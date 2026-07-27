export interface BatchedStreamEvent {
  type: string;
  data: unknown;
}

export interface StreamEventBatcherOptions {
  onFlush: (events: BatchedStreamEvent[]) => void;
  maxDelayMs?: number;
  maxBytes?: number;
  setTimer?: (callback: () => void, delayMs: number) => NodeJS.Timeout;
  clearTimer?: (timer: NodeJS.Timeout) => void;
}

const DEFAULT_MAX_DELAY_MS = 32;
const DEFAULT_MAX_BYTES = 16 * 1024;

interface PendingStreamEvent {
  event: BatchedStreamEvent;
  textField?: 'delta' | 'content';
  textChunks?: string[];
}

function getMergeableText(
  event: BatchedStreamEvent
): { field: 'delta' | 'content'; value: string } | null {
  if (!event.data || typeof event.data !== 'object') {
    return null;
  }
  if (event.type === 'text_delta') {
    const delta = (event.data as { delta?: unknown }).delta;
    return typeof delta === 'string' ? { field: 'delta', value: delta } : null;
  }
  if (event.type === 'assistant_message') {
    const data = event.data as { content?: unknown; isStreaming?: unknown };
    return data.isStreaming === true && typeof data.content === 'string'
      ? { field: 'content', value: data.content }
      : null;
  }
  return null;
}

export class StreamEventBatcher {
  private readonly onFlush: (events: BatchedStreamEvent[]) => void;
  private readonly maxDelayMs: number;
  private readonly maxBytes: number;
  private readonly setTimer: (
    callback: () => void,
    delayMs: number
  ) => NodeJS.Timeout;
  private readonly clearTimer: (timer: NodeJS.Timeout) => void;
  private events: PendingStreamEvent[] = [];
  private byteCount = 0;
  private timer: NodeJS.Timeout | null = null;
  private disposed = false;
  private hasFlushedFirstText = false;

  constructor(options: StreamEventBatcherOptions) {
    this.onFlush = options.onFlush;
    this.maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
  }

  push(event: BatchedStreamEvent): void {
    if (this.disposed) {
      return;
    }

    const text = getMergeableText(event);
    const previous = this.events[this.events.length - 1];
    if (
      text &&
      previous &&
      previous.textField === text.field &&
      previous.event.type === event.type &&
      previous.textChunks
    ) {
      previous.textChunks.push(text.value);
    } else {
      this.events.push({
        event,
        ...(text ? { textField: text.field, textChunks: [text.value] } : {}),
      });
    }
    this.byteCount +=
      text === null
        ? Buffer.byteLength(JSON.stringify(event), 'utf8')
        : Buffer.byteLength(text.value, 'utf8');

    if (text !== null && !this.hasFlushedFirstText) {
      this.hasFlushedFirstText = true;
      this.flush();
      return;
    }
    if (this.byteCount >= this.maxBytes) {
      this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = this.setTimer(() => this.flush(), this.maxDelayMs);
    }
  }

  flush(): void {
    if (this.timer) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    if (this.events.length === 0) {
      return;
    }

    const events = this.events.map(({ event, textField, textChunks }) => {
      if (!textField || !textChunks) {
        return event;
      }
      return {
        ...event,
        data: {
          ...(event.data as object),
          [textField]: textChunks.join(''),
        },
      };
    });
    this.events = [];
    this.byteCount = 0;
    this.onFlush(events);
  }

  dispose(): void {
    this.flush();
    this.disposed = true;
  }
}
