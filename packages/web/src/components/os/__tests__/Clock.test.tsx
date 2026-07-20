/**
 * Clock Component Tests
 */

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Clock from '../StatusBar/Clock';

describe('Clock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('displays current time', () => {
    vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('14:30');
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('03/07');

    render(<Clock />);
    expect(screen.getByText('14:30')).toBeInTheDocument();
    expect(screen.getByText('03/07')).toBeInTheDocument();
  });

  it('updates time every second', () => {
    render(<Clock />);
    const timeSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(timeSpy).toHaveBeenCalled();
  });

  it('cleans up timer on unmount', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = render(<Clock />);

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
