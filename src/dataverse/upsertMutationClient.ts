import { EntityViewModel, ExecutionProgress, ExecutionResult, RowOperation, UpsertPackageDraft, UpsertRowDraft } from '../product/upsertRunnerTypes';
import { DataverseHttpClient } from './dataverseHttpClient';

function escapeODataString(value: string): string { return value.replace(/'/g, "''"); }
function encodeKeyValue(value: unknown): string {
	if (typeof value === 'number' || typeof value === 'boolean') { return String(value); }
	return `'${escapeODataString(String(value ?? ''))}'`;
}
function normalise(value: string): string { return value.trim().toLowerCase(); }
function getKeyValue(row: UpsertRowDraft, keyColumn: string): unknown {
	const key = Object.keys(row.values).find(item => normalise(item) === normalise(keyColumn));
	return key ? row.values[key] : undefined;
}
function buildPath(entity: EntityViewModel, draft: UpsertPackageDraft, row: UpsertRowDraft): string {
	const keyValue = getKeyValue(row, draft.keyColumn);
	if (draft.keyMode === 'PrimaryId') {
		return `/${entity.entitySetName}(${String(keyValue)})`;
	}
	return `/${entity.entitySetName}(${draft.keyColumn}=${encodeKeyValue(keyValue)})`;
}
function chunkRows(rows: UpsertRowDraft[], batchSize: number): UpsertRowDraft[][] {
	const safeBatchSize = Math.max(1, batchSize || 250);
	const chunks: UpsertRowDraft[][] = [];
	for (let index = 0; index < rows.length; index += safeBatchSize) {
		chunks.push(rows.slice(index, index + safeBatchSize));
	}
	return chunks;
}

export class UpsertMutationClient {
	constructor(private readonly client: DataverseHttpClient) {}

	async detectOperation(entity: EntityViewModel, draft: UpsertPackageDraft, row: UpsertRowDraft): Promise<RowOperation> {
		try {
			await this.client.get(`${buildPath(entity, draft, row)}?$select=${encodeURIComponent(draft.keyColumn)}`);
			return 'Update';
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes('404')) { return 'Create'; }
			return 'Unknown';
		}
	}

	async upsertRows(
		entity: EntityViewModel,
		draft: UpsertPackageDraft,
		rows: UpsertRowDraft[],
		onProgress?: (progress: ExecutionProgress) => void | Promise<void>,
		shouldStop?: () => boolean
	): Promise<ExecutionResult[]> {
		const results: ExecutionResult[] = [];
		const batches = chunkRows(rows, draft.batchSize);
		const startedAt = Date.now();

		const report = async (running: boolean, batchIndex: number): Promise<void> => {
			await onProgress?.({
				running,
				phase: 'Apply',
				processed: results.length,
				total: rows.length,
				batchIndex,
				batchCount: batches.length,
				applied: results.filter(item => item.status === 'Applied').length,
				failed: results.filter(item => item.status === 'Failed').length,
				startedAt,
				completedAt: running ? undefined : Date.now(),
				stopRequested: shouldStop?.() ?? false,
				cancelled: !running && (shouldStop?.() ?? false),
				skipped: running ? undefined : Math.max(0, rows.length - results.length)
			});
		};

		for (const [batchIndex, batchRows] of batches.entries()) {
			await report(true, batchIndex + 1);

			for (const row of batchRows) {
				let operation: RowOperation = 'Unknown';
				try {
					operation = await this.detectOperation(entity, draft, row);
					await this.client.patch(buildPath(entity, draft, row), row.values);
					results.push({ rowId: row.id, rowNumber: row.rowNumber, operation, status: 'Applied', message: `${operation === 'Create' ? 'Created' : operation === 'Update' ? 'Updated' : 'Upserted'} row ${row.rowNumber}.` });
				} catch (error) {
					results.push({ rowId: row.id, rowNumber: row.rowNumber, operation, status: 'Failed', message: error instanceof Error ? error.message : String(error) });
				}

				if (results.length % 5 === 0 || results.length === rows.length) {
					await report(true, batchIndex + 1);
				}
			}

			await report(true, batchIndex + 1);
			if (shouldStop?.()) {
				break;
			}
		}

		await report(false, batches.length);
		return results;
	}
}
