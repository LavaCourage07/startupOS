/**
 * TASTE Context for System Prompt Injection
 *
 * Converts TASTE profiles to compact system prompt sections for pi-agent context.
 * Designed to be token-efficient while preserving key taste information.
 *
 * @module lib/integrations/pi-agent/taste-context
 */

import type { TASTEProfile } from '@/types/taste';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for TASTE system prompt generation
 */
export interface TASTEPromptOptions {
  /**
   * Include experience topology in the prompt
   * @default true
   */
  includeExperience?: boolean;

  /**
   * Include taste standards in the prompt
   * @default true
   */
  includeStandards?: boolean;

  /**
   * Include collaboration style (tension position) in the prompt
   * @default true
   */
  includeCollaborationStyle?: boolean;

  /**
   * Include symbiosis boundary in the prompt
   * @default true
   */
  includeSymbiosis?: boolean;

  /**
   * Maximum number of items per category (for token efficiency)
   * @default 5
   */
  maxItemsPerCategory?: number;
}

// ============================================================================
// TASTE System Prompt Generation
// ============================================================================

/**
 * Create a compact TASTE system prompt section
 *
 * Output format (brief, token-efficient):
 * ```
 * ## 用户品味档案
 * - 经验领域: [list]
 * - 偏好标准: [per-domain summary]
 * - 协作风格: [derived label from tension_position]
 * - 委托领域: [delegated_domains]
 * - 保留领域: [reserved_domains]
 * ```
 *
 * @param taste - TASTE profile to convert
 * @param options - Generation options
 * @returns Formatted system prompt section
 */
