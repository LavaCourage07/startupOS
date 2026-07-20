/**
 * 工具执行重试工具集
 *
 * 参考 nanobot mcp.py 和 openclaw retry.ts 设计：
 * - 只对瞬时连接类错误重试（网络断开、管道中断等）
 * - 业务错误（文件不存在、权限不足等）不重试，直接返回给 LLM
 * - 指数退避，默认最多 2 次重试
 */

// ============================================================================
// 瞬时错误识别
// ============================================================================

/** 可重试的瞬时错误类名（参考 nanobot _TRANSIENT_EXC_NAMES） */
const TRANSIENT_ERROR_NAMES = new Set([
  'ClosedResourceError',
  'BrokenResourceError',
  'BrokenPipeError',
  'ConnectionResetError',
  'ConnectionRefusedError',
  'ConnectionAbortedError',
  'ConnectionError',
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
]);

/** 可重试的瞬时错误消息模式 */
const TRANSIENT_ERROR_PATTERNS = /ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|socket hang up|network timeout/i;

export function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (TRANSIENT_ERROR_NAMES.has(err.constructor.name)) return true;
  if (TRANSIENT_ERROR_NAMES.has((err as any).code)) return true;
  return TRANSIENT_ERROR_PATTERNS.test(err.message);
}

// ============================================================================
// 重试配置
// ============================================================================

export interface RetryConfig {
  /** 最大重试次数（不含首次尝试），默认 2 */
  maxRetries?: number;
  /** 初始延迟 ms，默认 300 */
  initialDelayMs?: number;
  /** 最大延迟 ms，默认 5000 */
  maxDelayMs?: number;
  /** 是否对当前错误重试，默认只重试瞬时错误 */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
}

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'shouldRetry'>> = {
  maxRetries: 2,
  initialDelayMs: 300,
  maxDelayMs: 5000,
};

// ============================================================================
// retryAsync
// ============================================================================

/**
 * 带重试的异步执行。
 * 首次失败后检查是否为瞬时错误，是则按指数退避重试，否则立即抛出。
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
  label = 'operation',
): Promise<T> {
  const maxRetries = config.maxRetries ?? DEFAULT_CONFIG.maxRetries;
  const initialDelayMs = config.initialDelayMs ?? DEFAULT_CONFIG.initialDelayMs;
  const maxDelayMs = config.maxDelayMs ?? DEFAULT_CONFIG.maxDelayMs;
  const shouldRetry = config.shouldRetry ?? isTransientError;

  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      if (attempt >= maxRetries || !shouldRetry(err, attempt)) {
        throw err;
      }

      const delay = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs);
      console.warn(`[retry] ${label} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms — ${err instanceof Error ? err.message : String(err)}`);
      await sleep(delay);
    }
  }

  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// 工具 execute 包装器
// ============================================================================

/**
 * 用 retryAsync 包装工具的 execute 函数。
 * 只在瞬时连接错误时重试，业务错误直接透传给 LLM。
 */
export function withRetry<T extends { name: string; execute: (...args: any[]) => Promise<any> }>(
  tool: T,
  config?: RetryConfig,
): T {
  return {
    ...tool,
    execute: (...args: Parameters<T['execute']>) =>
      retryAsync(() => tool.execute(...args), config, tool.name),
  };
}
