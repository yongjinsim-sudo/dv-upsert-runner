import { escapeHtml } from '../shared/escaping';
import { AttributeFactoryViewModel, UpsertRowDraft } from '../product/attributeFactoryTypes';
import { attributeFactoryScript } from './attributeFactoryScript';
import { attributeFactoryStyles } from './attributeFactoryStyles';

type RenderOptions = { logoUri: string; cspSource: string };

function getEnvironmentPillClass(viewModel: AttributeFactoryViewModel): string {
	if (viewModel.environment.safety === 'Red') { return 'danger'; }
	if (viewModel.environment.safety === 'Amber') { return 'warning'; }
	if (viewModel.environment.safety === 'Grey') { return 'grey'; }
	return 'accent';
}
function getApplyButtonClass(viewModel: AttributeFactoryViewModel): string {
	if (viewModel.environment.safety === 'Red') { return 'danger-primary'; }
	if (viewModel.environment.safety === 'Amber') { return 'warning-primary'; }
	return 'primary';
}
function getPreviewCardClass(viewModel: AttributeFactoryViewModel): string {
	if (viewModel.environment.safety === 'Red') { return 'danger-preview'; }
	if (viewModel.environment.safety === 'Amber') { return 'warning-preview'; }
	return 'grey-preview';
}
function getApplyWarningText(viewModel: AttributeFactoryViewModel): string {
	if (viewModel.environment.safety === 'Red') { return 'Production-class environment detected. Review carefully before applying data changes.'; }
	if (viewModel.environment.safety === 'Amber') { return 'Controlled non-production environment detected. Review staged upserts before applying.'; }
	return 'Rows are staged locally. Dataverse data only changes after explicit apply.';
}
function input(field: string, value: unknown, extra = ''): string {
	return `<input ${extra} value="${escapeHtml(String(value ?? ''))}" data-command="updateDraft" data-field="${escapeHtml(field)}">`;
}
function select(field: string, values: string[], selected: string): string {
	return `<select data-command="updateDraft" data-field="${escapeHtml(field)}">${values.map(value => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select>`;
}
function keyColumnSelector(viewModel: AttributeFactoryViewModel): string {
	const selectedEntity = viewModel.entities.find(entity => entity.logicalName === viewModel.draft.entityLogicalName);
	if (viewModel.draft.keyMode === 'PrimaryId') {
		const primaryId = selectedEntity?.primaryIdAttribute || viewModel.draft.keyColumn;
		if (!primaryId) { return input('keyColumn', viewModel.draft.keyColumn, 'placeholder="primary id column"'); }
		return `<select data-command="updateDraft" data-field="keyColumn"><option value="${escapeHtml(primaryId)}"${primaryId === viewModel.draft.keyColumn ? ' selected' : ''}>${escapeHtml(primaryId)}${selectedEntity?.displayName ? ` — ${escapeHtml(selectedEntity.displayName)} primary id` : ' — Primary ID'}</option></select>`;
	}

	const activeSingleColumnKeys = viewModel.entityKeys.filter(key => key.isActive && key.keyAttributes.length === 1);
	if (!viewModel.draft.entityLogicalName || !viewModel.entityAttributes.length) {
		return input('keyColumn', viewModel.draft.keyColumn, 'placeholder="select entity first"');
	}
	if (!activeSingleColumnKeys.length) {
		const current = viewModel.draft.keyColumn.trim();
		return `<select data-command="updateDraft" data-field="keyColumn">${current ? `<option value="${escapeHtml(current)}" selected>${escapeHtml(current)} — not an active alternate key</option>` : ''}<option value=""${current ? '' : ' selected'}>No active single-column alternate keys</option></select>`;
	}
	const hasSelected = activeSingleColumnKeys.some(key => key.keyAttributes[0].toLowerCase() === viewModel.draft.keyColumn.toLowerCase());
	return `<select data-command="updateDraft" data-field="keyColumn">${hasSelected ? '' : `<option value="${escapeHtml(viewModel.draft.keyColumn)}" selected>${escapeHtml(viewModel.draft.keyColumn || 'Select key...')}${viewModel.draft.keyColumn ? ' — not active for this table' : ''}</option>`}${activeSingleColumnKeys.map(key => { const column = key.keyAttributes[0]; const label = `${key.displayName || key.logicalName} — ${column}`; return `<option value="${escapeHtml(column)}"${column.toLowerCase() === viewModel.draft.keyColumn.toLowerCase() ? ' selected' : ''}>${escapeHtml(label)}</option>`; }).join('')}</select>`;
}

