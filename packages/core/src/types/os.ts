/**
 * OS 组件类型定义
 * Story OS.1: Desktop 空间框架
 * Story OS.2: Dock 任务栏基础
 */

import { ReactNode } from 'react';

// ============ Desktop Icon ============

export interface DesktopIconItem {
  id: string;
  icon: string;
  label: string;
  position: { x: number; y: number };
  status?: 'idle' | 'active' | 'running';
  type?: 'system' | 'agent' | 'app';
}

export interface DesktopIconProps {
  id: string;
  icon: string;
  label: string;
  status?: 'idle' | 'active' | 'running';
  onClick?: () => void;
  onRightClick?: (e: React.MouseEvent) => void;
}

// ============ Dock App ============

export interface DockApp {
  id: string;
  name: string;
  icon: string;
  iconType?: 'emoji' | 'image' | 'component';
  iconUrl?: string;
  iconComponent?: ReactNode;
  isRunning: boolean;
  isMinimized?: boolean;
  isPinned: boolean;
  index?: number;
  /** App type: 'agent' opens with AgentDialogContent, 'skill' opens with SkillDialog */
  appType?: 'agent' | 'skill' | 'action' | 'sandbox';
  /** Skill code for appType='skill', maps to SkillDialog's skillName prop */
  skillName?: string;
}

// ============ Dock Components ============

export interface DockProps {
  apps?: DockApp[];
  onAppClick?: (appId: string) => void;
}

export interface DockIconProps {
  app: DockApp;
  index: number;
  side?: DockSide;
  onClick?: (appId: string) => void;
  onRightClick?: (e: React.MouseEvent, appId: string) => void;
}

export interface DockTooltipProps {
  text: string;
  visible: boolean;
  position: { x: number; y: number };
  side?: DockSide;
}

export interface DockIndicatorProps {
  isRunning: boolean;
}

export interface DockContextMenuProps {
  appId: string;
  appName: string;
  isPinned: boolean;
  position: { x: number; y: number };
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onUninstall: () => void;
}

// ============ Dock Store State ============

export type DockSide = 'left' | 'bottom' | 'right';

export interface DockState {
  // 应用列表
  apps: DockApp[];
  selectedAppId: string | null;
  draggedAppId: string | null;
  draggedAppIndex: number | null;

  // Dock UI 状态
  hoveringAppId: string | null;
  dockSide: DockSide;
  dockPosition: { x: number; y: number };
  dockWidth: number;

  // 菜单状态
  dockContextMenu: {
    isOpen: boolean;
    appId: string | null;
    position: { x: number; y: number } | null;
  };

  // Actions
  setApps: (apps: DockApp[]) => void;
  addApp: (app: DockApp) => void;
  removeApp: (appId: string) => void;
  updateApp: (appId: string, updates: Partial<Omit<DockApp, 'id'>>) => void;
  moveApp: (fromIndex: number, toIndex: number) => void;
  setAppRunning: (appId: string, isRunning: boolean) => void;
  selectApp: (appId: string | null) => void;
  setDraggedApp: (appId: string | null, index?: number | null) => void;
  setHoveringApp: (appId: string | null) => void;
  pinApp: (appId: string) => void;
  unpinApp: (appId: string) => void;
  uninstallApp: (appId: string) => void;
  openDockContextMenu: (appId: string, position: { x: number; y: number }) => void;
  closeDockContextMenu: () => void;
  setDockSide: (side: DockSide) => void;
  updateDockPosition: (position: { x: number; y: number }) => void;
}

// ============ Context Menu ============

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  onClick: () => void;
  separator?: boolean;
}

export interface ContextMenuProps {
  position: { x: number; y: number };
  items: MenuItem[];
  isOpen: boolean;
  onClose: () => void;
}

// ============ Network Status ============

export interface NetworkStatus {
  isOnline: boolean;
  type: 'wifi' | 'ethernet' | 'none';
  strength?: number; // 0-4 for WiFi
}

// ============ Background ============

export interface BackgroundConfig {
  type: 'solid' | 'image' | 'particles';
  color?: string;
  imageUrl?: string;
  particlesEnabled?: boolean;
}

// ============ Desktop Grid ============

export interface GridPosition {
  column: number;
  row: number;
}

// ============ Desktop Store State ============

export interface DesktopStoreState {
  // 图标状态
  icons: DesktopIconItem[];
  selectedIconId: string | null;
  draggedIconId: string | null;

  // 背景状态
  background: BackgroundConfig;

  // 菜单状态
  contextMenu: {
    isOpen: boolean;
    position: { x: number; y: number } | null;
  };

  // UI 状态
  isDragging: boolean;
  isLoading: boolean;
  viewport: { width: number; height: number };

  // Actions
  setIcons: (icons: DesktopIconItem[]) => void;
  moveIcon: (id: string, position: { x: number; y: number }) => void;
  selectIcon: (id: string | null) => void;
  setDraggedIcon: (id: string | null) => void;
  setBackground: (config: Partial<BackgroundConfig>) => void;
  openContextMenu: (position: { x: number; y: number }) => void;
  closeContextMenu: () => void;
  setDragging: (isDragging: boolean) => void;
  updateViewport: (viewport: { width: number; height: number }) => void;
  setLoading: (isLoading: boolean) => void;
}

// ============ Responsive Config ============

export interface ResponsiveConfig {
  breakpoints: {
    tablet: number;
    desktop: number;
  };
  gridSize: {
    tablet: { columns: number; rows: number };
    desktop: { columns: number; rows: number };
  };
}

// ============ Drag and Drop ============

export interface DragOverlayData {
  id: string;
  x: number;
  y: number;
}

// ============ Component Props ============

export interface DesktopProps {
  children?: ReactNode;
}

export interface StatusBarProps {
  showNetwork?: boolean;
}

export interface BackgroundProps {
  config: BackgroundConfig;
}

export interface DesktopGridProps {
  icons: DesktopIconItem[];
  onIconClick?: (id: string) => void;
  onIconRightClick?: (id: string, e: React.MouseEvent) => void;
}
