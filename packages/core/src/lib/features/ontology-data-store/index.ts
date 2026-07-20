/**
 * Ontology Data Store — 公共 API 导出
 */

export type {
	InstanceData,
	InstanceMeta,
	ConceptSchema,
	ConceptField,
	InstanceRelation,
	InstanceRelationsData,
	IndexEntry,
	IndexData,
	QueryParams,
	QueryResult,
	QueryFilters,
	VersionSnapshot,
	BatchDeletePreview,
	BatchDeleteResult,
	ExportFormat,
	ExportOptions,
} from "./types";

export { isValidId, projectIdFromOntologyId, ontologyDir, schemaPath, instanceDir, instancePath, indexPath, versionDir, versionPath, instanceRelationsPath } from "./config";

export { createInstance, getInstance, updateInstance, deleteInstance, listInstances } from "./store";

export { loadIndex, saveIndex, getIndexEntries, getAllInstanceIds, clearCache } from "./index-manager";

export { queryInstances } from "./query-engine";

export { validateInstance, loadConceptSchema } from "./schema-validator";

export { saveVersion, getVersions, getVersion, revertToVersion } from "./version";

export { exportInstances } from "./export";

export {
	listInstanceRelations,
	createInstanceRelation,
	deleteInstanceRelation,
	type CreateInstanceRelationInput,
} from "./instance-relations";

export {
	loadOntology,
	saveOntology,
	loadOrCreateOntology,
	createDomain,
	deleteDomain,
	createConcept,
	deleteConcept,
	updateConceptSchema,
	createConceptRelation,
	deleteConceptRelation,
	searchOntology,
	listConcepts,
	type OntologyData,
	type OntologyDomain,
	type OntologyConcept,
	type OntologyRelation,
} from "./ontology-ops";
