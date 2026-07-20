/**
 * OS.9: 应用窗口状态管理
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  AppWindowConfig,
  AppWindowData,
  AppWindowState,
  AppWindowPosition,
  AppWindowStoreState,
  DEFAULT_WINDOW_CONSTRAINTS,
  DEFAULT_WINDOW_POSITION,
  WINDOW_ZINDEX_BASE,
  WINDOW_ZINDEX_STEP,
} from '@originos/core/types';

const generateId = () => `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const getCenteredPosition = (width: number, height: number): { x: number; y: number } => {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.max(0, (window.innerWidth - width) / 2),
    y: Math.max(0, (window.innerHeight - height) / 2),
  };
};

export const useAppWindowStore = create<AppWindowStoreState>()(
  subscribeWithSelector((set, get) => ({
    windows: {},
    windowOrder: [],
    focusedWindowId: null,
    maxZIndex: WINDOW_ZINDEX_BASE,

    openWindow: (config: AppWindowConfig): string => {
      // 如果窗口已存在，恢复并聚焦（不创建新实例）
      const existingId = config.id;
      if (existingId && get().windows[existingId]) {
        const id = existingId;
        set((state) => {
          const updatedWindows: Record<string, AppWindowData> = Object.fromEntries(
            Object.entries(state.windows).map(([wid, w]) => [
              wid,
              wid === id
                ? {
                    ...w,
                    isFocused: true,
                    isDragging: false,
                    isResizing: false,
                    // 如果窗口是最小化状态，恢复为 normal
                    state: w.state === 'minimized' ? 'normal' as AppWindowState : w.state,
                    position: { ...w.position, zIndex: state.maxZIndex + WINDOW_ZINDEX_STEP }
                  }
                : { ...w, isFocused: false },
            ])
          );
          return {
            windows: updatedWindows,
            windowOrder: [...state.windowOrder.filter((wid) => wid !== id), id] as string[],
            focusedWindowId: id,
            maxZIndex: state.maxZIndex + WINDOW_ZINDEX_STEP,
          };
        });
        return id;
      }

      const id = config.id || generateId();
      const width = config.position?.width ?? DEFAULT_WINDOW_POSITION.width!;
      const height = config.position?.height ?? DEFAULT_WINDOW_POSITION.height!;
      const centered = getCenteredPosition(width, height);

      const windowData: AppWindowData = {
        id,
        type: config.type,
        title: config.title,
        icon: config.icon,
        state: 'normal',
        position: {
          x: config.position?.x ?? centered.x,
          y: config.position?.y ?? centered.y,
          width,
          height,
          zIndex: get().maxZIndex + WINDOW_ZINDEX_STEP,
        },
        constraints: { ...DEFAULT_WINDOW_CONSTRAINTS, ...config.constraints },
        content: config.content,
        isFocused: true,
        isDragging: false,
        isResizing: false,
        createdAt: Date.now(),
        lastActivatedAt: Date.now(),
        metadata: config.metadata,
        onClose: config.onClose,
      };

      set((state) => {
        // 取消其他窗口聚焦
        const updatedWindows: Record<string, AppWindowData> = Object.fromEntries(
          Object.entries(state.windows).map(([wid, w]) => [
            wid,
            { ...w, isFocused: false },
          ])
        );

        // 如果窗口已存在，将其移到 windowOrder 末尾（置顶）而不是添加重复项
        const isNewWindow = !state.windows[id];
        const newWindowOrder = isNewWindow
          ? [...state.windowOrder, id]
          : [...state.windowOrder.filter((wid) => wid !== id), id];

        return {
          windows: { ...updatedWindows, [id]: windowData },
          windowOrder: newWindowOrder as string[],
          focusedWindowId: id,
          maxZIndex: state.maxZIndex + WINDOW_ZINDEX_STEP,
        };
      });

      return id;
    },

    closeWindow: (windowId: string) => {
      const closingWindow = get().windows[windowId];
      console.log('[appWindowStore] closeWindow:', windowId, 'hasOnClose:', !!closingWindow?.onClose);
      closingWindow?.onClose?.();
      set((state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [windowId]: closed, ...remaining } = state.windows;
        const newOrder = state.windowOrder.filter((id) => id !== windowId);

        // 找到最上层窗口作为新的聚焦窗口
        const newFocusedId = newOrder.length > 0
          ? newOrder[newOrder.length - 1]
          : null;

        return {
          windows: remaining as Record<string, AppWindowData>,
          windowOrder: newOrder,
          focusedWindowId: newFocusedId,
        };
      });
    },

    closeAllWindows: () => {
      set(() => ({
        windows: {},
        windowOrder: [],
        focusedWindowId: null,
        maxZIndex: WINDOW_ZINDEX_BASE,
      }));
    },

    minimizeWindow: (windowId: string) => {
      set((state) => {
        const windowData = state.windows[windowId];
        if (!windowData) return state;

        return {
          windows: {
            ...state.windows,
            [windowId]: { ...windowData, state: 'minimized' as AppWindowState, isFocused: false },
          },
          focusedWindowId: state.focusedWindowId === windowId ? null : state.focusedWindowId,
        };
      });
    },

    maximizeWindow: (windowId: string) => {
      set((state) => {
        const windowData = state.windows[windowId];
        if (!windowData) return state;

        const isMaximized = windowData.state === 'maximized';

        // 获取窗口尺寸
        const screenWidth = typeof globalThis !== 'undefined' && typeof window !== 'undefined' ? window.innerWidth : 1920;
        const screenHeight = typeof globalThis !== 'undefined' && typeof window !== 'undefined' ? window.innerHeight : 1080;

        // 保存之前的位置用于还原
        const prevPosition = isMaximized
          ? {
              x: Math.max(0, (screenWidth - 800) / 2),
              y: Math.max(0, (screenHeight - 600) / 2),
              width: 800,
              height: 600,
              zIndex: windowData.position.zIndex,
            }
          : windowData.position;

        return {
          windows: {
            ...state.windows,
            [windowId]: {
              ...windowData,
              state: isMaximized ? 'normal' as AppWindowState : 'maximized' as AppWindowState,
              position: isMaximized
                ? prevPosition
                : {
                    x: 0,
                    y: 0,
                    width: screenWidth,
                    height: screenHeight,
                    zIndex: windowData.position.zIndex,
                  },
            },
          },
        };
      });
    },

    restoreWindow: (windowId: string) => {
      set((state) => {
        const windowData = state.windows[windowId];
        if (!windowData) return state;

        return {
          windows: {
            ...state.windows,
            [windowId]: { ...windowData, state: 'normal' as AppWindowState },
          },
        };
      });
    },

    focusWindow: (windowId: string) => {
      set((state) => {
        const windowData = state.windows[windowId];
        if (!windowData) return state;

        // 取消所有窗口聚焦
        const updatedWindows = Object.fromEntries(
          Object.entries(state.windows).map(([wid, w]) => [
            wid,
            wid === windowId
              ? {
                  ...w,
                  isFocused: true,
                  state: w.state === 'minimized' ? 'normal' as AppWindowState : w.state,
                  position: { ...w.position, zIndex: state.maxZIndex + WINDOW_ZINDEX_STEP },
                }
              : { ...w, isFocused: false },
          ])
        );

        return {
          windows: updatedWindows,
          focusedWindowId: windowId,
          maxZIndex: state.maxZIndex + WINDOW_ZINDEX_STEP,
        };
      });
    },

    updateWindowPosition: (windowId: string, position: Partial<AppWindowPosition>) => {
      set((state) => {
        const windowData = state.windows[windowId];
        if (!windowData) return state;

        // 约束检查
        const constrainedPosition = { ...windowData.position, ...position };

        if (windowData.constraints.keepInBounds && typeof globalThis !== 'undefined' && typeof window !== 'undefined') {
          constrainedPosition.x = Math.max(0, Math.min(constrainedPosition.x, window.innerWidth - 100));
          constrainedPosition.y = Math.max(0, Math.min(constrainedPosition.y, window.innerHeight - 100));
        }

        if (position.width !== undefined) {
          constrainedPosition.width = Math.max(
            windowData.constraints.minWidth,
            Math.min(position.width, windowData.constraints.maxWidth)
          );
        }

        if (position.height !== undefined) {
          constrainedPosition.height = Math.max(
            windowData.constraints.minHeight,
            Math.min(position.height, windowData.constraints.maxHeight)
          );
        }

        return {
          windows: {
            ...state.windows,
            [windowId]: { ...windowData, position: constrainedPosition },
          },
        };
      });
    },

    setDragging: (windowId: string, isDragging: boolean) => {
      set((state) => {
        const windowData = state.windows[windowId];
        if (!windowData) return state;

        return {
          windows: {
            ...state.windows,
            [windowId]: { ...windowData, isDragging },
          },
        };
      });
    },

    setResizing: (windowId: string, isResizing: boolean) => {
      set((state) => {
        const windowData = state.windows[windowId];
        if (!windowData) return state;

        return {
          windows: {
            ...state.windows,
            [windowId]: { ...windowData, isResizing },
          },
        };
      });
    },

    getWindow: (windowId: string) => get().windows[windowId],

    getOpenWindows: () =>
      Object.values(get().windows)
        .filter((w) => w.state !== 'minimized')
        .sort((a, b) => a.position.zIndex - b.position.zIndex),

    isWindowOpen: (windowId: string) => !!get().windows[windowId],
  }))
);
