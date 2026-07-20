/**
 * Type definitions for the OriginOS pi-agent Skill framework
 */

export * from "./skills";

/**
 * Skill invocation context
 */
export interface SkillInvocationContext {
	/** Skill being invoked */
	skillName: string;
	/** Session ID */
	sessionId: string;
	/** Workspace/working directory */
	workspace: string;
	/** User-provided arguments */
	args?: string[];
	/** Additional context */
	extra?: Record<string, unknown>;
}

/**
 * Skill invocation result
 */
export interface SkillInvocationResult {
	success: boolean;
	message?: string;
	error?: string;
	data?: unknown;
}

/**
 * Skill configuration
 */
export interface SkillConfig {
	enabled?: boolean;
	priority?: number;
	env?: Record<string, string>;
	customize?: boolean;
}

/**
 * Skill registry entry
 */
export interface SkillRegistryEntry {
	skill: Skill;
	config?: SkillConfig;
	enabled: boolean;
	lastUsed?: number;
	usageCount?: number;
}

/**
 * Supported skill categories
 */
export type SkillCategory =
	| "interview"
	| "design"
	| "development"
	| "testing"
	| "deployment"
	| "documentation"
	| "utility";

/**
 * Extended skill metadata for OriginOS
 */
export interface OriginOSSkillMetadata extends SkillFrontmatter {
	/** Optional category for organization */
	category?: SkillCategory;
	/** Estimated duration */
	estimatedDuration?: number;
	/** Required tools (for validation) */
	requiresTools?: string[];
	/** Compatible agent types */
	compatibleAgents?: string[];
	/** Deprecated flag */
	deprecated?: boolean;
	/** Replaced by skill (if deprecated) */
	replacedBy?: string;
	/** Version */
	version?: string;
	/** Author */
	author?: string;
}

/**
 * Re-export core types from skills.ts
 */
import type {
	Skill,
	SkillFrontmatter,
	SkillDiagnostic,
	LoadSkillsResult,
	LoadSkillsOptions,
} from "./skills";

export type {
	Skill,
	SkillFrontmatter,
	SkillDiagnostic,
	LoadSkillsResult,
	LoadSkillsOptions,
};
