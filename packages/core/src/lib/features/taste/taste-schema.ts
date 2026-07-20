/**
 * TASTE Schema - Type Definitions
 *
 * Core type definitions for the TASTE (Embodied Experience Engineering) layer.
 * Uses zod for runtime validation with full TypeScript type inference.
 */

import { z } from 'zod';

// ============================================================================
// Core Zod Schemas
// ============================================================================

/**
 * Taste Context - Situation Features
 *
 * Reusable context combination: domain × task_type × environment
 *
 * Minimum granularity for memory reusability:
 * - Too fine (this customer said X) → No reuse value
 * - Too coarse (customer negotiation) → No distinction value
 * - Sweet spot: "Customer Type × Negotiation Phase × Market Environment"
 */
export const TasteContextSchema = z.object({
  context_features: z.object({
    domain: z.string(),
    user_type: z.string(),
    task_type: z.string(),
    environment: z.string(),
    time_context: z.string(),
    risk_level: z.enum(['low', 'medium', 'high']),
  }),
});

/**
 * Taste Judgment - Decision/Action
 *
 * The user's judgment (not just preference, but embodied intuition)
 * about what feels right in a specific context
 */
export const TasteJudgmentSchema = z.object({
  judgment: z.object({
    type: z.enum(['decision', 'preference', 'boundary']),
    action: z.string(),
    rationale: z.string().optional(),
    confidence: z.number().min(0).max(1),
  }),
});

/**
 * Taste Feedback - Result Feedback
 */
export const TasteFeedbackSchema = z.object({
  feedback: z.object({
    outcome: z.enum(['positive', 'negative', 'neutral']),
    effectiveness: z.number().min(0).max(1),
    timestamp: z.string(), // ISO 8601
    iteration: z.number().int().min(0),
    user_confirmation: z.boolean().optional(),
  }),
});

/**
 * Taste Memory - Complete Context Memory Triplet
 *
 * The fundamental unit of TASTE: (context_features, judgment/action, result_feedback)
 * Plus decay_weight for aging and reference_count for memory strength
 */
