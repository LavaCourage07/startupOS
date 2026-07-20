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

/**
 * Send a dock action to the main window via IPC (Electron) or CustomEvent (Web).
 * Use this in the Dock component to ensure cross-window communication works in Electron.
 */
export function sendDockAction(detail: Record<string, unknown>): void {
  if (isElectron()) {
    void getIpcRenderer().invoke(IPC_CHANNELS.DOCK_ACTION, detail);
  } else {
    window.dispatchEvent(new CustomEvent('dock:action', { detail }));
  }
}

/**
 * Sync pinned apps from the main window to the dock window via IPC (Electron only).
 * In Web mode this is a no-op since both share the same zustand store.
 */
export function syncDockApps(apps: unknown[]): void {
  if (isElectron()) {
    getIpcRenderer().send(IPC_CHANNELS.DOCK_SYNC_APPS, apps);
  }
}

/**
 * Subscribe to dock app sync events from the main window (Electron only).
 * Returns an unsubscribe function.
 */
export function onDockAppsSync(listener: (apps: unknown[]) => void): () => void {
  if (!isElectron()) {
    return () => {};
  }
  return getIpcRenderer().on(IPC_CHANNELS.DOCK_SYNC_APPS, (apps: unknown) => {
    if (Array.isArray(apps)) {
      listener(apps);
    }
  });
}
