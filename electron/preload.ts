import { contextBridge, ipcRenderer } from 'electron';

type IpcListener = (...args: unknown[]) => void;

const electronApi = {
  isElectron: true,
  ipcRenderer: {
    send(channel: string, payload?: unknown) {
      ipcRenderer.send(channel, payload);
    },
    invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
      return ipcRenderer.invoke(channel, ...args) as Promise<T>;
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
