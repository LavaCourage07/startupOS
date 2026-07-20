/**
 * OS.9: 应用窗口系统类型定义
 */

import { ReactNode } from 'react';

// ============ 窗口类型 ============

export type AppWindowType =
  | 'app'       // 通用应用
  | 'agent'     // Agent 对话窗口
  | 'settings'  // 设置窗口
  | 'view'      // 视图窗口 (iframe/microapp)
  | 'custom';   // 自定义窗口

export type AppWindowState =
  | 'normal'    // 正常状态
  | 'minimized' // 最小化
  | 'maximized' // 最大化
  | 'fullscreen'; // 全屏

// ============ 窗口位置与尺寸 ============

export interface AppWindowPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface AppWindowConstraints {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  allowResize: boolean;
  allowDrag: boolean;
  allowMinimize: boolean;
  allowMaximize: boolean;
  allowFullscreen: boolean;
  keepInBounds: boolean;
}

// ============ 窗口内容类型 ============

export type ContentRendererType =
  | 'component'   // React 组件
  | 'iframe'      // iframe 嵌入
  | 'microapp'    // microapp 微前端
  | 'qiankun'     // qiankun 微前端
  | 'view';       // 通用视图 (使用 view-reconciler)

export interface ComponentContent {
  type: 'component';
  component: React.ComponentType<any>;
  props?: Record<string, unknown>;
  children?: ReactNode;
}

export interface IframeContent {
  type: 'iframe';
  url: string;
  sandbox?: string;
}

export interface MicroAppContent {
  type: 'microapp';
  url: string;
  name: string;
  props?: Record<string, unknown>;
}

export interface QiankunContent {
  type: 'qiankun';
  url: string;
  name: string;
  props?: Record<string, unknown>;
}

export interface ViewContent {
  type: 'view';
  viewId: string;
  viewCode: string;
  title: string;
  url: string;
  context?: Record<string, unknown>;
  storagePath?: string;
  currentRouteName?: string;
  urlQuery?: string;
}

export type AppWindowContent =
  | ComponentContent
  | IframeContent
  | MicroAppContent
  | QiankunContent
  | ViewContent;

// ============ 窗口配置 ============

export interface AppWindowConfig {
  id?: string;  // 可选，如果不提供会自动生成
  type: AppWindowType;
  title: string;
  icon?: string;
  position?: Partial<AppWindowPosition>;
  constraints?: Partial<AppWindowConstraints>;
  content: AppWindowContent;
  metadata?: Record<string, unknown>;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onFocus?: () => void;
}

export interface NativeAppWindowMetadata extends Record<string, unknown> {
  renderMode?: 'browser' | 'native';
  nativeRoute?: string;
  nativeQuery?: Record<string, string>;
}

// ============ 窗口数据 ============

export interface AppWindowData {
  id: string;
  type: AppWindowType;
  title: string;
  icon?: string;
  state: AppWindowState;
  position: AppWindowPosition;
  constraints: AppWindowConstraints;
  content: AppWindowContent;
  isFocused: boolean;
  isDragging: boolean;
  isResizing: boolean;
  createdAt: number;
  lastActivatedAt: number;
  metadata?: Record<string, unknown>;
  onClose?: () => void;
}

// ============ 窗口 Store 状态 ============

export interface AppWindowStoreState {
  windows: Record<string, AppWindowData>;
  windowOrder: string[];
  focusedWindowId: string | null;
  maxZIndex: number;

  // Actions
  openWindow: (config: AppWindowConfig) => string;
  closeWindow: (windowId: string) => void;
  closeAllWindows: () => void;
  minimizeWindow: (windowId: string) => void;
  maximizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  updateWindowPosition: (windowId: string, position: Partial<AppWindowPosition>) => void;
  setDragging: (windowId: string, isDragging: boolean) => void;
  setResizing: (windowId: string, isResizing: boolean) => void;
  getWindow: (windowId: string) => AppWindowData | undefined;
  getOpenWindows: () => AppWindowData[];
  isWindowOpen: (windowId: string) => boolean;
}

// ============ 默认值 ============

export const DEFAULT_WINDOW_CONSTRAINTS: AppWindowConstraints = {
  minWidth: 400,
  minHeight: 300,
  maxWidth: 1920,
  maxHeight: 1080,
  allowResize: true,
  allowDrag: true,
  allowMinimize: true,
  allowMaximize: true,
  allowFullscreen: false,
  keepInBounds: true,
};

export const DEFAULT_WINDOW_POSITION: Partial<AppWindowPosition> = {
  width: 800,
  height: 600,
  zIndex: 100,
};

export const WINDOW_ZINDEX_BASE = 100;
export const WINDOW_ZINDEX_STEP = 10;

// ============ 窗口组件 Props ============

export interface AppWindowProps {
  windowId: string;
  config: AppWindowConfig;
  children?: ReactNode;
}

export interface WindowTitleBarProps {
  title: string;
  icon?: string;
  isFocused: boolean;
  isMaximized: boolean;
  constraints: AppWindowConstraints;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}

export interface WindowControlsProps {
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  showMinimize: boolean;
  showMaximize: boolean;
  isMaximized: boolean;
}

export interface WindowResizerProps {
  windowId: string;
  position: AppWindowPosition;
  constraints: AppWindowConstraints;
  onResize: (position: Partial<AppWindowPosition>) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
}

export interface ViewRendererProps {
  content: AppWindowContent;
  windowId: string;
}