function entitySelector(viewModel: AttributeFactoryViewModel): string {
	if (!viewModel.entities.length) {
		return input('entityLogicalName', viewModel.draft.entityLogicalName, 'placeholder="account"');
	}
	const hasSelected = viewModel.entities.some(entity => entity.logicalName === viewModel.draft.entityLogicalName);
	return `<select data-command="updateDraft" data-field="entityLogicalName">${hasSelected ? '' : `<option value="${escapeHtml(viewModel.draft.entityLogicalName)}">${escapeHtml(viewModel.draft.entityLogicalName || 'Select table...')}</option>`}${viewModel.entities.map(entity => `<option value="${escapeHtml(entity.logicalName)}"${entity.logicalName === viewModel.draft.entityLogicalName ? ' selected' : ''}>${escapeHtml(entity.logicalName)}${entity.displayName ? ` — ${escapeHtml(entity.displayName)}` : ''}</option>`).join('')}</select>`;
}
function renderPackageSource(viewModel: AttributeFactoryViewModel): string {
	if (!viewModel.draft.imported) { return ''; }
	if (viewModel.draft.trustedSource) {
		return `<span class="dv-pill success">Trusted DVQR package</span>`;
	}
	if (viewModel.draft.importMode === 'GenericJson') { return `<span class="dv-pill grey">JSON import</span>`; }
	if (viewModel.draft.importMode === 'GenericCsv') { return `<span class="dv-pill grey">CSV import</span>`; }
	return `<span class="dv-pill grey">Generic import</span>`;
}
function rowKeyValue(row: UpsertRowDraft, keyColumn: string): unknown {
	const key = Object.keys(row.values).find(item => item.toLowerCase() === keyColumn.toLowerCase());
	return key ? row.values[key] : undefined;
}
function formatElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
function formatRate(processed: number, elapsedMs: number): string {
	if (!elapsedMs || elapsedMs <= 0) { return '—'; }
	return `${(processed / (elapsedMs / 1000)).toFixed(2)} rows/sec`; 
}
function formatEta(processed: number, total: number, elapsedMs: number): string {
	if (!processed || !elapsedMs || processed >= total) { return '—'; }
	const ratePerMs = processed / elapsedMs;
	const remainingMs = (total - processed) / ratePerMs;
	return formatElapsed(remainingMs);
}
function renderFields(row: UpsertRowDraft): string {
	return Object.entries(row.values).map(([key, value]) => `<div><strong>${escapeHtml(key)}</strong><span>${escapeHtml(String(value ?? ''))}</span></div>`).join('');
}
function compactName(row: UpsertRowDraft): string {
	const nameKey = Object.keys(row.values).find(key => key.toLowerCase().endsWith('_name') || key.toLowerCase() === 'name');
	const value = nameKey ? row.values[nameKey] : undefined;
	return value === undefined || value === null || String(value).trim() === '' ? 'No display value' : String(value);
}
function compactRowTitle(row: UpsertRowDraft, keyColumn: string): string {
	const keyValue = rowKeyValue(row, keyColumn);
	return `Row ${escapeHtml(row.rowNumber)}${keyValue !== undefined ? ` • ${escapeHtml(String(keyValue))}` : ''}`;
}
function renderCompactRow(row: UpsertRowDraft, viewModel: AttributeFactoryViewModel, badge?: string, badgeClass = 'grey'): string {
	const fieldCount = Object.keys(row.values).length;
	return `<div class="dv-operation dv-compact-row"><div class="dv-row-content"><strong>${compactRowTitle(row, viewModel.draft.keyColumn)}</strong><p>${escapeHtml(compactName(row))}</p><details><summary>View ${escapeHtml(fieldCount)} field(s)</summary><div class="dv-field-grid">${renderFields(row)}</div></details></div>${badge ? `<span class="dv-pill ${badgeClass}">${escapeHtml(badge)}</span>` : `<span class="dv-pill grey">${escapeHtml(fieldCount)} field(s)</span>`}</div>`;
}

