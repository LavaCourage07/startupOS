import { getIpcRenderer, isElectron } from '../env';
import { IPC_CHANNELS, type IpcResponse } from '../ipc-protocol';

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T;
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? JSON.stringify((payload as { error: unknown }).error)
        : response.statusText;
    throw new Error(message);
  }
  return payload;
}

// ── Domain ────────────────────────────────────────────────────

export async function createOntologyDomain(
  ontologyId: string,
  name: string,
  description?: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_DOMAIN_CREATE,
      { ontologyId, name, description }
    );
  }

  const response = await fetch('/api/ontology-data/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ontologyId, name, description }),
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function deleteOntologyDomain(
  ontologyId: string,
  domainId: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_DOMAIN_DELETE,
      { ontologyId, domainId }
    );
  }

  const response = await fetch(`/api/ontology-data/domains/${encodeURIComponent(domainId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ontologyId }),
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

// ── Concept ───────────────────────────────────────────────────

export async function listOntologyConcepts(
  ontologyId: string
): Promise<IpcResponse<unknown>> {
  console.log('[ontology-data bridge] listOntologyConcepts', { ontologyId, isElectron: isElectron() });
  if (isElectron()) {
    const result = await getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_LIST,
      ontologyId
    );
    console.log('[ontology-data bridge] listOntologyConcepts IPC result', { ontologyId, result });
    return result;
  }

  const response = await fetch(`/api/ontology-data/concepts?ontologyId=${encodeURIComponent(ontologyId)}`);
  const result = await readJsonResponse<IpcResponse<unknown>>(response);
  console.log('[ontology-data bridge] listOntologyConcepts HTTP result', { ontologyId, result });
  return result;
}

export async function createOntologyConcept(
  ontologyId: string,
  domainId: string,
  name: string,
  type: string,
  description?: string,
  attributes?: Record<string, unknown>
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_CREATE,
      { ontologyId, domainId, name, type, description, attributes }
    );
  }

  const response = await fetch('/api/ontology-data/concepts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ontologyId, domainId, name, type, description, attributes }),
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

// ── Instance ──────────────────────────────────────────────────

export async function listOntologyInstances(
  ontologyId: string,
  conceptId: string,
  page?: number,
  limit?: number
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_INSTANCE_LIST,
      { ontologyId, conceptId, page, limit }
    );
  }

  const params = new URLSearchParams({
    ontologyId,
    conceptId,
  });
  if (page !== undefined) params.set('page', String(page));
  if (limit !== undefined) params.set('limit', String(limit));

  const response = await fetch(`/api/ontology-data/instances?${params.toString()}`);
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function createOntologyInstance(
  ontologyId: string,
  conceptId: string,
  fields: Record<string, unknown>,
  createdBy?: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_INSTANCE_CREATE,
      { ontologyId, conceptId, fields, createdBy }
    );
  }

  const response = await fetch('/api/ontology-data/instances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ontologyId, conceptId, fields, createdBy }),
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function updateOntologyInstance(
  ontologyId: string,
  instanceId: string,
  conceptId: string,
  domainId: string,
  fields: Record<string, unknown>
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_INSTANCE_UPDATE,
      { ontologyId, instanceId, conceptId, domainId, fields }
    );
  }

  const response = await fetch(
    `/api/ontology-data/instances/${encodeURIComponent(instanceId)}?ontologyId=${encodeURIComponent(ontologyId)}&conceptId=${encodeURIComponent(conceptId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    }
  );
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function deleteOntologyInstance(
  ontologyId: string,
  instanceId: string,
  conceptId: string,
  domainId: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_INSTANCE_DELETE,
      { ontologyId, instanceId, conceptId, domainId }
    );
  }

  const response = await fetch(
    `/api/ontology-data/instances/${encodeURIComponent(instanceId)}?ontologyId=${encodeURIComponent(ontologyId)}&conceptId=${encodeURIComponent(conceptId)}`,
    { method: 'DELETE' }
  );
  return readJsonResponse<IpcResponse<unknown>>(response);
}

// ── Sync ──────────────────────────────────────────────────────

