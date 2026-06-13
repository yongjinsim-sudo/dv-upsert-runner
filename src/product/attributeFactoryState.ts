import { AttributeFactoryEnvironmentViewModel, EntityAttributeViewModel, EntityKeyViewModel, EntityViewModel, ExecutionProgress, ExecutionResult, PendingUpsertChange, UpsertPackageDraft, ValidationIssue } from './attributeFactoryTypes';

export type AttributeFactoryState = {
	environment: AttributeFactoryEnvironmentViewModel;
	entities: EntityViewModel[];
	entityAttributes: EntityAttributeViewModel[];
	entityKeys: EntityKeyViewModel[];
	draft: UpsertPackageDraft;
	pendingChanges: PendingUpsertChange[];
	validationIssues: ValidationIssue[];
	executionResults: ExecutionResult[];
	executionProgress?: ExecutionProgress;
	previewOpen: boolean;
	cancelAfterCurrentBatch: boolean;
	message?: { kind: 'Info' | 'Warning' | 'Error'; text: string };
};

export function createInitialAttributeFactoryState(): AttributeFactoryState {
	return {
		environment: { label: 'Not connected', state: 'NotConnected', safety: 'None', safetyLabel: 'No environment selected' },
		entities: [],
		entityAttributes: [],
		entityKeys: [],
		draft: {
			id: 'package',
			entityLogicalName: '',
			entitySetName: '',
			keyMode: 'AlternateKey',
			keyColumn: '',
			importMode: 'GenericCsv',
			trustedSource: false,
			sourceLabel: '',
			imported: false,
			batchSize: 250,
			rows: []
		},
		pendingChanges: [],
		validationIssues: [],
		executionResults: [],
		executionProgress: undefined,
		previewOpen: false,
		cancelAfterCurrentBatch: false
	};
}
