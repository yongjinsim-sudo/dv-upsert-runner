import { EntityAttributeViewModel, EntityKeyViewModel, EntityViewModel, PendingUpsertChange, UpsertPackageDraft, ValidationIssue, ValidationIssueGroup } from './attributeFactoryTypes';

function normalise(value: string): string { return value.trim().toLowerCase(); }

function getKeyValue(rowValues: Record<string, unknown>, keyColumn: string): unknown {
	const key = Object.keys(rowValues).find(item => normalise(item) === normalise(keyColumn));
	return key ? rowValues[key] : undefined;
}


function issueKey(issue: ValidationIssue): string {
	const message = issue.message.replace(/^Row \d+:\s*/i, '');
	if (issue.code === 'UnknownColumn') {
		const match = /unknown column\s+([^\s]+)\s+for/i.exec(message);
		return `${issue.severity}:${issue.code}:${match?.[1]?.toLowerCase() ?? message.toLowerCase()}`;
	}
	if (issue.code === 'ReadOnlyColumn') {
		const match = /column\s+([^\s]+)\s+is read-only/i.exec(message);
		return `${issue.severity}:${issue.code}:${match?.[1]?.toLowerCase() ?? message.toLowerCase()}`;
	}
	return `${issue.severity}:${issue.code ?? message}`;
}

export function groupValidationIssues(issues: ValidationIssue[], rows: { id: string; rowNumber: number }[] = []): ValidationIssueGroup[] {
	const rowNumbersById = new Map(rows.map(row => [row.id, row.rowNumber]));
	const groups = new Map<string, ValidationIssueGroup>();
	for (const issue of issues) {
		const key = issueKey(issue);
		const existing = groups.get(key);
		const rowNumber = issue.rowId ? rowNumbersById.get(issue.rowId) : undefined;
		const message = issue.message.replace(/^Row \d+:\s*/i, '');
		if (existing) {
			existing.count += 1;
			if (rowNumber !== undefined && !existing.rowNumbers.includes(rowNumber)) { existing.rowNumbers.push(rowNumber); }
			continue;
		}
		groups.set(key, {
			key,
			severity: issue.severity,
			message,
			count: 1,
			rowNumbers: rowNumber !== undefined ? [rowNumber] : []
		});
	}
	return [...groups.values()].sort((left, right) => {
		if (left.severity !== right.severity) { return left.severity === 'Error' ? -1 : 1; }
		return right.count - left.count;
	});
}

