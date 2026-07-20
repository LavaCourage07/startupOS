/**
 * 认知系统类型定义（Epic C）
 *
 * 核心类型已迁移到 @/lib/shared/cognitive（AG.2），此处重导出保持向后兼容。
 */

export type { CorrectionSignal, TurnCognitiveData, CognitiveProvider, MemoryBlock } from '../../../../lib/shared/cognitive';

// ============================================================================
// Reflexion — 情景记忆（Story C.8）
// ============================================================================

export interface ReflectionEntry {
  id: string;
  turnId: string;
  timestamp: string;
  scene: string;
  toolChain: string[];
  failureReason: string;
  reflection: {
    whatWentWrong: string;
    tryNextTime: string;
    lesson: string;
  };
  tags: string[];
  ttl: string; // ISO date, default 30 days
  usedCount: number;
  alternativeAttempts?: Array<{
    timestamp: string;
    whatWentWrong: string;
    tryNextTime: string;
  }>;
}

export interface ReflectionIndexEntry {
  id: string;
  tags: string[];
  scene: string;
  failureReason: string;
  timestamp: string;
  ttl: string;
  usedCount: number;
}

// ============================================================================
// 聚合结果
// ============================================================================

export interface PrefetchResult {
  provider: string;
  content: string;
}

// ============================================================================
// Memory Block 扩展（Story C.9 — Letta 三元记忆）
// ============================================================================

/** 默认 Block 定义 */
export interface DefaultBlockDef {
  label: string;
  description: string;
  limit: number;
  readOnly?: boolean;
}

/** 默认 5 个 Block */
export const DEFAULT_BLOCKS: DefaultBlockDef[] = [
  { label: 'human', description: '用户画像、偏好、历史习惯', limit: 2000 },
  { label: 'persona', description: 'Agent 角色认知、工作风格、专业语言', limit: 2000 },
  { label: 'project', description: '当前项目状态、活跃任务、关键决策', limit: 2000 },
  { label: 'scratchpad', description: '临时笔记、待办、注意项', limit: 1000 },
  { label: 'temporal', description: '关键事件时间线', limit: 3000, readOnly: true },
];

// ============================================================================
// Sleep-time Compute（Story C.9 — Letta 睡眠计算）
// ============================================================================

export type SleepTaskType = 'consolidate_memory' | 'extract_knowledge' | 'mine_patterns' | 'update_blocks';

export interface SleepTask {
  type: SleepTaskType;
  payload: Record<string, unknown>;
}

export type SleepTrigger =
  | { type: 'session_end' }
  | { type: 'interval'; everyNTurns: number }
  | { type: 'manual' };

export interface SleepTaskEntry {
  id: string;
  task: SleepTask;
  trigger: SleepTrigger;
  scheduledAt: number;
}
