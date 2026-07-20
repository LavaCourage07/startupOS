/**
 * TASTE Schema Tests
 *
 * Unit tests for taste schema validation and factory functions.
 */

import { describe, it, expect } from 'vitest';
import {

  TasteContextSchema,
  TasteJudgmentSchema,
  TasteFeedbackSchema,
  TasteMemorySchema,
  TASTEProfileSchema,
  CultureLayerDetectionSchema,
  ECOStateSchema,
  TasteAlignmentMetricsSchema,
} from '../taste-schema';

describe('Taste Schema', () => {
  describe('TasteContextSchema', () => {
    it('should validate a valid taste context', () => {
      const context = {
        context_features: {
          domain: 'code_style',
          user_type: 'developer',
          task_type: 'formatting',
          environment: 'production',
          time_context: '2026-03-05',
          risk_level: 'low' as const,
        },
      };

      const result = TasteContextSchema.parse(context);
      expect(result).toEqual(context);
    });

    it('should reject invalid risk_level', () => {
      const context = {
        context_features: {
          domain: 'code',
          user_type: 'dev',
          task_type: 'format',
          environment: 'prod',
          time_context: '2026-03-05',
          risk_level: 'invalid' as any,
        },
      };

      expect(() => TasteContextSchema.parse(context)).toThrow();
    });

    it('should reject confidence outside [0,1]', () => {
      const judgment = {
        judgment: {
          type: 'preference' as const,
          action: 'format code',
          confidence: 1.5,
        },
      };

      expect(() => TasteJudgmentSchema.parse(judgment)).toThrow();
    });
  });

  describe('TasteMemorySchema', () => {
    it('should validate a complete taste memory', () => {
      const memory = {
        id: 'memory-123',
        context: {
          context_features: {
            domain: 'code_style',
            user_type: 'developer',
            task_type: 'formatting',
            environment: 'production',
            time_context: '2026-03-05',
            risk_level: 'low' as const,
          },
        },
        judgment: {
          judgment: {
            type: 'preference' as const,
            action: 'format code with prettier',
            confidence: 0.9,
          },
        },
        feedback: {
          feedback: {
            outcome: 'positive' as const,
            effectiveness: 0.8,
            timestamp: '2026-03-05T12:00:00.000Z',
            iteration: 1,
            user_confirmation: true,
          },
        },
        decay_weight: 0.95,
        reference_count: 5,
        ownership: 'personal' as const,
        created_at: '2026-03-05T12:00:00.000Z',
        updated_at: '2026-03-05T12:00:00.000Z',
      };

      const result = TasteMemorySchema.parse(memory);
      expect(result).toEqual(memory);
    });
  });

  describe('TASTEProfileSchema', () => {
    it('should validate a taste profile', () => {
      const profile = {
        version: '1.0.0',
        generated_at: '2026-03-05T12:00:00.000Z',
        summary: {
          experience_topology: ['code_style', 'architecture'],
          taste_standards: {
            code_style: {
              positive_vibes: ['explicit code', 'type safety'],
              negative_vibes: ['magic numbers', 'any types'],
            },
          },
          tension_position: {
            control_level: 0.5,
            trust_level: 0.5,
            intervention_threshold: 0.7,
          },
          symbiosis_boundary: {
            delegated_domains: ['formatting', 'documentation'],
            reserved_domains: ['security', 'critical decisions'],
            contextual_triggers: ['error handling', 'performance critical'],
          },
        },
        memory_stats: {
          total_memories: 50,
          high_confidence_count: 20,
          avg_confidence: 0.75,
          domains: ['code_style', 'architecture'],
        },
      };

      const result = TASTEProfileSchema.parse(profile);
      expect(result).toEqual(profile);
    });
  });

  describe('CultureLayerDetectionSchema', () => {
    it('should validate cultureLayer detection result', () => {
      const detection = {
        result: {
          communication_style: 'direct-western' as const,
          discourse_system: 'technical' as const,
          value_orientation: 'efficiency-first' as const,
          sensitivity_distribution: {
            topics: { 'security': 0.9, 'performance': 0.7 },
            depth_preference: 0.8,
            risk_tolerance: 0.6,
          },
        },
        confidence: 0.85,
        sample_size: 10,
      };

      const result = CultureLayerDetectionSchema.parse(detection);
      expect(result).toEqual(detection);
    });
  });

  describe('ECOStateSchema', () => {
    it('should validate ECO state', () => {
      const ecoState = {
        explore: {
          uncertainty: 0.7,
          possibility_space: 0.8,
        },
        conserve: {
          stability_score: 0.6,
          violation_count: 2,
        },
        optimize: {
          taste_alignment: 0.75,
          effectiveness: 0.8,
        },
        timestamp: '2026-03-05T12:00:00.000Z',
      };

      const result = ECOStateSchema.parse(ecoState);
      expect(result).toEqual(ecoState);
    });
  });

  describe('TasteAlignmentMetricsSchema', () => {
    it('should validate taste alignment metrics', () => {
      const metrics = {
        taste_match_rate: 0.75,
        context_hit_rate: 0.2,
        sentiment_score: 0.7,
        timestamp: '2026-03-05T12:00:00.000Z',
        time_window: '30d',
      };

      const result = TasteAlignmentMetricsSchema.parse(metrics);
      expect(result).toEqual(metrics);
    });
  });
});
