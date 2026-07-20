"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInstanceRelations = listInstanceRelations;
exports.createInstanceRelation = createInstanceRelation;
exports.deleteInstanceRelation = deleteInstanceRelation;
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const ontology_ops_1 = require("./ontology-ops");
async function readInstanceRelations(ontologyId) {
    if (!(0, config_1.isValidId)(ontologyId)) {
        throw new Error("Invalid ontology ID: path traversal detected");
    }
    const filePath = (0, config_1.instanceRelationsPath)(ontologyId);
    if (!(0, fs_1.existsSync)(filePath)) {
        return { relations: [] };
    }
    const content = await promises_1.default.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);
    return { relations: Array.isArray(parsed.relations) ? parsed.relations : [] };
}
async function writeInstanceRelations(ontologyId, data) {
    const filePath = (0, config_1.instanceRelationsPath)(ontologyId);
    await promises_1.default.mkdir(path_1.default.dirname(filePath), { recursive: true });
    await promises_1.default.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}
async function listInstanceRelations(ontologyId) {
    const [stored, ontology] = await Promise.all([
        readInstanceRelations(ontologyId),
        (0, ontology_ops_1.loadOntology)(ontologyId),
    ]);
    return {
        relations: stored.relations,
        constraints: ontology.relations ?? [],
    };
}
async function createInstanceRelation(ontologyId, input) {
    const stored = await readInstanceRelations(ontologyId);
    const relation = {
        id: `irel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sourceInstanceId: input.sourceInstanceId,
        targetInstanceId: input.targetInstanceId,
        type: input.type,
        sourceConceptId: input.sourceConceptId,
        targetConceptId: input.targetConceptId,
    };
    await writeInstanceRelations(ontologyId, {
        relations: [...stored.relations, relation],
    });
    return relation;
}
async function deleteInstanceRelation(ontologyId, relationId) {
    const stored = await readInstanceRelations(ontologyId);
    const relations = stored.relations.filter((relation) => relation.id !== relationId);
    if (relations.length === stored.relations.length) {
        throw new Error(`实例关系 "${relationId}" 不存在`);
    }
    await writeInstanceRelations(ontologyId, { relations });
}
