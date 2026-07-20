import { getIpcRenderer, isElectron } from '../env';
import { IPC_CHANNELS, type IpcResponse } from '../ipc-protocol';
import type { OntologyEntity, OntologyRelation } from '../../../../types/ontology';
import type {
  ChatRequest,
  ConfirmOntologyRequest,
  GenerateOntologyRequest,
  UpdateOntologyRequest,
} from '../../../../types/api';

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

export async function listOntologyEntities(
  type?: string
): Promise<IpcResponse<OntologyEntity[]>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<OntologyEntity[]>>(
      IPC_CHANNELS.ONTOLOGY_ENTITY_LIST,
      type
    );
  }

  const url = type
    ? `/api/ontology/entities?type=${encodeURIComponent(type)}`
    : '/api/ontology/entities';
  const response = await fetch(url);
  return readJsonResponse<IpcResponse<OntologyEntity[]>>(response);
}

export async function getOntologyEntity(
  entityId: string
): Promise<IpcResponse<OntologyEntity>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<OntologyEntity>>(
      IPC_CHANNELS.ONTOLOGY_ENTITY_GET,
      entityId
    );
  }

  const response = await fetch(`/api/ontology/entities/${encodeURIComponent(entityId)}`);
  return readJsonResponse<IpcResponse<OntologyEntity>>(response);
}

export async function createOntologyEntity(
  entity: OntologyEntity
): Promise<IpcResponse<OntologyEntity>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<OntologyEntity>>(
      IPC_CHANNELS.ONTOLOGY_ENTITY_CREATE,
      { entity }
    );
  }

  const response = await fetch('/api/ontology/entities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'create', entity }),
  });
  return readJsonResponse<IpcResponse<OntologyEntity>>(response);
}

export async function createOntologyRelation(
  relation: OntologyRelation
): Promise<IpcResponse<OntologyRelation>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<OntologyRelation>>(
      IPC_CHANNELS.ONTOLOGY_ENTITY_CREATE,
      { relation }
    );
  }

  const response = await fetch('/api/ontology/entities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'relate', ...relation }),
  });
  return readJsonResponse<IpcResponse<OntologyRelation>>(response);
}

export async function updateOntologyEntity(
  entityId: string,
  properties: Record<string, unknown>
): Promise<IpcResponse<OntologyEntity>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<OntologyEntity>>(
      IPC_CHANNELS.ONTOLOGY_ENTITY_UPDATE,
      entityId,
      properties
    );
  }

  const response = await fetch(`/api/ontology/entities/${encodeURIComponent(entityId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'update', properties }),
  });
  return readJsonResponse<IpcResponse<OntologyEntity>>(response);
}

export async function deleteOntologyEntity(
  entityId: string
): Promise<IpcResponse<{ deleted: true }>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<{ deleted: true }>>(
      IPC_CHANNELS.ONTOLOGY_ENTITY_DELETE,
      entityId
    );
  }

  const response = await fetch(`/api/ontology/entities/${encodeURIComponent(entityId)}`, {
    method: 'DELETE',
  });
  return readJsonResponse<IpcResponse<{ deleted: true }>>(response);
}

export async function getRelatedEntities(
  entityId: string,
  relType?: string,
  direction?: 'outgoing' | 'incoming' | 'both'
): Promise<IpcResponse<Array<{ relation: string; entity: OntologyEntity }>>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<Array<{ relation: string; entity: OntologyEntity }>>>(
      IPC_CHANNELS.ONTOLOGY_ENTITY_RELATED,
      entityId,
      relType,
      direction
    );
  }

  const params = new URLSearchParams();
  if (relType) params.set('rel', relType);
  if (direction) params.set('dir', direction);
  const query = params.toString();

  const response = await fetch(
    `/api/ontology/entities/${encodeURIComponent(entityId)}/related${query ? `?${query}` : ''}`
  );
  return readJsonResponse<IpcResponse<Array<{ relation: string; entity: OntologyEntity }>>>(response);
}

export async function generateOntology(
  request: GenerateOntologyRequest
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_GENERATE,
      request
    );
  }

  const response = await fetch('/api/ontology/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function validateOntology(): Promise<IpcResponse<string[]>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<string[]>>(IPC_CHANNELS.ONTOLOGY_VALIDATE);
  }

  const response = await fetch('/api/ontology/validate');
  return readJsonResponse<IpcResponse<string[]>>(response);
}

export async function getOntology(ontologyId: string): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_GET,
      { ontologyId }
    );
  }

  const response = await fetch(`/api/ontology/${encodeURIComponent(ontologyId)}`);
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function updateOntology(
  ontologyId: string,
  request: UpdateOntologyRequest
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_UPDATE,
      { ontologyId, ...request }
    );
  }

  const response = await fetch(`/api/ontology/${encodeURIComponent(ontologyId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function confirmOntology(
  ontologyId: string,
  confirmed: boolean
): Promise<IpcResponse<unknown>> {
  const request: ConfirmOntologyRequest = { ontologyId, confirmed };
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_CONFIRM,
      request
    );
  }

  const response = await fetch(`/api/ontology/${encodeURIComponent(ontologyId)}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function chatWithOntology(
  ontologyId: string,
  message: string
): Promise<IpcResponse<unknown>> {
  const request: ChatRequest = { ontologyId, message };
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.ONTOLOGY_CHAT,
      request
    );
  }

  const response = await fetch(`/api/ontology/${encodeURIComponent(ontologyId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}
