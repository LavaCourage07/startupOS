import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { ProcessHealthMonitor } from '../process-health-monitor';

function createWindowMock() {
  const windowEvents = new EventEmitter();
  const webContentsEvents = new EventEmitter();
  const window = Object.assign(windowEvents, {
    id: 7,
    getTitle: () => 'Skill Window',
    webContents: Object.assign(webContentsEvents, {
      getURL: () => 'http://127.0.0.1/window?skill=test',
    }),
  }) as unknown as BrowserWindow;
  return { window, windowEvents, webContentsEvents };
}

describe('ProcessHealthMonitor', () => {
  it('logs main event-loop lag with bounded agent activity metadata', () => {
    let now = 0;
    let tick: (() => void) | undefined;
    const logWarn = vi.fn();
    const monitor = new ProcessHealthMonitor({
      now: () => now,
      sampleIntervalMs: 1_000,
      lagWarningMs: 500,
      activityLogIntervalMs: 15_000,
      setInterval: callback => {
        tick = callback;
        return { unref: vi.fn() } as unknown as NodeJS.Timeout;
      },
      clearInterval: vi.fn(),
      memoryUsage: () => ({ rss: 128 * 1024 * 1024, heapUsed: 32 * 1024 * 1024 }),
      logInfo: vi.fn(),
      logWarn,
      logError: vi.fn(),
    });

    monitor.start();
    monitor.setAgentActivity('session-1', 'tool_running', 'execute_command');
    now = 1_800;
    tick?.();

    expect(logWarn).toHaveBeenCalledWith(expect.stringContaining('main-event-loop-lag lagMs=800'));
    expect(logWarn).toHaveBeenCalledWith(expect.stringContaining('phase=tool_running'));
    expect(logWarn).toHaveBeenCalledWith(expect.stringContaining('tool="execute_command"'));
    expect(logWarn.mock.calls[0]?.[0]).not.toContain('message content');
  });

  it('logs low-frequency active phases and clears completed sessions', () => {
    let now = 0;
    let tick: (() => void) | undefined;
    const logInfo = vi.fn();
    const monitor = new ProcessHealthMonitor({
      now: () => now,
      setInterval: callback => {
        tick = callback;
        return { unref: vi.fn() } as unknown as NodeJS.Timeout;
      },
      clearInterval: vi.fn(),
      logInfo,
      logWarn: vi.fn(),
      logError: vi.fn(),
    });

    monitor.start();
    monitor.setAgentActivity('session-2', 'model_wait');
    now = 15_000;
    tick?.();
    expect(logInfo).toHaveBeenCalledWith(expect.stringContaining('agent-active'));
    expect(logInfo).toHaveBeenCalledWith(expect.stringContaining('phaseElapsedMs=15000'));

    monitor.clearAgentActivity('session-2');
    now = 30_000;
    tick?.();
    expect(logInfo).toHaveBeenCalledTimes(1);
    expect(monitor.getAgentActivities()).toEqual([]);
  });

  it('logs renderer unresponsive, recovery, and process exit', () => {
    let now = 10_000;
    const logInfo = vi.fn();
    const logWarn = vi.fn();
    const logError = vi.fn();
    const monitor = new ProcessHealthMonitor({
      now: () => now,
      logInfo,
      logWarn,
      logError,
    });
    const { window, windowEvents, webContentsEvents } = createWindowMock();

    monitor.setAgentActivity('session-3', 'model_wait');
    monitor.trackWindow(window);
    windowEvents.emit('unresponsive');
    now = 12_500;
    windowEvents.emit('responsive');
    webContentsEvents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 9 });

    expect(logWarn).toHaveBeenCalledWith(expect.stringContaining('renderer-unresponsive'));
    expect(logWarn).toHaveBeenCalledWith(expect.stringContaining('session-3'));
    expect(logInfo).toHaveBeenCalledWith(expect.stringContaining('unresponsiveMs=2500'));
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('reason=crashed exitCode=9'));
  });
});
