/**
 * Ontology Operations — 本体结构操作层
 * 提供领域、概念、概念关系的 CRUD，供工具层和 API 路由调用。
 */

import fs from "fs/promises";
import { existsSync } from "fs";
import { ontologyDir, schemaPath, isValidId } from "./config";

// ============================================================================
// Ontology 结构类型
// ============================================================================

export interface OntologyDomain {
	id: string;
	name: string;
	description?: string;
}

export interface OntologyConcept {
	id: string;
	domainId: string;
	name: string;
	type: string;
	description?: string;
	attributes?: Record<string, { type: string; required?: boolean; description?: string; enum?: string[] }>;
}

export interface OntologyRelation {
	id: string;
	sourceId: string;
	targetId: string;
	type: string;
	cardinality?: string;
}

export interface OntologyData {
	version?: string;
	ontologyId?: string;
	domains: OntologyDomain[];
	concepts: OntologyConcept[];
	relations: OntologyRelation[];
	createdAt?: string | number;
	updatedAt?: string | number;
}

// ============================================================================
// 路径工具
// ============================================================================

function getOntologyDir(ontologyId: string): string {
	return ontologyDir(ontologyId);
}

function ontologyJsonPath(ontologyId: string): string {
	return schemaPath(ontologyId);
}

async function ensureDir(dirPath: string): Promise<void> {
	await fs.mkdir(dirPath, { recursive: true });
}

// ============================================================================
// 核心读写
// ============================================================================

export async function loadOntology(ontologyId: string): Promise<OntologyData> {
	if (!isValidId(ontologyId)) {
		throw new Error("Invalid ontology ID: path traversal detected");
	}
	const fp = ontologyJsonPath(ontologyId);
	if (!existsSync(fp)) {
		throw new Error(`本体不存在: ${ontologyId}`);
	}
	const content = await fs.readFile(fp, "utf-8");
	return JSON.parse(content) as OntologyData;
}

export async function saveOntology(ontologyId: string, data: OntologyData): Promise<void> {
	if (!isValidId(ontologyId)) {
		throw new Error("Invalid ontology ID: path traversal detected");
	}
	const fp = ontologyJsonPath(ontologyId);
	await ensureDir(getOntologyDir(ontologyId));
	await fs.writeFile(fp, JSON.stringify(data, null, 2), "utf-8");
}

