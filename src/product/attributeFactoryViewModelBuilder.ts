import { AttributeFactoryState } from './attributeFactoryState';
import { AttributeFactoryViewModel, EnvironmentSafety } from './attributeFactoryTypes';
import { groupValidationIssues } from './attributeFactoryValidation';

function classifyEnvironment(label: string, url?: string): { safety: EnvironmentSafety; safetyLabel: string } {
	const source = `${label} ${url ?? ''}`.toLowerCase();
	if (!url) { return { safety: 'None', safetyLabel: 'No environment selected' }; }
	if (/\b(prod|production|prd|live)\b/.test(source)) { return { safety: 'Red', safetyLabel: 'Production-class environment' }; }
	if (/\b(uat|sit|test|qa|preprod|pre-prod|stage|staging)\b/.test(source)) { return { safety: 'Amber', safetyLabel: 'Controlled non-production environment' }; }
	return { safety: 'Grey', safetyLabel: 'Development / unclassified environment' };
}

function getColumnCount(state: AttributeFactoryState): number {
	return new Set(state.draft.rows.flatMap(row => Object.keys(row.values))).size;
}

export function buildAttributeFactoryViewModel(state: AttributeFactoryState): AttributeFactoryViewModel {
	const environmentSafety = classifyEnvironment(state.environment.label, state.environment.url);
	const errorCount = state.validationIssues.filter(issue => issue.severity === 'Error').length;
	const warningCount = state.validationIssues.filter(issue => issue.severity === 'Warning').length;
	const createCount = state.pendingChanges.filter(change => change.operation === 'Create').length;
	const updateCount = state.pendingChanges.filter(change => change.operation === 'Update').length;
	const batchSize = state.draft.batchSize > 0 ? state.draft.batchSize : 250;

	return {
		productName: 'DV Bulk Upsert Runner',
		subtitle: 'Preview-first Dataverse bulk upsert utility for CSV, JSON, and DVQR packages.',
		environment: { ...state.environment, ...environmentSafety },
		entities: state.entities,
		entityAttributes: state.entityAttributes,
		entityKeys: state.entityKeys,
		draft: state.draft,
		pendingChanges: state.pendingChanges,
		validationIssues: state.validationIssues,
		validationGroups: groupValidationIssues(state.validationIssues, state.draft.rows),
		executionResults: state.executionResults,
		executionProgress: state.executionProgress,
		previewOpen: state.previewOpen,
		summary: {
			recordCount: state.draft.rows.length,
			createCount,
			updateCount,
			issueCount: errorCount + warningCount,
			pendingChangeCount: state.pendingChanges.length,
			errorCount,
			warningCount,
			batchCount: state.pendingChanges.length ? Math.ceil(state.pendingChanges.length / batchSize) : 0,
			columnCount: getColumnCount(state)
		},
		message: state.message
	};
}
