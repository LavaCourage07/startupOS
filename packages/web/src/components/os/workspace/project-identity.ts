export function normalizeProjectEntryId(projectId: string): string {
  if (projectId.startsWith('project-proj-')) {
    return projectId.slice('project-'.length);
  }
  if (/^project-\d/.test(projectId)) {
    return projectId.slice('project-'.length);
  }
  return projectId;
}

export function normalizeOntologyId(
  ontologyId: string | undefined | null,
  projectId: string | undefined | null,
): string | null {
  if (ontologyId && ontologyId.trim().length > 0) {
    const trimmed = ontologyId.trim();
    if (trimmed.startsWith('ontology_')) {
      return `ontology-${normalizeProjectEntryId(trimmed.slice('ontology_'.length))}`;
    }
    if (trimmed.startsWith('ontology-project-proj-')) {
      return `ontology-${trimmed.slice('ontology-project-'.length)}`;
    }
    if (/^ontology-project-\d/.test(trimmed)) {
      return `ontology-${trimmed.slice('ontology-project-'.length)}`;
    }
    return trimmed;
  }

  if (!projectId) {
    return null;
  }

  return `ontology-${normalizeProjectEntryId(projectId)}`;
}
