/**
 * Consolidator 预留接口（Story R.7）
 *
 * 轻量级 token 预算触发式压缩。
 * 本期仅预留接口，不接入触发逻辑。
 * 后续需要前端 token 计数支持时接入。
 */

/** Consolidator 配置 */
export interface ConsolidatorConfig {
  /** 上下文窗口 token 数 */
  contextWindowTokens?: number;
  /** 安全缓冲 token 数 */
  safetyBuffer?: number;
}

export class Consolidator {
  private readonly contextWindowTokens: number;
  private readonly safetyBuffer: number;

  constructor(config?: ConsolidatorConfig) {
    this.contextWindowTokens = config?.contextWindowTokens ?? 128_000;
    this.safetyBuffer = config?.safetyBuffer ?? 10_000;
  }

  /**
   * 判断是否需要压缩。
   * 当当前 token 数超过上下文窗口减去安全缓冲时触发。
   */
  shouldConsolidate(currentTokens: number): boolean {
    const threshold = this.contextWindowTokens - this.safetyBuffer;
    return currentTokens > threshold;
  }
}

/**
 * Consolidator 归档 prompt 模板。
 * 后续接入 LLM 压缩时使用。
 */
export const CONSOLIDATOR_ARCHIVE_PROMPT = `将以下对话历史压缩为简洁摘要，保留：
- 核心请求和决策
- 重要的修改和配置变更
- 用户确认的方案和偏好

省略：
- 调试过程和试错
- 工具调用的详细参数
- 对话填充物和确认语句

输出格式：
## 对话摘要
- [关键请求/决策/修改]`;