function renderRowPreview(viewModel: AttributeFactoryViewModel): string {
	const rows = viewModel.draft.rows.slice(0, 5);
	if (!rows.length) { return '<div class="dv-empty">Import CSV, JSON, or a DVUR package to begin.</div>'; }
	return `<h3 class="dv-subheading">Sample preview</h3><div class="dv-list">${rows.map(row => renderCompactRow(row, viewModel)).join('')}${viewModel.draft.rows.length > rows.length ? `<div class="dv-empty">Showing first ${rows.length} of ${viewModel.draft.rows.length} rows. Expand a row only when you need the full payload.</div>` : ''}</div>`;
}
function renderImportSummary(viewModel: AttributeFactoryViewModel): string {
	if (!viewModel.draft.imported) { return ''; }
	return `<div class="dv-preview-grid dv-import-summary">
		<div><span>Source</span><strong>${viewModel.draft.trustedSource ? 'Trusted DVQR Package' : viewModel.draft.importMode === 'GenericJson' ? 'JSON' : 'CSV'}</strong><em>${escapeHtml(viewModel.draft.sourceLabel || 'Imported package')}</em></div>
		<div><span>Records</span><strong>${escapeHtml(viewModel.summary.recordCount)}</strong><em>Imported single-entity rows</em></div>
		<div><span>Columns</span><strong>${escapeHtml(viewModel.summary.columnCount)}</strong><em>Detected fields in import</em></div>
		<div><span>Entity / Key</span><strong>${escapeHtml(viewModel.draft.entityLogicalName || 'Not selected')}</strong><em>${escapeHtml(viewModel.draft.keyMode)} • ${escapeHtml(viewModel.draft.keyColumn || 'No key')}</em></div>
	</div>`;
}
function isPreviewReady(viewModel: AttributeFactoryViewModel): boolean {
	return viewModel.draft.imported
		&& viewModel.draft.rows.length > 0
		&& viewModel.draft.entityLogicalName.trim().length > 0
		&& viewModel.draft.keyMode.trim().length > 0
		&& viewModel.draft.keyColumn.trim().length > 0;
}
function renderFooterNote(viewModel: AttributeFactoryViewModel, unresolved: number): string {
	if (viewModel.executionProgress?.cancelled && (viewModel.executionProgress.skipped ?? 0) > 0) {
		return `${viewModel.executionProgress.applied} applied. ${viewModel.executionProgress.skipped ?? 0} available for requeue or export.`;
	}
	if (unresolved > 0) { return 'Create/update state unresolved. Run Check Creates / Updates before applying.'; }
	return `Classification complete. Ready to apply ${viewModel.pendingChanges.length} upserts.`;
}
function renderPreview(viewModel: AttributeFactoryViewModel): string {
	if (!viewModel.previewOpen) { return ''; }
	const hasErrors = viewModel.summary.errorCount > 0;
	const applyButtonClass = getApplyButtonClass(viewModel);
	const unresolved = viewModel.pendingChanges.filter(change => change.operation === 'Unknown').length;
	const isConnected = viewModel.environment.state === 'Connected';
	const canCheck = isConnected && !hasErrors && !!viewModel.pendingChanges.length && !viewModel.executionProgress?.running;
	const canApply = !hasErrors && unresolved === 0 && !!viewModel.pendingChanges.length && !viewModel.executionProgress?.running;
	const previewNote = unresolved > 0 ? renderFooterNote(viewModel, unresolved) : `${renderFooterNote(viewModel, unresolved)} ${getApplyWarningText(viewModel)}`;
	const checkLabel = isConnected ? `Check Creates / Updates` : 'Connect to Check Creates / Updates';
	return `<section class="dv-card dv-section dv-preview-card ${getPreviewCardClass(viewModel)}">
		<div class="dv-section-header">
			<div><div class="dv-kicker">Data operation preview</div><h2>Preview upserts</h2><p>Review the package locally, then check Dataverse to classify creates and updates before applying.</p></div>
			<span class="dv-pill warning">Preview-first</span>
		</div>
		<div class="dv-preview-grid">
			<div><span>Environment</span><strong>${escapeHtml(viewModel.environment.label)}</strong><em>${escapeHtml(viewModel.environment.safetyLabel)}</em></div>
			<div><span>Records</span><strong>${escapeHtml(viewModel.summary.pendingChangeCount)}</strong><em>${escapeHtml(viewModel.summary.errorCount)} error(s), ${escapeHtml(viewModel.summary.warningCount)} warning(s)</em></div>
			<div><span>Execution plan</span><strong>${escapeHtml(viewModel.summary.batchCount)} batch(es)</strong><em>Batch size ${escapeHtml(viewModel.draft.batchSize)}</em></div>
		</div>
		<div class="dv-preview-grid">
			<div><span>Creates</span><strong>${escapeHtml(viewModel.summary.createCount)}</strong><em>After Dataverse check</em></div>
			<div><span>Updates</span><strong>${escapeHtml(viewModel.summary.updateCount)}</strong><em>After Dataverse check</em></div>
			<div><span>Unresolved</span><strong>${escapeHtml(unresolved)}</strong><em>${unresolved ? 'Check required before apply' : 'Ready to apply'}</em></div>
		</div>
		<div class="dv-list dv-scroll-list">${viewModel.pendingChanges.slice(0, 5).map(change => renderCompactRow(change.row, viewModel, change.operation, change.operation === 'Create' ? 'success' : change.operation === 'Update' ? 'warning' : 'grey')).join('') || '<div class="dv-empty">No valid rows ready for preview.</div>'}${viewModel.pendingChanges.length > 5 ? `<div class="dv-empty">Showing first 5 of ${escapeHtml(viewModel.pendingChanges.length)} preview rows. Full row-level detail is kept for failures.</div>` : ''}</div>
		<div class="dv-preview-note">${escapeHtml(previewNote)}</div>
		<div class="dv-actions" style="margin-top:12px"><button class="secondary" data-command="cancelPreview">Cancel preview</button><button class="secondary" ${canCheck ? '' : 'disabled'} data-command="checkOperations">${escapeHtml(checkLabel)}</button><button class="${applyButtonClass}" ${canApply ? '' : 'disabled'} data-command="applyAndPublish">Apply ${escapeHtml(viewModel.pendingChanges.length)} Upserts</button></div>
	</section>`;
}
function renderProgress(viewModel: AttributeFactoryViewModel): string {
	const progress = viewModel.executionProgress;
	if (!progress?.running) { return ''; }
	const pct = progress.total ? Math.round((progress.processed / progress.total) * 100) : 0;
	const elapsedMs = progress.startedAt ? Date.now() - progress.startedAt : 0;
	const elapsed = formatElapsed(elapsedMs);
	const throughput = formatRate(progress.processed, elapsedMs);
	const eta = formatEta(progress.processed, progress.total, elapsedMs);
	const isPreview = progress.phase === 'Preview';
	const title = isPreview ? 'Checking creates / updates' : 'Applying upserts';
	const unresolved = viewModel.pendingChanges.filter(change => change.operation === 'Unknown').length;
	const subText = isPreview
		? `${escapeHtml(progress.processed)} of ${escapeHtml(progress.total)} rows checked against Dataverse.`
		: `Batch ${escapeHtml(progress.batchIndex)} of ${escapeHtml(progress.batchCount)}. ${escapeHtml(progress.processed)} of ${escapeHtml(progress.total)} rows processed.`;
	const stopNote = progress.stopRequested ? '<div class="dv-preview-note">Stop requested. DVUR will finish the current batch and skip remaining batches.</div>' : '';
	const cancelAction = !isPreview ? `<div class="dv-actions" style="margin-top:12px"><button class="secondary" ${progress.stopRequested ? 'disabled' : ''} data-command="requestCancelRun">${progress.stopRequested ? 'Stop requested' : 'Cancel after current batch'}</button></div>` : '';
	const middleCards = isPreview
		? `<div><span>Creates</span><strong>${escapeHtml(viewModel.summary.createCount)}</strong><em>Detected so far</em></div><div><span>Updates</span><strong>${escapeHtml(viewModel.summary.updateCount)}</strong><em>Detected so far</em></div><div><span>Unresolved</span><strong>${escapeHtml(unresolved)}</strong><em>Remaining rows</em></div>`
		: `<div><span>Applied</span><strong>${escapeHtml(progress.applied)}</strong><em>Successful rows</em></div><div><span>Failed</span><strong>${escapeHtml(progress.failed)}</strong><em>Collected for review</em></div>`;
	return `<section class="dv-card dv-section"><div class="dv-section-header"><div><h2>${title}</h2><p>${subText}</p></div><span class="dv-pill warning">${progress.stopRequested ? 'Stopping' : 'Running'}</span></div><div class="dv-progress"><div style="width:${pct}%"></div></div><div class="dv-preview-grid"><div><span>Processed</span><strong>${escapeHtml(progress.processed)} / ${escapeHtml(progress.total)}</strong><em>${escapeHtml(pct)}%</em></div>${middleCards}<div><span>Elapsed</span><strong>${escapeHtml(elapsed)}</strong><em>Wall-clock time</em></div><div><span>Throughput</span><strong>${escapeHtml(throughput)}</strong><em>Rows processed</em></div><div><span>ETA</span><strong>${escapeHtml(eta)}</strong><em>Estimated remaining</em></div></div>${stopNote}${cancelAction}</section>`;
}