export async function syncOntologyData(
  ontologyId: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_SYNC,
      { ontologyId }
    );
  }

  const response = await fetch(`/api/ontology-data/sync?ontologyId=${encodeURIComponent(ontologyId)}`, {
    method: 'POST',
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

// ── Concept Schema ────────────────────────────────────────────

export async function getConceptSchema(
  conceptId: string,
  ontologyId: string
): Promise<IpcResponse<unknown>> {
  console.log('[ontology-data bridge] getConceptSchema', { ontologyId, conceptId, isElectron: isElectron() });
  if (isElectron()) {
    const result = await getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_SCHEMA_GET,
      { conceptId, ontologyId }
    );
    console.log('[ontology-data bridge] getConceptSchema IPC result', { ontologyId, conceptId, result });
    return result;
  }

  const response = await fetch(`/api/ontology-data/concepts/${encodeURIComponent(conceptId)}/schema?ontologyId=${encodeURIComponent(ontologyId)}`);
  const result = await readJsonResponse<IpcResponse<unknown>>(response);
  console.log('[ontology-data bridge] getConceptSchema HTTP result', { ontologyId, conceptId, result });
  return result;
}

export async function updateConceptSchema(
  conceptId: string,
  ontologyId: string,
  domainId: string,
  fields: unknown[]
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_SCHEMA_UPDATE,
      { conceptId, ontologyId, domainId, fields }
    );
  }

  const response = await fetch(
    `/api/ontology-data/concepts/${encodeURIComponent(conceptId)}/schema?ontologyId=${encodeURIComponent(ontologyId)}&domainId=${encodeURIComponent(domainId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    }
  );
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function deleteOntologyConcept(
  conceptId: string,
  ontologyId: string,
  domainId: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_DELETE,
      { conceptId, ontologyId, domainId }
    );
  }

  const response = await fetch(`/api/ontology-data/concepts/${encodeURIComponent(conceptId)}?ontologyId=${encodeURIComponent(ontologyId)}&domainId=${encodeURIComponent(domainId)}`, {
    method: 'DELETE',
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

// ── Relations ─────────────────────────────────────────────────

export async function listInstanceRelations(
  ontologyId: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_RELATION_INSTANCE_LIST,
      { ontologyId }
    );
  }

  const response = await fetch(`/api/ontology-data/relations/instances?ontologyId=${encodeURIComponent(ontologyId)}`);
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function listConceptRelations(
  ontologyId: string
): Promise<IpcResponse<unknown>> {
  console.log('[ontology-data bridge] listConceptRelations', { ontologyId, isElectron: isElectron() });
  if (isElectron()) {
    const result = await getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_RELATION_CONCEPT_LIST,
      { ontologyId }
    );
    console.log('[ontology-data bridge] listConceptRelations IPC result', { ontologyId, result });
    return result;
  }

  const response = await fetch(`/api/ontology-data/relations/concepts?ontologyId=${encodeURIComponent(ontologyId)}`);
  const result = await readJsonResponse<IpcResponse<unknown>>(response);
  console.log('[ontology-data bridge] listConceptRelations HTTP result', { ontologyId, result });
  return result;
}

export async function createConceptRelation(
  ontologyId: string,
  relation: { sourceId: string; targetId: string; type: string; cardinality: string }
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_RELATION_CONCEPT_CREATE,
      { ontologyId, ...relation }
    );
  }

  const response = await fetch(`/api/ontology-data/relations/concepts?ontologyId=${encodeURIComponent(ontologyId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(relation),
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function deleteConceptRelation(
  ontologyId: string,
  relationId: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_RELATION_CONCEPT_DELETE,
      { ontologyId, relationId }
    );
  }

  const response = await fetch(`/api/ontology-data/relations/concepts?ontologyId=${encodeURIComponent(ontologyId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ relationId }),
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function createInstanceRelation(
  ontologyId: string,
  relation: {
    sourceInstanceId: string;
    targetInstanceId: string;
    type: string;
    sourceConceptId: string;
    targetConceptId: string;
  }
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_RELATION_INSTANCE_CREATE,
      { ontologyId, ...relation }
    );
  }

  const response = await fetch(`/api/ontology-data/relations/instances?ontologyId=${encodeURIComponent(ontologyId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(relation),
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function deleteInstanceRelation(
  ontologyId: string,
  relationId: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_DATA_RELATION_INSTANCE_DELETE,
      { ontologyId, relationId }
    );
  }

  const response = await fetch(`/api/ontology-data/relations/instances?ontologyId=${encodeURIComponent(ontologyId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ relationId }),
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}
