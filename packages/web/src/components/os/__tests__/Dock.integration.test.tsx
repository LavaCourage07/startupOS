/**
 * Dock Component Integration Tests
 * Tests for Dock + AppWindow integration
 */

import { cleanup, render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';

// Mock dependencies before imports
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: vi.fn(() => ''),
    },
  },
}));

// Import after mocks
import { useAppWindowStore } from '@/store/appWindowStore';

describe('Dock Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset app window store
    useAppWindowStore.setState({
      windows: {},
      windowOrder: [],
      focusedWindowId: null,
      maxZIndex: 100,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Module Imports', () => {
    it('Dock supporting modules can be imported', async () => {
      // 测试 dockStore 可以导入
      const dockStore = await import('../../../store/dockStore');
      expect(dockStore.default).toBeDefined();

      // 测试 hooks 可以导入
      const { useDockIconAnimation } = await import('../../../hooks/useDockIconAnimation');
      expect(typeof useDockIconAnimation).toBe('function');
    });

    it('AppWindow hooks can be imported', async () => {
      const { useAppWindowManager } = await import('../../../hooks/useAppWindowManager');
      expect(typeof useAppWindowManager).toBe('function');

      const { useAppWindow } = await import('../../../hooks/useAppWindow');
      expect(typeof useAppWindow).toBe('function');
    });

    it('AppWindow store can be imported', async () => {
      const { useAppWindowStore } = await import('../../../store/appWindowStore');
      expect(typeof useAppWindowStore).toBe('function');
      expect(typeof useAppWindowStore.getState).toBe('function');
    });
  });

  describe('Dock Component Rendering', () => {
    it('Dock component renders without errors', async () => {
      const Dock = (await import('../dock')).default;

      const { container } = render(<Dock />);

      expect(container).toBeDefined();
    }, 30000);

    it('Dock renders DndContext wrapper', async () => {
      const Dock = (await import('../dock')).default;

      render(<Dock />);

      // Check for DndContext mock wrapper
      const dndContexts = screen.getAllByTestId('dnd-context');
      expect(dndContexts.length).toBeGreaterThan(0);
    });
  });

  describe('Window State Management', () => {
    it('tracks window open state correctly', () => {
      // Reset store
      useAppWindowStore.setState({
        windows: {},
        windowOrder: [],
        focusedWindowId: null,
        maxZIndex: 100,
      });

      const store = useAppWindowStore.getState();

      // Open a window
      const windowId = store.openWindow({
        id: 'test-window-1',
        type: 'app',
        title: 'Test Window',
        content: { type: 'component', component: () => null },
      });

      // Get fresh state after mutation
      const stateAfterOpen = useAppWindowStore.getState();

      expect(stateAfterOpen.isWindowOpen(windowId!)).toBe(true);
      expect(stateAfterOpen.focusedWindowId).toBe(windowId);

      // Close the window
      store.closeWindow(windowId!);

      const stateAfterClose = useAppWindowStore.getState();
      expect(stateAfterClose.isWindowOpen(windowId!)).toBe(false);
      expect(stateAfterClose.focusedWindowId).toBeNull();
    });

    it('focuses correct window when multiple windows are open', () => {
      // Reset store
      useAppWindowStore.setState({
        windows: {},
        windowOrder: [],
        focusedWindowId: null,
        maxZIndex: 100,
      });

      const store = useAppWindowStore.getState();

      // Open multiple windows
      const windowId1 = store.openWindow({
        id: 'multi-window-1',
        type: 'app',
        title: 'Window 1',
        content: { type: 'component', component: () => null },
      });

      const windowId2 = store.openWindow({
        id: 'multi-window-2',
        type: 'app',
        title: 'Window 2',
        content: { type: 'component', component: () => null },
      });

      // Latest window should be focused
      const stateAfterOpen = useAppWindowStore.getState();
      expect(stateAfterOpen.focusedWindowId).toBe(windowId2);

      // Focus the first window
      store.focusWindow(windowId1!);

      const stateAfterFocus = useAppWindowStore.getState();
      expect(stateAfterFocus.focusedWindowId).toBe(windowId1);
    });

    it('updates window state correctly after close', () => {
      // Reset store
      useAppWindowStore.setState({
        windows: {},
        windowOrder: [],
        focusedWindowId: null,
        maxZIndex: 100,
      });

      const store = useAppWindowStore.getState();

      // Open a window
      const windowId = store.openWindow({
        id: 'close-test-window',
        type: 'app',
        title: 'Test Window',
        content: { type: 'component', component: () => null },
      });

      const stateAfterOpen = useAppWindowStore.getState();
      expect(stateAfterOpen.getOpenWindows().length).toBe(1);

      // Close the window
      store.closeWindow(windowId!);

      const stateAfterClose = useAppWindowStore.getState();
      expect(stateAfterClose.getOpenWindows().length).toBe(0);
      expect(Object.keys(stateAfterClose.windows).length).toBe(0);
    });

    it('minimizes and restores windows correctly', () => {
      // Reset store
      useAppWindowStore.setState({
        windows: {},
        windowOrder: [],
        focusedWindowId: null,
        maxZIndex: 100,
      });

      const store = useAppWindowStore.getState();

      const windowId = store.openWindow({
        id: 'minimize-test-window',
        type: 'app',
        title: 'Test Window',
        content: { type: 'component', component: () => null },
      });

      // Minimize
      store.minimizeWindow(windowId!);
      let state = useAppWindowStore.getState();
      const minimizedWindow = state.getWindow(windowId!);
      expect(minimizedWindow?.state).toBe('minimized');
      expect(state.getOpenWindows().length).toBe(0); // Minimized windows not included

      // Restore
      store.restoreWindow(windowId!);
      state = useAppWindowStore.getState();
      const restoredWindow = state.getWindow(windowId!);
      expect(restoredWindow?.state).toBe('normal');
      expect(state.getOpenWindows().length).toBe(1);
    });

    it('maximizes and un-maximizes windows correctly', () => {
      // Reset store
      useAppWindowStore.setState({
        windows: {},
        windowOrder: [],
        focusedWindowId: null,
        maxZIndex: 100,
      });

      const store = useAppWindowStore.getState();

      const windowId = store.openWindow({
        id: 'maximize-test-window',
        type: 'app',
        title: 'Test Window',
        content: { type: 'component', component: () => null },
      });

      // Maximize
      store.maximizeWindow(windowId!);
      let state = useAppWindowStore.getState();
      const maximizedWindow = state.getWindow(windowId!);
      expect(maximizedWindow?.state).toBe('maximized');

      // Un-maximize
      store.maximizeWindow(windowId!);
      state = useAppWindowStore.getState();
      const normalWindow = state.getWindow(windowId!);
      expect(normalWindow?.state).toBe('normal');
    });

    it('updates window position correctly', () => {
      // Reset store
      useAppWindowStore.setState({
        windows: {},
        windowOrder: [],
        focusedWindowId: null,
        maxZIndex: 100,
      });

      const store = useAppWindowStore.getState();

      const windowId = store.openWindow({
        id: 'position-test-window',
        type: 'app',
        title: 'Test Window',
        content: { type: 'component', component: () => null },
      });

      // Update position
      store.updateWindowPosition(windowId!, { x: 100, y: 200 });

      const state = useAppWindowStore.getState();
      const window = state.getWindow(windowId!);
      expect(window?.position.x).toBe(100);
      expect(window?.position.y).toBe(200);
    });

    it('tracks dragging and resizing state', () => {
      // Reset store
      useAppWindowStore.setState({
        windows: {},
        windowOrder: [],
        focusedWindowId: null,
        maxZIndex: 100,
      });

      const store = useAppWindowStore.getState();

      const windowId = store.openWindow({
        id: 'drag-test-window',
        type: 'app',
        title: 'Test Window',
        content: { type: 'component', component: () => null },
      });

      // Set dragging
      store.setDragging(windowId!, true);
      let state = useAppWindowStore.getState();
      expect(state.getWindow(windowId!)?.isDragging).toBe(true);

      // Set resizing
      store.setResizing(windowId!, true);
      state = useAppWindowStore.getState();
      expect(state.getWindow(windowId!)?.isResizing).toBe(true);

      // Clear states
      store.setDragging(windowId!, false);
      store.setResizing(windowId!, false);
      state = useAppWindowStore.getState();
      expect(state.getWindow(windowId!)?.isDragging).toBe(false);
      expect(state.getWindow(windowId!)?.isResizing).toBe(false);
    });
  });

  describe('useAppWindowManager Hook', () => {
    it('provides window management functions', async () => {
      const { useAppWindowManager } = await import('../../../hooks/useAppWindowManager');

      // Test hook with a wrapper component
      const TestComponent = () => {
        const manager = useAppWindowManager();
        return (
          <div>
            <span data-testid="window-count">{manager.openWindowCount}</span>
            <button
              data-testid="open-button"
              onClick={() =>
                manager.openWindow({
                  id: 'test',
                  type: 'app',
                  title: 'Test',
                  content: { type: 'component', component: () => null },
                })
              }
            >
              Open
            </button>
            <button
              data-testid="close-button"
              onClick={() => manager.closeWindow('test')}
            >
              Close
            </button>
          </div>
        );
      };

      const { getByTestId } = render(<TestComponent />);

      expect(getByTestId('window-count').textContent).toBe('0');

      // Open window
      act(() => {
        getByTestId('open-button').click();
      });

      expect(getByTestId('window-count').textContent).toBe('1');

      // Close window
      act(() => {
        getByTestId('close-button').click();
      });

      expect(getByTestId('window-count').textContent).toBe('0');
    });
  });

  describe('useAppWindow Hook', () => {
    it('provides single window operations', async () => {
      const { useAppWindow } = await import('../../../hooks/useAppWindow');
      const store = useAppWindowStore.getState();

      // Open a window first
      store.openWindow({
        id: 'test-hook-window',
        type: 'app',
        title: 'Test Hook Window',
        content: { type: 'component', component: () => null },
      });

      const TestComponent = () => {
        const { isOpen, isFocused, isMinimized, close, minimize, maximize } = useAppWindow({
          windowId: 'test-hook-window',
        });

        return (
          <div>
            <span data-testid="is-open">{isOpen.toString()}</span>
            <span data-testid="is-focused">{isFocused.toString()}</span>
            <span data-testid="is-minimized">{isMinimized.toString()}</span>
            <button data-testid="close-btn" onClick={close}>
              Close
            </button>
            <button data-testid="minimize-btn" onClick={minimize}>
              Minimize
            </button>
            <button data-testid="maximize-btn" onClick={maximize}>
              Maximize
            </button>
          </div>
        );
      };

      const { getByTestId } = render(<TestComponent />);

      expect(getByTestId('is-open').textContent).toBe('true');
      expect(getByTestId('is-focused').textContent).toBe('true');
      expect(getByTestId('is-minimized').textContent).toBe('false');

      // Minimize
      act(() => {
        getByTestId('minimize-btn').click();
      });
      expect(getByTestId('is-minimized').textContent).toBe('true');

      // Close
      act(() => {
        getByTestId('close-btn').click();
      });
      expect(getByTestId('is-open').textContent).toBe('false');
    });
  });

  describe('Window Ordering and Z-Index', () => {
    it('updates zIndex when windows are focused', () => {
      const store = useAppWindowStore.getState();

      const windowId1 = store.openWindow({
        id: 'zindex-window-1',
        type: 'app',
        title: 'Window 1',
        content: { type: 'component', component: () => null },
      });

      const windowId2 = store.openWindow({
        id: 'zindex-window-2',
        type: 'app',
        title: 'Window 2',
        content: { type: 'component', component: () => null },
      });

      const stateAfterOpen = useAppWindowStore.getState();
      const window1 = stateAfterOpen.getWindow(windowId1!);
      const window2 = stateAfterOpen.getWindow(windowId2!);

      // Window 2 should have higher zIndex
      expect(window2?.position.zIndex).toBeGreaterThan(window1?.position.zIndex ?? 0);

      // Focus window 1
      store.focusWindow(windowId1!);

      const stateAfterFocus = useAppWindowStore.getState();
      const window1AfterFocus = stateAfterFocus.getWindow(windowId1!);
      expect(window1AfterFocus?.position.zIndex).toBeGreaterThan(window2?.position.zIndex ?? 0);

      // Cleanup
      store.closeAllWindows();
    });

    it('maintains window order correctly', () => {
      const store = useAppWindowStore.getState();

      const windowId1 = store.openWindow({
        id: 'order-window-1',
        type: 'app',
        title: 'Window 1',
        content: { type: 'component', component: () => null },
      });

      const windowId2 = store.openWindow({
        id: 'order-window-2',
        type: 'app',
        title: 'Window 2',
        content: { type: 'component', component: () => null },
      });

      const windowId3 = store.openWindow({
        id: 'order-window-3',
        type: 'app',
        title: 'Window 3',
        content: { type: 'component', component: () => null },
      });

      const stateAfterOpen = useAppWindowStore.getState();
      expect(stateAfterOpen.windowOrder).toEqual([windowId1, windowId2, windowId3]);

      // Close middle window
      store.closeWindow(windowId2!);

      const stateAfterClose = useAppWindowStore.getState();
      expect(stateAfterClose.windowOrder).toEqual([windowId1, windowId3]);

      // Cleanup
      store.closeAllWindows();
    });
  });
});