type NormalizedFailure = {
	category: string;
	summary: string;
	field?: string;
	value?: string;
	expected?: string;
	action?: string;
	httpStatus?: string;
	technical: string;
};

function firstMatch(text: string, pattern: RegExp): string | undefined {
	const match = text.match(pattern);
	return match?.[1];
}
function extractHttpStatus(message: string): string | undefined {
	const status = firstMatch(message, /Dataverse error\s+(\d{3})/i);
	return status ? `${status} ${status === '400' ? 'Bad Request' : 'Dataverse response'}` : undefined;
}
function dataverseTypeLabel(expectedType: string): string {
	const normalised = expectedType.replace('Edm.', '');
	switch (normalised.toLowerCase()) {
		case 'int32': return 'Whole Number (Int32)';
		case 'int64': return 'Big Integer (Int64)';
		case 'decimal': return 'Decimal Number';
		case 'double': return 'Floating Point Number';
		case 'boolean': return 'Boolean';
		case 'datetimeoffset': return 'Date/Time';
		case 'guid': return 'GUID';
		default: return normalised;
	}
}
function attributeMatchesExpectedType(attributeType: string | undefined, expectedType: string): boolean {
	const expected = expectedType.toLowerCase();
	const attribute = (attributeType ?? '').toLowerCase();
	if (expected.includes('int32')) { return attribute === 'integer' || attribute === 'picklist' || attribute === 'state' || attribute === 'status'; }
	if (expected.includes('int64')) { return attribute === 'bigint'; }
	if (expected.includes('decimal')) { return attribute === 'decimal' || attribute === 'money'; }
	if (expected.includes('double')) { return attribute === 'double'; }
	if (expected.includes('boolean')) { return attribute === 'boolean'; }
	if (expected.includes('datetime')) { return attribute === 'datetime'; }
	if (expected.includes('guid')) { return attribute === 'uniqueidentifier' || attribute === 'lookup' || attribute === 'owner'; }
	return false;
}
function inferFailureField(literal: string | undefined, expectedType: string | undefined, row?: UpsertRowDraft, attributes?: { logicalName: string; attributeType?: string }[]): string | undefined {
	if (!literal || !expectedType || !row || !attributes?.length) { return undefined; }
	const attributeMap = new Map(attributes.map(attribute => [attribute.logicalName.toLowerCase(), attribute]));
	for (const [field, value] of Object.entries(row.values)) {
		if (String(value ?? '') !== literal) { continue; }
		const attribute = attributeMap.get(field.toLowerCase());
		if (attributeMatchesExpectedType(attribute?.attributeType, expectedType)) { return field; }
	}
	return Object.entries(row.values).find(([, value]) => String(value ?? '') === literal)?.[0];
}
function normalizeFailureMessage(message: string, row?: UpsertRowDraft, attributes?: { logicalName: string; attributeType?: string }[]): NormalizedFailure {
	const httpStatus = extractHttpStatus(message);
	const literal = firstMatch(message, /Cannot convert the literal '([^']+)'/i);
	const expectedType = firstMatch(message, /expected type '([^']+)'/i) ?? firstMatch(message, /expected type \"([^\"]+)\"/i);
	const invalidProperty = firstMatch(message, /Invalid property '([^']+)'/i) ?? firstMatch(message, /property '([^']+)' does not exist/i);
	const duplicate = /duplicate|already exists|0x8004f016/i.test(message);
	const permission = /privilege|permission|access is denied|not authorized|unauthorized|forbidden|401|403/i.test(message);
	const plugin = /plugin|plug-in|business process|business rule|workflow/i.test(message);
	const required = /required|cannot be null|is missing/i.test(message);

	if (literal && expectedType) {
		const expected = dataverseTypeLabel(expectedType);
		const field = inferFailureField(literal, expectedType, row, attributes);
		return {
			category: 'Type conversion error',
			summary: `Value '${literal}' is not valid for ${expected}.`,
			field,
			value: literal,
			expected,
			action: `Replace '${literal}' with a value compatible with ${expected}${field ? ` for ${field}` : ''}.`,
			httpStatus,
			technical: message
		};
	}
	if (invalidProperty) {
		return {
			category: 'Unknown column',
			summary: `Dataverse did not recognise column '${invalidProperty}'.`,
			field: invalidProperty,
			action: `Remove '${invalidProperty}' from the import or replace it with the Dataverse logical column name.`,
			httpStatus,
			technical: message
		};
	}
	if (required) {
		return {
			category: 'Required value error',
			summary: 'Dataverse rejected the row because a required value was missing or empty.',
			action: 'Populate the required Dataverse column, then requeue or re-import the failed row.',
			httpStatus,
			technical: message
		};
	}
	if (duplicate) {
		return {
			category: 'Duplicate key error',
			summary: 'Dataverse rejected the row because a duplicate or conflicting key already exists.',
			action: 'Review the alternate key value and decide whether the row should update an existing record or use a new key.',
			httpStatus,
			technical: message
		};
	}
	if (permission) {
		return {
			category: 'Permission error',
			summary: 'Dataverse rejected the row because the current user is not allowed to perform the operation.',
			action: 'Check the current user privileges, table permissions, field security, and environment access.',
			httpStatus,
			technical: message
		};
	}
	if (plugin) {
		return {
			category: 'Business logic error',
			summary: 'Dataverse business logic rejected the row during execution.',
			action: 'Review plugins, flows, business rules, and custom validation that run for this table.',
			httpStatus,
			technical: message
		};
	}
	const firstLine = message.split('\n')[0].slice(0, 260);
	return {
		category: 'Dataverse execution error',
		summary: firstLine || 'Dataverse rejected the row during execution.',
		action: 'Review the technical details or export the failed rows for investigation.',
		httpStatus,
		technical: message
	};
}
function renderFailureMetadata(failure: NormalizedFailure): string {
	const items = [
		failure.httpStatus ? `<div><span>HTTP</span><strong>${escapeHtml(failure.httpStatus)}</strong></div>` : '',
		failure.field ? `<div><span>Column</span><strong>${escapeHtml(failure.field)}</strong></div>` : '',
		failure.value ? `<div><span>Value</span><strong>${escapeHtml(failure.value)}</strong></div>` : '',
		failure.expected ? `<div><span>Expected</span><strong>${escapeHtml(failure.expected)}</strong></div>` : '',
		failure.action ? `<div class="dv-failure-action"><span>Suggested action</span><strong>${escapeHtml(failure.action)}</strong></div>` : ''
	].filter(Boolean).join('');
	return items ? `<div class="dv-failure-meta">${items}</div>` : '';
}

