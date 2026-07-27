export interface StreamRenderSchedulerOptions {
  onCommit: (content: string, isStreaming: boolean) => void;
  intervalMs?: number;
  initialChars?: number;
  minCharsPerTick?: number;
  maxCharsPerTick?: number;
  catchUpTicks?: number;
  setTimer?: (
    callback: () => void,
    delayMs: number
  ) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

export class StreamRenderScheduler {
  private readonly onCommit: (content: string, isStreaming: boolean) => void;
  private readonly intervalMs: number;
  private readonly initialChars: number;
  private readonly minCharsPerTick: number;
  private readonly maxCharsPerTick: number;
  private readonly catchUpTicks: number;
  private readonly setTimer: (
    callback: () => void,
    delayMs: number
  ) => ReturnType<typeof setTimeout>;
  private readonly clearTimer: (timer: ReturnType<typeof setTimeout>) => void;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private latestContent = '';
  private renderedContent = '';
  private active = true;

  constructor(options: StreamRenderSchedulerOptions) {
    this.onCommit = options.onCommit;
    this.intervalMs = options.intervalMs ?? 32;
    this.initialChars = Math.max(1, options.initialChars ?? 4);
    this.minCharsPerTick = Math.max(1, options.minCharsPerTick ?? 4);
    this.maxCharsPerTick = Math.max(
      this.minCharsPerTick,
      options.maxCharsPerTick ?? 2048
    );
    this.catchUpTicks = Math.max(1, options.catchUpTicks ?? 8);
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
  }

  schedule(content: string): void {
    if (!this.active) {
      return;
    }

    if (!content.startsWith(this.renderedContent)) {
      this.renderedContent = this.commonPrefix(this.renderedContent, content);
    }
    this.latestContent = content;

    if (this.renderedContent.length === 0 && content.length > 0) {
      this.commitNext(this.initialChars);
    }
    this.ensureTimer();
  }

  flush(content: string, isStreaming = false): void {
    if (!this.active) {
      return;
    }
    this.latestContent = content;
    this.renderedContent = content;
    this.clearPendingTimer();
    this.onCommit(this.latestContent, isStreaming);
  }

  cancel(): void {
    this.clearPendingTimer();
    this.active = false;
  }

  private ensureTimer(): void {
    if (
      this.timer ||
      this.renderedContent.length >= this.latestContent.length
    ) {
      return;
    }

    this.timer = this.setTimer(() => {
      this.timer = null;
      if (!this.active) {
        return;
      }

      const backlog = this.latestContent.length - this.renderedContent.length;
      const charsThisTick = Math.min(
        this.maxCharsPerTick,
        Math.max(this.minCharsPerTick, Math.ceil(backlog / this.catchUpTicks))
      );
      this.commitNext(charsThisTick);
      this.ensureTimer();
    }, this.intervalMs);
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
    this.onCommit(this.renderedContent, true);
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
    if (this.timer) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }
}
