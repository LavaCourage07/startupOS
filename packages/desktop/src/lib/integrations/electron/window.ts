import { getIpcRenderer, isElectron } from './env';
import { IPC_CHANNELS } from './ipc-protocol';

export interface NativeWindowConfig {
  id: string;
  title: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  minWidth?: number;
  minHeight?: number;
  route?: string;
  query?: Record<string, string>;
}

export async function createNativeWindow(config: NativeWindowConfig): Promise<string> {
  if (!isElectron()) {
    throw new Error('Native windows are only available in Electron');
  }

  return getIpcRenderer().invoke<string>(IPC_CHANNELS.WINDOW_CREATE, config);
}

export async function closeNativeWindow(windowId: string): Promise<void> {
  if (!isElectron()) return;
  await getIpcRenderer().invoke<void>(IPC_CHANNELS.WINDOW_CLOSE, windowId);
}

export async function focusNativeWindow(windowId: string): Promise<void> {
  if (!isElectron()) return;
  await getIpcRenderer().invoke<void>(IPC_CHANNELS.WINDOW_FOCUS, windowId);
}

export async function minimizeNativeWindow(windowId: string): Promise<void> {
  if (!isElectron()) return;
  await getIpcRenderer().invoke<void>(IPC_CHANNELS.WINDOW_MINIMIZE, windowId);
}

export async function maximizeNativeWindow(windowId: string): Promise<void> {
  if (!isElectron()) return;
  await getIpcRenderer().invoke<void>(IPC_CHANNELS.WINDOW_MAXIMIZE, windowId);
}

export function subscribeToNativeWindowClosed(listener: (windowId: string) => void): () => void {
  if (!isElectron()) {
    return () => {};
  }

  return getIpcRenderer().on(IPC_CHANNELS.WINDOW_CLOSED, (windowId: unknown) => {
    if (typeof windowId === 'string') {
      listener(windowId);
    }
  });
}
