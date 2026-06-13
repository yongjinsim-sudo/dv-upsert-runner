import * as vscode from 'vscode';
import { AttributeMetadataClient } from '../dataverse/attributeMetadataClient';
import { AttributeMutationClient } from '../dataverse/attributeMutationClient';
import { DataverseConnection, getDataverseConnection } from '../dataverse/dataverseConnection';
import { createInitialAttributeFactoryState } from '../product/attributeFactoryState';
import { ImportMode, KeyMode, UpsertPackageDraft, UpsertRowDraft } from '../product/attributeFactoryTypes';
import { validateDrafts } from '../product/attributeFactoryValidation';
import { buildAttributeFactoryViewModel } from '../product/attributeFactoryViewModelBuilder';
import { renderAttributeFactoryHtml } from '../webview/renderAttributeFactoryHtml';

const panelTitle = 'DV Bulk Upsert Runner';
const commandName = 'DV Bulk Upsert Runner';

type WebviewMessage = { command?: string; payload?: Record<string, unknown> };

function createRow(rowNumber: number, values: Record<string, unknown>): UpsertRowDraft {
	return { id: `${Date.now()}-${rowNumber}-${Math.random().toString(16).slice(2)}`, rowNumber, values };
}
function normaliseString(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function parseNumber(value: unknown, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
function clampBatchSize(value: unknown): number {
	const allowed = [100, 250, 500, 1000];
	const parsed = parseNumber(value, 250);
	return allowed.includes(parsed) ? parsed : 250;
}
function normaliseHeader(value: string): string { return value.replace(/^\uFEFF/, '').trim(); }
function sameCells(left: string[], right: string[]): boolean {
	return left.length === right.length && left.every((value, index) => value.trim().toLowerCase() === (right[index] ?? '').trim().toLowerCase());
}
function toCsvValue(value: unknown): string {
	const text = String(value ?? '');
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function parseCsvRecords(content: string): string[][] {
	const records: string[][] = [];
	let record: string[] = [];
	let current = '';
	let quoted = false;
	for (let index = 0; index < content.length; index += 1) {
		const character = content[index];
		if (character === '"') {
			if (quoted && content[index + 1] === '"') { current += '"'; index += 1; } else { quoted = !quoted; }
			continue;
		}
		if (character === ',' && !quoted) { record.push(current.trim()); current = ''; continue; }
		if ((character === '\n' || character === '\r') && !quoted) {
			if (character === '\r' && content[index + 1] === '\n') { index += 1; }
			record.push(current.trim()); current = '';
			if (record.some(value => value.length > 0)) { records.push(record); }
			record = [];
			continue;
		}
		current += character;
	}
	record.push(current.trim());
	if (record.some(value => value.length > 0)) { records.push(record); }
	return records;
}
function importCsv(content: string): UpsertRowDraft[] {
	const records = parseCsvRecords(content);
	if (records.length < 2) { return []; }
	const headers = records[0].map(header => normaliseHeader(header)).filter(Boolean);
	return records.slice(1)
		.filter(values => !sameCells(headers, values))
		.map((values, index) => {
			const rowValues: Record<string, unknown> = {};
			for (const [headerIndex, header] of headers.entries()) { rowValues[header] = values[headerIndex] ?? ''; }
			return createRow(index + 1, rowValues);
		});
}
function importJson(content: string): { rows: UpsertRowDraft[]; entity?: string; keyColumn?: string; keyMode?: KeyMode; importMode: ImportMode; trusted: boolean; sourceLabel?: string } {
	const parsed = JSON.parse(content) as unknown;
	if (Array.isArray(parsed)) {
		return { rows: parsed.map((item, index) => createRow(index + 1, item && typeof item === 'object' ? item as Record<string, unknown> : {})), importMode: 'GenericJson', trusted: false };
	}
	const object = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
	const rawRows = Array.isArray(object.records) ? object.records : Array.isArray(object.rows) ? object.rows : [];
	return {
		rows: rawRows.map((item, index) => createRow(index + 1, item && typeof item === 'object' ? item as Record<string, unknown> : {})),
		entity: normaliseString(object.entityLogicalName ?? object.entity),
		keyColumn: normaliseString(object.keyColumn ?? object.key),
		keyMode: normaliseString(object.keyMode).toLowerCase() === 'primaryid' ? 'PrimaryId' : 'AlternateKey',
		importMode: normaliseString(object.generatedBy).toLowerCase().includes('dv quick run') || normaliseString(object.source).toLowerCase() === 'dvqr' ? 'DvurPackage' : 'GenericJson',
		trusted: normaliseString(object.generatedBy).toLowerCase().includes('dv quick run') || normaliseString(object.source).toLowerCase() === 'dvqr',
		sourceLabel: normaliseString(object.generatedBy ?? object.sourceLabel ?? object.source)
	};
}
function buildJsonContent(draft: UpsertPackageDraft): string {
	return `${JSON.stringify({
		version: '1.0',
		source: draft.trustedSource ? 'DVQR' : 'Manual',
		entityLogicalName: draft.entityLogicalName,
		keyMode: draft.keyMode,
		keyColumn: draft.keyColumn,
		records: draft.rows.map(row => row.values)
	}, null, 2)}\n`;
}
function buildCsvContent(draft: UpsertPackageDraft): string {
	const headers = [...new Set(draft.rows.flatMap(row => Object.keys(row.values)))];
	if (!headers.length) { return 'accountnumber,name\n1001,Contoso\n'; }
	return `${headers.join(',')}\n${draft.rows.map(row => headers.map(header => toCsvValue(row.values[header])).join(',')).join('\n')}\n`;
}


function preservePendingOperations(statePending: { row: UpsertRowDraft; operation: string }[]): Map<string, string> {
	return new Map(statePending.map(change => [change.row.id, change.operation]));
}
function restorePendingOperations(statePending: { row: UpsertRowDraft; operation: string }[], operations: Map<string, string>): void {
	for (const change of statePending) {
		const operation = operations.get(change.row.id);
		if (operation === 'Create' || operation === 'Update' || operation === 'Unknown') {
			change.operation = operation;
		}
	}
}

export async function openAttributeFactoryCommand(context: vscode.ExtensionContext): Promise<void> {
	let connection: DataverseConnection | undefined;
	let metadataClient: AttributeMetadataClient | undefined;
	let mutationClient: AttributeMutationClient | undefined;
	const state = createInitialAttributeFactoryState();

	const panel = vscode.window.createWebviewPanel('dvUpsertRunner', panelTitle, vscode.ViewColumn.One, { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'images')] });
	const logoUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'images', 'dv-utilities-icon-128.png'));

	function updateValidation(): void {
		const result = validateDrafts(state.draft, state.entities, state.entityAttributes, state.entityKeys);
		state.validationIssues = result.issues;
		state.pendingChanges = result.pendingChanges;
	}
	function render(): void {
		panel.webview.html = renderAttributeFactoryHtml(buildAttributeFactoryViewModel(state), { logoUri: logoUri.toString(), cspSource: panel.webview.cspSource });
	}
	async function connect(forcePick = false): Promise<void> {
		try {
			state.message = { kind: 'Info', text: 'Connecting to Dataverse...' }; render();
			connection = await getDataverseConnection(context, { forcePick });
			if (!connection) { state.message = { kind: 'Warning', text: 'Connection cancelled.' }; render(); return; }
			metadataClient = new AttributeMetadataClient(connection.client);
			mutationClient = new AttributeMutationClient(connection.client);
			state.environment = { label: connection.environmentLabel, url: connection.environmentUrl, state: 'Connected', safety: 'Grey', safetyLabel: 'Connected' };
			state.entities = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `${commandName}: Loading Dataverse tables`, cancellable: false }, () => metadataClient!.listEntities());
			state.entityAttributes = [];
			state.entityKeys = [];
			updateValidation();
			state.message = { kind: 'Info', text: `Connected to ${connection.environmentLabel}. ${state.entities.length} table(s) loaded.` };
			render();
		} catch (error) { state.message = { kind: 'Error', text: error instanceof Error ? error.message : String(error) }; render(); }
	}

	async function refreshMetadata(): Promise<void> {
		if (!connection || !metadataClient) { await connect(false); return; }
		state.message = { kind: 'Info', text: 'Refreshing Dataverse metadata...' }; render();
		state.entities = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `${commandName}: Refreshing Dataverse tables`, cancellable: false }, () => metadataClient!.listEntities());
		state.entityAttributes = [];
		state.entityKeys = [];
		updateValidation();
		state.message = { kind: 'Info', text: `Refreshed ${state.entities.length} table(s) from ${state.environment.label}.` };
		render();
	}
	async function resolveEntitySetName(): Promise<void> {
		const logicalName = state.draft.entityLogicalName.trim();
		const entity = state.entities.find(item => item.logicalName.toLowerCase() === logicalName.toLowerCase()) ?? await metadataClient?.getEntity(logicalName);
		state.draft.entitySetName = entity?.entitySetName ?? '';
		if (metadataClient && logicalName && entity) {
			try {
				const [attributes, keys] = await Promise.all([metadataClient.listAttributes(logicalName), metadataClient.listKeys(logicalName)]);
				state.entityAttributes = attributes;
				state.entityKeys = keys;
				if (!state.draft.keyColumn.trim()) {
					if (state.draft.keyMode === 'PrimaryId') {
						state.draft.keyColumn = entity.primaryIdAttribute ?? '';
					} else {
						state.draft.keyColumn = keys.find(key => key.isActive && key.keyAttributes.length === 1)?.keyAttributes[0] ?? '';
					}
				}
			} catch {
				state.entityAttributes = [];
				state.entityKeys = [];
			}
		} else if (!logicalName) {
			state.entityAttributes = [];
			state.entityKeys = [];
		}
	}
	async function importCsvFromFile(): Promise<void> {
		const picked = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { CSV: ['csv'] }, openLabel: 'Import CSV' });
		if (!picked?.[0]) { return; }
		const content = Buffer.from(await vscode.workspace.fs.readFile(picked[0])).toString('utf8');
		state.draft.rows = importCsv(content);
		state.draft.importMode = 'GenericCsv'; state.draft.trustedSource = false; state.draft.sourceLabel = 'CSV import'; state.draft.imported = true;
		state.executionResults = []; state.executionProgress = undefined; state.previewOpen = false; updateValidation();
		state.message = { kind: 'Info', text: `${state.draft.rows.length} row(s) imported from CSV.` }; render();
	}
	async function importJsonFromFile(): Promise<void> {
		const picked = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { JSON: ['json'] }, openLabel: 'Import JSON / DVUR Package' });
		if (!picked?.[0]) { return; }
		const content = Buffer.from(await vscode.workspace.fs.readFile(picked[0])).toString('utf8');
		const imported = importJson(content);
		state.draft.rows = imported.rows;
		if (imported.entity) { state.draft.entityLogicalName = imported.entity; }
		if (imported.keyColumn) { state.draft.keyColumn = imported.keyColumn; }
		if (imported.keyMode) { state.draft.keyMode = imported.keyMode; }
		state.draft.importMode = imported.importMode; state.draft.trustedSource = imported.trusted; state.draft.sourceLabel = imported.sourceLabel || (imported.trusted ? 'DVQR package' : 'JSON import'); state.draft.imported = true;
		await resolveEntitySetName(); state.executionResults = []; state.executionProgress = undefined; state.previewOpen = false; updateValidation();
		state.message = { kind: 'Info', text: `${state.draft.rows.length} row(s) imported from ${imported.trusted ? 'trusted DVQR package' : 'JSON'}.` }; render();
	}
	async function exportJson(): Promise<void> {
		const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file('dv-upsert-runner-package.dvur.json'), filters: { JSON: ['json'] }, saveLabel: 'Export DVUR Package' });
		if (!uri) { return; }
		await vscode.workspace.fs.writeFile(uri, Buffer.from(buildJsonContent(state.draft), 'utf8'));
		state.message = { kind: 'Info', text: `${state.draft.rows.length} row(s) exported to JSON.` }; render();
	}
	async function exportCsv(): Promise<void> {
		const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file('dv-upsert-runner-records.csv'), filters: { CSV: ['csv'] }, saveLabel: 'Export CSV' });
		if (!uri) { return; }
		await vscode.workspace.fs.writeFile(uri, Buffer.from(buildCsvContent(state.draft), 'utf8'));
		state.message = { kind: 'Info', text: `${state.draft.rows.length} row(s) exported to CSV.` }; render();
	}
	async function buildPreview(): Promise<void> {
		await resolveEntitySetName();
		updateValidation();
		state.executionResults = [];
		state.executionProgress = undefined;
		state.previewOpen = true;
		const unresolved = state.pendingChanges.filter(change => change.operation === 'Unknown').length;
		state.message = { kind: unresolved ? 'Warning' : 'Info', text: unresolved ? `Package preview ready. Check creates / updates before applying ${unresolved} unresolved row(s).` : 'Package preview ready.' };
		render();
	}

	async function checkCreatesUpdates(): Promise<void> {
		await resolveEntitySetName();
		updateValidation();
		state.previewOpen = true;
		if (state.validationIssues.some(issue => issue.severity === 'Error')) { state.executionProgress = undefined; state.message = { kind: 'Error', text: 'Resolve validation errors before checking creates / updates.' }; render(); return; }
		if (!state.pendingChanges.length) { state.executionProgress = undefined; state.message = { kind: 'Warning', text: 'No rows are ready to check.' }; render(); return; }
		if (!metadataClient || !mutationClient) { state.executionProgress = undefined; state.message = { kind: 'Warning', text: 'Connect to Dataverse before checking creates / updates.' }; render(); return; }
		if (!state.draft.entitySetName) { state.executionProgress = undefined; state.message = { kind: 'Warning', text: 'Resolve the Dataverse table before checking creates / updates.' }; render(); return; }

		const entity = state.entities.find(item => item.logicalName.toLowerCase() === state.draft.entityLogicalName.trim().toLowerCase()) ?? await metadataClient.getEntity(state.draft.entityLogicalName.trim());
		if (!entity) { state.executionProgress = undefined; state.message = { kind: 'Error', text: `Entity ${state.draft.entityLogicalName} could not be resolved.` }; render(); return; }

		const startedAt = Date.now();
		state.executionProgress = {
			running: true,
			phase: 'Preview',
			processed: 0,
			total: state.pendingChanges.length,
			batchIndex: 0,
			batchCount: 1,
			applied: 0,
			failed: 0,
			startedAt
		};
		state.message = { kind: 'Info', text: `Checking ${state.pendingChanges.length} row(s). Detecting creates and updates...` };
		render();

		for (const [index, change] of state.pendingChanges.entries()) {
			try {
				change.operation = await mutationClient.detectOperation(entity, state.draft, change.row);
			} catch {
				change.operation = 'Unknown';
			}
			const processed = index + 1;
			if (processed % 25 === 0 || processed === state.pendingChanges.length) {
				state.executionProgress = {
					running: true,
					phase: 'Preview',
					processed,
					total: state.pendingChanges.length,
					batchIndex: 1,
					batchCount: 1,
					applied: 0,
					failed: 0,
					startedAt
				};
				state.message = { kind: 'Info', text: `Checking creates / updates. ${processed}/${state.pendingChanges.length} row(s) classified.` };
				render();
			}
		}

		state.executionProgress = undefined;
		const creates = state.pendingChanges.filter(change => change.operation === 'Create').length;
		const updates = state.pendingChanges.filter(change => change.operation === 'Update').length;
		const unknown = state.pendingChanges.filter(change => change.operation === 'Unknown').length;
		state.message = { kind: unknown ? 'Warning' : 'Info', text: `Check complete. ${creates} create(s), ${updates} update(s), ${unknown} unresolved.` };
		render();
	}



	function getSkippedRows(): UpsertRowDraft[] {
		const processedIds = new Set(state.executionResults.map(result => result.rowId));
		const explicitSkippedIds = new Set(state.executionProgress?.skippedRowIds ?? []);
		return state.draft.rows.filter(row => explicitSkippedIds.has(row.id) || (!processedIds.has(row.id) && (state.executionProgress?.cancelled ?? false)));
	}
	async function exportSkippedRows(): Promise<void> {
		const skippedRows = getSkippedRows();
		if (!skippedRows.length) { state.message = { kind: 'Info', text: 'No skipped rows to export.' }; render(); return; }
		const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file('dv-upsert-runner-skipped.dvur.json'), filters: { JSON: ['json'] }, saveLabel: 'Export Skipped Rows' });
		if (!uri) { return; }
		const exportDraft = { ...state.draft, rows: skippedRows };
		await vscode.workspace.fs.writeFile(uri, Buffer.from(buildJsonContent(exportDraft), 'utf8'));
		state.message = { kind: 'Info', text: `${skippedRows.length} skipped row(s) exported.` }; render();
	}
	async function requeueSkippedRows(): Promise<void> {
		const skippedRows = getSkippedRows();
		if (!skippedRows.length) { state.message = { kind: 'Info', text: 'No skipped rows to requeue.' }; render(); return; }
		state.draft.rows = skippedRows.map((row, index) => createRow(index + 1, row.values));
		state.draft.imported = true;
		state.draft.sourceLabel = 'Requeued skipped rows';
		state.executionResults = [];
		state.executionProgress = undefined;
		state.previewOpen = false;
		updateValidation();
		state.message = { kind: 'Info', text: `${state.draft.rows.length} skipped row(s) requeued. Run Preview and Check Creates / Updates before applying.` };
		render();
	}

	async function exportFailedRows(): Promise<void> {
		const failedIds = new Set(state.executionResults.filter(result => result.status === 'Failed').map(result => result.rowId));
		const failedRows = state.draft.rows.filter(row => failedIds.has(row.id));
		if (!failedRows.length) { state.message = { kind: 'Info', text: 'No failed rows to export.' }; render(); return; }
		const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file('dv-upsert-runner-failures.dvur.json'), filters: { JSON: ['json'] }, saveLabel: 'Export Failed Rows' });
		if (!uri) { return; }
		const exportDraft = { ...state.draft, rows: failedRows };
		await vscode.workspace.fs.writeFile(uri, Buffer.from(buildJsonContent(exportDraft), 'utf8'));
		state.message = { kind: 'Info', text: `${failedRows.length} failed row(s) exported.` }; render();
	}
	async function requeueFailedRows(): Promise<void> {
		const failedIds = new Set(state.executionResults.filter(result => result.status === 'Failed').map(result => result.rowId));
		const failedRows = state.draft.rows.filter(row => failedIds.has(row.id));
		if (!failedRows.length) { state.message = { kind: 'Info', text: 'No failed rows to requeue.' }; render(); return; }
		state.draft.rows = failedRows.map((row, index) => createRow(index + 1, row.values));
		state.draft.imported = true;
		state.draft.sourceLabel = 'Requeued failed rows';
		state.executionResults = [];
		state.executionProgress = undefined;
		state.previewOpen = false;
		updateValidation();
		state.message = { kind: 'Info', text: `${state.draft.rows.length} failed row(s) requeued for review.` };
		render();
	}
	async function applyUpsert(): Promise<void> {
		if (!mutationClient || !metadataClient) { state.message = { kind: 'Warning', text: 'Connect to Dataverse before applying rows.' }; render(); return; }
		const preservedOperations = preservePendingOperations(state.pendingChanges);
		updateValidation();
		restorePendingOperations(state.pendingChanges, preservedOperations);
		if (state.validationIssues.some(issue => issue.severity === 'Error')) { state.message = { kind: 'Error', text: 'Resolve validation errors before applying rows.' }; render(); return; }
		if (!state.pendingChanges.length) { state.message = { kind: 'Warning', text: 'No rows are ready to apply.' }; render(); return; }
		if (state.pendingChanges.some(change => change.operation === 'Unknown')) { state.message = { kind: 'Warning', text: 'Run Check Creates / Updates before applying unresolved rows.' }; render(); return; }

		const confirmed = await vscode.window.showWarningMessage(`Apply ${state.pendingChanges.length} upsert row(s) to ${state.environment.label}?`, { modal: true }, 'Apply Upserts');
		if (confirmed !== 'Apply Upserts') { return; }

		const entity = state.entities.find(item => item.logicalName.toLowerCase() === state.draft.entityLogicalName.trim().toLowerCase()) ?? await metadataClient.getEntity(state.draft.entityLogicalName.trim());
		if (!entity) { state.message = { kind: 'Error', text: `Entity ${state.draft.entityLogicalName} could not be resolved.` }; render(); return; }

		state.cancelAfterCurrentBatch = false;
		state.executionResults = [];
		state.executionProgress = { running: true, phase: 'Apply', processed: 0, total: state.pendingChanges.length, batchIndex: 1, batchCount: Math.ceil(state.pendingChanges.length / state.draft.batchSize), applied: 0, failed: 0, startedAt: Date.now() };
		state.message = { kind: 'Info', text: 'Applying Dataverse upserts...' };
		render();

		state.executionResults = await mutationClient.upsertRows(entity, state.draft, state.pendingChanges.map(change => change.row), async progress => {
			state.executionProgress = { ...progress, stopRequested: state.cancelAfterCurrentBatch || progress.stopRequested };
			state.message = { kind: 'Info', text: state.cancelAfterCurrentBatch ? `Stop requested. Finishing batch ${progress.batchIndex} of ${progress.batchCount}.` : `Applying batch ${progress.batchIndex} of ${progress.batchCount}. ${progress.processed}/${progress.total} row(s) processed.` };
			render();
		}, () => state.cancelAfterCurrentBatch);

		state.previewOpen = false;
		const completedAt = Date.now();
		const startedAt = state.executionProgress?.startedAt;
		const total = state.pendingChanges.length;
		const applied = state.executionResults.filter(item => item.status === 'Applied').length;
		const failed = state.executionResults.filter(item => item.status === 'Failed').length;
		const skipped = Math.max(0, total - state.executionResults.length);
		const processedIds = new Set(state.executionResults.map(result => result.rowId));
		const skippedRowIds = state.pendingChanges.filter(change => !processedIds.has(change.row.id)).map(change => change.row.id);
		const cancelled = state.cancelAfterCurrentBatch && skipped > 0;
		state.executionProgress = {
			running: false,
			phase: 'Apply',
			processed: state.executionResults.length,
			total,
			batchIndex: Math.min(Math.ceil(state.executionResults.length / state.draft.batchSize), Math.ceil(total / state.draft.batchSize)),
			batchCount: Math.ceil(total / state.draft.batchSize),
			applied,
			failed,
			startedAt,
			completedAt,
			cancelled,
			skipped,
			skippedRowIds
		};
		state.cancelAfterCurrentBatch = false;
		state.message = { kind: cancelled ? 'Warning' : 'Info', text: `${applied} row(s) applied. ${failed} failed.${skipped ? ` ${skipped} skipped after cancellation.` : ''}` };
		render();
	}


	panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
		try {
			switch (message.command) {
				case 'connect': await connect(false); break;
				case 'switchEnvironment': await connect(true); break;
				case 'refreshMetadata': await refreshMetadata(); break;
				case 'updateDraft': {
					const field = normaliseString(message.payload?.field) as keyof UpsertPackageDraft;
					const rawValue = message.payload?.value;
					if (field === 'batchSize') { state.draft.batchSize = clampBatchSize(rawValue); }
					else if (field === 'trustedSource') { state.draft.trustedSource = Boolean(rawValue); }
					else if (field === 'keyMode') { state.draft.keyMode = (rawValue === 'PrimaryId' ? 'PrimaryId' : 'AlternateKey'); state.draft.keyColumn = ''; }
					else if (field === 'entityLogicalName' || field === 'keyColumn') { (state.draft[field] as string) = String(rawValue ?? ''); if (field === 'entityLogicalName') { state.entityAttributes = []; state.entityKeys = []; state.draft.entitySetName = ''; state.draft.keyColumn = ''; } }
					state.executionResults = []; updateValidation(); render(); break;
				}
				case 'importCsv': await importCsvFromFile(); break;
				case 'importJson': await importJsonFromFile(); break;
				case 'exportCsv': await exportCsv(); break;
				case 'exportJson': await exportJson(); break;
				case 'exportFailures': await exportFailedRows(); break;
				case 'requeueFailures': await requeueFailedRows(); break;
				case 'exportSkipped': await exportSkippedRows(); break;
				case 'requeueSkipped': await requeueSkippedRows(); break;
				case 'validate': await resolveEntitySetName(); updateValidation(); state.message = { kind: state.validationIssues.some(issue => issue.severity === 'Error') ? 'Error' : 'Info', text: `${state.validationIssues.length} validation issue(s) found.` }; render(); break;
				case 'openPreview': await buildPreview(); break;
				case 'checkOperations': await checkCreatesUpdates(); break;
				case 'cancelPreview': state.previewOpen = false; render(); break;
				case 'applyAndPublish': await applyUpsert(); break;
				case 'requestCancelRun': state.cancelAfterCurrentBatch = true; if (state.executionProgress?.running) { state.executionProgress = { ...state.executionProgress, stopRequested: true }; state.message = { kind: 'Warning', text: 'Stop requested. DVUR will finish the current batch and skip remaining batches.' }; render(); } break;
				case 'clearDrafts': state.draft.rows = []; state.draft.imported = false; state.draft.sourceLabel = ''; state.entityAttributes = []; state.entityKeys = []; state.executionResults = []; state.executionProgress = undefined; state.previewOpen = false; updateValidation(); render(); break;
			}
		} catch (error) { state.message = { kind: 'Error', text: error instanceof Error ? error.message : String(error) }; render(); }
	});

	state.message = { kind: 'Info', text: 'Choose Connect to load Dataverse metadata, or import CSV / JSON first and connect before preview/apply.' };
	render();
}

