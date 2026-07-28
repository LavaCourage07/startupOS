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

  it('commits final content without depending on a renderer timer', async () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const scheduler = new StreamRenderScheduler({
      onCommit,
      initialChars: 1,
      minCharsPerTick: 2,
      maxCharsPerTick: 2,
      catchUpTicks: 8,
    });

    scheduler.schedule('a');
    const finished = scheduler.finish('abcdefg');
    await finished;

    const commits = onCommit.mock.calls.map(([content, isStreaming]) => ({
      content,
      isStreaming,
    }));
    expect(commits.map(({ content }) => content)).toEqual([
      'a',
      'abcdefg',
      'abcdefg',
    ]);
    expect(commits.slice(0, -1).every(({ isStreaming }) => isStreaming)).toBe(true);
    expect(commits.at(-1)).toEqual({ content: 'abcdefg', isStreaming: false });
  });

  it('uses incoming events as a throttled render clock', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    let now = 0;
    const scheduler = new StreamRenderScheduler({
      onCommit,
      intervalMs: 32,
      initialChars: 2,
      now: () => now,
    });

    scheduler.schedule('你好');
    now = 16;
    scheduler.schedule('你好，第一段');
    now = 32;
    scheduler.schedule('你好，第一段正文');

    expect(onCommit.mock.calls).toEqual([
      ['你好', true],
      ['你好，第一段正文', true],
    ]);
  });

  it('does not emit another final commit when finish is repeated', async () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const scheduler = new StreamRenderScheduler({ onCommit });

    await scheduler.finish('done');
    await scheduler.finish('done');

    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenNthCalledWith(1, 'done', true);
    expect(onCommit).toHaveBeenNthCalledWith(2, 'done', false);
  });

  it('continues rendering when done supplies more content after message end', async () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const scheduler = new StreamRenderScheduler({
      onCommit,
      initialChars: 2,
      minCharsPerTick: 2,
      maxCharsPerTick: 2,
    });

    await scheduler.finish('你好');
    const done = scheduler.finish('你好，后续完整正文');
    await done;

    expect(onCommit.mock.calls.at(-1)).toEqual(['你好，后续完整正文', false]);
    expect(
      onCommit.mock.calls.some(
        ([content, isStreaming]) =>
          content === '你好，后续完整正文' && isStreaming === true
      )
    ).toBe(true);
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
