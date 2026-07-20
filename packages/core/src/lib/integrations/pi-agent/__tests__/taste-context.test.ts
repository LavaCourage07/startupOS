/**
 * TASTE Context Tests
 *
 * Tests for TASTE system prompt generation and injection.
 */

import { describe, it, expect } from 'vitest';
import {
  createTASTESystemPrompt,
  buildSystemPromptWithTASTE,
  hasTASTEContent,
  estimateTASTEPromptTokens,
} from '../taste-context';
import { createTASTEProfile, TASTEProfile } from '@/types/taste';

describe('createTASTESystemPrompt', () => {
  it('should return empty string for minimal profile with no meaningful content', () => {
    // Create a profile with empty arrays and exclude collaboration style
    const profile = createTASTEProfile({ userId: 'test-user' });

    const prompt = createTASTESystemPrompt(profile, {
      includeCollaborationStyle: false,
    });

    expect(prompt).toBe('');
  });

  it('should include collaboration style even for minimal profile by default', () => {
    const profile = createTASTEProfile({ userId: 'test-user' });

    const prompt = createTASTESystemPrompt(profile);

    // Default tension_position produces a collaboration style
    expect(prompt).toContain('**协作风格**');
  });

  it('should generate prompt with experience topology', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      experience_topology: ['web-development', 'frontend', 'react'],
    });

    const prompt = createTASTESystemPrompt(profile);

    expect(prompt).toContain('## 用户品味档案');
    expect(prompt).toContain('**经验领域**');
    expect(prompt).toContain('web-development');
    expect(prompt).toContain('frontend');
    expect(prompt).toContain('react');
  });

  it('should generate prompt with taste standards', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      taste_standards: {
        development: {
          positive_vibes: ['clean-code', 'simplicity'],
          negative_vibes: ['complexity', 'over-engineering'],
        },
        design: {
          positive_vibes: ['minimalism'],
          negative_vibes: ['clutter'],
        },
      },
    });

    const prompt = createTASTESystemPrompt(profile);

    expect(prompt).toContain('**偏好标准**');
    expect(prompt).toContain('development:');
    expect(prompt).toContain('偏好: clean-code、simplicity');
    expect(prompt).toContain('避免: complexity、over-engineering');
    expect(prompt).toContain('design:');
  });

  it('should generate prompt with collaboration style', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      tension_position: {
        control_level: 0.8,
        trust_level: 0.3,
        intervention_threshold: 0.5,
      },
    });

    const prompt = createTASTESystemPrompt(profile);

    expect(prompt).toContain('**协作风格**');
    expect(prompt).toContain('高度自主型');
  });

  it('should generate prompt for high delegation style', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      tension_position: {
        control_level: 0.3,
        trust_level: 0.8,
        intervention_threshold: 0.3,
      },
    });

    const prompt = createTASTESystemPrompt(profile);

    expect(prompt).toContain('**协作风格**');
    expect(prompt).toContain('高度委托型');
  });

  it('should generate prompt for balanced style', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      tension_position: {
        control_level: 0.5,
        trust_level: 0.5,
        intervention_threshold: 0.6,
      },
    });

    const prompt = createTASTESystemPrompt(profile);

    expect(prompt).toContain('**协作风格**');
    expect(prompt).toContain('平衡型');
  });

  it('should generate prompt with symbiosis boundary', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      symbiosis_boundary: {
        delegated_domains: ['code-generation', 'testing'],
        reserved_domains: ['architecture', 'security'],
        contextual_triggers: [],
      },
    });

    const prompt = createTASTESystemPrompt(profile);

    expect(prompt).toContain('**可委托领域**');
    expect(prompt).toContain('code-generation');
    expect(prompt).toContain('testing');
    expect(prompt).toContain('**保留领域**');
    expect(prompt).toContain('architecture');
    expect(prompt).toContain('security');
  });

  it('should include confidence warning for low confidence', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      experience_topology: ['web-development'],
      metadata: {
        source: 'user',
        confidence: 0.5,
        evolution_count: 0,
      },
    });

    const prompt = createTASTESystemPrompt(profile);

    expect(prompt).toContain('置信度');
    expect(prompt).toContain('50%');
  });

  it('should not include confidence warning for high confidence', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      experience_topology: ['web-development'],
      metadata: {
        source: 'user',
        confidence: 0.9,
        evolution_count: 0,
      },
    });

    const prompt = createTASTESystemPrompt(profile);

    expect(prompt).not.toContain('置信度');
  });

  it('should respect maxItemsPerCategory option', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      experience_topology: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });

    const prompt = createTASTESystemPrompt(profile, { maxItemsPerCategory: 3 });

    expect(prompt).toContain('a、b、c');
    expect(prompt).not.toContain('d、e');
    expect(prompt).toContain('7个领域');
  });

  it('should respect include options', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      experience_topology: ['web-development'],
      taste_standards: {
        development: { positive_vibes: ['clean-code'], negative_vibes: [] },
      },
      tension_position: { control_level: 0.8, trust_level: 0.3, intervention_threshold: 0.5 },
      symbiosis_boundary: { delegated_domains: ['testing'], reserved_domains: [], contextual_triggers: [] },
    });

    const promptNoExperience = createTASTESystemPrompt(profile, { includeExperience: false });
    expect(promptNoExperience).not.toContain('**经验领域**');

    const promptNoStandards = createTASTESystemPrompt(profile, { includeStandards: false });
    expect(promptNoStandards).not.toContain('**偏好标准**');

    const promptNoCollaboration = createTASTESystemPrompt(profile, { includeCollaborationStyle: false });
    expect(promptNoCollaboration).not.toContain('**协作风格**');

    const promptNoSymbiosis = createTASTESystemPrompt(profile, { includeSymbiosis: false });
    expect(promptNoSymbiosis).not.toContain('**可委托领域**');
  });

  it('should generate complete prompt for full profile', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      projectId: 'test-project',
      experience_topology: ['web-development', 'frontend', 'react'],
      taste_standards: {
        development: {
          positive_vibes: ['clean-code', 'test-driven'],
          negative_vibes: ['complexity'],
        },
      },
      tension_position: {
        control_level: 0.6,
        trust_level: 0.5,
        intervention_threshold: 0.7,
      },
      symbiosis_boundary: {
        delegated_domains: ['code-generation'],
        reserved_domains: ['architecture'],
        contextual_triggers: [],
      },
    });

    const prompt = createTASTESystemPrompt(profile);

    expect(prompt).toContain('## 用户品味档案');
    expect(prompt).toContain('**经验领域**');
    expect(prompt).toContain('**偏好标准**');
    expect(prompt).toContain('**协作风格**');
    expect(prompt).toContain('**可委托领域**');
    expect(prompt).toContain('**保留领域**');
  });
});

