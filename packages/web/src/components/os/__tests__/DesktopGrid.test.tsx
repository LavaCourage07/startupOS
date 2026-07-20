/**
 * DesktopGrid Component Tests
 */

import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DesktopGrid from '../DesktopGrid';
import type { DesktopIconItem } from '@originos/core/types';

describe('DesktopGrid', () => {
  const mockIcons: DesktopIconItem[] = [
    {
      id: 'icon1',
      icon: '⚙️',
      label: '设置',
      position: { x: 0, y: 0 },
      status: 'idle',
      type: 'system',
    },
    {
      id: 'icon2',
      icon: '❓',
      label: '帮助',
      position: { x: 1, y: 0 },
      status: 'running',
      type: 'system',
    },
    {
      id: 'icon3',
      icon: 'ℹ️',
      label: '关于',
      position: { x: 2, y: 0 },
      status: 'idle',
      type: 'system',
    },
  ];

  it('renders all icons', () => {
    render(<DesktopGrid icons={mockIcons} />);

    expect(screen.getByText('设置')).toBeInTheDocument();
    expect(screen.getByText('帮助')).toBeInTheDocument();
    expect(screen.getByText('关于')).toBeInTheDocument();
  });

  it('renders icons with correct emoji', () => {
    render(<DesktopGrid icons={mockIcons} />);

    expect(screen.getByText('⚙️')).toBeInTheDocument();
    expect(screen.getByText('❓')).toBeInTheDocument();
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
  });

  it('renders running status indicator', () => {
    render(<DesktopGrid icons={mockIcons} />);
    const indicators = document.querySelectorAll('.animate-pulse');
    expect(indicators.length).toBe(1);
  });

  it('calls onIconClick when icon is clicked', () => {
    const handleClick = vi.fn();
    render(<DesktopGrid icons={mockIcons} onIconClick={handleClick} />);

    fireEvent.click(screen.getByText('设置'));
    expect(handleClick).toHaveBeenCalledWith('icon1');
  });

  it('calls onIconRightClick when icon is right-clicked', () => {
    const handleRightClick = vi.fn();
    render(<DesktopGrid icons={mockIcons} onIconRightClick={handleRightClick} />);

    const settingsIcon = screen.getByText('设置').closest('div');
    expect(settingsIcon).not.toBeNull();

    fireEvent.contextMenu(settingsIcon!);
    expect(handleRightClick).toHaveBeenCalled();
  });

  it('positions icons correctly', () => {
    const { container } = render(<DesktopGrid icons={mockIcons} />);

    // Count only icon containers (not absolute child elements)
    const icons = container.querySelectorAll('.absolute.flex.flex-col');
    expect(icons.length).toBe(mockIcons.length);
  });
});
