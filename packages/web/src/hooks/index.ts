/**
 * Hooks Export Index
 */

// OS.9: 应用窗口系统
export { useAppWindow } from './useAppWindow';
export type { UseAppWindowOptions, UseAppWindowReturn } from './useAppWindow';

export { useAppWindowManager } from './useAppWindowManager';
export type { UseAppWindowManagerReturn } from './useAppWindowManager';

export { useViewReconciler } from './useViewReconciler';
export type { UseViewReconcilerOptions, UseViewReconcilerReturn } from './useViewReconciler';

// Agent hooks
export { useAgent } from './useAgent';
export { useAgentLifecycle } from './useAgentLifecycle';
export { useAgentLauncher } from './useAgentLauncher';

// Desktop hooks
export { useDesktopGrid } from './useDesktopGrid';
export { useResponsive } from './useResponsive';
export { useContextMenu } from './useContextMenu';
export { useDockContextMenu } from './useDockContextMenu';
export { useDockIconAnimation } from './useDockIconAnimation';

// Spotlight hooks
export { useSpotlight } from './useSpotlight';
export { useSpotlightSearch } from './useSpotlightSearch';

// UI hooks
export { useGlobalShortcut } from './useGlobalShortcut';
export { useAcrylic } from './useAcrylic';