export async function loadOrCreateOntology(ontologyId: string): Promise<OntologyData> {
	if (!isValidId(ontologyId)) {
		throw new Error("Invalid ontology ID: path traversal detected");
	}
	const fp = ontologyJsonPath(ontologyId);
	if (!existsSync(fp)) {
		return {
			version: "1.0.0",
			ontologyId,
			domains: [],
			concepts: [],
			relations: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
	}
	return loadOntology(ontologyId);
}

// ============================================================================
// 领域操作
// ============================================================================

export async function createDomain(
	ontologyId: string,
	name: string,
	description?: string
): Promise<OntologyDomain> {
	const ontology = await loadOrCreateOntology(ontologyId);

	if (ontology.domains.some((d) => d.name === name)) {
		throw new Error(`领域 "${name}" 已存在`);
	}

	const newDomain: OntologyDomain = {
		id: `domain-${Date.now()}`,
		name,
		description: description || "",
	};
	ontology.domains.push(newDomain);
	ontology.updatedAt = new Date().toISOString();

	await saveOntology(ontologyId, ontology);
	return newDomain;
}

export async function deleteDomain(ontologyId: string, domainId: string): Promise<void> {
	const ontology = await loadOntology(ontologyId);
	const domain = ontology.domains.find((d) => d.id === domainId);
	if (!domain) {
		throw new Error(`领域 "${domainId}" 不存在`);
	}

	// 删除该领域下的所有概念
	const conceptIds = ontology.concepts
		.filter((c) => c.domainId === domainId)
		.map((c) => c.id);
	ontology.concepts = ontology.concepts.filter((c) => c.domainId !== domainId);
	ontology.domains = ontology.domains.filter((d) => d.id !== domainId);

	// 删除涉及这些概念的关系
	ontology.relations = ontology.relations.filter(
		(r) => !conceptIds.includes(r.sourceId) && !conceptIds.includes(r.targetId)
	);

	ontology.updatedAt = new Date().toISOString();
	await saveOntology(ontologyId, ontology);

	// 删除数据目录
	const dir = `${getOntologyDir(ontologyId)}/data/${domainId}`;
	if (existsSync(dir)) {
		await fs.rm(dir, { recursive: true });
	}
}

// ============================================================================
// 概念操作
// ============================================================================

export async function createConcept(
	ontologyId: string,
	domainId: string,
	name: string,
	type: string,
	description?: string,
	attributes?: Record<string, { type: string; required?: boolean; description?: string; enum?: string[] }>
): Promise<OntologyConcept> {
	const ontology = await loadOntology(ontologyId);

	const domain = ontology.domains.find((d) => d.id === domainId);
	if (!domain) {
		throw new Error(`领域 "${domainId}" 不存在`);
	}

	const conceptId = `concept-${Date.now()}`;
	const newConcept: OntologyConcept = {
		id: conceptId,
		domainId,
		name,
		type,
		description: description || "",
	};
	if (attributes && Object.keys(attributes).length > 0) {
		newConcept.attributes = attributes;
	}

	ontology.concepts.push(newConcept);
	ontology.updatedAt = new Date().toISOString();
	await saveOntology(ontologyId, ontology);

	// 创建数据目录
	const conceptDataDir = `${getOntologyDir(ontologyId)}/data/${domainId}/${conceptId}`;
	await ensureDir(conceptDataDir);
	await fs.writeFile(
		`${conceptDataDir}/_index.json`,
		JSON.stringify({ instanceIds: [] }),
		"utf-8"
	);

	return newConcept;
}

export async function deleteConcept(ontologyId: string, conceptId: string): Promise<void> {
	const ontology = await loadOntology(ontologyId);
	const concept = ontology.concepts.find((c) => c.id === conceptId);
	if (!concept) {
		throw new Error(`概念 "${conceptId}" 不存在`);
	}

	// 删除概念
	ontology.concepts = ontology.concepts.filter((c) => c.id !== conceptId);

	// 删除涉及该概念的关系
	ontology.relations = ontology.relations.filter(
		(r) => r.sourceId !== conceptId && r.targetId !== conceptId
	);

	ontology.updatedAt = new Date().toISOString();
	await saveOntology(ontologyId, ontology);

	// 删除数据目录
	const dir = `${getOntologyDir(ontologyId)}/data/${concept.domainId}/${conceptId}`;
	if (existsSync(dir)) {
		await fs.rm(dir, { recursive: true });
	}
}

export async function updateConceptSchema(
	ontologyId: string,
	conceptId: string,
	attributes: Record<string, { type: string; required?: boolean; description?: string; enum?: string[] }>
): Promise<OntologyConcept> {
	const ontology = await loadOntology(ontologyId);
	const concept = ontology.concepts.find((c) => c.id === conceptId);
	if (!concept) {
		throw new Error(`概念 "${conceptId}" 不存在`);
	}

	concept.attributes = attributes;
	ontology.updatedAt = new Date().toISOString();
	await saveOntology(ontologyId, ontology);
	return concept;
}

// ============================================================================
// 概念关系操作
// ============================================================================

export async function createConceptRelation(
	ontologyId: string,
	sourceId: string,
	targetId: string,
	type: string,
	cardinality?: string
): Promise<OntologyRelation> {
	const ontology = await loadOntology(ontologyId);

	// 检查关系是否已存在
	const exists = (ontology.relations ?? []).find(
		(r) => r.sourceId === sourceId && r.targetId === targetId && r.type === type
	);
	if (exists) {
		throw new Error(`该概念关系已存在: ${sourceId} -> ${targetId} (${type})`);
	}

	const relationId = `rel-${Date.now()}`;
	const newRelation: OntologyRelation = {
		id: relationId,
		sourceId,
		targetId,
		type,
		cardinality: cardinality || "N:M",
	};

	ontology.relations = ontology.relations ?? [];
	ontology.relations.push(newRelation);
	ontology.updatedAt = new Date().toISOString();
	await saveOntology(ontologyId, ontology);
	return newRelation;
}

export async function deleteConceptRelation(ontologyId: string, relationId: string): Promise<void> {
	const ontology = await loadOntology(ontologyId);
	const existing = ontology.relations ?? [];
	const filtered = existing.filter((r) => r.id !== relationId);

	if (filtered.length === existing.length) {
		throw new Error(`关系 "${relationId}" 不存在`);
	}

	ontology.relations = filtered;
	ontology.updatedAt = new Date().toISOString();
	await saveOntology(ontologyId, ontology);
}

// ============================================================================
// 搜索
// ============================================================================

export async function searchOntology(
	ontologyId: string,
	query: string
): Promise<{ domains: OntologyDomain[]; concepts: OntologyConcept[]; totalMatches: number }> {
	const ontology = await loadOntology(ontologyId);
	const q = query.toLowerCase();

	const matchingDomains = ontology.domains.filter(
		(d) =>
			d.name?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q)
	);

	const matchingConcepts = ontology.concepts.filter(
		(c) =>
			c.name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
	);

	return {
		domains: matchingDomains,
		concepts: matchingConcepts,
		totalMatches: matchingDomains.length + matchingConcepts.length,
	};
}

// ============================================================================
// 概念列表
// ============================================================================

export async function listConcepts(
	ontologyId: string,
	domainId?: string
): Promise<OntologyConcept[]> {
	const ontology = await loadOntology(ontologyId);
	let concepts = ontology.concepts ?? [];
	if (domainId) {
		concepts = concepts.filter((c) => c.domainId === domainId);
	}
	return concepts;
}
