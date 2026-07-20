import { getIpcRenderer, isElectron } from '../env';
import { IPC_CHANNELS, type IpcResponse } from '../ipc-protocol';

export type UpdateStatus =
  | 'idle'
  | 'unsupported'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateInfo {
  version?: string;
  releaseDate?: string;
  releaseName?: string;
  releaseNotes?: string | null | Array<{ note?: string; version?: string }>;
}

export interface UpdateProgress {
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
}

export interface UpdateState {
  status: UpdateStatus;
  available: boolean;
  currentVersion: string;
  updateInfo?: UpdateInfo;
  progress?: UpdateProgress;
  error?: string;
  lastCheckedAt?: string;
}

const unsupportedState: UpdateState = {
  status: 'unsupported',
  available: false,
  currentVersion: 'web',
  error: '自动更新仅在桌面应用中可用。',
};

function ok<T>(data: T): IpcResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

export async function getUpdateStatus(): Promise<IpcResponse<UpdateState>> {
  if (!isElectron()) {
    return ok(unsupportedState);
  }

  return getIpcRenderer().invoke<IpcResponse<UpdateState>>(IPC_CHANNELS.UPDATE_STATUS);
}

export async function checkForUpdates(): Promise<IpcResponse<UpdateState>> {
  if (!isElectron()) {
    return ok(unsupportedState);
  }

  return getIpcRenderer().invoke<IpcResponse<UpdateState>>(IPC_CHANNELS.UPDATE_CHECK);
}

export async function downloadUpdate(): Promise<IpcResponse<UpdateState>> {
  if (!isElectron()) {
    return ok(unsupportedState);
  }

  return getIpcRenderer().invoke<IpcResponse<UpdateState>>(IPC_CHANNELS.UPDATE_DOWNLOAD);
}

export async function installUpdate(): Promise<IpcResponse<UpdateState>> {
  if (!isElectron()) {
    return ok(unsupportedState);
  }

  return getIpcRenderer().invoke<IpcResponse<UpdateState>>(IPC_CHANNELS.UPDATE_INSTALL);
}

export function subscribeToUpdateEvents(listener: (state: UpdateState) => void): () => void {
  if (!isElectron()) {
    return () => undefined;
  }

  return getIpcRenderer().on(IPC_CHANNELS.UPDATE_EVENT, (state: unknown) => {
    listener(state as UpdateState);
  });
}
