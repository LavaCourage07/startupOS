/**
 * ContextMenu Component Tests
 */

import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ContextMenu from '../ContextMenu';
import type { MenuItem } from '@originos/core/types';

describe('ContextMenu', () => {
  const mockItems: MenuItem[] = [
    {
      id: 'item1',
      label: 'Item 1',
      icon: '📄',
      onClick: vi.fn(),
    },
    {
      id: 'item2',
      label: 'Item 2',
      onClick: vi.fn(),
    },
    {
      id: 'separator',
      label: '',
      separator: true,
      onClick: vi.fn(),
    },
    {
      id: 'item3',
      label: 'Item 3',
      shortcut: '⌘K',
      onClick: vi.fn(),
    },
  ];

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ContextMenu
        position={{ x: 100, y: 100 }}
        items={mockItems}
        isOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders menu items when isOpen is true', () => {
    render(
      <ContextMenu
        position={{ x: 100, y: 100 }}
        items={mockItems}
        isOpen={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('renders separator', () => {
    render(
      <ContextMenu
        position={{ x: 100, y: 100 }}
        items={mockItems}
        isOpen={true}
        onClose={vi.fn()}
      />
    );
    const separator = document.querySelector('.bg-white\\/20');
    expect(separator).toBeInTheDocument();
  });

  it('calls onClick when menu item is clicked', () => {
    const mockOnClick = vi.fn();
    const items: MenuItem[] = [
      {
        id: 'item1',
        label: 'Item 1',
        onClick: mockOnClick,
      },
    ];

    render(
      <ContextMenu
        position={{ x: 100, y: 100 }}
        items={items}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Item 1'));
    expect(mockOnClick).toHaveBeenCalled();
  });

  it('closes menu when clicking outside', () => {
    const mockOnClose = vi.fn();

    const wrapper = document.createElement('div');
    wrapper.id = 'test-wrapper';
    document.body.appendChild(wrapper);

    render(
      <ContextMenu
        position={{ x: 100, y: 100 }}
        items={mockItems}
        isOpen={true}
        onClose={mockOnClose}
      />,
      { container: wrapper }
    );

    // Trigger mousedown event on a different element (document body)
    fireEvent.mouseDown(document.body);

    // Verify the callback was triggered
    expect(mockOnClose).toHaveBeenCalled();

    // Cleanup
    document.body.removeChild(wrapper);
  });

  it('does not close when clicking inside the menu', () => {
    const mockOnClose = vi.fn();
    render(
      <ContextMenu
        position={{ x: 100, y: 100 }}
        items={mockItems}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Click on the menu itself
    const menu = document.querySelector('.fixed.z-\\[100\\]');
    if (menu) {
      fireEvent.mouseDown(menu);
      expect(mockOnClose).not.toHaveBeenCalled();
    }
  });

  it('renders icon', () => {
    const items: MenuItem[] = [
      {
        id: 'item1',
        label: 'Item 1',
        icon: '📄',
        onClick: vi.fn(),
      },
    ];

    render(
      <ContextMenu
        position={{ x: 100, y: 100 }}
        items={items}
        isOpen={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('📄')).toBeInTheDocument();
  });

  it('renders shortcut', () => {
    render(
      <ContextMenu
        position={{ x: 100, y: 100 }}
        items={mockItems}
        isOpen={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('⌘K')).toBeInTheDocument();
  });
});
