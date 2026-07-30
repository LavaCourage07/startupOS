/**
 * Skill Middleware for OriginOS pi-agent Integration
 *
 * This module provides middleware for integrating skills into the pi-agent
 * session flow, handling skill discovery, context injection, and invocation.
 */

import type { AgentSession } from "@originos/pi-agent-adapter/coding-agent";
import type {
	Skill,
	SkillInvocationContext,
	SkillInvocationResult,
	SkillRegistryEntry,
	SkillConfig,
	LoadSkillsOptions,
} from "./skills.types";
import {
	loadSkills,
	formatSkillsForPrompt,
	loadSkillContent,
} from "./skills";
import { getMonorepoRoot } from '../../../paths';

/**
 * Skill Manager for managing skill lifecycle
 */
export class SkillManager {
	private skills: Map<string, Skill> = new Map();
	private diagnostics: Map<string, SkillManager.Diagnostic[]> = new Map();
	private registry: Map<string, SkillRegistryEntry> = new Map();

	constructor(private options: LoadSkillsOptions = {}) {
		this.load();
	}

	/**
	 * Load skills from configured sources
	 */
	load(): void {
		const result = loadSkills(this.options);

		// Clear existing skills
		this.skills.clear();
		this.diagnostics.clear();

		// Add new skills
		for (const skill of result.skills) {
			this.skills.set(skill.name, skill);
			this.registry.set(skill.name, {
				skill,
				enabled: true,
				usageCount: 0,
			});
		}

		// Add diagnostics
		for (const diag of result.diagnostics) {
			const key = diag.path;
			const existing = this.diagnostics.get(key) ?? [];
			existing.push(diag);
			this.diagnostics.set(key, existing);
		}
	}

	/**
	 * Reload skills
	 */
	reload(): void {
		this.load();
	}

	/**
	 * Get all skills
	 */
	getAllSkills(): Skill[] {
		return Array.from(this.skills.values());
	}

	/**
	 * Get skill by name
	 */
	getSkill(name: string): Skill | undefined {
		return this.skills.get(name);
	}

	/**
	 * Get all diagnostics
	 */
	getDiagnostics(): Record<string, SkillManager.Diagnostic[]> {
		return Object.fromEntries(this.diagnostics);
	}

	/**
	 * Get registry entry
	 */
	getRegistryEntry(name: string): SkillRegistryEntry | undefined {
		return this.registry.get(name);
	}

	/**
	 * Get all registry entries
	 */
	getRegistryEntries(): Array<[string, SkillRegistryEntry]> {
		return Array.from(this.registry.entries());
	}

	/**
	 * Check if skill is enabled
	 */
	isSkillEnabled(name: string): boolean {
		const entry = this.registry.get(name);
		return entry?.enabled ?? false;
	}

	/**
	 * Enable or disable a skill
	 */
	setSkillEnabled(name: string, enabled: boolean): boolean {
		const entry = this.registry.get(name);
		if (!entry) {
			return false;
		}
		entry.enabled = enabled;
		return true;
	}

	/**
	 * Update skill configuration
	 */
	updateSkillConfig(name: string, config: Partial<SkillConfig>): boolean {
		const entry = this.registry.get(name);
		if (!entry) {
			return false;
		}
		entry.config = { ...entry.config, ...config };
		return true;
	}

	/**
	 * Get skills formatted for agent context
	 */
	getSkillsForPrompt(): string {
		const skills = Array.from(this.skills.values()).filter((skill) => {
			const entry = this.registry.get(skill.name);
			return (entry?.enabled ?? true) && !skill.disableModelInvocation;
		});
		return formatSkillsForPrompt(skills);
	}

	/**
	 * Record skill usage
	 */
	recordUsage(name: string): void {
		const entry = this.registry.get(name);
		if (entry) {
			entry.usageCount = (entry.usageCount ?? 0) + 1;
			entry.lastUsed = Date.now();
		}
	}

