/**
 * Ontology Data Store 配置：目录结构、路径工具
 */

import path from "path";
import { getDataRoot } from '../../paths';

export function projectIdFromOntologyId(ontologyId: string): string {
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

export function ontologyDir(ontologyId: string): string {
  const projectId = projectIdFromOntologyId(ontologyId);
  return path.join(getDataRoot(), "projects", projectId, "ontology");
}

export function schemaPath(ontologyId: string): string {
  return path.join(ontologyDir(ontologyId), "ontology.json");
}

export function instanceDir(ontologyId: string, conceptId: string): string {
  return path.join(ontologyDir(ontologyId), "data", conceptId);
}

export function instancePath(ontologyId: string, conceptId: string, instanceId: string): string {
  return path.join(instanceDir(ontologyId, conceptId), `${instanceId}.json`);
}

export function indexPath(ontologyId: string, conceptId: string): string {
  return path.join(instanceDir(ontologyId, conceptId), "_index.json");
}

export function versionDir(ontologyId: string, instanceId: string): string {
  return path.join(ontologyDir(ontologyId), "versions", instanceId);
}

export function versionPath(ontologyId: string, instanceId: string, version: number): string {
  return path.join(versionDir(ontologyId, instanceId), `${version}.json`);
}

export function instanceRelationsPath(ontologyId: string): string {
  return path.join(ontologyDir(ontologyId), "instance-relations.json");
}

/** 验证 ID 安全，防止路径遍历 */
export function isValidId(id: string): boolean {
  const normalized = path.normalize(id);
  return !normalized.startsWith("..") && !path.isAbsolute(normalized);
}
