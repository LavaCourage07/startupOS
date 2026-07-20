/**
 * Dock Store - Zustand State Management (with Agent Integration)
 * Story OS.2: Dock 任务栏基础 + OS.3: Agent 对象定义
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DockApp, DockSide, DockState } from '@originos/core/types';

// 默认 Dock 快捷入口
const DEFAULT_DOCK_APPS: DockApp[] = [
  {
    id: 'app-project-create',
    name: '创建项目',
    icon: '➕',
    iconType: 'emoji',
    isRunning: false,
    isPinned: true,
    index: 0,
    appType: 'action',
  },
  {
    id: 'app-workspace',
    name: '工作区',
    icon: '📝',
    iconType: 'emoji',
    isRunning: false,
    isPinned: true,
    index: 1,
    appType: 'action',
  },
  {
    id: 'skill-agent-creator',
    name: '创建 Agent',
    icon: '🤖',
    iconType: 'emoji',
    isRunning: false,
    isPinned: true,
    index: 2,
    appType: 'skill',
    skillName: 'agent-creator',
  },
  {
    id: 'skill-role-agent-creator',
    name: '创建角色',
    icon: '🎭',
    iconType: 'emoji',
    isRunning: false,
    isPinned: true,
    index: 3,
    appType: 'skill',
    skillName: 'role-agent-creator',
  },
  {
    id: 'skill-creator',
    name: '创建技能',
    icon: '⚡',
    iconType: 'emoji',
    isRunning: false,
    isPinned: true,
    index: 4,
    appType: 'skill',
    skillName: 'skill-creator-app',
  },
  {
    id: 'app-brainstorming',
    name: '头脑风暴',
    icon: '💡',
    iconType: 'emoji',
    isRunning: false,
    isPinned: false,
    index: 5,
    appType: 'skill',
    skillName: 'bmad-brainstorming',
  },
  {
    id: 'app-workflow-builder',
    name: '工作流构建',
    icon: '🔗',
    iconType: 'emoji',
    isRunning: false,
    isPinned: false,
    index: 6,
    appType: 'skill',
    skillName: 'bmad-workflow-builder',
  },
  {
    id: 'sandbox',
    name: '代码沙箱',
    icon: '🔬',
    iconType: 'emoji',
    isRunning: false,
    isPinned: true,
    index: 7,
    appType: 'sandbox',
  },
];

// Dock Store
const useDockStore = create<DockState>()(
  persist(
    (set, _get) => ({
      // Initial state
      apps: DEFAULT_DOCK_APPS,
      selectedAppId: null,
      draggedAppId: null,
      draggedAppIndex: null,
      hoveringAppId: null,
      dockSide: 'left' as DockSide,
      dockPosition: { x: 0, y: 0 },
      dockWidth: 0,
      dockContextMenu: {
        isOpen: false,
        appId: null,
        position: null,
      },

      // Actions
      setApps: (apps) => set({ apps }),

      addApp: (app) =>
        set((state) => ({
          apps: [...state.apps, { ...app, index: state.apps.length }],
        })),

      removeApp: (appId) =>
        set((state) => ({
          apps: state.apps.filter((a) => a.id !== appId),
          draggedAppId: state.draggedAppId === appId ? null : state.draggedAppId,
        })),

      updateApp: (appId, updates) =>
        set((state) => ({
          apps: state.apps.map((app) =>
            app.id === appId ? { ...app, ...updates } : app
          ),
        })),

      moveApp: (fromIndex, toIndex) =>
        set((state) => {
          if (fromIndex === toIndex) return state;

          const newApps = [...state.apps];
          const [removed] = newApps.splice(fromIndex, 1);
          if (removed) newApps.splice(toIndex, 0, removed);

          return {
            apps: newApps.map((app, idx) => ({ ...app, index: idx })),
          };
        }),

      setAppRunning: (appId, isRunning) =>
        set((state) => ({
          apps: state.apps.map((app) =>
            app.id === appId ? { ...app, isRunning } : app
          ),
        })),

      selectApp: (appId) => set({ selectedAppId: appId }),

      setDraggedApp: (appId, index = null) =>
        set({ draggedAppId: appId, draggedAppIndex: index }),

      setHoveringApp: (appId) => set({ hoveringAppId: appId }),

      pinApp: (appId) =>
        set((state) => ({
          apps: state.apps.map((app) =>
            app.id === appId ? { ...app, isPinned: true } : app
          ),
        })),

      unpinApp: (appId) =>
        set((state) => ({
          apps: state.apps.filter((a) => a.id !== appId),
        })),

      uninstallApp: (appId) =>
        set((state) => ({
          apps: state.apps.filter((a) => a.id !== appId),
        })),

      openDockContextMenu: (appId, position) =>
        set({
          dockContextMenu: { isOpen: true, appId, position },
        }),

      closeDockContextMenu: () =>
        set({
          dockContextMenu: { isOpen: false, appId: null, position: null },
        }),

      setDockSide: (side) => set({ dockSide: side }),

      updateDockPosition: (position) => set({ dockPosition: position }),
    }),
    {
      name: 'originos-dock-store',
      // Only persist pinned apps and their order — runtime state is volatile
      partialize: (state) => ({
        dockSide: state.dockSide,
        apps: state.apps.map(({ id, name, icon, iconType, iconUrl, iconComponent, isPinned, appType, skillName }) => ({
          id, name, icon, iconType, iconUrl, iconComponent, isPinned, appType, skillName,
        })),
      }),
      // Merge persisted apps with any new default pinned apps
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<DockState>;

        // Deduplicate persisted apps by skillName (keep first occurrence)
        const seenSkillNames = new Set<string>();
        const dedupedApps = (persisted.apps ?? []).filter((a) => {
          if (!a.skillName) return true;
          if (seenSkillNames.has(a.skillName)) return false;
          seenSkillNames.add(a.skillName);
          return true;
        });

        const persistedIds = new Set(dedupedApps.map((a) => a.id));
        const missingDefaults = DEFAULT_DOCK_APPS.filter(
          (a) => a.isPinned && !persistedIds.has(a.id) && !(a.skillName && seenSkillNames.has(a.skillName))
        );
        return {
          ...currentState,
          ...persisted,
          dockSide: isDockSide(persisted.dockSide) ? persisted.dockSide : currentState.dockSide,
          apps: [...dedupedApps, ...missingDefaults],
        };
      },
    }
  )
);

function isDockSide(value: unknown): value is DockSide {
  return value === 'left' || value === 'bottom' || value === 'right';
}

export default useDockStore;