function failureSeverity(category: string): { icon: string; label: string; pillClass: string; cardClass: string } {
	const lower = category.toLowerCase();
	if (lower.includes('type conversion')) { return { icon: '🔴', label: 'Data type', pillClass: 'danger', cardClass: 'severity-high' }; }
	if (lower.includes('lookup')) { return { icon: '🟠', label: 'Lookup', pillClass: 'warning', cardClass: 'severity-medium' }; }
	if (lower.includes('duplicate') || lower.includes('key')) { return { icon: '🟠', label: 'Key conflict', pillClass: 'warning', cardClass: 'severity-medium' }; }
	if (lower.includes('required')) { return { icon: '🟡', label: 'Required value', pillClass: 'warning', cardClass: 'severity-low' }; }
	if (lower.includes('choice') || lower.includes('option')) { return { icon: '🟡', label: 'Choice value', pillClass: 'warning', cardClass: 'severity-low' }; }
	if (lower.includes('permission') || lower.includes('access')) { return { icon: '🔵', label: 'Permission', pillClass: 'accent', cardClass: 'severity-info' }; }
	if (lower.includes('business logic')) { return { icon: '🟠', label: 'Business logic', pillClass: 'warning', cardClass: 'severity-medium' }; }
	if (lower.includes('unknown column')) { return { icon: '🟡', label: 'Column', pillClass: 'warning', cardClass: 'severity-low' }; }
	return { icon: '⚪', label: 'Dataverse', pillClass: 'grey', cardClass: 'severity-neutral' };
}