export const TasteMemorySchema = z.object({
  id: z.string(),
  context: TasteContextSchema,
  judgment: TasteJudgmentSchema,
  feedback: TasteFeedbackSchema,
  decay_weight: z.number().min(0).max(1),
  reference_count: z.number().int().min(0),
  ownership: z.enum(['personal', 'role', 'organization']),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * TASTE Ownership Level
 *
 * Progressive model: personal → role → organization
 * Each level enables broader sharing and contribution
 */
export type OwnershipLevel = 'personal' | 'role' | 'organization';

/**
 * TASTE Profile (Distilled Output)
 *
 * Human-readable taste portrait generated from periodic distillation
 * This becomes the "curvature" of the taste manifold
 */
export const TASTEProfileSchema = z.object({
  version: z.string().default('1.0.0'),
  generated_at: z.string(),
  summary: z.object({
    experience_topology: z.array(z.string()),
    taste_standards: z.record(z.string(), z.object({
      positive_vibes: z.array(z.string()),
      negative_vibes: z.array(z.string()),
    })),
    tension_position: z.object({
      control_level: z.number().min(0).max(1),
      trust_level: z.number().min(0).max(1),
      intervention_threshold: z.number().min(0).max(1),
    }),
    symbiosis_boundary: z.object({
      delegated_domains: z.array(z.string()),
      reserved_domains: z.array(z.string()),
      contextual_triggers: z.array(z.string()),
    }),
  }),
  memory_stats: z.object({
    total_memories: z.number().int().min(0),
    high_confidence_count: z.number().int().min(0),
    avg_confidence: z.number().min(0).max(1),
    domains: z.array(z.string()),
  }),
});

/**
 * Ownership Promotion Criteria
 *
 * Conditions for upgrading memories between ownership levels
 * Personal → Role → Organization
 */
export interface OwnershipPromotionCriteria {
  // Personal → Role: Emphasize reusability
  personal_to_position: {
    min_confidence: number;
    min_validations: number;
    min_cross_user_reuse: number;
    time_window: string; // e.g., '30d'
  };

  // Role → Organization: Emphasize cross-domain value
  position_to_organization: {
    min_confidence: number;
    min_validations: number;
    min_cross_position_reuse: number;
    min_success_rate: number;
    manual_review_required: boolean;
  };
}

/**
 * Default promotion criteria
 */
export const DEFAULT_PROMOTION_CRITERIA: OwnershipPromotionCriteria = {
  personal_to_position: {
    min_confidence: 0.85,
    min_validations: 5,
    min_cross_user_reuse: 2,
    time_window: '30d',
  },
  position_to_organization: {
    min_confidence: 0.92,
    min_validations: 15,
    min_cross_position_reuse: 3,
    min_success_rate: 0.8,
    manual_review_required: true,
  },
};

// ============================================================================
// Culture Layer Detection (Cold Start)
// ============================================================================

/**
 * Culture Layer Detection Result
 *
 * Quick detection of user's cognitive style during initial interactions.
 * This establishes the initial baseline (品位) before individual taste (品味) emerges.
 */
export const CultureLayerDetectionSchema = z.object({
  result: z.object({
    communication_style: z.enum([
      'direct-western',
      'indirect-eastern',
      'mixed',
      'ambiguous',
    ]),
    discourse_system: z.enum([
      'technical',
      'humanities',
      'business',
      'mixed',
    ]),
    value_orientation: z.enum([
      'efficiency-first',
      'relationship-first',
      'balanced',
      'conflict',
    ]),
    sensitivity_distribution: z.object({
      topics: z.record(z.string(), z.number().min(0).max(1)),
      depth_preference: z.number().min(0).max(1),
      risk_tolerance: z.number().min(0).max(1),
    }),
  }),
  confidence: z.number().min(0).max(1),
  sample_size: z.number().int().min(0),
});

/**
 * ECO Balance State
 *
 * The three-way tension state: Explore (LLM) / Conserve (Code) / Optimize (Human)
 */
export const ECOStateSchema = z.object({
  explore: z.object({
    uncertainty: z.number().min(0).max(1),
    possibility_space: z.number().min(0).max(1),
  }),
  conserve: z.object({
    stability_score: z.number().min(0).max(1),
    violation_count: z.number().int().min(0),
  }),
  optimize: z.object({
    taste_alignment: z.number().min(0).max(1),
    effectiveness: z.number().min(0).max(1),
  }),
  timestamp: z.string(),
});

/**
 * TASTE Alignment Metrics
 *
 * Core metrics defined by PM for Phase 1:
 * Metric 1: Taste Match Rate - (accepted suggestions) / (total suggestions)
 * Metric 2: Context Memory Hit Rate - Compare TASTE-enhanced vs pure LLM
 * Metric 3: Sentiment Feedback - "feels right/feels wrong" explicit feedback
 */
export const TasteAlignmentMetricsSchema = z.object({
  taste_match_rate: z.number().min(0).max(1),
  context_hit_rate: z.number().min(0).max(1),
  sentiment_score: z.number().min(0).max(1),
  timestamp: z.string(),
  time_window: z.string(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type TasteContext = z.infer<typeof TasteContextSchema>;
export type TasteJudgment = z.infer<typeof TasteJudgmentSchema>;
export type TasteFeedback = z.infer<typeof TasteFeedbackSchema>;
export type TasteMemory = z.infer<typeof TasteMemorySchema>;
export type TASTEProfile = z.infer<typeof TASTEProfileSchema>;
export type CultureLayerDetection = z.infer<typeof CultureLayerDetectionSchema>;
export type ECOState = z.infer<typeof ECOStateSchema>;
export type TasteAlignmentMetrics = z.infer<typeof TasteAlignmentMetricsSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate taste context data
 */
export function validateTasteContext(data: unknown): TasteContext {
  return TasteContextSchema.parse(data);
}

/**
 * Validate taste judgment data
 */
export function validateTasteJudgment(data: unknown): TasteJudgment {
  return TasteJudgmentSchema.parse(data);
}

/**
 * Validate taste feedback data
 */
export function validateTasteFeedback(data: unknown): TasteFeedback {
  return TasteFeedbackSchema.parse(data);
}

/**
 * Validate complete taste memory data
 */
export function validateTasteMemory(data: unknown): TasteMemory {
  return TasteMemorySchema.parse(data);
}

/**
 * Validate TASTE profile data
 */
export function validateTASTEProfile(data: unknown): TASTEProfile {
  return TASTEProfileSchema.parse(data);
}

/**
 * Validate culture layer detection result
 */
export function validateCultureLayerDetection(data: unknown): CultureLayerDetection {
  return CultureLayerDetectionSchema.parse(data);
}

/**
 * Validate ECO state
 */
export function validateECOState(data: unknown): ECOState {
  return ECOStateSchema.parse(data);
}

/**
 * Validate taste alignment metrics
 */
export function validateTasteAlignmentMetrics(data: unknown): TasteAlignmentMetrics {
  return TasteAlignmentMetricsSchema.parse(data);
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new taste memory with defaults
 */
export function createTasteMemory(params: {
  id?: string;
  context: TasteContext;
  judgment: TasteJudgment;
  feedback: TasteFeedback;
  ownership?: OwnershipLevel;
  initialDecayWeight?: number;
}): TasteMemory {
  const now = new Date().toISOString();

  return {
    id: params.id || `memory-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    context: params.context,
    judgment: params.judgment,
    feedback: params.feedback,
    decay_weight: params.initialDecayWeight ?? 0.5,
    reference_count: 0,
    ownership: params.ownership ?? 'personal',
    created_at: now,
    updated_at: now,
  };
}

/**
 * Create taste feedback from user action
 */
export function createFeedback(params: {
  outcome: 'positive' | 'negative' | 'neutral';
  effectiveness?: number;
  user_confirmation?: boolean;
  iteration?: number;
}): TasteFeedback {
  const now = new Date().toISOString();

  return {
    feedback: {
      outcome: params.outcome,
      effectiveness: params.effectiveness ?? 0.5,
      timestamp: now,
      iteration: params.iteration ?? 0,
      user_confirmation: params.user_confirmation,
    },
  };
}

/**
 * Create judgment from AI suggestion
 */
export function createJudgment(params: {
  type: 'decision' | 'preference' | 'boundary';
  action: string;
  rationale?: string;
  confidence?: number;
}): TasteJudgment {
  return {
    judgment: {
      ...params,
      confidence: params.confidence ?? 0.5,
    },
  };
}

/**
 * Create context from situation
 */
export function createContext(params: {
  domain: string;
  user_type: string;
  task_type: string;
  environment: string;
  time_context?: string;
  risk_level?: 'low' | 'medium' | 'high';
}): TasteContext {
  return {
    context_features: {
      ...params,
      time_context: params.time_context ?? new Date().toISOString().substring(0, 10),
      risk_level: params.risk_level ?? 'low',
    },
  };
}