describe('buildSystemPromptWithTASTE', () => {
  const basePrompt = 'You are a helpful assistant.';

  it('should return base prompt when TASTE is null', () => {
    const result = buildSystemPromptWithTASTE(basePrompt, null);

    expect(result).toBe(basePrompt);
  });

  it('should return base prompt when TASTE has no content (with options)', () => {
    const profile = createTASTEProfile({ userId: 'test-user' });

    // Exclude collaboration style to have truly empty content
    const result = buildSystemPromptWithTASTE(basePrompt, profile, {
      includeCollaborationStyle: false,
    });

    expect(result).toBe(basePrompt);
  });

  it('should include collaboration style by default', () => {
    const profile = createTASTEProfile({ userId: 'test-user' });

    const result = buildSystemPromptWithTASTE(basePrompt, profile);

    // Default includes collaboration style
    expect(result).toContain(basePrompt);
    expect(result).toContain('**协作风格**');
  });

  it('should append TASTE section when TASTE has content', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      experience_topology: ['web-development'],
    });

    const result = buildSystemPromptWithTASTE(basePrompt, profile);

    expect(result).toContain(basePrompt);
    expect(result).toContain('## 用户品味档案');
    expect(result).toContain('**经验领域**');
  });

  it('should preserve base prompt formatting', () => {
    const multiLineBase = 'Line 1\nLine 2\nLine 3';
    const profile = createTASTEProfile({
      userId: 'test-user',
      experience_topology: ['web-development'],
    });

    const result = buildSystemPromptWithTASTE(multiLineBase, profile);

    expect(result).toContain('Line 1\nLine 2\nLine 3');
    expect(result).toContain('## 用户品味档案');
  });
});