export function validateDrafts(draft: UpsertPackageDraft, entities: EntityViewModel[], attributes: EntityAttributeViewModel[] = [], keys: EntityKeyViewModel[] = []): { issues: ValidationIssue[]; pendingChanges: PendingUpsertChange[]; groups: ValidationIssueGroup[] } {
	const issues: ValidationIssue[] = [];

	if (!draft.imported) {
		return { issues: [], pendingChanges: [], groups: [] };
	}

	const entityNames = new Set(entities.map(entity => normalise(entity.logicalName)));
	const attributeByName = new Map(attributes.map(attribute => [normalise(attribute.logicalName), attribute]));
	const hasAttributeMetadata = attributeByName.size > 0;
	const keyCounts = new Map<string, number>();

	if (!draft.entityLogicalName.trim()) {
		issues.push({ draftId: draft.id, severity: 'Error', code: 'MissingEntity', message: 'Entity logical name is required.' });
	} else if (entityNames.size && !entityNames.has(normalise(draft.entityLogicalName))) {
		issues.push({ draftId: draft.id, severity: 'Warning', code: 'UnknownEntity', message: `Entity ${draft.entityLogicalName} was not found in the loaded metadata list.` });
	}

	if (!draft.keyColumn.trim()) {
		issues.push({ draftId: draft.id, severity: 'Error', code: 'MissingKeyColumn', message: 'Key column is required for preview and upsert.' });
	} else {
		const selectedEntity = entities.find(entity => normalise(entity.logicalName) === normalise(draft.entityLogicalName));
		if (draft.keyMode === 'PrimaryId') {
			const primaryId = selectedEntity?.primaryIdAttribute;
			if (primaryId && normalise(draft.keyColumn) !== normalise(primaryId)) {
				issues.push({ draftId: draft.id, severity: 'Error', code: 'InvalidPrimaryKey', message: `PrimaryId mode for ${draft.entityLogicalName} must use ${primaryId}.` });
			}
		} else if (keys.length > 0 || attributes.length > 0) {
			const activeSingleColumnKeys = keys.filter(key => key.isActive && key.keyAttributes.length === 1);
			if (!activeSingleColumnKeys.length) {
				issues.push({ draftId: draft.id, severity: 'Error', code: 'NoActiveAlternateKey', message: `No active single-column alternate keys were found for ${draft.entityLogicalName}. Create and activate an alternate key in Dataverse, or use PrimaryId mode.` });
			} else if (!activeSingleColumnKeys.some(key => normalise(key.keyAttributes[0]) === normalise(draft.keyColumn))) {
				const available = activeSingleColumnKeys.map(key => key.keyAttributes[0]).join(', ');
				issues.push({ draftId: draft.id, severity: 'Error', code: 'InvalidAlternateKey', message: `${draft.keyColumn} is not an active alternate key for ${draft.entityLogicalName}. Available alternate key column(s): ${available}.` });
			}
		}
	}

	if (!draft.rows.length) {
		issues.push({ draftId: draft.id, severity: 'Warning', code: 'NoRows', message: 'Import completed, but no records were found.' });
	}

	for (const row of draft.rows) {
		const rowIssues: ValidationIssue[] = [];
		const keyValue = getKeyValue(row.values, draft.keyColumn);
		if (draft.keyColumn.trim() && (keyValue === undefined || keyValue === null || String(keyValue).trim() === '')) {
			rowIssues.push({ draftId: draft.id, rowId: row.id, severity: 'Error', code: 'MissingKeyValue', message: `Row ${row.rowNumber}: missing key value for ${draft.keyColumn}.` });
		} else if (draft.keyColumn.trim()) {
			const duplicateKey = `${normalise(draft.keyColumn)}::${String(keyValue).trim().toLowerCase()}`;
			keyCounts.set(duplicateKey, (keyCounts.get(duplicateKey) ?? 0) + 1);
		}

		if (!Object.keys(row.values).length) {
			rowIssues.push({ draftId: draft.id, rowId: row.id, severity: 'Error', code: 'EmptyRow', message: `Row ${row.rowNumber}: no values supplied.` });
		}

		if (hasAttributeMetadata) {
			for (const column of Object.keys(row.values)) {
				const attribute = attributeByName.get(normalise(column));
				if (!attribute) {
					rowIssues.push({ draftId: draft.id, rowId: row.id, severity: 'Error', code: 'UnknownColumn', message: `Row ${row.rowNumber}: unknown column ${column} for ${draft.entityLogicalName}.` });
					continue;
				}
				if (attribute.isValidForCreate === false && attribute.isValidForUpdate === false) {
					rowIssues.push({ draftId: draft.id, rowId: row.id, severity: 'Error', code: 'ReadOnlyColumn', message: `Row ${row.rowNumber}: column ${column} is read-only and cannot be supplied in an upsert payload.` });
				}
			}
		}

		issues.push(...rowIssues);
	}

	for (const row of draft.rows) {
		const keyValue = getKeyValue(row.values, draft.keyColumn);
		if (!draft.keyColumn.trim() || keyValue === undefined || keyValue === null || String(keyValue).trim() === '') {
			continue;
		}
		const duplicateKey = `${normalise(draft.keyColumn)}::${String(keyValue).trim().toLowerCase()}`;
		if ((keyCounts.get(duplicateKey) ?? 0) > 1) {
			issues.push({ draftId: draft.id, rowId: row.id, severity: 'Error', code: 'DuplicateKey', message: `Row ${row.rowNumber}: duplicate key value in imported file.` });
		}
	}

	const pendingChanges: PendingUpsertChange[] = draft.rows
		.map(row => ({ row, operation: 'Unknown' as const, issues: issues.filter(issue => issue.rowId === row.id) }))
		.filter(change => !change.issues.some(issue => issue.severity === 'Error'));

	return { issues, pendingChanges, groups: groupValidationIssues(issues, draft.rows) };
}
