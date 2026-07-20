/**
 * 实践日志记录系统（Story C.4）
 *
 * 每次 turn 自动记录结构化数据到 practice/turns/turn-{N}.json
 * 异步写入，不阻塞 Agent 响应
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import type { CognitiveProvider, TurnCognitiveData } from './types';

// ============================================================================
// 聚合统计
// ============================================================================

interface PracticeSummary {
  totalTurns: number;
  totalToolCalls: number;
  averageToolChainLength: number;
  successRate: number;
  resolvedCount: number;
  lastUpdated: number;
}

// ============================================================================
// PracticeLogger
// ============================================================================

export class PracticeLogger implements CognitiveProvider {
  readonly name = 'practice';

  private readonly turnsDir: string;
  private readonly summaryPath: string;

  constructor(agentDir: string) {
    this.turnsDir = path.join(agentDir, 'practice', 'turns');
    this.summaryPath = path.join(agentDir, 'practice', 'summary.json');
    this.ensurePracticeDir();
  }

  async sync_turn(data: TurnCognitiveData): Promise<void> {
    const turnFile = path.join(this.turnsDir, `turn-${data.turnNumber}.json`);
    writeFileSync(turnFile, JSON.stringify(data, null, 2), 'utf-8');
    await this.updateSummary(data);
  }

  async prefetch(_query: string): Promise<null> {
    return null;
  }

  async system_prompt_block(): Promise<string> {
    return '';
  }

  // ==========================================================================
  // 内部方法
  // ==========================================================================

  private ensurePracticeDir(): void {
    if (!existsSync(this.turnsDir)) {
      mkdirSync(this.turnsDir, { recursive: true });
    }
  }

  private readSummary(): PracticeSummary {
    if (!existsSync(this.summaryPath)) {
      return {
        totalTurns: 0,
        totalToolCalls: 0,
        averageToolChainLength: 0,
        successRate: 0,
        resolvedCount: 0,
        lastUpdated: Date.now(),
      };
    }
    try {
      return JSON.parse(readFileSync(this.summaryPath, 'utf-8'));
    } catch {
      return {
        totalTurns: 0,
        totalToolCalls: 0,
        averageToolChainLength: 0,
        successRate: 0,
        resolvedCount: 0,
        lastUpdated: Date.now(),
      };
    }
  }

  private writeSummary(summary: PracticeSummary): void {
    writeFileSync(this.summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  }

  private async updateSummary(data: TurnCognitiveData): Promise<void> {
    const summary = this.readSummary();

    summary.totalTurns++;
    summary.totalToolCalls += data.toolCalls.length;
    summary.resolvedCount += data.outcome.resolved ? 1 : 0;
    summary.lastUpdated = Date.now();

    if (summary.totalTurns > 0) {
      summary.averageToolChainLength = +(summary.totalToolCalls / summary.totalTurns).toFixed(2);
      summary.successRate = +(summary.resolvedCount / summary.totalTurns * 100).toFixed(2);
    }

    this.writeSummary(summary);
  }
}
