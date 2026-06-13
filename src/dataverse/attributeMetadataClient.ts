import { EntityAttributeViewModel, EntityKeyViewModel, EntityViewModel } from '../product/attributeFactoryTypes';
import { DataverseHttpClient } from './dataverseHttpClient';

type ODataList<T> = { value?: T[] };

type EntityMetadataRow = {
	LogicalName?: string;
	EntitySetName?: string;
	DisplayName?: { UserLocalizedLabel?: { Label?: string } };
	PrimaryIdAttribute?: string;
};

type AttributeMetadataRow = { LogicalName?: string; AttributeType?: string; IsValidForCreate?: boolean; IsValidForUpdate?: boolean };
type EntityKeyMetadataRow = { LogicalName?: string; DisplayName?: { UserLocalizedLabel?: { Label?: string } }; KeyAttributes?: string[]; EntityKeyIndexStatus?: string | number };

function encodeLogicalName(value: string): string { return value.replace(/'/g, "''"); }
function getDisplayLabel(row: EntityMetadataRow, fallback?: string): string | undefined { return row.DisplayName?.UserLocalizedLabel?.Label?.trim() || fallback; }

export class AttributeMetadataClient {
	constructor(private readonly client: DataverseHttpClient) {}

	async listEntities(): Promise<EntityViewModel[]> {
		const response = await this.client.get<ODataList<EntityMetadataRow>>('/EntityDefinitions?$select=LogicalName,EntitySetName,DisplayName,PrimaryIdAttribute');
		return (response.value ?? [])
			.map((row): EntityViewModel | undefined => {
				const logicalName = row.LogicalName?.trim();
				const entitySetName = row.EntitySetName?.trim();
				if (!logicalName || !entitySetName) { return undefined; }
				return { logicalName, entitySetName, displayName: getDisplayLabel(row, logicalName), primaryIdAttribute: row.PrimaryIdAttribute?.trim() };
			})
			.filter((item): item is EntityViewModel => !!item)
			.sort((a, b) => (a.displayName ?? a.logicalName).localeCompare(b.displayName ?? b.logicalName, undefined, { sensitivity: 'base' }));
	}

	async getEntity(entityLogicalName: string): Promise<EntityViewModel | undefined> {
		const safeEntity = encodeLogicalName(entityLogicalName);
		try {
			const row = await this.client.get<EntityMetadataRow>(`/EntityDefinitions(LogicalName='${safeEntity}')?$select=LogicalName,EntitySetName,DisplayName,PrimaryIdAttribute`);
			if (!row.LogicalName || !row.EntitySetName) { return undefined; }
			return { logicalName: row.LogicalName, entitySetName: row.EntitySetName, displayName: getDisplayLabel(row, row.LogicalName), primaryIdAttribute: row.PrimaryIdAttribute?.trim() };
		} catch { return undefined; }
	}

	async listAttributes(entityLogicalName: string): Promise<EntityAttributeViewModel[]> {
		const safeEntity = encodeLogicalName(entityLogicalName);
		const response = await this.client.get<ODataList<AttributeMetadataRow>>(`/EntityDefinitions(LogicalName='${safeEntity}')/Attributes?$select=LogicalName,AttributeType,IsValidForCreate,IsValidForUpdate`);
		return (response.value ?? [])
			.map((row): EntityAttributeViewModel | undefined => {
				const logicalName = row.LogicalName?.trim();
				if (!logicalName) { return undefined; }
				return { logicalName, attributeType: row.AttributeType, isValidForCreate: row.IsValidForCreate, isValidForUpdate: row.IsValidForUpdate };
			})
			.filter((item): item is EntityAttributeViewModel => !!item);
	}
	async listKeys(entityLogicalName: string): Promise<EntityKeyViewModel[]> {
		const safeEntity = encodeLogicalName(entityLogicalName);
		try {
			const response = await this.client.get<ODataList<EntityKeyMetadataRow>>(`/EntityDefinitions(LogicalName='${safeEntity}')/Keys?$select=LogicalName,DisplayName,KeyAttributes,EntityKeyIndexStatus`);
			return (response.value ?? [])
				.map((row): EntityKeyViewModel | undefined => {
					const logicalName = row.LogicalName?.trim();
					const keyAttributes = (row.KeyAttributes ?? []).map(item => item.trim()).filter(Boolean);
					if (!logicalName || !keyAttributes.length) { return undefined; }
					const status = row.EntityKeyIndexStatus === undefined ? undefined : String(row.EntityKeyIndexStatus);
					const isActive = !status || status.toLowerCase() === 'active' || status === '1';
					return { logicalName, displayName: getDisplayLabel(row, logicalName), keyAttributes, status, isActive };
				})
				.filter((item): item is EntityKeyViewModel => !!item)
				.sort((a, b) => (a.displayName ?? a.logicalName).localeCompare(b.displayName ?? b.logicalName, undefined, { sensitivity: 'base' }));
		} catch {
			return [];
		}
	}

}