	/**
	 * Get skill usage stats
	 */
	getUsageStats(name: string): { count: number | undefined; lastUsed: number | undefined } {
		const entry = this.registry.get(name);
		if (!entry) {
			return { count: undefined, lastUsed: undefined };
		}
		return {
			count: entry.usageCount,
			lastUsed: entry.lastUsed,
		};
	}

	/**
	 * Invoke a skill directly
	 */
	invoke(context: SkillInvocationContext): SkillInvocationResult {
		const skill = this.skills.get(context.skillName);
		if (!skill) {
			return {
				success: false,
				error: `Skill not found: ${context.skillName}`,
			};
		}

		const entry = this.registry.get(context.skillName);
		if (entry && !entry.enabled) {
			return {
				success: false,
				error: `Skill is disabled: ${context.skillName}`,
			};
		}

		// Record usage
		this.recordUsage(context.skillName);

		// Load skill content
		const { frontmatter, body } = loadSkillContent(skill);

		// Return skill content for agent to use
		return {
			success: true,
			message: `Loaded skill: ${skill.name}`,
			data: {
				skill,
				frontmatter,
				body,
				context,
			},
		};
	}

	/**
	 * Search skills by name or description
	 */
	search(query: string): Skill[] {
		const lowerQuery = query.toLowerCase();
		return Array.from(this.skills.values()).filter((skill) =>
			skill.name.toLowerCase().includes(lowerQuery) ||
			skill.description.toLowerCase().includes(lowerQuery)
		);
	}
}

export namespace SkillManager {
	export interface Diagnostic {
		type: "warning" | "error" | "collision";
		message: string;
		path: string;
		collision?: {
			resourceType: string;
			name: string;
			winnerPath: string;
			loserPath: string;
		};
	}
}

/**
 * Create a skill manager with default configuration
 */
export function createSkillManager(options?: LoadSkillsOptions): SkillManager {
	// Set default options based on environment
	const cwd = options?.cwd ?? getMonorepoRoot();
	const defaults: LoadSkillsOptions = {
		cwd,
		includeDefaults: true,
		...options,
	};

	return new SkillManager(defaults);
}

/**
 * Skill middleware for pi-agent sessions
 */
export function createSkillMiddleware(skillManager: SkillManager) {
	return {
		/**
		 * Hook into session start to inject skill context
		 */
		onSessionStart(_session: AgentSession): void {
			const skillsPrompt = skillManager.getSkillsForPrompt();
			if (skillsPrompt) {
				// Inject skills into system prompt or context
				// This depends on how sessions are configured
			}
		},

		/**
		 * Handle skill invocation requests
		 */
		async handleSkillInvoke(
			context: SkillInvocationContext,
		): Promise<SkillInvocationResult> {
			return skillManager.invoke(context);
		},

		/**
		 * Get available skills for UI display
		 */
		getAvailableSkills(): Array<{
			name: string;
			description: string;
			enabled: boolean;
			source: string;
			usage?: { count: number; lastUsed: number };
		}> {
			return skillManager.getRegistryEntries().map(([name, entry]) => ({
				name,
				description: entry.skill.description,
				enabled: entry.enabled,
				source: entry.skill.source,
				usage: entry.usageCount !== undefined
					? { count: entry.usageCount, lastUsed: entry.lastUsed ?? 0 }
					: undefined,
			}));
		},
	};
}

/**
 * Global skill manager instance (lazy initialized)
 */
let globalSkillManager: SkillManager | null = null;

/**
 * Get or create the global skill manager
 */
export function getGlobalSkillManager(options?: LoadSkillsOptions): SkillManager {
	if (!globalSkillManager) {
		globalSkillManager = createSkillManager(options);
	}
	return globalSkillManager;
}

/**
 * Reset the global skill manager (for testing or reconfiguration)
 */
export function resetGlobalSkillManager(): void {
	globalSkillManager = null;
}