function renderFailureTitle(failure: NormalizedFailure, count?: number): string {
	const severity = failureSeverity(failure.category);
	return `${severity.icon} ${failure.category}${count !== undefined ? ` • ${count} row(s)` : ''}`;
}

function renderResults(viewModel: AttributeFactoryViewModel): string {
	if (!viewModel.executionResults.length) { return ''; }
	const applied = viewModel.executionResults.filter(result => result.status === 'Applied').length;
	const failed = viewModel.executionResults.filter(result => result.status === 'Failed').length;
	const skipped = viewModel.executionProgress?.skipped ?? 0;
	const cancelled = viewModel.executionProgress?.cancelled ?? false;
	const elapsedMs = viewModel.executionProgress?.startedAt ? (viewModel.executionProgress.completedAt ?? Date.now()) - viewModel.executionProgress.startedAt : undefined;
	const elapsed = elapsedMs !== undefined ? formatElapsed(elapsedMs) : undefined;
	const throughput = elapsedMs && elapsedMs > 0 ? (applied / (elapsedMs / 1000)).toFixed(2) : undefined;
	const batchText = viewModel.executionProgress?.batchCount ? `${viewModel.executionProgress.batchCount} batch(es)` : `${viewModel.summary.batchCount} batch(es)`;
	const failedResults = viewModel.executionResults.filter(result => result.status === 'Failed');
	const normalizedFailures = failedResults.map(result => ({ result, failure: normalizeFailureMessage(result.message, viewModel.draft.rows.find(row => row.id === result.rowId), viewModel.entityAttributes) }));
	const failureGroups = new Map<string, { failure: NormalizedFailure; count: number; rows: number[] }>();
	for (const item of normalizedFailures) {
		const key = `${item.failure.category}|${item.failure.field ?? ''}|${item.failure.summary}`;
		const existing = failureGroups.get(key);
		if (existing) {
			existing.count += 1;
			existing.rows.push(item.result.rowNumber);
		} else {
			failureGroups.set(key, { failure: item.failure, count: 1, rows: [item.result.rowNumber] });
		}
	}
	const executionSummary = `<div class="dv-preview-grid dv-execution-summary"><div><span>Applied</span><strong>${escapeHtml(applied)}</strong><em>Successful rows</em></div><div><span>Failed</span><strong>${escapeHtml(failed)}</strong><em>Rows needing review</em></div><div><span>Skipped</span><strong>${escapeHtml(skipped)}</strong><em>${cancelled ? 'Skipped after stop' : 'Not processed'}</em></div><div><span>Elapsed</span><strong>${escapeHtml(elapsed ?? '0:00')}</strong><em>Wall-clock time</em></div><div><span>Throughput</span><strong>${escapeHtml(throughput ? `${throughput} rows/sec` : '—')}</strong><em>Average applied rows</em></div><div><span>Batches</span><strong>${escapeHtml(batchText)}</strong><em>Execution plan</em></div></div>`;
	const successfulSummary = failed === 0 ? `<div class="dv-empty">${cancelled ? `${escapeHtml(applied)} row(s) applied before cancellation. ${escapeHtml(skipped)} row(s) skipped. Export or requeue skipped rows to resume later.` : `Completed successfully. ${escapeHtml(applied)} row(s) applied in ${escapeHtml(elapsed ?? '0:00')} at ${escapeHtml(throughput ? `${throughput} rows/sec` : '—')}.`} Row-level success details are summarised to keep bulk runs readable.</div>` : '';
	const failureSummaryHtml = failureGroups.size ? `<h3 class="dv-subheading">Failure summary</h3><div class="dv-failure-summary">${[...failureGroups.values()].map(group => { const severity = failureSeverity(group.failure.category); return `<span class="dv-pill ${severity.pillClass}">${escapeHtml(severity.icon)} ${escapeHtml(group.failure.category)} (${escapeHtml(group.count)})</span>`; }).join('')}</div>` : '';
	const failureGroupHtml = failureGroups.size ? `<h3 class="dv-subheading">Failure groups</h3><div class="dv-list dv-scroll-list">${[...failureGroups.values()].map(group => { const severity = failureSeverity(group.failure.category); return `<div class="dv-result dv-failure-card ${severity.cardClass}"><div class="dv-row-content"><strong>${escapeHtml(renderFailureTitle(group.failure, group.count))}</strong><p>${escapeHtml(group.failure.summary)}</p>${renderFailureMetadata(group.failure)}<p>Affected rows: ${escapeHtml(group.rows.slice(0, 8).join(', '))}${group.rows.length > 8 ? '…' : ''}</p><details><summary>Technical details</summary><pre>${escapeHtml(group.failure.technical)}</pre></details></div><span class="dv-pill ${severity.pillClass}">${escapeHtml(severity.label)}</span></div>`; }).join('')}</div>` : '';
	const failureDetails = normalizedFailures.length ? `<h3 class="dv-subheading">Failed row details</h3><div class="dv-list dv-scroll-list">${normalizedFailures.slice(0, 50).map(({ result, failure }) => { const severity = failureSeverity(failure.category); return `<div class="dv-result dv-failure-card ${severity.cardClass}"><div class="dv-row-content"><strong>${escapeHtml(severity.icon)} Row ${escapeHtml(result.rowNumber)} • ${escapeHtml(result.operation)}</strong><p>${escapeHtml(failure.summary)}</p>${renderFailureMetadata(failure)}<details><summary>Technical details</summary><pre>${escapeHtml(failure.technical)}</pre></details></div><span class="dv-pill ${severity.pillClass}">${escapeHtml(result.status)}</span></div>`; }).join('')}${normalizedFailures.length > 50 ? `<div class="dv-empty">Showing first 50 of ${escapeHtml(normalizedFailures.length)} failed rows. Export failures for the full set.</div>` : ''}</div>` : '';
	const failedActions = failed ? '<button class="secondary" data-command="exportFailures">Export failures</button><button class="secondary" data-command="requeueFailures">Requeue failures</button>' : '';
	const skippedActions = cancelled && skipped ? '<button class="secondary" data-command="exportSkipped">Export skipped</button><button class="secondary" data-command="requeueSkipped">Requeue skipped</button>' : '';
	return `<section class="dv-card dv-section"><div class="dv-section-header"><div><h2>Execution results</h2><p>${escapeHtml(applied)} applied. ${escapeHtml(failed)} failed.${skipped ? ` ${escapeHtml(skipped)} skipped.` : ''}${elapsed ? ` Elapsed ${escapeHtml(elapsed)}.` : ''}</p></div><div class="dv-actions">${failedActions}${skippedActions}<span class="dv-pill ${failed || cancelled ? 'warning' : 'success'}">${failed ? 'Review failures' : cancelled ? 'Cancelled' : 'Completed'}</span></div></div>${executionSummary}${failureSummaryHtml}${failureGroupHtml}${successfulSummary}${failureDetails}</section>`;
}
function renderValidation(viewModel: AttributeFactoryViewModel): string {
	if (!viewModel.draft.imported) { return '<div class="dv-empty">No package imported yet. Validation starts after CSV, JSON, or DVUR package import.</div>'; }
	if (!viewModel.validationGroups.length) { return '<div class="dv-empty">No validation issues.</div>'; }
	return viewModel.validationGroups.map(group => `<div class="dv-result"><div><strong>${escapeHtml(group.severity)} • ${escapeHtml(group.count)} occurrence(s)</strong><p>${escapeHtml(group.message)}</p>${group.rowNumbers.length ? `<p>Affected rows: ${escapeHtml(group.rowNumbers.length)}. Examples: ${escapeHtml(group.rowNumbers.slice(0, 8).join(', '))}${group.rowNumbers.length > 8 ? '…' : ''}</p>` : ''}</div><span class="dv-pill ${group.severity === 'Error' ? 'danger' : 'warning'}">${escapeHtml(group.severity)}</span></div>`).join('');
}

