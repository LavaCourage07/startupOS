import { contextBridge, ipcRenderer } from 'electron';

type IpcListener = (...args: unknown[]) => void;

function sanitizeIpcArg(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeIpcArg);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, sanitizeIpcArg(entryValue)])
    );
  }
  return value;
}

const electronApi = {
  isElectron: true,
  ipcRenderer: {
    send(channel: string, payload?: unknown) {
      if (payload === undefined) {
        ipcRenderer.send(channel);
        return;
      }
      ipcRenderer.send(channel, sanitizeIpcArg(payload));
    },
    invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
      return ipcRenderer.invoke(channel, ...args.map(sanitizeIpcArg)) as Promise<T>;
    },
    on(channel: string, listener: IpcListener) {
      const wrappedListener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
        listener(...args);
      };
      ipcRenderer.on(channel, wrappedListener);

      return () => {
        ipcRenderer.removeListener(channel, wrappedListener);
      };
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronApi);
