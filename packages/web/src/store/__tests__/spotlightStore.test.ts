/**
 * OS.4: Spotlight Store Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useSpotlightStore } from '@/store/spotlightStore';
import { SpotlightItemType } from '@originos/core/types';
import { vi } from 'vitest';

describe('spotlightStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useSpotlightStore());
    act(() => {
      result.current.close();
    });
  });

  it('should initialize with closed state', () => {
    const { result } = renderHook(() => useSpotlightStore());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.query).toBe('');
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.results).toEqual([]);
  });

  it('should open spotlight', () => {
    const { result } = renderHook(() => useSpotlightStore());
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it('should toggle spotlight open and closed', () => {
    const { result } = renderHook(() => useSpotlightStore());

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.setQuery('test');
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.query).toBe('');
  });

  it('should close spotlight and reset state', () => {
    const { result } = renderHook(() => useSpotlightStore());
    act(() => {
      result.current.open();
      result.current.setQuery('test');
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.query).toBe('');
    expect(result.current.selectedIndex).toBe(0);
  });

  it('should set query and reset selected index', () => {
    const { result } = renderHook(() => useSpotlightStore());
    act(() => {
      result.current.setSelectedIndex(2);
      result.current.setQuery('test');
    });
    expect(result.current.query).toBe('test');
    expect(result.current.selectedIndex).toBe(0);
  });

  it('should navigate to next item', () => {
    const { result } = renderHook(() => useSpotlightStore());
    const items = [
      { id: '1', type: SpotlightItemType.APP, title: 'Item 1', icon: '1', action: () => {} },
      { id: '2', type: SpotlightItemType.APP, title: 'Item 2', icon: '2', action: () => {} },
    ];

    act(() => {
      result.current.setResults(items);
      result.current.selectNext();
    });
    expect(result.current.selectedIndex).toBe(1);

    act(() => {
      result.current.selectNext();
    });
    expect(result.current.selectedIndex).toBe(0);
  });

  it('should navigate to previous item', () => {
    const { result } = renderHook(() => useSpotlightStore());
    const items = [
      { id: '1', type: SpotlightItemType.APP, title: 'Item 1', icon: '1', action: () => {} },
      { id: '2', type: SpotlightItemType.APP, title: 'Item 2', icon: '2', action: () => {} },
    ];

    act(() => {
      result.current.setResults(items);
      result.current.selectPrevious();
    });
    expect(result.current.selectedIndex).toBe(1);
  });

  it('should execute selected item and close', async () => {
    const mockAction = vi.fn();
    const { result } = renderHook(() => useSpotlightStore());
    const items = [
      { id: '1', type: SpotlightItemType.APP, title: 'Item 1', icon: '1', action: mockAction },
    ];

    await act(async () => {
      result.current.open();
      result.current.setResults(items);
      await result.current.executeSelected();
    });

    expect(mockAction).toHaveBeenCalled();
    expect(result.current.isOpen).toBe(false);
  });
});
