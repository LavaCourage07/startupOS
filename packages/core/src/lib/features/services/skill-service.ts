/**
 * Skill Service
 *
 * Provides a service layer for skill management with caching
 */

import {
  loadSkills,
  loadSkillContent,
  formatSkillsForPrompt,
  type Skill,
  type LoadSkillsResult,
} from '../../../lib/integrations/pi-agent/core/skills';

/**
 * Cached skills state
 */
let cachedSkillsResult: LoadSkillsResult | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds cache

/**
 * Skill Service class
 */
class SkillService {
  private skillsCache: Map<string, LoadSkillsResult> = new Map();
  private cacheTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Get skills with optional caching
   */
  async getSkills(options: { useCache?: boolean; cacheKey?: string } = {}): Promise<LoadSkillsResult> {
    const { useCache = true, cacheKey = 'default' } = options;

    if (useCache) {
      const now = Date.now();

      // Check global cache first
      if (cachedSkillsResult && (now - cacheTimestamp) < CACHE_TTL) {
        return cachedSkillsResult;
      }

      // Check instance cache
      const cached = this.skillsCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Load fresh skills
    const result = loadSkills({ includeDefaults: true });

    // Update caches
    cachedSkillsResult = result;
    cacheTimestamp = Date.now();
    this.skillsCache.set(cacheKey, result);

    // Set cache auto-clear
    const timeout = setTimeout(() => {
      this.skillsCache.delete(cacheKey);
    }, CACHE_TTL);
    this.cacheTimeouts.set(cacheKey, timeout);

    return result;
  }

  /**
   * Clear cache for a specific key or all keys
   */
  clearCache(cacheKey?: string): void {
    if (cacheKey) {
      const timeout = this.cacheTimeouts.get(cacheKey);
      if (timeout) {
        clearTimeout(timeout);
        this.cacheTimeouts.delete(cacheKey);
      }
      this.skillsCache.delete(cacheKey);
    } else {
      for (const timeout of this.cacheTimeouts.values()) {
        clearTimeout(timeout);
      }
      this.cacheTimeouts.clear();
      this.skillsCache.clear();
      cachedSkillsResult = null;
    }
  }

  /**
   * Get skill by name
   */
  async getSkillByName(name: string): Promise<Skill | null> {
    const result = await this.getSkills();
    return result.skills.find((s) => s.name === name) || null;
  }

  /**
   * Get skill content
   */
  getSkillContent(skill: Skill) {
    return loadSkillContent(skill);
  }

  /**
   * Format skills for agent prompt (XML format)
   */
  async formatSkillsForAgentPrompt(options?: { source?: Skill['source'] }): Promise<string> {
    const result = await this.getSkills();

    let skills = result.skills;
    if (options?.source) {
      skills = skills.filter((s) => s.source === options.source);
    }

    return formatSkillsForPrompt(skills);
  }

  /**
   * Get diagnostics only
   */
  async getDiagnostics(): Promise<LoadSkillsResult['diagnostics']> {
    const result = await this.getSkills();
    return result.diagnostics;
  }

  /**
   * Validate skill directory structure
   */
  async validateSkillDirectory(dirPath: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const { existsSync, readdirSync } = await import('fs');
    const { join } = await import('path');

    const errors: string[] = [];

    if (!existsSync(dirPath)) {
      return { valid: false, errors: [`Directory does not exist: ${dirPath}`] };
    }

    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      const hasSkillMd = entries.some((e) => e.isFile() && e.name === 'SKILL.md');

      if (!hasSkillMd) {
        errors.push('SKILL.md file not found in directory');
      }
    } catch (error) {
      errors.push(`Failed to read directory: ${error}`);
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Export singleton instance
 */
export const skillService = new SkillService();

/**
 * Export types
 */
export type { Skill, LoadSkillsResult };
