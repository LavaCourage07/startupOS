/**
 * Desktop Component Integration Tests
 */

import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Desktop from '../Desktop';
import useDesktopStore from '@/store/desktopStore';

// Mock modules
vi.mock('@/hooks/useContextMenu', () => ({
  DEFAULT_CONTEXT_MENU_ITEMS: [
    {
      id: 'refresh',
      label: '刷新',
      icon: '🔄',
      onClick: () => window.location.reload(),
      separator: false,
    },
  ],
}));

// Mock DndContext
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dnd-context">{children}</div>
  ),
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drag-overlay">{children}</div>
  ),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
}));

describe('Desktop Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default store state
    useDesktopStore.setState({
      icons: [
        {
          id: 'settings',
          icon: '⚙️',
          label: '设置',
          position: { x: 0, y: 0 },
          status: 'idle',
          type: 'system',
        },
      ],
      selectedIconId: null,
      draggedIconId: null,
      background: {
        type: 'solid',
        color: '#0A0A0A',
      },
      contextMenu: {
        isOpen: false,
        position: null,
      },
      isDragging: false,
      isLoading: false,
      viewport: { width: 1920, height: 1080 },
      setIcons: vi.fn(),
      moveIcon: vi.fn(),
      selectIcon: vi.fn(),
      setDraggedIcon: vi.fn(),
      setBackground: vi.fn(),
      openContextMenu: vi.fn(),
      closeContextMenu: vi.fn(),
      setDragging: vi.fn(),
      updateViewport: vi.fn(),
      setLoading: vi.fn(),
    });
  });

  it('renders Desktop container', () => {
    render(<Desktop />);
    const desktop = document.querySelector('.relative.w-screen.h-screen');
    expect(desktop).toBeInTheDocument();
  });

  it('renders StatusBar', () => {
    render(<Desktop />);
    const statusBars = document.querySelectorAll('.fixed.top-0.left-0.right-0');
    expect(statusBars.length).toBeGreaterThan(0);
  });

  it('renders Background layer', () => {
    render(<Desktop />);
    const background = document.querySelector('.absolute.-z-10');
    expect(background).toBeInTheDocument();
  });
});
