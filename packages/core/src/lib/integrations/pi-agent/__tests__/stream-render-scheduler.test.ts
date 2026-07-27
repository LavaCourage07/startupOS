import { afterEach, describe, expect, it, vi } from 'vitest';
import { StreamRenderScheduler } from '../stream-render-scheduler';

describe('StreamRenderScheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals content in adaptive batches with bounded commits', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const scheduler = new StreamRenderScheduler({
      onCommit,
      intervalMs: 32,
      initialChars: 4,
      minCharsPerTick: 4,
      maxCharsPerTick: 256,
      catchUpTicks: 8,
    });

    let content = '';
    for (let index = 0; index < 10_000; index += 1) {
      content += 'x';
      scheduler.schedule(content);
    }

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenNthCalledWith(1, 'x', true);

    vi.runAllTimers();

    const finalCall = onCommit.mock.calls.at(-1);
    expect(finalCall).toEqual(['x'.repeat(10_000), true]);
    expect(onCommit.mock.calls.length).toBeLessThan(100);
  });

  it('flushes the latest content immediately and cancels the timer', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const scheduler = new StreamRenderScheduler({ onCommit });

    scheduler.schedule('partial');
    scheduler.flush('complete', false);
    vi.runAllTimers();

    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenNthCalledWith(1, 'part', true);
    expect(onCommit).toHaveBeenNthCalledWith(2, 'complete', false);
  });

  it('ignores updates after cancellation', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const scheduler = new StreamRenderScheduler({ onCommit });

    scheduler.schedule('pending');
    scheduler.cancel();
    scheduler.schedule('late');
    scheduler.flush('late', false);
    vi.runAllTimers();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('pend', true);
  });

  it('does not split a UTF-16 surrogate pair', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const scheduler = new StreamRenderScheduler({
      onCommit,
      initialChars: 2,
      minCharsPerTick: 1,
    });

    scheduler.schedule('A😀B');

    expect(onCommit).toHaveBeenCalledWith('A😀', true);
    const committed = onCommit.mock.calls[0]?.[0] as string;
    expect(committed.charCodeAt(committed.length - 1)).toBe(0xde00);
  });
});