export function createTASTESystemPrompt(
  taste: TASTEProfile,
  options: TASTEPromptOptions = {}
): string {
  const {
    includeExperience = true,
    includeStandards = true,
    includeCollaborationStyle = true,
    includeSymbiosis = true,
    maxItemsPerCategory = 5,
  } = options;

  // Handle empty or minimal profiles
  const hasContent =
    taste.experience_topology.length > 0 ||
    Object.keys(taste.taste_standards).length > 0 ||
    (includeCollaborationStyle && taste.tension_position) ||
    (includeSymbiosis && taste.symbiosis_boundary);

  if (!hasContent) {
    return '';
  }

  const lines: string[] = ['## 用户品味档案', ''];

  // Experience Topology
  if (includeExperience && taste.experience_topology.length > 0) {
    const experiences = taste.experience_topology.slice(0, maxItemsPerCategory);
    lines.push(`- **经验领域**: ${experiences.join('、')}`);
    if (taste.experience_topology.length > maxItemsPerCategory) {
      lines[lines.length - 1] += ` 等${taste.experience_topology.length}个领域`;
    }
  }

  // Taste Standards
  if (includeStandards && Object.keys(taste.taste_standards).length > 0) {
    const standards = formatTasteStandards(taste.taste_standards as Record<string, { positive_vibes: string[]; negative_vibes: string[] }>, maxItemsPerCategory);
    if (standards) {
      lines.push(`- **偏好标准**:`);
      lines.push(standards);
    }
  }

  // Collaboration Style (derived from tension position)
  if (includeCollaborationStyle && taste.tension_position) {
    const style = deriveCollaborationStyle(taste.tension_position as { control_level: number; trust_level: number; intervention_threshold: number });
    lines.push(`- **协作风格**: ${style}`);
  }

  // Symbiosis Boundary
  if (includeSymbiosis && taste.symbiosis_boundary) {
    const { delegated_domains, reserved_domains } = taste.symbiosis_boundary;

    if (delegated_domains.length > 0) {
      const delegated = delegated_domains.slice(0, maxItemsPerCategory).join('、');
      lines.push(`- **可委托领域**: ${delegated}`);
    }

    if (reserved_domains.length > 0) {
      const reserved = reserved_domains.slice(0, maxItemsPerCategory).join('、');
      lines.push(`- **保留领域**: ${reserved}`);
    }
  }

  // Add confidence indicator if low
  if (taste.metadata.confidence < 0.7) {
    lines.push('');
    lines.push(`> 注：此档案置信度为 ${Math.round(taste.metadata.confidence * 100)}%，可能需要更多交互来完善。`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format taste standards for the prompt
 */
function formatTasteStandards(
  standards: Record<string, { positive_vibes: string[]; negative_vibes: string[] }>,
  maxItems: number
): string {
  const lines: string[] = [];

  for (const [domain, { positive_vibes, negative_vibes }] of Object.entries(standards)) {
    const parts: string[] = [];

    if (positive_vibes.length > 0) {
      const positives = positive_vibes.slice(0, maxItems).join('、');
      parts.push(`偏好: ${positives}`);
    }

    if (negative_vibes.length > 0) {
      const negatives = negative_vibes.slice(0, maxItems).join('、');
      parts.push(`避免: ${negatives}`);
    }

    if (parts.length > 0) {
      lines.push(`  - ${domain}: ${parts.join('; ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Derive a collaboration style label from tension position
 */
function deriveCollaborationStyle(tension: {
  control_level: number;
  trust_level: number;
  intervention_threshold: number;
}): string {
  const { control_level, trust_level, intervention_threshold } = tension;

  // Determine primary style based on control/trust balance
  if (control_level > 0.7 && trust_level < 0.4) {
    return '高度自主型 - 倾向于详细审查和验证';
  }

  if (control_level < 0.4 && trust_level > 0.7) {
    return '高度委托型 - 信任AI决策，较少干预';
  }

  if (control_level > 0.6 && intervention_threshold > 0.6) {
    return '验证型 - 偏好渐进式确认和逐步委托';
  }

  if (trust_level > 0.6 && intervention_threshold < 0.4) {
    return '快速迭代型 - 偏好快速反馈循环';
  }

  if (control_level >= 0.4 && control_level <= 0.6 && trust_level >= 0.4 && trust_level <= 0.6) {
    return '平衡型 - 根据情境灵活调整协作方式';
  }

  // Default fallback
  return '渐进适应型 - 正在建立协作偏好';
}

// ============================================================================
// Extended Prompt Builder
// ============================================================================

/**
 * Build complete system prompt with TASTE context
 *
 * This function takes a base system prompt and appends the TASTE context
 * section if a TASTE profile is provided.
 *
 * @param basePrompt - Base system prompt
 * @param taste - Optional TASTE profile to inject
 * @param options - Generation options
 * @returns Complete system prompt with TASTE context
 */
export function buildSystemPromptWithTASTE(
  basePrompt: string,
  taste: TASTEProfile | null,
  options: TASTEPromptOptions = {}
): string {
  if (!taste) {
    return basePrompt;
  }

  const tasteSection = createTASTESystemPrompt(taste, options);

  if (!tasteSection.trim()) {
    return basePrompt;
  }

  // Append TASTE section to base prompt
  return `${basePrompt}\n\n${tasteSection}`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a TASTE profile has meaningful content for prompt injection
 */
export function hasTASTEContent(taste: TASTEProfile | null): boolean {
  if (!taste) {
    return false;
  }

  return (
    taste.experience_topology.length > 0 ||
    Object.keys(taste.taste_standards).length > 0 ||
    taste.symbiosis_boundary.delegated_domains.length > 0 ||
    taste.symbiosis_boundary.reserved_domains.length > 0
  );
}

/**
 * Estimate the token count for TASTE prompt section
 *
 * This is a rough estimate based on character count.
 * Chinese characters are typically 1-2 tokens.
 */
export function estimateTASTEPromptTokens(taste: TASTEProfile): number {
  const prompt = createTASTESystemPrompt(taste);
  // Rough estimate: 1 Chinese char ≈ 1.5 tokens, 1 English word ≈ 1 token
  // For simplicity, we use char count / 2 as a rough estimate
  return Math.ceil(prompt.length / 2);
}
