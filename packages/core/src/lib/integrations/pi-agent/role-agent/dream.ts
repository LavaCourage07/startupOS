/**
 * Dream 自动记忆维护（Story R.7）
 *
 * 两阶段记忆处理器：
 * Phase 1: LLM 分析对话历史 + 现有 Memory.md，输出结构化指令
 * Phase 2: 解析指令，委托 memory-core compatibility helper 编辑 Memory.md
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import {
  applyDreamInstructions,
  parseDreamInstructions,
} from '../../../../modules/memory-core/core/dream-compat';

/** Dream 配置 */
export interface DreamConfig {
  /** 触发间隔（turn 数，默认 20） */
  turnInterval?: number;
  /** 过时阈值（天数，默认 14） */
  staleThresholdDays?: number;
}

/** Dream 执行结果 */
export interface DreamResult {
  changes: string[];
  skipped: boolean;
}

// ============================================================================
// Phase 1 Prompt 模板
// ============================================================================

export const DREAM_PHASE1_PROMPT = `分析以下对话历史，结合现有 Memory.md，输出记忆更新指令：

## 现有 Memory.md
{existingMemoryMd}

## 对话历史
{recentHistory}

输出格式（每行一条）：
- [ADD] 原子级事实
- [UPDATE] 对已有条目的修正
- [REMOVE] 过时/重复/可从代码推导的条目
- [SKILL] 发现的重复工作流程（名称: 描述）

规则：
- 原子级：具体事实，不要泛泛描述
- 用户纠正 > 解决方案 > 决策 > 事件 > 环境事实
- 去重：同一事实在多处出现时保留最精确的一条
- 过时：已过期计划、已完成任务、被取代的方案
- 不添加：可从源码推导的信息、临时状态、对话填充物

[SKIP] 如果无需更新。`;

// ============================================================================
// Dream 主类
// ============================================================================

export class Dream {
  private readonly agentDir: string;
  private readonly config: Required<DreamConfig>;

  constructor(agentDir: string, config?: DreamConfig) {
    this.agentDir = agentDir;
    this.config = {
      turnInterval: config?.turnInterval ?? 20,
      staleThresholdDays: config?.staleThresholdDays ?? 14,
    };
  }

  get turnInterval(): number {
    return this.config.turnInterval;
  }

  /**
   * 执行 Dream 两阶段记忆维护。
   *
   * @param existingMemoryMd 当前 Memory.md 内容
   * @param recentHistory 近期对话历史（JSONL 格式文本）
   * @returns DreamResult
   *
   * 注意：Phase 1 的 LLM 调用由 launcher 层通过已有 agent 会话完成，
   * 本方法接收 Phase 1 输出的指令文本作为 llmOutput 参数。
   */
  async run(llmOutput: string): Promise<DreamResult> {
    // Phase 2: 解析 LLM 输出并应用更改
    const instructions = parseDreamInstructions(llmOutput);

    if (instructions.length === 0) {
      return { changes: [], skipped: true };
    }

    const memoryPath = path.join(this.agentDir, 'Memory.md');
    const existingContent = existsSync(memoryPath)
      ? readFileSync(memoryPath, 'utf-8')
      : '';

    const newContent = applyDreamInstructions(existingContent, instructions);
    writeFileSync(memoryPath, newContent, 'utf-8');

    const changeDescriptions = instructions.map(i =>
      `[${i.type}] ${i.content.slice(0, 80)}${i.content.length > 80 ? '...' : ''}`,
    );

    return { changes: changeDescriptions, skipped: false };
  }
}
