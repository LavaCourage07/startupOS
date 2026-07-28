export interface StreamRenderSchedulerOptions {
  onCommit: (content: string, isStreaming: boolean) => void;
  onDebug?: (event: StreamRenderDebugEvent) => void;
  intervalMs?: number;
  initialChars?: number;
  minCharsPerTick?: number;
  maxCharsPerTick?: number;
  catchUpTicks?: number;
  now?: () => number;
  setTimer?: (
    callback: () => void,
    delayMs: number
  ) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

export interface StreamRenderDebugEvent {
  type:
    | 'input_commit'
    | 'timer_scheduled'
    | 'timer_fired'
    | 'finish_requested'
    | 'final_commit'
    | 'cancel';
  latestLength: number;
  renderedLength: number;
  finalizing: boolean;
  active: boolean;
}

export class StreamRenderScheduler {
  private readonly onCommit: (content: string, isStreaming: boolean) => void;
  private readonly onDebug?: (event: StreamRenderDebugEvent) => void;
  private readonly intervalMs: number;
  private readonly initialChars: number;
  private readonly minCharsPerTick: number;
  private readonly maxCharsPerTick: number;
  private readonly catchUpTicks: number;
  private readonly now: () => number;
  private readonly setTimer: (
    callback: () => void,
    delayMs: number
  ) => ReturnType<typeof setTimeout>;
  private readonly clearTimer: (timer: ReturnType<typeof setTimeout>) => void;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private latestContent = '';
  private renderedContent = '';
  private active = true;
  private finalizing = false;
  private lastFinalizedContent: string | null = null;
  private lastCommitAt = Number.NEGATIVE_INFINITY;
  private finishResolvers: Array<() => void> = [];

  constructor(options: StreamRenderSchedulerOptions) {
    this.onCommit = options.onCommit;
    this.onDebug = options.onDebug;
    this.intervalMs = options.intervalMs ?? 32;
    this.initialChars = Math.max(1, options.initialChars ?? 4);
    this.minCharsPerTick = Math.max(1, options.minCharsPerTick ?? 4);
    this.maxCharsPerTick = Math.max(
      this.minCharsPerTick,
      options.maxCharsPerTick ?? 2048
    );
    this.catchUpTicks = Math.max(1, options.catchUpTicks ?? 8);
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
  }

  schedule(content: string): void {
    if (!this.active) {
      return;
    }

    this.lastFinalizedContent = null;
    if (!content.startsWith(this.renderedContent)) {
      this.renderedContent = this.commonPrefix(this.renderedContent, content);
    }
    this.latestContent = content;

    if (this.renderedContent.length === 0 && content.length > 0) {
      this.commitNext(this.initialChars);
    } else if (
      this.renderedContent.length < this.latestContent.length &&
      this.now() - this.lastCommitAt >= this.intervalMs
    ) {
      // Incoming stream events are the primary render clock. Electron already
      // batches them, so committing the accumulated value here keeps the UI
      // moving even when a renderer timer is delayed or throttled.
      this.commitNext(this.latestContent.length - this.renderedContent.length);
      this.debug('input_commit');
    }
    this.ensureTimer();
  }

  finish(content: string): Promise<void> {
    if (!this.active || this.lastFinalizedContent === content) {
      return Promise.resolve();
    }

    const settled = new Promise<void>((resolve) => {
      this.finishResolvers.push(resolve);
    });
    if (!content.startsWith(this.renderedContent)) {
      this.renderedContent = this.commonPrefix(this.renderedContent, content);
    }
    this.latestContent = content;
    this.finalizing = true;
    this.debug('finish_requested');

    if (this.renderedContent.length === 0 && content.length > 0) {
      this.commitNext(this.initialChars);
    }
    if (this.renderedContent.length < this.latestContent.length) {
      // Final delivery is authoritative. Do not leave correctness dependent on
      // a pending browser timer: normally only a small trailing chunk remains.
      this.commitNext(this.latestContent.length - this.renderedContent.length);
    }
    this.commitFinal();
    return settled;
  }

  flush(content: string, isStreaming = false): void {
    if (!this.active) {
      return;
    }
    this.latestContent = content;
    this.renderedContent = content;
    this.clearPendingTimer();
    this.onCommit(this.latestContent, isStreaming);
    this.finalizing = false;
    this.lastFinalizedContent = isStreaming ? null : content;
    this.resolveFinishWaiters();
  }

  cancel(): void {
    this.clearPendingTimer();
    this.active = false;
    this.finalizing = false;
    this.debug('cancel');
    this.resolveFinishWaiters();
  }

  private ensureTimer(): void {
    if (
      this.timer !== null ||
      this.renderedContent.length >= this.latestContent.length
    ) {
      return;
    }

    this.timer = this.setTimer(() => {
      this.timer = null;
      this.debug('timer_fired');
      if (!this.active) {
        return;
      }

      const backlog = this.latestContent.length - this.renderedContent.length;
      const charsThisTick = Math.min(
        this.maxCharsPerTick,
        Math.max(this.minCharsPerTick, Math.ceil(backlog / this.catchUpTicks))
      );
      this.commitNext(charsThisTick);
      if (
        this.finalizing &&
        this.renderedContent.length >= this.latestContent.length
      ) {
        this.commitFinal();
      } else {
        this.ensureTimer();
      }
    }, this.intervalMs);
    this.debug('timer_scheduled');
  }

  private commitNext(characterCount: number): void {
    const requestedEnd = Math.min(
      this.latestContent.length,
      this.renderedContent.length + characterCount
    );
    const safeEnd = this.safeUtf16Boundary(this.latestContent, requestedEnd);
    if (safeEnd <= this.renderedContent.length) {
      return;
    }

    this.renderedContent = this.latestContent.slice(0, safeEnd);
    this.lastCommitAt = this.now();
    this.onCommit(this.renderedContent, true);
  }

  private commitFinal(): void {
    if (!this.finalizing) {
      return;
    }
    this.clearPendingTimer();
    this.finalizing = false;
    this.lastFinalizedContent = this.latestContent;
    this.onCommit(this.renderedContent, false);
    this.debug('final_commit');
    this.resolveFinishWaiters();
  }

  private safeUtf16Boundary(content: string, requestedEnd: number): number {
    if (
      requestedEnd > 0 &&
      requestedEnd < content.length &&
      this.isHighSurrogate(content.charCodeAt(requestedEnd - 1))
    ) {
      return requestedEnd + 1;
    }
    return requestedEnd;
  }

  private isHighSurrogate(codeUnit: number): boolean {
    return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
  }

  private commonPrefix(left: string, right: string): string {
    const maxLength = Math.min(left.length, right.length);
    let index = 0;
    while (index < maxLength && left.charCodeAt(index) === right.charCodeAt(index)) {
      index += 1;
    }
    if (index > 0 && this.isHighSurrogate(left.charCodeAt(index - 1))) {
      index -= 1;
    }
    return left.slice(0, index);
  }

  private clearPendingTimer(): void {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }

  private resolveFinishWaiters(): void {
    const resolvers = this.finishResolvers;
    this.finishResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }

  private debug(type: StreamRenderDebugEvent['type']): void {
    this.onDebug?.({
      type,
      latestLength: this.latestContent.length,
      renderedLength: this.renderedContent.length,
      finalizing: this.finalizing,
      active: this.active,
    });
  }
}
