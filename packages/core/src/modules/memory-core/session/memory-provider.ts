/**
 * MemoryProvider — CognitiveProvider 实现。
 *
 * Story M.6: 接入现有 CognitiveManager，
 * 提供 prefetch / sync_turn / system_prompt_block 方法。
 */

import type { CognitiveProvider, TurnCognitiveData } from '../../../lib/shared/cognitive';
import fs from 'node:fs';
import path from 'node:path';
import { MemoryCore } from '../core/memory-core';
import { MemoryConsolidator, type ConsolidationResult } from '../core/consolidator';
import type { KnowledgeCandidateBatch } from '../../../lib/integrations/pi-agent/cognitive/knowledge-provider';

export interface MemoryQueryResult {
  recent_history: string[];
  stable_memory: string[];
  pattern: string[];
  reflection: string[];
  knowledge_candidate: string[];
}

interface PersistedKnowledgeCandidate {
  savedAt: number;
  entities: Array<{ name: string; type: string; attributes: Record<string, unknown> }>;
  facts: string[];
}

export class MemoryProvider implements CognitiveProvider {
  readonly name = 'memory';

  private core: MemoryCore;
  private consolidator: MemoryConsolidator;
  private agentDir: string;
  private sessionId: string;
  private lastConsolidation: ConsolidationResult | null = null;
  private knowledgeCandidatesPath: string;
  private knowledgeConsumer?: { ingestCandidates(candidates: KnowledgeCandidateBatch[]): Promise<void> };

  /**
   * 构造 MemoryProvider。
   * 优先复用外部传入的 MemoryCore 实例（避免与 tool 侧创建重复实例）。
   * 如未传入，则自行创建。
   */
  constructor(
    coreOrAgentDir: MemoryCore | string,
    sessionId: string = 'default',
    knowledgeConsumer?: { ingestCandidates(candidates: KnowledgeCandidateBatch[]): Promise<void> },
  ) {
    this.sessionId = sessionId;
    this.knowledgeConsumer = knowledgeConsumer;
    if (coreOrAgentDir instanceof MemoryCore) {
      this.core = coreOrAgentDir;
      this.agentDir = this.core.agentDir;
    } else {
      this.agentDir = coreOrAgentDir;
      this.core = new MemoryCore(coreOrAgentDir, sessionId);
    }
    this.consolidator = new MemoryConsolidator(this.agentDir, this.sessionId);
    this.knowledgeCandidatesPath = path.join(this.agentDir, 'knowledge', 'candidates.json');
  }

  async prefetch(query: string): Promise<string | null> {
    const sections = await this.queryMemory(query);
    const parts: string[] = [];

    if (sections.pattern.length > 0 || sections.reflection.length > 0) {
      parts.push('## Archival Memory (Semantic)\n');
      for (const item of [...sections.pattern, ...sections.reflection]) {
        parts.push(`- ${item}`);
      }
    }

    if (sections.recent_history.length > 0) {
      parts.push(`## Recall Memory (Conversation History)\n\n${sections.recent_history.map((item) => `- ${item}`).join('\n')}`);
    }

    if (sections.stable_memory.length > 0) {
      parts.push(`## Stable Memory\n\n${sections.stable_memory.map((item) => `- ${item}`).join('\n')}`);
    }

    if (sections.knowledge_candidate.length > 0) {
      parts.push(`## Knowledge Candidates\n\n${sections.knowledge_candidate.map((item) => `- ${item}`).join('\n')}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  async sync_turn(data: TurnCognitiveData): Promise<void> {
    this.core.recall.recordTurn({
      turnNumber: data.turnNumber,
      userMessage: data.userMessage,
      assistantMessage: data.assistantMessage,
      toolCalls: data.toolCalls,
    });
  }

  async system_prompt_block(): Promise<string> {
    return this.core.memory.compile({ format: 'xml' });
  }

  async on_session_end(_messages: unknown[]): Promise<ConsolidationResult | null> {
    const result = await this.consolidator.consolidate();
    const hasMaterializedOutput =
      result.consolidated
      || result.knowledgeCandidates.length > 0
      || result.stableMemory.length > 0
      || result.patterns.length > 0;
    this.lastConsolidation = hasMaterializedOutput ? result : null;
    if (this.lastConsolidation && this.lastConsolidation.knowledgeCandidates.length > 0) {
      this.persistKnowledgeCandidates(this.lastConsolidation.knowledgeCandidates);
      await this.knowledgeConsumer?.ingestCandidates(this.lastConsolidation.knowledgeCandidates);
    }
    return this.lastConsolidation;
  }

  getLastConsolidation(): ConsolidationResult | null {
    return this.lastConsolidation;
  }

  async queryMemory(query: string): Promise<MemoryQueryResult> {
    const [archivalResults, recallResults] = await Promise.all([
      this.core.archival.search(query, { limit: 5 }),
      this.core.recall.searchSemantic(query, 5),
    ]);

    const stable_memory = this.lastConsolidation
      ? this.lastConsolidation.stableMemory.filter((item) => item.includes(query))
      : [];
    const persistedCandidates = this.readPersistedKnowledgeCandidates();
    const activeKnowledgeCandidates = this.lastConsolidation?.knowledgeCandidates ?? persistedCandidates;
    const knowledge_candidate = activeKnowledgeCandidates
      ? activeKnowledgeCandidates
          .flatMap((candidate) => [
            ...candidate.entities.map((entity) => `Entity: ${entity.name} (${entity.type})`),
            ...candidate.facts,
          ])
          .filter((item) => item.includes(query))
      : [];

    const archivalTexts = archivalResults.map((result) => result.text);
    const pattern = archivalTexts.filter((item) => item.includes('[POSITIVE]'));
    const reflection = archivalTexts.filter((item) => item.includes('失败场景:') || item.includes('[NEGATIVE]'));

    return {
      recent_history: recallResults.map((result) => `Turn #${result.turnNumber} [${result.score.toFixed(2)}]: ${result.summary}`),
      stable_memory,
      pattern,
      reflection,
      knowledge_candidate,
    };
  }

  private persistKnowledgeCandidates(
    candidates: Array<{
      entities: Array<{ name: string; type: string; attributes: Record<string, unknown> }>;
      facts: string[];
    }>,
  ): void {
    const persisted: PersistedKnowledgeCandidate[] = candidates.map((candidate) => ({
      savedAt: Date.now(),
      entities: candidate.entities,
      facts: candidate.facts,
    }));
    fs.mkdirSync(path.dirname(this.knowledgeCandidatesPath), { recursive: true });
    fs.writeFileSync(this.knowledgeCandidatesPath, JSON.stringify(persisted, null, 2), 'utf-8');
  }

  private readPersistedKnowledgeCandidates(): Array<{
    entities: Array<{ name: string; type: string; attributes: Record<string, unknown> }>;
    facts: string[];
  }> {
    if (!fs.existsSync(this.knowledgeCandidatesPath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(this.knowledgeCandidatesPath, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedKnowledgeCandidate[];
      return parsed.map((item) => ({
        entities: item.entities,
        facts: item.facts,
      }));
    } catch {
      return [];
    }
  }

  get coreMemory() { return this.core.memory; }
  get archivalMemory() { return this.core.archival; }
  get recallMemory() { return this.core.recall; }
  get coreTools() { return this.core.coreTools; }
  get archivalTools() { return this.core.archivalTools; }
}
