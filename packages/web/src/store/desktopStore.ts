/**
 * Desktop Store - Zustand State Management
 * Story OS.1: Desktop 空间框架
 */

import { create } from 'zustand';
import type {
  DesktopIconItem,
  BackgroundConfig,
  DesktopStoreState,
} from '@originos/core/types';

// 默认背景配置
const DEFAULT_BACKGROUND: BackgroundConfig = {
  type: 'solid',
  color: '#0A0A0A',
  particlesEnabled: true,
};

// 默认图标列表
const DEFAULT_ICONS: DesktopIconItem[] = [
  {
    id: 'settings',
    icon: '⚙️',
    label: '设置',
    position: { x: 0, y: 0 },
    status: 'idle',
    type: 'system',
  },
  {
    id: 'help',
    icon: '❓',
    label: '帮助',
    position: { x: 1, y: 0 },
    status: 'idle',
    type: 'system',
  },
  {
    id: 'about',
    icon: 'ℹ️',
    label: '关于',
    position: { x: 2, y: 0 },
    status: 'idle',
    type: 'system',
  },
];

// 初始化函数
function initializeDesktopState(): Partial<DesktopStoreState> {
  return {
    icons: DEFAULT_ICONS,
    selectedIconId: null,
    draggedIconId: null,
    background: DEFAULT_BACKGROUND,
    contextMenu: {
      isOpen: false,
      position: null,
    },
    isDragging: false,
    isLoading: true,
    viewport: {
      width: typeof window !== 'undefined' ? window.innerWidth : 1920,
      height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    },
  };
}

// Desktop Store
const useDesktopStore = create<DesktopStoreState>((set) => ({
  // Initial state
  ...(initializeDesktopState() as any),

  // Actions
  setIcons: (icons) => set({ icons }),

  moveIcon: (id, position) =>
    set((state) => ({
      icons: state.icons.map((icon) =>
        icon.id === id ? { ...icon, position } : icon
      ),
    })),

  selectIcon: (id) => set({ selectedIconId: id }),

  setDraggedIcon: (id) => set({ draggedIconId: id }),

  setBackground: (config) =>
    set((state) => ({
      background: { ...state.background, ...config },
    })),

  openContextMenu: (position) =>
    set({
      contextMenu: { isOpen: true, position },
    }),

  closeContextMenu: () =>
    set({
      contextMenu: { isOpen: false, position: null },
    }),

  setDragging: (isDragging) => set({ isDragging }),

  updateViewport: (viewport) => set({ viewport }),

  setLoading: (isLoading) => set({ isLoading }),
}));

export default useDesktopStore;
