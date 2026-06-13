export type EnvironmentSafety = 'None' | 'Grey' | 'Amber' | 'Red';

export type AttributeFactoryEnvironmentViewModel = {
	label: string;
	url?: string;
	state: 'NotConnected' | 'Connected';
	safety: EnvironmentSafety;
	safetyLabel: string;
};

export type EntityViewModel = {
	logicalName: string;
	entitySetName: string;
	displayName?: string;
	primaryIdAttribute?: string;
};

export type EntityKeyViewModel = {
	logicalName: string;
	displayName?: string;
	keyAttributes: string[];
	status?: string;
	isActive: boolean;
};

export type EntityAttributeViewModel = {
	logicalName: string;
	attributeType?: string;
	isValidForCreate?: boolean;
	isValidForUpdate?: boolean;
};

export type ImportMode = 'GenericCsv' | 'GenericJson' | 'DvurPackage';
export type KeyMode = 'PrimaryId' | 'AlternateKey';
export type RowOperation = 'Create' | 'Update' | 'Unknown';

export type UpsertRowDraft = {
	id: string;
	rowNumber: number;
	values: Record<string, unknown>;
};

export type UpsertPackageDraft = {
	id: string;
	entityLogicalName: string;
	entitySetName?: string;
	keyMode: KeyMode;
	keyColumn: string;
	importMode: ImportMode;
	trustedSource: boolean;
	sourceLabel?: string;
	imported: boolean;
	batchSize: number;
	rows: UpsertRowDraft[];
};

export type ValidationIssue = {
	draftId: string;
	rowId?: string;
	severity: 'Error' | 'Warning';
	message: string;
	code?: 'MissingEntity' | 'UnknownEntity' | 'MissingKeyColumn' | 'NoRows' | 'MissingKeyValue' | 'EmptyRow' | 'DuplicateKey' | 'UnknownColumn' | 'ReadOnlyColumn' | 'InvalidPrimaryKey' | 'InvalidAlternateKey' | 'NoActiveAlternateKey';
};

export type ValidationIssueGroup = {
	key: string;
	severity: 'Error' | 'Warning';
	message: string;
	count: number;
	rowNumbers: number[];
};

export type PendingUpsertChange = {
	row: UpsertRowDraft;
	operation: RowOperation;
	issues: ValidationIssue[];
};

export type ExecutionResult = {
	rowId: string;
	rowNumber: number;
	operation: RowOperation;
	status: 'Applied' | 'Skipped' | 'Failed';
	message: string;
};

export type ExecutionProgressPhase = 'Preview' | 'Apply';

export type ExecutionProgress = {
	running: boolean;
	phase: ExecutionProgressPhase;
	processed: number;
	total: number;
	batchIndex: number;
	batchCount: number;
	applied: number;
	failed: number;
	startedAt?: number;
	completedAt?: number;
	stopRequested?: boolean;
	cancelled?: boolean;
	skipped?: number;
	skippedRowIds?: string[];
};

export type AttributeFactoryViewModel = {
	productName: string;
	subtitle: string;
	environment: AttributeFactoryEnvironmentViewModel;
	entities: EntityViewModel[];
	entityAttributes: EntityAttributeViewModel[];
	entityKeys: EntityKeyViewModel[];
	draft: UpsertPackageDraft;
	pendingChanges: PendingUpsertChange[];
	validationIssues: ValidationIssue[];
	validationGroups: ValidationIssueGroup[];
	executionResults: ExecutionResult[];
	executionProgress?: ExecutionProgress;
	previewOpen: boolean;
	summary: {
		recordCount: number;
		createCount: number;
		updateCount: number;
		issueCount: number;
		pendingChangeCount: number;
		errorCount: number;
		warningCount: number;
		batchCount: number;
		columnCount: number;
	};
	message?: {
		kind: 'Info' | 'Warning' | 'Error';
		text: string;
	};
};
