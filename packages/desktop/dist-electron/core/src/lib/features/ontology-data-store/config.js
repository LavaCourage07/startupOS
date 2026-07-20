"use strict";
/**
 * Ontology Data Store 配置：目录结构、路径工具
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectIdFromOntologyId = projectIdFromOntologyId;
exports.ontologyDir = ontologyDir;
exports.schemaPath = schemaPath;
exports.instanceDir = instanceDir;
exports.instancePath = instancePath;
exports.indexPath = indexPath;
exports.versionDir = versionDir;
exports.versionPath = versionPath;
exports.instanceRelationsPath = instanceRelationsPath;
exports.isValidId = isValidId;
const path_1 = __importDefault(require("path"));
const paths_1 = require("../../paths");
function projectIdFromOntologyId(ontologyId) {
    if (ontologyId.startsWith('ontology-project-proj-')) {
        return ontologyId.slice('ontology-project-'.length);
    }
    if (/^ontology-project-\d/.test(ontologyId)) {
        return ontologyId.slice('ontology-project-'.length);
    }
    if (ontologyId.startsWith('ontology_')) {
        return ontologyId.slice('ontology_'.length);
    }
    if (ontologyId.startsWith('ontology-')) {
        return ontologyId.slice('ontology-'.length);
    }
    return ontologyId;
}
function ontologyDir(ontologyId) {
    const projectId = projectIdFromOntologyId(ontologyId);
    return path_1.default.join((0, paths_1.getDataRoot)(), "projects", projectId, "ontology");
}
function schemaPath(ontologyId) {
    return path_1.default.join(ontologyDir(ontologyId), "ontology.json");
}
function instanceDir(ontologyId, conceptId) {
    return path_1.default.join(ontologyDir(ontologyId), "data", conceptId);
}
function instancePath(ontologyId, conceptId, instanceId) {
    return path_1.default.join(instanceDir(ontologyId, conceptId), `${instanceId}.json`);
}
function indexPath(ontologyId, conceptId) {
    return path_1.default.join(instanceDir(ontologyId, conceptId), "_index.json");
}
function versionDir(ontologyId, instanceId) {
    return path_1.default.join(ontologyDir(ontologyId), "versions", instanceId);
}
function versionPath(ontologyId, instanceId, version) {
    return path_1.default.join(versionDir(ontologyId, instanceId), `${version}.json`);
}
function instanceRelationsPath(ontologyId) {
    return path_1.default.join(ontologyDir(ontologyId), "instance-relations.json");
}
/** 验证 ID 安全，防止路径遍历 */
function isValidId(id) {
    const normalized = path_1.default.normalize(id);
    return !normalized.startsWith("..") && !path_1.default.isAbsolute(normalized);
}