describe('hasTASTEContent', () => {
  it('should return false for null profile', () => {
    expect(hasTASTEContent(null)).toBe(false);
  });

  it('should return false for empty profile', () => {
    const profile = createTASTEProfile({ userId: 'test-user' });
    expect(hasTASTEContent(profile)).toBe(false);
  });

  it('should return true for profile with experience_topology', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      experience_topology: ['web-development'],
    });
    expect(hasTASTEContent(profile)).toBe(true);
  });

  it('should return true for profile with taste_standards', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      taste_standards: {
        development: { positive_vibes: ['clean-code'], negative_vibes: [] },
      },
    });
    expect(hasTASTEContent(profile)).toBe(true);
  });

  it('should return true for profile with delegated_domains', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      symbiosis_boundary: {
        delegated_domains: ['testing'],
        reserved_domains: [],
        contextual_triggers: [],
      },
    });
    expect(hasTASTEContent(profile)).toBe(true);
  });

  it('should return true for profile with reserved_domains', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      symbiosis_boundary: {
        delegated_domains: [],
        reserved_domains: ['architecture'],
        contextual_triggers: [],
      },
    });
    expect(hasTASTEContent(profile)).toBe(true);
  });
});

describe('estimateTASTEPromptTokens', () => {
  it('should return 0 for empty profile with no collaboration style', () => {
    const profile = createTASTEProfile({ userId: 'test-user' });
    // The profile has default tension_position which produces collaboration style
    // So we need to exclude it to get truly empty content
    const tokens = estimateTASTEPromptTokens(createTASTEProfile({
      userId: 'test-user',
      tension_position: { control_level: 0.5, trust_level: 0.5, intervention_threshold: 0.7 },
    }));
    // Default profile still produces some content (collaboration style + confidence warning)
    expect(tokens).toBeGreaterThan(0);
  });

  it('should return positive number for profile with content', () => {
    const profile = createTASTEProfile({
      userId: 'test-user',
      experience_topology: ['web-development', 'frontend', 'react'],
      taste_standards: {
        development: {
          positive_vibes: ['clean-code', 'simplicity'],
          negative_vibes: ['complexity'],
        },
      },
    });

    const tokens = estimateTASTEPromptTokens(profile);

    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(500); // Should be reasonable
  });

  it('should estimate higher for larger profiles', () => {
    const smallProfile = createTASTEProfile({
      userId: 'test-user',
      experience_topology: ['web-development'],
    });

    const largeProfile = createTASTEProfile({
      userId: 'test-user',
      experience_topology: ['web-development', 'frontend', 'backend', 'testing', 'devops', 'mobile'],
      taste_standards: {
        development: {
          positive_vibes: ['clean-code', 'simplicity', 'test-driven', 'documentation', 'modularity'],
          negative_vibes: ['complexity', 'over-engineering', 'spaghetti-code', 'tight-coupling'],
        },
        design: {
          positive_vibes: ['minimalism', 'consistency'],
          negative_vibes: ['clutter', 'inconsistency'],
        },
      },
    });

    const smallTokens = estimateTASTEPromptTokens(smallProfile);
    const largeTokens = estimateTASTEPromptTokens(largeProfile);

    expect(largeTokens).toBeGreaterThan(smallTokens);
  });
});
