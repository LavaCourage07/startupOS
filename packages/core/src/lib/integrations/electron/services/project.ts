import { getIpcRenderer, isElectron } from '../env';
import { IPC_CHANNELS, type IpcResponse } from '../ipc-protocol';
import type {
  Project,
  ProjectListItem,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectQuery,
} from '../../../../types/project';
import type {
  CompleteCreationRequest,
  CompleteCreationResponse,
  StartProjectCreationRequest,
  StartProjectCreationResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '../../../../types/project-creation';

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

function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export async function listProjects(
  query: ProjectQuery = {}
): Promise<IpcResponse<ProjectListItem[]>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<ProjectListItem[]>>(
      IPC_CHANNELS.PROJECT_LIST,
      query
    );
  }

  const response = await fetch(`/api/projects${toQueryString({
    status: query.status,
    userId: query.userId,
    domain: query.domain,
    page: query.page,
    limit: query.limit,
  })}`);
  return readJsonResponse<IpcResponse<ProjectListItem[]>>(response);
}

export async function getProject(
  projectId: string
): Promise<IpcResponse<Project>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<Project>>(
      IPC_CHANNELS.PROJECT_GET,
      projectId
    );
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
  return readJsonResponse<IpcResponse<Project>>(response);
}

export async function createProject(
  request: CreateProjectRequest
): Promise<IpcResponse<Project>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<Project>>(
      IPC_CHANNELS.PROJECT_CREATE,
      request
    );
  }

  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJsonResponse<IpcResponse<Project>>(response);
}

export async function updateProject(
  projectId: string,
  updates: UpdateProjectRequest
): Promise<IpcResponse<Project>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<Project>>(
      IPC_CHANNELS.PROJECT_UPDATE,
      projectId,
      updates
    );
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return readJsonResponse<IpcResponse<Project>>(response);
}

export async function deleteProject(
  projectId: string
): Promise<IpcResponse<{ deleted: true }>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<{ deleted: true }>>(
      IPC_CHANNELS.PROJECT_DELETE,
      projectId
    );
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
  return readJsonResponse<IpcResponse<{ deleted: true }>>(response);
}

export async function getProjectArtifact(
  projectId: string,
  artifactType: string
): Promise<IpcResponse<unknown>> {
  console.log('[project bridge] getProjectArtifact request', { projectId, artifactType, isElectron: isElectron() });
  if (isElectron()) {
    const result = await getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.PROJECT_ARTIFACT_GET,
      { projectId, artifactType }
    );
    console.log('[project bridge] getProjectArtifact IPC result', {
      projectId,
      artifactType,
      success: result.success,
      error: result.error,
      hasData: Boolean(result.data),
    });
    return result;
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(artifactType)}`);
  const result = await readJsonResponse<IpcResponse<unknown>>(response);
  console.log('[project bridge] getProjectArtifact HTTP result', {
    projectId,
    artifactType,
    success: result.success,
    error: result.error,
    hasData: Boolean(result.data),
  });
  return result;
}

export async function initializeProject(
  projectId: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.PROJECT_INITIALIZE,
      { projectId }
    );
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/initialize`, {
    method: 'POST',
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function syncProjectOntology(
  projectId: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.PROJECT_SYNC_ONTOLOGY,
      { projectId }
    );
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/sync-ontology`, {
    method: 'POST',
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function initializeSolution(
  projectId: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.PROJECT_SOLUTION_INITIALIZE,
      { projectId }
    );
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/solution/initialize`, {
    method: 'POST',
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function listSolutions(
  projectId: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.PROJECT_SOLUTION_LIST,
      { projectId }
    );
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/solutions`);
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function getSolution(
  projectId: string,
  version: string
): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.PROJECT_SOLUTION_GET,
      { projectId, version }
    );
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/solutions/${encodeURIComponent(version)}`);
  return readJsonResponse<IpcResponse<unknown>>(response);
}

export async function exportProject(
  projectId: string
): Promise<IpcResponse<string>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<string>>(
      IPC_CHANNELS.PROJECT_EXPORT,
      { projectId }
    );
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/export`);
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(message || response.statusText);
  }
  return {
    success: true,
    data: await response.text(),
    timestamp: new Date().toISOString(),
  };
}

export async function importProject(
  exportJson: string,
  options?: { overwrite?: boolean; newId?: boolean }
): Promise<IpcResponse<Project>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<Project>>(
      IPC_CHANNELS.PROJECT_IMPORT,
      { exportJson, ...options }
    );
  }

  const response = await fetch('/api/projects/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exportJson, ...options }),
  });
  return readJsonResponse<IpcResponse<Project>>(response);
}

export async function startProjectCreation(
  request: StartProjectCreationRequest
): Promise<IpcResponse<StartProjectCreationResponse>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<StartProjectCreationResponse>>(
      IPC_CHANNELS.PROJECT_CREATION_START,
      request
    );
  }

  const response = await fetch('/api/project/create/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const data = await readJsonResponse<StartProjectCreationResponse>(response);
  return { success: true, data, timestamp: new Date().toISOString() };
}

export async function submitProjectCreationAnswer(
  sessionId: string,
  request: Omit<SubmitAnswerRequest, 'sessionId'>
): Promise<IpcResponse<SubmitAnswerResponse>> {
  const payload: SubmitAnswerRequest = { ...request, sessionId };

  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<SubmitAnswerResponse>>(
      IPC_CHANNELS.PROJECT_CREATION_ANSWER,
      payload
    );
  }

  const response = await fetch(`/api/project/create/${encodeURIComponent(sessionId)}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const data = await readJsonResponse<SubmitAnswerResponse>(response);
  return { success: true, data, timestamp: new Date().toISOString() };
}

export async function completeProjectCreation(
  sessionId: string,
  request: Omit<CompleteCreationRequest, 'sessionId'>
): Promise<IpcResponse<CompleteCreationResponse>> {
  const payload: CompleteCreationRequest = { ...request, sessionId };

  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<CompleteCreationResponse>>(
      IPC_CHANNELS.PROJECT_CREATION_COMPLETE,
      payload
    );
  }

  const response = await fetch(`/api/project/create/${encodeURIComponent(sessionId)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const data = await readJsonResponse<CompleteCreationResponse>(response);
  return { success: true, data, timestamp: new Date().toISOString() };
}
