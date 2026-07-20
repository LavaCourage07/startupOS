/**
 * Tracing — 协作会话分布式追踪。
 *
 * Story 9.18: 生产加固 — 完整可观测性
 *
 * 每个协作操作（任务分配、消息发送、冲突检测等）生成一个 span，
 * 支持父子关系和链路追踪。
 */

// ============================================================================
// Types
// ============================================================================

export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  operation: string;
  agentId?: string;
  sessionId: string;
  startTime: number;
  endTime?: number;
  status: "ok" | "error" | "pending";
  attributes: Record<string, unknown>;
}

export interface Trace {
  traceId: string;
  spans: Span[];
}

// ============================================================================
// Tracer
// ============================================================================

export class Tracer {
  private spans = new Map<string, Span>();
  private traces = new Map<string, Span[]>(); // traceId → spans
  private activeSpans = new Map<string, Span>(); // spanId → span

  /**
   * 开始一个 span。
   */
  startSpan(
    operation: string,
    opts: {
      sessionId: string;
      traceId?: string;
      parentId?: string;
      agentId?: string;
      attributes?: Record<string, unknown>;
    }
  ): string {
    const spanId = `span-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const traceId = opts.traceId ?? `trace-${Date.now()}`;

    const span: Span = {
      id: spanId,
      traceId,
      parentId: opts.parentId,
      operation,
      agentId: opts.agentId,
      sessionId: opts.sessionId,
      startTime: Date.now(),
      status: "pending",
      attributes: opts.attributes ?? {},
    };

    this.spans.set(spanId, span);
    this.activeSpans.set(spanId, span);

    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, []);
    }
    this.traces.get(traceId)!.push(span);

    return spanId;
  }

  /**
   * 结束一个 span。
   */
  endSpan(spanId: string, status: "ok" | "error" = "ok"): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.status = status;
    this.activeSpans.delete(spanId);
  }

  /**
   * 使用回调自动管理 span 生命周期。
   */
  async withSpan<T>(
    operation: string,
    opts: {
      sessionId: string;
      traceId?: string;
      parentId?: string;
      agentId?: string;
      attributes?: Record<string, unknown>;
    },
    fn: (spanId: string) => Promise<T>
  ): Promise<T> {
    const spanId = this.startSpan(operation, opts);
    try {
      const result = await fn(spanId);
      this.endSpan(spanId, "ok");
      return result;
    } catch (error) {
      this.endSpan(spanId, "error");
      throw error;
    }
  }

  /**
   * 获取完整 trace。
   */
  getTrace(traceId: string): Trace | undefined {
    const spans = this.traces.get(traceId);
    if (!spans) return undefined;

    return {
      traceId,
      spans: [...spans],
    };
  }

  /**
   * 获取 session 的所有 traces。
   */
  getTracesBySession(sessionId: string): Trace[] {
    const result: Trace[] = [];
    for (const [traceId, spans] of this.traces) {
      if (spans.some((s) => s.sessionId === sessionId)) {
        result.push({ traceId, spans: [...spans] });
      }
    }
    return result;
  }

  /**
   * 获取活跃 spans。
   */
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * 获取所有 spans。
   */
  getAllSpans(): Span[] {
    return Array.from(this.spans.values());
  }

  /**
   * 获取慢操作（超过阈值 ms）。
   */
  getSlowOperations(thresholdMs: number): Span[] {
    return this.getAllSpans().filter((s) => {
      if (!s.endTime) return false;
      return s.endTime - s.startTime > thresholdMs;
    });
  }

  /**
   * 清理已完成的 traces。
   */
  cleanup(completedBefore?: number): number {
    let count = 0;
    const cutoff = completedBefore ?? Date.now() - 300_000; // default: 5 min ago

    for (const [traceId, spans] of this.traces) {
      const allCompleted = spans.every((s) => s.endTime && s.endTime < cutoff);
      if (allCompleted) {
        this.traces.delete(traceId);
        for (const span of spans) {
          this.spans.delete(span.id);
          this.activeSpans.delete(span.id);
        }
        count++;
      }
    }

    return count;
  }
}
