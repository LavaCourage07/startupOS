import type { BrowserWindow, RenderProcessGoneDetails } from 'electron';

export type AgentRuntimePhase =
  | 'prompt_start'
  | 'model_wait'
  | 'model_stream'
  | 'tool_running'
  | 'completion_check';

export interface AgentRuntimeActivity {
  sessionId: string;
  phase: AgentRuntimePhase;
  toolName?: string;
  phaseStartedAt: number;
}

export interface ProcessHealthMonitorOptions {
  now?: () => number;
  sampleIntervalMs?: number;
  lagWarningMs?: number;
  activityLogIntervalMs?: number;
  setInterval?: (callback: () => void, intervalMs: number) => NodeJS.Timeout;
  clearInterval?: (timer: NodeJS.Timeout) => void;
  memoryUsage?: () => { rss: number; heapUsed: number };
  logInfo?: (message: string) => void;
  logWarn?: (message: string) => void;
  logError?: (message: string) => void;
}

const DEFAULT_SAMPLE_INTERVAL_MS = 1_000;
const DEFAULT_LAG_WARNING_MS = 500;
const DEFAULT_ACTIVITY_LOG_INTERVAL_MS = 15_000;
const MAX_ACTIVITY_SUMMARIES = 5;

function toMegabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

export class ProcessHealthMonitor {
  private readonly now: () => number;
  private readonly sampleIntervalMs: number;
  private readonly lagWarningMs: number;
  private readonly activityLogIntervalMs: number;
  private readonly setIntervalFn: (callback: () => void, intervalMs: number) => NodeJS.Timeout;
  private readonly clearIntervalFn: (timer: NodeJS.Timeout) => void;
  private readonly memoryUsage: () => { rss: number; heapUsed: number };
  private readonly logInfo: (message: string) => void;
  private readonly logWarn: (message: string) => void;
  private readonly logError: (message: string) => void;
  private readonly activities = new Map<string, AgentRuntimeActivity>();
  private readonly trackedWindows = new Set<number>();
  private readonly unresponsiveSince = new Map<number, number>();
  private timer: NodeJS.Timeout | null = null;
  private expectedTickAt = 0;
  private lastActivityLogAt = 0;

  constructor(options: ProcessHealthMonitorOptions = {}) {
    this.now = options.now ?? Date.now;
    this.sampleIntervalMs = options.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS;
    this.lagWarningMs = options.lagWarningMs ?? DEFAULT_LAG_WARNING_MS;
    this.activityLogIntervalMs =
      options.activityLogIntervalMs ?? DEFAULT_ACTIVITY_LOG_INTERVAL_MS;
    this.setIntervalFn = options.setInterval ?? setInterval;
    this.clearIntervalFn = options.clearInterval ?? clearInterval;
    this.memoryUsage = options.memoryUsage ?? process.memoryUsage;
    this.logInfo = options.logInfo ?? ((message): void => console.info(message));
    this.logWarn = options.logWarn ?? ((message): void => console.warn(message));
    this.logError = options.logError ?? ((message): void => console.error(message));
  }

  start(): void {
    if (this.timer) {
      return;
    }
    const now = this.now();
    this.expectedTickAt = now + this.sampleIntervalMs;
    this.lastActivityLogAt = now;
    this.timer = this.setIntervalFn(() => this.tick(), this.sampleIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      this.clearIntervalFn(this.timer);
      this.timer = null;
    }
    this.activities.clear();
    this.trackedWindows.clear();
    this.unresponsiveSince.clear();
  }

  setAgentActivity(sessionId: string, phase: AgentRuntimePhase, toolName?: string): void {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return;
    }
    const existing = this.activities.get(normalizedSessionId);
    if (existing?.phase === phase && existing.toolName === toolName) {
      return;
    }
    this.activities.set(normalizedSessionId, {
      sessionId: normalizedSessionId,
      phase,
      ...(toolName ? { toolName } : {}),
      phaseStartedAt: this.now(),
    });
  }

  clearAgentActivity(sessionId: string): void {
    this.activities.delete(sessionId);
  }

  trackWindow(window: BrowserWindow): void {
    if (this.trackedWindows.has(window.id)) {
      return;
    }
    this.trackedWindows.add(window.id);

    window.on('unresponsive', () => {
      const now = this.now();
      this.unresponsiveSince.set(window.id, now);
      this.logWarn(
        `[ProcessHealth] renderer-unresponsive ${this.describeWindow(window)} ${this.describeActivities(now)}`
      );
    });
    window.on('responsive', () => {
      const now = this.now();
      const startedAt = this.unresponsiveSince.get(window.id);
      this.unresponsiveSince.delete(window.id);
      this.logInfo(
        `[ProcessHealth] renderer-responsive ${this.describeWindow(window)} unresponsiveMs=${startedAt === undefined ? 'unknown' : Math.max(0, now - startedAt)}`
      );
    });
    window.webContents.on(
      'render-process-gone',
      (_event, details: RenderProcessGoneDetails) => {
        this.logError(
          `[ProcessHealth] renderer-gone ${this.describeWindow(window)} reason=${details.reason} exitCode=${details.exitCode} ${this.describeActivities(this.now())}`
        );
      }
    );
    window.once('closed', () => {
      this.trackedWindows.delete(window.id);
      this.unresponsiveSince.delete(window.id);
    });
  }

  getAgentActivities(): AgentRuntimeActivity[] {
    return Array.from(this.activities.values(), activity => ({ ...activity }));
  }

  private tick(): void {
    const now = this.now();
    const lagMs = Math.max(0, now - this.expectedTickAt);
    this.expectedTickAt = now + this.sampleIntervalMs;

    if (lagMs >= this.lagWarningMs) {
      const memory = this.memoryUsage();
      this.logWarn(
        `[ProcessHealth] main-event-loop-lag lagMs=${lagMs} rssMb=${toMegabytes(memory.rss)} heapUsedMb=${toMegabytes(memory.heapUsed)} ${this.describeActivities(now)}`
      );
    }

    if (
      this.activities.size > 0 &&
      now - this.lastActivityLogAt >= this.activityLogIntervalMs
    ) {
      this.lastActivityLogAt = now;
      this.logInfo(
        `[ProcessHealth] agent-active mainLagMs=${lagMs} ${this.describeActivities(now)}`
      );
    }
  }

  private describeActivities(now: number): string {
    if (this.activities.size === 0) {
      return 'activeAgents=none';
    }
    const summaries = Array.from(this.activities.values())
      .slice(0, MAX_ACTIVITY_SUMMARIES)
      .map(activity => {
        const tool = activity.toolName ? `,tool=${JSON.stringify(activity.toolName)}` : '';
        return `{session=${JSON.stringify(activity.sessionId)},phase=${activity.phase},phaseElapsedMs=${Math.max(0, now - activity.phaseStartedAt)}${tool}}`;
      });
    const omitted = this.activities.size - summaries.length;
    return `activeAgents=[${summaries.join(',')}]${omitted > 0 ? ` omittedAgents=${omitted}` : ''}`;
  }

  private describeWindow(window: BrowserWindow): string {
    let title = '';
    let url = '';
    try {
      title = window.getTitle();
      url = window.webContents.getURL();
    } catch {
      // Window may already be tearing down.
    }
    return `windowId=${window.id} title=${JSON.stringify(title.slice(0, 120))} url=${JSON.stringify(url.slice(0, 300))}`;
  }
}

export const processHealthMonitor = new ProcessHealthMonitor();
