/**
 * OS.4: Spotlight Component Tests
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Spotlight from '@/components/os/spotlight';
import { useSpotlightStore } from '@/store/spotlightStore';
import { SpotlightItemType } from '@originos/core/types';

vi.mock('@/store/spotlightStore');

describe('Spotlight', () => {
  const mockItems = [
    {
      id: 'settings',
      type: SpotlightItemType.APP,
      title: '设置',
      subtitle: '系统设置',
      icon: '⚙️',
      action: vi.fn(),
    },
  ];

  beforeEach(() => {
    (useSpotlightStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isOpen: false,
      query: '',
      results: [],
      selectedIndex: 0,
      close: vi.fn(),
      setResults: vi.fn(),
    });
  });

  it('should not render when closed', () => {
    const { container } = render(<Spotlight items={mockItems} />);
    // Component now returns a hidden div to keep keyboard shortcuts active
    expect(container.firstChild).not.toBeNull();
    expect(container.firstChild).toHaveClass('hidden');
  });

  it('should render when open', () => {
    (useSpotlightStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isOpen: true,
      query: '',
      results: [],
      selectedIndex: 0,
      close: vi.fn(),
      setResults: vi.fn(),
    });

    render(<Spotlight items={mockItems} />);
    expect(screen.getByPlaceholderText('搜索应用、项目、Agent、技能...')).toBeInTheDocument();
  });

  it('should close when clicking backdrop', async () => {
    const mockClose = vi.fn();
    (useSpotlightStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isOpen: true,
      query: '',
      results: [],
      selectedIndex: 0,
      close: mockClose,
      setResults: vi.fn(),
    });

    const { container } = render(<Spotlight items={mockItems} />);
    const backdrop = container.firstChild as HTMLElement;

    await userEvent.click(backdrop);
    expect(mockClose).toHaveBeenCalled();
  });
});
