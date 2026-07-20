/**
 * Context Memory Database
 *
 * Manages storage and retrieval of taste memories.
 * MVP: Uses PostgreSQL JSONB with in-memory graph for phase 1.
 */

import {
  TasteMemory,
  TasteContext,
  TASTEProfile,
  OwnershipPromotionCriteria,
  DEFAULT_PROMOTION_CRITERIA,
  OwnershipLevel,
} from './taste-schema';
import { MemoryGraph } from './memory-graph';

interface MemoryEvent {
  type: 'memory_created' | 'memory_reinforced' | 'memory_archived';
  memory_id: string;
  timestamp: number;
}

interface QueryOptions {
  limit?: number;
  minDecayWeight?: number;
  maxAgeDays?: number;
}

/**
 * Context Memory Database
 *
 * Phase 1 (Observer Mode): In-memory graph, minimal persistence
 * Future: PostgreSQL integration for production
 */
export class ContextMemoryDB {
  private graph: MemoryGraph;
  private eventLog: MemoryEvent[] = [];
  private promotionCriteria: OwnershipPromotionCriteria;

  constructor(promotionCriteria?: OwnershipPromotionCriteria) {
    this.graph = new MemoryGraph();
    this.promotionCriteria = promotionCriteria ?? DEFAULT_PROMOTION_CRITERIA;
  }

