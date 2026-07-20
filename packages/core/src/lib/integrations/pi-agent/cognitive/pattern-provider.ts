/**
 * 经验模式 Provider（Story C.5）
 *
 * 从实践日志中提取经验模式，评估有效性。
 * 模式提取触发：session_end 或每 N 轮批量分析。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import path from 'path';
import type { CognitiveProvider, TurnCognitiveData, ReflectionEntry, ReflectionIndexEntry } from './types';

const DEFAULT_REFLECTION_TTL_DAYS = 30;
const REFLECTION_EXTENSION_DAYS = 7;
const COMPACTION_THRESHOLD = 100;
const DEDUP_JACCARD_THRESHOLD = 0.8;

// ============================================================================
// 模式注册
// ============================================================================

interface PatternRegistry {
  patterns: PatternEntry[];
  lastAnalyzedTurn: number;
  lastUpdated: number;
}

interface PatternEntry {
  id: string;
  name: string;
  triggerCondition: string;
  toolChain: string[];
  /** 从成功实践中提炼的可复用原则（LLM 分析 assistantThinking 生成） */
  principle?: string;
  effectiveness: {
    avgToolCalls: number;
    successRate: number;
    sampleCount: number;
  };
  isAntiPattern: boolean;
}

// ============================================================================
// PatternProvider
// ============================================================================

export class PatternProvider implements CognitiveProvider {
  readonly name = 'pattern';

  private readonly patternsDir: string;
  private readonly registryPath: string;
  private readonly snapshotMdPath: string;
  private readonly practiceDir: string;
  private readonly turnsDir: string;
  private readonly episodicMemoryDir: string;
  private readonly reflectionIndexPath: string;
  private reflectionIndex: ReflectionIndexEntry[] = [];

  constructor(agentDir: string) {
    this.patternsDir = path.join(agentDir, 'patterns');
    this.registryPath = path.join(this.patternsDir, 'registry.json');
    this.snapshotMdPath = path.join(agentDir, 'Patterns.md');
    this.practiceDir = path.join(agentDir, 'practice');
    this.turnsDir = path.join(this.practiceDir, 'turns');
    this.episodicMemoryDir = path.join(this.patternsDir, 'episodic-memory');
    this.reflectionIndexPath = path.join(this.episodicMemoryDir, 'reflection-index.jsonl');
    this.ensurePatternsDir();
    this.ensureEpisodicMemoryDir();
    this.loadReflectionIndex();
  }

  async sync_turn(data: TurnCognitiveData): Promise<void> {
    const currentChain = data.toolCalls.map(t => t.name);

    // Check if there's a matching reflection we can apply
    if (currentChain.length > 0) {
      this.applyMatchingReflection(currentChain);
    }

    // Detect failures
    const hasErrors = data.toolCalls.some(t => !t.success);
    const resolved = data.outcome.resolved;

    if (!resolved || hasErrors) {
      await this.on_failure(data);
      return;
    }

    // Non-failure: record tool chain pattern matching (existing logic)
    if (currentChain.length === 0) return;

    const registry = this.readRegistry();
    const matched = registry.patterns.find(p =>
      !p.isAntiPattern && this.chainsMatch(p.toolChain, currentChain)
    );

    if (matched) {
      matched.effectiveness.sampleCount++;
      matched.effectiveness.avgToolCalls =
        (matched.effectiveness.avgToolCalls * (matched.effectiveness.sampleCount - 1) + currentChain.length) / matched.effectiveness.sampleCount;
      matched.effectiveness.successRate =
        ((matched.effectiveness.successRate * (matched.effectiveness.sampleCount - 1)) + 100) / matched.effectiveness.sampleCount;
    } else if (currentChain.length <= 3) {
      const newPattern: PatternEntry = {
        id: `pattern-${Date.now()}`,
        name: `Auto: ${currentChain.join(' → ')}`,
        triggerCondition: `当用户需要类似 ${currentChain[0]} 功能时`,
        toolChain: currentChain,
        effectiveness: {
          avgToolCalls: currentChain.length,
          successRate: 100,
          sampleCount: 1,
        },
        isAntiPattern: false,
      };
      registry.patterns.push(newPattern);
    }

    this.writeRegistry(registry);
  }

