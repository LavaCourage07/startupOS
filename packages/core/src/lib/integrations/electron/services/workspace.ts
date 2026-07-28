import { getIpcRenderer, isElectron } from '../env';
import {
  IPC_CHANNELS,
  type IpcResponse,
  type EntryExportRequest,
  type EntryExportResponse,
  type WorkspaceUploadRequest,
  type WorkspaceUploadResponse,
} from '../ipc-protocol';

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

// ── Workspace Resolve ─────────────────────────────────────────

export async function resolveWorkspace(entryType: string, entryId: string): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.WORKSPACE_RESOLVE,
      { entryType, entryId }
    );
  }

  const response = await fetch(`/api/workspace/resolve?entryType=${encodeURIComponent(entryType)}&entryId=${encodeURIComponent(entryId)}`);
  return readJsonResponse<IpcResponse<unknown>>(response);
}

// ── Workspace File List ───────────────────────────────────────

export async function listWorkspaceFiles(basePath: string): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.WORKSPACE_FILE_LIST,
      { basePath }
    );
  }

  const response = await fetch(`/api/workspace/files?basePath=${encodeURIComponent(basePath)}`);
  return readJsonResponse<IpcResponse<unknown>>(response);
}

// ── Workspace File Read ───────────────────────────────────────

export async function readWorkspaceFile(basePath: string, filePath: string[]): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.WORKSPACE_FILE_READ,
      { basePath, filePath }
    );
  }

  const encodedPath = filePath.map(encodeURIComponent).join('/');
  const response = await fetch(`/api/workspace/files/${encodedPath}?basePath=${encodeURIComponent(basePath)}`);
  return readJsonResponse<IpcResponse<unknown>>(response);
}

// ── Workspace File Write ──────────────────────────────────────

export async function writeWorkspaceFile(basePath: string, filePath: string[], content: string): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.WORKSPACE_FILE_WRITE,
      { basePath, filePath, content }
    );
  }

  const encodedPath = filePath.map(encodeURIComponent).join('/');
  const response = await fetch(`/api/workspace/files/${encodedPath}?basePath=${encodeURIComponent(basePath)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

// ── Workspace File Delete ─────────────────────────────────────

export async function deleteWorkspaceFile(basePath: string, filePath: string[]): Promise<IpcResponse<unknown>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<unknown>>(
      IPC_CHANNELS.WORKSPACE_FILE_DELETE,
      { basePath, filePath }
    );
  }

  const encodedPath = filePath.map(encodeURIComponent).join('/');
  const response = await fetch(`/api/workspace/files/${encodedPath}?basePath=${encodeURIComponent(basePath)}`, {
    method: 'DELETE',
  });
  return readJsonResponse<IpcResponse<unknown>>(response);
}

// ── Workspace File Upload ─────────────────────────────────────

export async function uploadWorkspaceFiles(request: WorkspaceUploadRequest): Promise<IpcResponse<WorkspaceUploadResponse>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<WorkspaceUploadResponse>>(
      IPC_CHANNELS.WORKSPACE_FILE_UPLOAD,
      request
    );
  }

  const formData = new FormData();
  for (const file of request.files) {
    formData.append('files', new Blob([file.content]), file.name);
  }

  const response = await fetch(`/api/workspace/upload?basePath=${encodeURIComponent(request.basePath)}`, {
    method: 'POST',
    body: formData,
  });
  return readJsonResponse<IpcResponse<WorkspaceUploadResponse>>(response);
}

// ── Entry Export ─────────────────────────────────────────────

export async function exportWorkspaceEntry(
  request: EntryExportRequest,
): Promise<IpcResponse<EntryExportResponse>> {
  if (!isElectron()) {
    return {
      success: false,
      error: {
        code: 'UNAVAILABLE',
        message: 'Directory export is only available in the desktop application',
      },
      timestamp: new Date().toISOString(),
    };
  }

  return getIpcRenderer().invoke<IpcResponse<EntryExportResponse>>(
    IPC_CHANNELS.ENTRY_EXPORT,
    request,
  );
}