  /**
   * Write a taste memory
   *
   * Conditions (AND):
   * 1. Decision occurred (not just info query)
   * 2. Clear feedback received
   * 3. Context is reusable
   */
  async writeMemory(memory: TasteMemory): Promise<void> {
    if (!this.shouldWrite(memory)) {
      return;
    }

    const existing = await this.findSimilar(memory.context);
    if (existing.length > 0) {
      const existingMemory = await this.graph.getMemory(existing[0].id);
      const feedbackFactor = memory.feedback.feedback.outcome === 'positive' ? 0.1 : -0.05;
      const newWeight = Math.min(1, Math.max(0, existingMemory.decay_weight + feedbackFactor));
      await this.graph.updateDecayWeight(existing[0].id, newWeight);
      await this.graph.incrementReferenceCount(existing[0].id);
      this.logEvent({
        type: 'memory_reinforced',
        memory_id: existing[0].id,
        timestamp: Date.now(),
      });
    } else {
      await this.graph.addNode(memory);
      await this.graph.addContextRelations(memory);
      this.logEvent({
        type: 'memory_created',
        memory_id: memory.id,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Retrieve relevant context memories
   *
   * Priority: high weight + high relevance + recent verification
   */
  async retrieveMemories(
    context: TasteContext,
    options: QueryOptions = {}
  ): Promise<TasteMemory[]> {
    return await this.graph.query(context, {
      minDecayWeight: options.minDecayWeight ?? 0.3,
      maxAge: options.maxAgeDays ? `${options.maxAgeDays}d` : '90d',
      limit: options.limit ?? 5,
    });
  }

  /**
   * Retrieve all memories for distillation
   */
  async getAllMemories(options: {
    minDecayWeight?: number;
    maxAgeDays?: number;
  } = {}): Promise<TasteMemory[]> {
    return await this.graph.queryAll({
      minDecayWeight: options.minDecayWeight ?? 0,
      maxAge: options.maxAgeDays ? `${options.maxAgeDays}d` : undefined,
    });
  }

  /**
   * Weekly distillation: Generate taste profile
   */
  async distillTasteProfile(): Promise<TASTEProfile> {
    const memories = await this.getAllMemories({ minDecayWeight: 0.5 });
    const summary = await this.generateProfileSummary(memories);

    return {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      summary,
      memory_stats: this.calculateMemStats(memories),
    };
  }

  /**
   * Evaluate and promote ownership
   */
  async evaluateOwnershipPromotion(
    memoryId: string,
    criteria?: OwnershipPromotionCriteria
  ): Promise<{
    shouldPromote: boolean;
    targetLevel: OwnershipLevel;
    reason: string;
  }> {
    const memory = await this.graph.getMemory(memoryId);
    const cr = criteria ?? this.promotionCriteria;

    if (memory.ownership === 'personal') {
      const meetsConfidence = memory.decay_weight >= cr.personal_to_position.min_confidence;
      const meetsValidations = memory.reference_count >= cr.personal_to_position.min_validations;
      const meetsReuse = await this.getCrossUserReuse(memoryId) >= cr.personal_to_position.min_cross_user_reuse;

      if (meetsConfidence && meetsValidations && meetsReuse) {
        return {
          shouldPromote: true,
          targetLevel: 'role',
          reason: 'Meets personal->role criteria',
        };
      }
    } else if (memory.ownership === 'role') {
      const meetsConfidence = memory.decay_weight >= cr.position_to_organization.min_confidence;
      const meetsValidations = memory.reference_count >= cr.position_to_organization.min_validations;
      const meetsReuse = await this.getCrossRoleReuse(memoryId) >= cr.position_to_organization.min_cross_position_reuse;
      // Note: success_rate and manual_review are not implemented in MVP

      if (meetsConfidence && meetsValidations && meetsReuse) {
        return {
          shouldPromote: true,
          targetLevel: 'organization',
          reason: 'Meets role->organization criteria (manual review pending)',
        };
      }
    }

    return {
      shouldPromote: false,
      targetLevel: 'personal',
      reason: 'Does not meet promotion criteria',
    };
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    totalMemories: number;
    byOwnership: Record<OwnershipLevel, number>;
    avgDecayWeight: number;
  } {
    // Simplified for MVP
    return {
      totalMemories: this.graph.getNodeCount(),
      byOwnership: {
        personal: 0,
        role: 0,
        organization: 0,
      },
      avgDecayWeight: 0.5,
    };
  }

  /**
   * Get event log
   */
  getEventLog(): MemoryEvent[] {
    return [...this.eventLog];
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.graph.clear();
    this.eventLog = [];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private shouldWrite(memory: TasteMemory): boolean {
    const isDecision = memory.judgment.judgment.type !== 'preference';
    const hasFeedback = memory.feedback.feedback.outcome !== 'neutral';
    const hasReuse = this.isReusableContext(memory.context);

    return isDecision && hasFeedback && hasReuse;
  }

  private isReusableContext(context: TasteContext): boolean {
    const cf = context.context_features;
    return cf.domain.length > 0 && cf.task_type.length > 0;
  }

  private async findSimilar(context: TasteContext): Promise<TasteMemory[]> {
    return await this.graph.findSimilar(context, { threshold: 0.7, limit: 3 });
  }

  private async generateProfileSummary(memories: TasteMemory[]): Promise<TASTEProfile['summary']> {
    const domains = [...new Set(memories.map(m => m.context.context_features.domain))];
    const positiveVibes: Record<string, string[]> = {};
    const negativeVibes: Record<string, string[]> = {};

    for (const memory of memories) {
      const domain = memory.context.context_features.domain;
      const action = memory.judgment.judgment.action;

      if (memory.feedback.feedback.outcome === 'positive') {
        positiveVibes[domain] = positiveVibes[domain] || [];
        positiveVibes[domain].push(action);
      } else if (memory.feedback.feedback.outcome === 'negative') {
        negativeVibes[domain] = negativeVibes[domain] || [];
        negativeVibes[domain].push(action);
      }
    }

    return {
      experience_topology: domains,
      taste_standards: Object.entries(positiveVibes).reduce(
        (acc, [domain, vibes]) => {
          return {
            ...acc,
            [domain]: {
              positive_vibes: vibes,
              negative_vibes: negativeVibes[domain] || [],
            },
          };
        },
        {}
      ),
      tension_position: {
        control_level: 0.5,
        trust_level: 0.5,
        intervention_threshold: 0.7,
      },
      symbiosis_boundary: {
        delegated_domains: [],
        reserved_domains: [],
        contextual_triggers: [],
      },
    };
  }

  private calculateMemStats(memories: TasteMemory[]): TASTEProfile['memory_stats'] {
    const total = memories.length;
    const highConfidence = memories.filter(m => m.decay_weight > 0.8).length;
    const avgConfidence = total > 0
      ? memories.reduce((sum, m) => sum + m.decay_weight, 0) / total
      : 0;
    const domains = [...new Set(memories.map(m => m.context.context_features.domain))];

    return {
      total_memories: total,
      high_confidence_count: highConfidence,
      avg_confidence: avgConfidence,
      domains,
    };
  }

  private async getCrossUserReuse(memoryId: string): Promise<number> {
    // MVP: Return 0, implement in Phase 2 with PostgreSQL
    return 0;
  }

  private async getCrossRoleReuse(memoryId: string): Promise<number> {
    // MVP: Return 0, implement in Phase 2
    return 0;
  }

  private logEvent(event: MemoryEvent): void {
    this.eventLog.push(event);
  }
}

/**
 * Create a memory database instance
 */
export function createMemoryDB(criteria?: OwnershipPromotionCriteria): ContextMemoryDB {
  return new ContextMemoryDB(criteria);
}
