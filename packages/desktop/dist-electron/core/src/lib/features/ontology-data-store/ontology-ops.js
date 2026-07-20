"use strict";
/**
 * Ontology Operations — 本体结构操作层
 * 提供领域、概念、概念关系的 CRUD，供工具层和 API 路由调用。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadOntology = loadOntology;
exports.saveOntology = saveOntology;
exports.loadOrCreateOntology = loadOrCreateOntology;
exports.createDomain = createDomain;
exports.deleteDomain = deleteDomain;
exports.createConcept = createConcept;
exports.deleteConcept = deleteConcept;
exports.updateConceptSchema = updateConceptSchema;
exports.createConceptRelation = createConceptRelation;
exports.deleteConceptRelation = deleteConceptRelation;
exports.searchOntology = searchOntology;
exports.listConcepts = listConcepts;
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = require("fs");
const config_1 = require("./config");
// ============================================================================
// 路径工具
// ============================================================================
function getOntologyDir(ontologyId) {
    return (0, config_1.ontologyDir)(ontologyId);
}
function ontologyJsonPath(ontologyId) {
    return (0, config_1.schemaPath)(ontologyId);
}
async function ensureDir(dirPath) {
    await promises_1.default.mkdir(dirPath, { recursive: true });
}
// ============================================================================
// 核心读写
// ============================================================================
async function loadOntology(ontologyId) {
    if (!(0, config_1.isValidId)(ontologyId)) {
        throw new Error("Invalid ontology ID: path traversal detected");
    }
    const fp = ontologyJsonPath(ontologyId);
    if (!(0, fs_1.existsSync)(fp)) {
        throw new Error(`本体不存在: ${ontologyId}`);
    }
    const content = await promises_1.default.readFile(fp, "utf-8");
    return JSON.parse(content);
}
async function saveOntology(ontologyId, data) {
    if (!(0, config_1.isValidId)(ontologyId)) {
        throw new Error("Invalid ontology ID: path traversal detected");
    }
    const fp = ontologyJsonPath(ontologyId);
    await ensureDir(getOntologyDir(ontologyId));
    await promises_1.default.writeFile(fp, JSON.stringify(data, null, 2), "utf-8");
}
async function loadOrCreateOntology(ontologyId) {
    if (!(0, config_1.isValidId)(ontologyId)) {
        throw new Error("Invalid ontology ID: path traversal detected");
    }
    const fp = ontologyJsonPath(ontologyId);
    if (!(0, fs_1.existsSync)(fp)) {
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
async function createDomain(ontologyId, name, description) {
    const ontology = await loadOrCreateOntology(ontologyId);
    if (ontology.domains.some((d) => d.name === name)) {
        throw new Error(`领域 "${name}" 已存在`);
    }
    const newDomain = {
        id: `domain-${Date.now()}`,
        name,
        description: description || "",
    };
    ontology.domains.push(newDomain);
    ontology.updatedAt = new Date().toISOString();
    await saveOntology(ontologyId, ontology);
    return newDomain;
}
async function deleteDomain(ontologyId, domainId) {
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
    ontology.relations = ontology.relations.filter((r) => !conceptIds.includes(r.sourceId) && !conceptIds.includes(r.targetId));
    ontology.updatedAt = new Date().toISOString();
    await saveOntology(ontologyId, ontology);
    // 删除数据目录
    const dir = `${getOntologyDir(ontologyId)}/data/${domainId}`;
    if ((0, fs_1.existsSync)(dir)) {
        await promises_1.default.rm(dir, { recursive: true });
    }
}
// ============================================================================
// 概念操作
// ============================================================================
async function createConcept(ontologyId, domainId, name, type, description, attributes) {
    const ontology = await loadOntology(ontologyId);
    const domain = ontology.domains.find((d) => d.id === domainId);
    if (!domain) {
        throw new Error(`领域 "${domainId}" 不存在`);
    }
    const conceptId = `concept-${Date.now()}`;
    const newConcept = {
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
    await promises_1.default.writeFile(`${conceptDataDir}/_index.json`, JSON.stringify({ instanceIds: [] }), "utf-8");
    return newConcept;
}
async function deleteConcept(ontologyId, conceptId) {
    const ontology = await loadOntology(ontologyId);
    const concept = ontology.concepts.find((c) => c.id === conceptId);
    if (!concept) {
        throw new Error(`概念 "${conceptId}" 不存在`);
    }
    // 删除概念
    ontology.concepts = ontology.concepts.filter((c) => c.id !== conceptId);
    // 删除涉及该概念的关系
    ontology.relations = ontology.relations.filter((r) => r.sourceId !== conceptId && r.targetId !== conceptId);
    ontology.updatedAt = new Date().toISOString();
    await saveOntology(ontologyId, ontology);
    // 删除数据目录
    const dir = `${getOntologyDir(ontologyId)}/data/${concept.domainId}/${conceptId}`;
    if ((0, fs_1.existsSync)(dir)) {
        await promises_1.default.rm(dir, { recursive: true });
    }
}
async function updateConceptSchema(ontologyId, conceptId, attributes) {
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
async function createConceptRelation(ontologyId, sourceId, targetId, type, cardinality) {
    const ontology = await loadOntology(ontologyId);
    // 检查关系是否已存在
    const exists = (ontology.relations ?? []).find((r) => r.sourceId === sourceId && r.targetId === targetId && r.type === type);
    if (exists) {
        throw new Error(`该概念关系已存在: ${sourceId} -> ${targetId} (${type})`);
    }
    const relationId = `rel-${Date.now()}`;
    const newRelation = {
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
async function deleteConceptRelation(ontologyId, relationId) {
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
async function searchOntology(ontologyId, query) {
    const ontology = await loadOntology(ontologyId);
    const q = query.toLowerCase();
    const matchingDomains = ontology.domains.filter((d) => d.name?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q));
    const matchingConcepts = ontology.concepts.filter((c) => c.name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
    return {
        domains: matchingDomains,
        concepts: matchingConcepts,
        totalMatches: matchingDomains.length + matchingConcepts.length,
    };
}
// ============================================================================
// 概念列表
// ============================================================================
async function listConcepts(ontologyId, domainId) {
    const ontology = await loadOntology(ontologyId);
    let concepts = ontology.concepts ?? [];
    if (domainId) {
        concepts = concepts.filter((c) => c.domainId === domainId);
    }
    return concepts;
}