export function renderAttributeFactoryHtml(viewModel: AttributeFactoryViewModel, options: RenderOptions): string {
	const messageHtml = viewModel.message ? `<div class="dv-message ${escapeHtml(viewModel.message.kind)}">${escapeHtml(viewModel.message.text)}</div>` : '';
	const environmentPillClass = getEnvironmentPillClass(viewModel);
	const environmentPillText = viewModel.environment.label === 'Not connected' ? 'No environment connected' : viewModel.environment.label;
	return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${options.cspSource}; style-src ${options.cspSource} 'unsafe-inline'; script-src ${options.cspSource} 'unsafe-inline';"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${attributeFactoryStyles}</style><title>${escapeHtml(viewModel.productName)}</title></head>
	<body><div class="dv-shell">
		<header class="dv-hero"><div><div class="dv-kicker">DV FORGELAB UTILITY</div><h1>${escapeHtml(viewModel.productName)}</h1><p>${escapeHtml(viewModel.subtitle)}</p></div><div class="dv-logo-card"><img src="${options.logoUri}" alt="DV ForgeLab"></div></header>
		<section class="dv-toolbar" aria-label="Environment and actions"><div class="dv-status-pills"><span class="dv-pill ${environmentPillClass}">${escapeHtml(environmentPillText)}</span><span class="dv-pill">Preview-first</span><span class="dv-pill">Runner</span></div><div class="dv-actions"><button data-command="connect">Connect</button><button class="secondary" data-command="switchEnvironment">Change environment</button><button class="secondary" data-command="refreshMetadata">Refresh</button></div></section>
		${messageHtml}
		<section class="dv-grid"><div class="dv-card dv-summary accent-blue"><span>RECORDS</span><strong>${escapeHtml(viewModel.summary.recordCount)}</strong><p>Imported rows</p></div><div class="dv-card dv-summary"><span>CREATES</span><strong>${escapeHtml(viewModel.summary.createCount)}</strong><p>Detected by preview</p></div><div class="dv-card dv-summary accent-yellow"><span>UPDATES</span><strong>${escapeHtml(viewModel.summary.updateCount)}</strong><p>Detected by preview</p></div><div class="dv-card dv-summary"><span>ISSUES</span><strong>${escapeHtml(viewModel.summary.issueCount)}</strong><p>Review before apply</p></div></section>
		<section class="dv-card dv-section"><div class="dv-section-header"><div><h2>Import package</h2><p>Import generic CSV/JSON or a trusted DVQR-generated .dvur.json package. Generic imports are basic; trusted DVQR packages may carry richer metadata context later.</p></div><div class="dv-actions"><select class="dv-command-select" data-command-select="import"><option value="">Import...</option><option value="importCsv">CSV</option><option value="importJson">JSON / DVUR Package</option></select><select class="dv-command-select" data-command-select="export"><option value="">Export...</option><option value="exportCsv">CSV</option><option value="exportJson">DVUR JSON</option></select><button class="secondary" data-command="validate">Validate</button><button class="secondary" data-command="clearDrafts">Clear</button><button ${isPreviewReady(viewModel) ? '' : 'disabled'} data-command="openPreview">Preview</button></div></div>
			<div class="dv-draft-fields"><label><span>Entity logical name</span>${entitySelector(viewModel)}</label><label><span>Key mode</span>${select('keyMode', ['AlternateKey', 'PrimaryId'], viewModel.draft.keyMode)}</label><label><span>Key column</span>${keyColumnSelector(viewModel)}</label><label><span>Batch size</span>${select('batchSize', ['100', '250', '500', '1000'], String(viewModel.draft.batchSize))}</label></div>
			<div class="dv-source-row">${viewModel.draft.imported ? renderPackageSource(viewModel) : ''}<span class="dv-muted">${escapeHtml(viewModel.draft.imported ? (viewModel.draft.sourceLabel || 'Imported package') : 'No source imported. Import CSV, JSON, or DVUR package to begin.')}</span></div>
			${renderImportSummary(viewModel)}
			${renderRowPreview(viewModel)}
		</section>
		<section class="dv-card dv-section"><h2>Validation notes</h2><div class="dv-list">${renderValidation(viewModel)}</div></section>
		${renderPreview(viewModel)}${renderProgress(viewModel)}${renderResults(viewModel)}
		<section class="dv-card dv-section"><h2>Boundary</h2><p>Runner, not migration platform. DV Upsert Runner applies single-entity data rows through a preview-first workflow. It does not perform ETL, scheduled sync, relationship graph migration, attachment migration, or automatic data cleansing.</p></section>
		<footer class="dv-footer-note">DV Upsert Runner is part of the <a href="https://www.dvforgelab.com">DV ForgeLab</a> Dataverse tooling ecosystem. <a href="https://www.dvquickrun.com">DV Quick Run</a> is the flagship Dataverse investigation workbench.</footer>
	</div><script>${attributeFactoryScript}</script></body></html>`;
}
