/**
 * Sandbox Store - 代码沙箱状态管理
 */

import { create } from 'zustand';
import type { SandboxApp, SandboxLog, SandboxErrorInfo, SandboxStoreState } from '@originos/core/types';
import { listSandboxApps } from '@originos/core/lib/integrations/electron/services/misc';

const useSandboxStore = create<SandboxStoreState>((set) => ({
  apps: [],
  activeAppId: null,
  runtime: {},
  isConsoleOpen: false,
  consoleFilter: 'all',

  loadApps: async () => {
    try {
      const result = await listSandboxApps();
      if (result.success && (result.data as { apps?: SandboxApp[] })?.apps) {
        set({ apps: (result.data as { apps: SandboxApp[] }).apps });
      }
    } catch (error) {
      console.error('[SandboxStore] Failed to load apps:', error);
    }
  },

  setActiveApp: (appId: string | null) => {
    set({ activeAppId: appId });
  },

  addLog: (appId: string, log: SandboxLog) => {
    set((state) => {
      const runtime = state.runtime[appId] ?? { appId, status: 'running', logs: [], errors: [] };
      const logs = runtime.logs.length >= 1000
        ? [...runtime.logs.slice(-500), log]
        : [...runtime.logs, log];
      return {
        runtime: { ...state.runtime, [appId]: { ...runtime, logs } },
      };
    });
  },

  addError: (appId: string, error: SandboxErrorInfo) => {
    set((state) => {
      const runtime = state.runtime[appId] ?? { appId, status: 'running', logs: [], errors: [] };
      return {
        runtime: { ...state.runtime, [appId]: { ...runtime, errors: [...runtime.errors, error] } },
      };
    });
  },

  clearConsole: (appId: string) => {
    set((state) => {
      const runtime = state.runtime[appId];
      if (!runtime) return state;
      return {
        runtime: { ...state.runtime, [appId]: { ...runtime, logs: [], errors: [] } },
      };
    });
  },

  toggleConsole: () => {
    set((state) => ({ isConsoleOpen: !state.isConsoleOpen }));
  },

  setConsoleFilter: (consoleFilter: 'all' | 'log' | 'warn' | 'error') => {
    set({ consoleFilter });
  },
}));

export default useSandboxStore;