  async prefetch(query: string): Promise<string | null> {
    const registry = this.readRegistry();
    const keywords = query.split(/\s+/).filter(w => w.length > 2);

    const matched = registry.patterns.filter(p =>
      !p.isAntiPattern &&
      (p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.toolChain.some(t => keywords.some(kw => t.toLowerCase().includes(kw.toLowerCase()))))
    );

    const parts: string[] = [];

    if (matched.length > 0) {
      parts.push(`## Relevant Patterns\n\n${matched.map(p => `- **${p.toolChain.join(' → ')}**: ${p.principle || p.triggerCondition}`).join('\n')}`);
    }

    // 追加反思检索结果
    const reflections = await this.searchReflections(query);
    if (reflections) {
      parts.push(reflections);
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  async system_prompt_block(): Promise<string> {
    if (existsSync(this.snapshotMdPath)) {
      try {
        const content = readFileSync(this.snapshotMdPath, 'utf-8');
        if (content.trim()) {
          return `## Experience Patterns Snapshot\n\n以下是经验模式快照（Patterns.md），包含从历史实践中提炼的最佳路径和反模式：\n\n${content}`;
        }
      } catch {
        // ignore
      }
    }
    return '';
  }

  async on_session_end(_messages: unknown[]): Promise<void> {
    const registry = this.readRegistry();
    const lastAnalyzed = registry.lastAnalyzedTurn;

    // 读取最近未分析的 turn 文件
    const turnFiles = this.listTurnFiles();
    const recentTurns = turnFiles
      .map(f => {
        const match = f.match(/turn-(\d+)\.json/);
        return match?.[1] ? { num: parseInt(match[1]), file: f } : null;
      })
      .filter(Boolean)
      .filter(t => t!.num > lastAnalyzed)
      .sort((a, b) => a!.num - b!.num);

    if (recentTurns.length === 0) return;

    // 收集每个工具链的统计 + 最佳 thinking 样本
    const chainStats = new Map<string, {
      count: number; resolved: number; totalLength: number;
      lastScene: string; // 最近一次使用的场景（用户消息）
      bestThinking: string; // 最清晰的 thinking 样本（用于提炼原则）
    }>();

    for (const turn of recentTurns) {
      const turnPath = path.join(this.turnsDir, turn!.file);
      try {
        const turnData: TurnCognitiveData = JSON.parse(readFileSync(turnPath, 'utf-8'));
        const chainKey = turnData.toolCalls.map(t => t.name).join(' → ');
        if (!chainKey) continue;

        const stats = chainStats.get(chainKey) ?? {
          count: 0, resolved: 0, totalLength: 0,
          lastScene: '', bestThinking: '',
        };
        stats.count++;
        if (turnData.outcome.resolved) stats.resolved++;
        stats.totalLength += turnData.toolCalls.length;
        stats.lastScene = turnData.userMessage.slice(0, 100);
        // 保留最长 thinking（通常包含最完整的决策推理）
        if (turnData.assistantThinking.length > stats.bestThinking.length) {
          stats.bestThinking = turnData.assistantThinking;
        }
        chainStats.set(chainKey, stats);
      } catch {
        // skip
      }
    }

    // 更新注册表
    for (const [chainKey, stats] of chainStats) {
      const existing = registry.patterns.find(p => p.toolChain.join(' → ') === chainKey);
      if (existing) {
        existing.effectiveness.sampleCount += stats.count;
        existing.effectiveness.avgToolCalls = stats.totalLength / stats.count;
        existing.effectiveness.successRate = (stats.resolved / stats.count) * 100;
      } else if (stats.count >= 2) {
        const successRate = (stats.resolved / stats.count) * 100;
        const avgLength = stats.totalLength / stats.count;
        const tools = chainKey.split(' → ');

        const isAntiPattern = successRate < 50 || avgLength > 5;
        const principle = this.extractPrinciple(tools, stats.lastScene, stats.bestThinking, isAntiPattern);
        registry.patterns.push({
          id: `pattern-${Date.now()}-${chainKey.slice(0, 20)}`,
          name: isAntiPattern ? `Anti: ${tools.join(' → ')}` : `Auto: ${tools.join(' → ')}`,
          triggerCondition: principle,
          toolChain: tools,
          effectiveness: {
            avgToolCalls: avgLength,
            successRate,
            sampleCount: stats.count,
          },
          isAntiPattern,
        });
      }
    }

    registry.lastAnalyzedTurn = recentTurns[recentTurns.length - 1]?.num ?? lastAnalyzed;
    registry.lastUpdated = Date.now();
    this.writeRegistry(registry);
    this.updatePatternsMd(registry);
  }

  /**
   * 从工具链 + 场景 + thinking 中提取可复用原则
   * （Rule-based 简化版，后续可接入 LLM 提炼）
   */
  private extractPrinciple(
    _tools: string[],
    scene: string,
    thinking: string,
    isAnti: boolean
  ): string {
    if (isAnti) {
      return `该工具链在类似场景下效果不佳，建议寻找替代路径`;
    }
    // 从 thinking 中抽取决策推理关键词
    if (thinking.length > 20) {
      const reasoning = thinking.slice(0, 200);
      return `场景: ${scene}。决策推理: ${reasoning}...`;
    }
    return `当需要处理类似"${scene}"任务时`;
  }

  // ==========================================================================
  // Reflexion — Episodic Memory（Story C.8）
  // ==========================================================================

  private ensureEpisodicMemoryDir(): void {
    if (!existsSync(this.episodicMemoryDir)) {
      mkdirSync(this.episodicMemoryDir, { recursive: true });
    }
  }

  private loadReflectionIndex(): void {
    if (!existsSync(this.reflectionIndexPath)) return;
    try {
      const content = readFileSync(this.reflectionIndexPath, 'utf-8');
      this.reflectionIndex = content
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => JSON.parse(line) as ReflectionIndexEntry);
    } catch {
      this.reflectionIndex = [];
    }
  }

  private appendToReflectionIndex(entry: ReflectionIndexEntry): void {
    this.reflectionIndex.push(entry);
    const line = JSON.stringify(entry) + '\n';
    writeFileSync(this.reflectionIndexPath, line, { flag: 'a' });
  }

  /**
   * 失败触发：生成反思并存储到情景记忆
   */
  async on_failure(data: TurnCognitiveData): Promise<void> {
    const toolChain = data.toolCalls.map(t => t.name);
    const errors = data.toolCalls
      .filter(t => !t.success)
      .map(t => `${t.name}: ${t.result || 'unknown error'}`)
      .join('; ');

    const failureReason = errors || 'Task unresolved';

    // Generate reflection tags from tool names and failure reason
    const tags = this.extractReflectionTags(toolChain, data.userMessage, failureReason);

    // Generate a simple rule-based reflection (LLM-based can be added later)
    const reflection = this.generateReflection(toolChain, failureReason, tags);

    const entry: ReflectionEntry = {
      id: `reflection-${data.turnNumber}`,
      turnId: `turn-${data.turnNumber}`,
      timestamp: new Date().toISOString(),
      scene: data.userMessage.slice(0, 200),
      toolChain,
      failureReason,
      reflection,
      tags,
      ttl: new Date(Date.now() + DEFAULT_REFLECTION_TTL_DAYS * 86400000).toISOString(),
      usedCount: 0,
    };

    // Deduplicate before saving
    await this.deduplicateAndSaveReflection(entry);
  }

  /**
   * 生成反思内容（Rule-based initial implementation）
   * TODO: Replace with LLM-based Self-Reflector
   */
  private generateReflection(
    toolChain: string[],
    failureReason: string,
    _tags: string[]
  ): ReflectionEntry['reflection'] {
    return {
      whatWentWrong: `工具链 ${toolChain.join(' → ')} 失败: ${failureReason}`,
      tryNextTime: `尝试替代方案: 减少工具调用链长度，避免 ${toolChain.join(' → ')} 路径`,
      lesson: `失败路径记录: ${toolChain.join(' → ')} 在当前场景下不可靠`,
    };
  }

  /**
   * 从失败场景中提取标签
   */
  private extractReflectionTags(
    toolChain: string[],
    userMessage: string,
    failureReason: string
  ): string[] {
    const tags = new Set<string>();

    // 工具名称作为标签
    for (const tool of toolChain) {
      tags.add(tool);
    }

    // 从失败原因中提取关键词
    const keywords = ['error', 'timeout', 'failed', 'empty', 'invalid', 'not found'];
    const lowerReason = failureReason.toLowerCase();
    for (const kw of keywords) {
      if (lowerReason.includes(kw)) tags.add(kw);
    }

    // 从用户消息中提取场景关键词（>3 字符的词）
    const words = userMessage.split(/\s+/).filter(w => w.length > 3);
    for (const word of words.slice(0, 3)) {
      tags.add(word.toLowerCase());
    }

    return Array.from(tags);
  }

  /**
   * 去重后保存
   */
  private async deduplicateAndSaveReflection(entry: ReflectionEntry): Promise<void> {
    // Calculate Jaccard similarity with existing reflections
    let bestMatch: ReflectionIndexEntry | null = null;
    let bestScore = 0;

    for (const existing of this.reflectionIndex) {
      const score = this.jaccardSimilarity(new Set(entry.tags), new Set(existing.tags));
      if (score > bestScore) {
        bestScore = score;
        bestMatch = existing;
      }
    }

    if (bestScore >= DEDUP_JACCARD_THRESHOLD && bestMatch) {
      // Append to existing reflection's alternative attempts
      const existingFile = path.join(this.episodicMemoryDir, `${bestMatch.id}.json`);
      try {
        const existingContent = JSON.parse(readFileSync(existingFile, 'utf-8')) as ReflectionEntry;
        if (!existingContent.alternativeAttempts) {
          existingContent.alternativeAttempts = [];
        }
        existingContent.alternativeAttempts.push({
          timestamp: entry.timestamp,
          whatWentWrong: entry.reflection.whatWentWrong,
          tryNextTime: entry.reflection.tryNextTime,
        });
        writeFileSync(existingFile, JSON.stringify(existingContent, null, 2), 'utf-8');
      } catch {
        // Fall back to new file
        this.saveReflection(entry);
      }
    } else {
      this.saveReflection(entry);
    }

    // Check if compaction is needed
    if (this.reflectionIndex.length >= COMPACTION_THRESHOLD) {
      await this.compactEpisodicMemory();
    }
  }

  /**
   * 保存反思到磁盘
   */
  private saveReflection(entry: ReflectionEntry): void {
    const filePath = path.join(this.episodicMemoryDir, `${entry.id}.json`);
    writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
    this.appendToReflectionIndex(this.toIndexEntry(entry));
  }

  private toIndexEntry(entry: ReflectionEntry): ReflectionIndexEntry {
    return {
      id: entry.id,
      tags: entry.tags,
      scene: entry.scene,
      failureReason: entry.failureReason,
      timestamp: entry.timestamp,
      ttl: entry.ttl,
      usedCount: entry.usedCount,
    };
  }

  /**
   * 检索相关反思
   */
  async searchReflections(query: string): Promise<string | null> {
    const now = new Date();
    this.pruneExpiredReflections();

    const queryTags = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    // Score reflections by tag overlap + recency + low usage
    const scored = this.reflectionIndex
      .filter(entry => new Date(entry.ttl) > now)
      .map(entry => {
        const tagOverlap = this.jaccardSimilarity(queryTags, new Set(entry.tags));
        const recencyBonus = Math.max(0, (new Date(entry.ttl).getTime() - now.getTime()) / (30 * 86400000));
        const usagePenalty = Math.min(entry.usedCount * 0.1, 1);
        const score = tagOverlap * 2 + recencyBonus - usagePenalty;
        return { entry, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (scored.length === 0) return null;

    const lines: string[] = ['## 历史失败反思（可能相关）\n'];
    for (const { entry } of scored) {
      // Update usedCount
      const idx = this.reflectionIndex.findIndex(e => e.id === entry.id);
      if (idx >= 0) {
        const idxEntry = this.reflectionIndex[idx]!;
        idxEntry.usedCount++;
        // Extend TTL
        const currentTtl = new Date(idxEntry.ttl).getTime();
        idxEntry.ttl = new Date(currentTtl + REFLECTION_EXTENSION_DAYS * 86400000).toISOString();
      }

      const reflection = this.loadReflectionFromFile(entry.id);
      if (reflection) {
        lines.push(`### 场景: ${reflection.scene.slice(0, 100)}`);
        lines.push(`**失败原因:** ${reflection.failureReason}`);
        lines.push(`**教训:** ${reflection.reflection.lesson}`);
        lines.push(`**下次尝试:** ${reflection.reflection.tryNextTime}`);
        lines.push('');
      }
    }

    // Persist updated index
    this.rewriteReflectionIndexFile();
    return lines.join('\n');
  }

  private loadReflectionFromFile(id: string): ReflectionEntry | null {
    const filePath = path.join(this.episodicMemoryDir, `${id}.json`);
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  /**
   * 应用匹配的反思到当前工具链（标记使用）
   */
  private applyMatchingReflection(currentChain: string[]): void {
    const chainTags = new Set(currentChain.map(t => t.toLowerCase()));
    for (const entry of this.reflectionIndex) {
      const overlap = this.jaccardSimilarity(chainTags, new Set(entry.tags.map(t => t.toLowerCase())));
      if (overlap >= 0.5) {
        const idx = this.reflectionIndex.findIndex(e => e.id === entry.id);
        if (idx >= 0) {
          this.reflectionIndex[idx]!.usedCount++;
        }
      }
    }
    // Only rewrite if something changed
    // (skip file write for performance, will persist on next search)
  }

  /**
   * 清理过期反思
   */
  private pruneExpiredReflections(): void {
    const now = new Date();
    const expiredIds: string[] = [];
    this.reflectionIndex = this.reflectionIndex.filter(entry => {
      if (new Date(entry.ttl) < now) {
        expiredIds.push(entry.id);
        return false;
      }
      return true;
    });
    if (expiredIds.length > 0) {
      this.rewriteReflectionIndexFile();
    }
  }

  /**
   * 定期压缩：合并同类反思，删除从未使用的过期反思
   */
  async compactEpisodicMemory(): Promise<void> {
    const report: string[] = ['## 情景记忆压缩报告', ''];
    const beforeCount = this.reflectionIndex.length;

    // Merge reflections with > 50% tag overlap
    const merged: Set<string> = new Set();
    const kept: ReflectionIndexEntry[] = [];

    for (let i = 0; i < this.reflectionIndex.length; i++) {
      const entryI = this.reflectionIndex[i]!;
      if (merged.has(entryI.id)) continue;
      const a = entryI;
      kept.push(a);
      merged.add(a.id);

      for (let j = i + 1; j < this.reflectionIndex.length; j++) {
        const entryJ = this.reflectionIndex[j]!;
        if (merged.has(entryJ.id)) continue;
        const b = entryJ;
        const overlap = this.jaccardSimilarity(new Set(a.tags), new Set(b.tags));
        if (overlap >= 0.5) {
          merged.add(b.id);
          // Merge b's alternative attempts into a
          const bFile = this.loadReflectionFromFile(b.id);
          if (bFile) {
            const aFile = this.loadReflectionFromFile(a.id);
            if (aFile) {
              if (!aFile.alternativeAttempts) aFile.alternativeAttempts = [];
              if (bFile.alternativeAttempts) {
                aFile.alternativeAttempts.push(...bFile.alternativeAttempts);
              }
              aFile.alternativeAttempts.push({
                timestamp: bFile.timestamp,
                whatWentWrong: bFile.reflection.whatWentWrong,
                tryNextTime: bFile.reflection.tryNextTime,
              });
              writeFileSync(
                path.join(this.episodicMemoryDir, `${a.id}.json`),
                JSON.stringify(aFile, null, 2),
                'utf-8'
              );
            }
          }
          // Delete b's file
          try {
            const bPath = path.join(this.episodicMemoryDir, `${b.id}.json`);
            const { rmSync } = await import('fs');
            rmSync(bPath, { force: true });
          } catch { /* ignore */ }
          report.push(`- 合并: ${b.id} → ${a.id}`);
        }
      }
    }

    this.reflectionIndex = kept;
    this.rewriteReflectionIndexFile();

    report.unshift(`## 情景记忆压缩报告\n压缩前: ${beforeCount} 条 → 压缩后: ${kept.length} 条\n`);
    const reportPath = path.join(this.episodicMemoryDir, 'compaction-report.md');
    writeFileSync(reportPath, report.join('\n'), 'utf-8');
  }

  private rewriteReflectionIndexFile(): void {
    const content = this.reflectionIndex
      .map(entry => JSON.stringify(entry))
      .join('\n') + '\n';
    writeFileSync(this.reflectionIndexPath, content, 'utf-8');
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    const intersection = new Set([...a].filter(x => b.has(x)));
    const union = new Set([...a, ...b]);
    return intersection.size / union.size;
  }

  // ==========================================================================
  // 内部方法
  // ==========================================================================

  private ensurePatternsDir(): void {
    if (!existsSync(this.patternsDir)) {
      mkdirSync(this.patternsDir, { recursive: true });
    }
    if (!existsSync(this.registryPath)) {
      this.writeRegistry({ patterns: [], lastAnalyzedTurn: 0, lastUpdated: Date.now() });
    }
  }

  private readRegistry(): PatternRegistry {
    if (!existsSync(this.registryPath)) {
      return { patterns: [], lastAnalyzedTurn: 0, lastUpdated: Date.now() };
    }
    try {
      return JSON.parse(readFileSync(this.registryPath, 'utf-8'));
    } catch {
      return { patterns: [], lastAnalyzedTurn: 0, lastUpdated: Date.now() };
    }
  }

  private writeRegistry(registry: PatternRegistry): void {
    writeFileSync(this.registryPath, JSON.stringify(registry, null, 2), 'utf-8');
  }

  private listTurnFiles(): string[] {
    if (!existsSync(this.turnsDir)) return [];
    try {
      return readdirSync(this.turnsDir).filter(f => f.startsWith('turn-') && f.endsWith('.json'));
    } catch {
      return [];
    }
  }

  private chainsMatch(pattern: string[], current: string[]): boolean {
    if (pattern.length !== current.length) return false;
    return pattern.every((p, i) => p.toLowerCase() === current[i]?.toLowerCase());
  }

  private updatePatternsMd(registry: PatternRegistry): void {
    const lines = ['# Experience Patterns\n'];

    // ===== Positive: 成功实践中提炼的最佳实践 =====
    const validPatterns = registry.patterns.filter(p => !p.isAntiPattern);
    if (validPatterns.length > 0) {
      lines.push('## Positive — 最佳实践\n');
      for (const p of validPatterns) {
        lines.push(`### ${p.triggerCondition}`);
        lines.push(`**推荐路径:** \`${p.toolChain.join(' → ')}\``);
        if (p.principle) {
          lines.push(`**原则:** ${p.principle}`);
        }
        lines.push('');
      }
    }

    // ===== Negative: Reflexion 失败反思，用于后续会话避免 =====
    const antiPatterns = registry.patterns.filter(p => p.isAntiPattern);
    const reflections = this.getReflectionsForPatternsMd();

    if (antiPatterns.length > 0 || reflections.length > 0) {
      lines.push('## Negative — 避免路径\n');

      // 反模式（统计型失败路径）
      for (const p of antiPatterns) {
        lines.push(`### 避免路径: \`${p.toolChain.join(' → ')}\``);
        lines.push(`**原因:** ${p.triggerCondition}\n`);
      }

      // Reflexion 反思
      for (const r of reflections) {
        lines.push(`### 反思: ${r.scene.slice(0, 80)}…`);
        lines.push(`**失败原因:** ${r.failureReason}`);
        lines.push(`**教训:** ${r.reflection.lesson}`);
        lines.push(`**下次避免:** ${r.reflection.tryNextTime}`);
        lines.push('');
      }
    }

    if (validPatterns.length === 0 && antiPatterns.length === 0 && reflections.length === 0) {
      lines.push('（尚无经验模式，待积累）\n');
    }

    writeFileSync(this.snapshotMdPath, lines.join('\n'), 'utf-8');
  }

  /**
   * 获取需要写入 Patterns.md 的反思（按使用频次排序，取 Top 10）
   */
  private getReflectionsForPatternsMd(): ReflectionEntry[] {
    const now = new Date();
    return this.reflectionIndex
      .filter(e => new Date(e.ttl) > now)
      .map(e => this.loadReflectionFromFile(e.id))
      .filter(Boolean) as ReflectionEntry[];
  }
}
