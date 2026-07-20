/**
 * TasteLoader Service
 *
 * Loads User and Project TASTE profiles and provides merge functionality.
 * Implements two-layer TASTE architecture as specified in docs/specs/epic-C/TASTE_ARCH_ASSESSMENT.md
 *
 * @module lib/taste/taste-loader
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  TASTEProfile,
  mergeTASTEProfiles,
  TASTEProfileSchema,
} from '@/types/taste';

// ============================================================================
// Constants
// ============================================================================

/**
 * Storage directories for TASTE profiles
 */
import { getDataRoot } from '../../paths';

const TASTE_BASE_DIR = path.join(getDataRoot(), 'taste');
const USER_TASTE_DIR = path.join(TASTE_BASE_DIR, 'users');
const PROJECT_TASTE_DIR = path.join(TASTE_BASE_DIR, 'projects');

// ============================================================================
// TasteLoader Class
// ============================================================================

/**
 * TasteLoader Service
 *
 * Responsible for loading and merging TASTE profiles from storage.
 * Follows the two-layer architecture:
 * - User TASTE: Global preferences stored at data/taste/users/{userId}/profile.json
 * - Project TASTE: Project-specific preferences stored at data/taste/projects/{projectId}/profile.json
 */
export class TasteLoader {
  private userTasteDir: string;
  private projectTasteDir: string;
  private cache: Map<string, { profile: TASTEProfile; timestamp: number }>;
  private cacheTTL: number; // milliseconds

  constructor(options?: {
    userTasteDir?: string;
    projectTasteDir?: string;
    cacheTTL?: number;
  }) {
    this.userTasteDir = options?.userTasteDir ?? USER_TASTE_DIR;
    this.projectTasteDir = options?.projectTasteDir ?? PROJECT_TASTE_DIR;
    this.cache = new Map();
    this.cacheTTL = options?.cacheTTL ?? 60000; // Default 1 minute cache
  }

  /**
   * Load TASTE profile with optional project context
   *
   * - If projectId is provided and Project TASTE exists, returns merged profile
   * - If only User TASTE exists, returns User TASTE directly
   * - If neither exists, returns null
   *
   * @param context - Context with userId and optional projectId
   * @returns Merged TASTE profile, single layer profile, or null if none exists
   */
  async loadTASTE(context: {
    userId: string;
    projectId?: string;
  }): Promise<TASTEProfile | null> {
    const { userId, projectId } = context;

    // Load User TASTE
    const userTASTE = await this.loadUserTASTE(userId);

    // If no projectId, return User TASTE directly
    if (!projectId) {
      return userTASTE;
    }

    // Load Project TASTE
    const projectTASTE = await this.loadProjectTASTE(projectId);

    // If no Project TASTE, return User TASTE directly
    if (!projectTASTE) {
      return userTASTE;
    }

    // If no User TASTE but Project TASTE exists, return Project TASTE
    if (!userTASTE) {
      return projectTASTE;
    }

    // Merge User and Project TASTE (Project takes precedence for domain-specific preferences)
    return this.mergeTASTE(userTASTE, projectTASTE);
  }

  /**
   * Load User TASTE profile
   *
   * @param userId - User ID
   * @returns User TASTE profile or null if not found
   */
  async loadUserTASTE(userId: string): Promise<TASTEProfile | null> {
    const cacheKey = `user:${userId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const profilePath = path.join(this.userTasteDir, userId, 'profile.json');

    try {
      const data = await fs.readFile(profilePath, 'utf-8');
      const parsed = JSON.parse(data);
      const profile = TASTEProfileSchema.parse(parsed);

      this.setCache(cacheKey, profile);
      return profile;
    } catch (error) {
      // File not found or parse error
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      console.error(`[TasteLoader] Error loading user TASTE for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Load Project TASTE profile
   *
   * @param projectId - Project ID
   * @returns Project TASTE profile or null if not found
   */
  async loadProjectTASTE(projectId: string): Promise<TASTEProfile | null> {
    const cacheKey = `project:${projectId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const profilePath = path.join(this.projectTasteDir, projectId, 'profile.json');

    try {
      const data = await fs.readFile(profilePath, 'utf-8');
      const parsed = JSON.parse(data);
      const profile = TASTEProfileSchema.parse(parsed);

      this.setCache(cacheKey, profile);
      return profile;
    } catch (error) {
      // File not found or parse error
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      console.error(`[TasteLoader] Error loading project TASTE for ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Merge User and Project TASTE profiles
   *
   * Uses the merge rules defined in TASTE_ARCH_ASSESSMENT.md:
   * - experience_topology: Union (deduplicated)
   * - taste_standards[domain]: Project wins entirely
   * - taste_standards (missing domains): User value kept
   * - tension_position: Weighted average (Project 0.7, User 0.3)
   * - symbiosis_boundary: Union of all arrays
   * - metadata.source: Set to 'merged'
   * - metadata.confidence: Minimum of the two
   * - metadata.evolution_count: Sum
   *
   * @param userTASTE - User-level TASTE profile
   * @param projectTASTE - Project-level TASTE profile
   * @returns Merged TASTE profile (NOT persisted)
   */
  mergeTASTE(userTASTE: TASTEProfile, projectTASTE: TASTEProfile): TASTEProfile {
    return mergeTASTEProfiles(userTASTE, projectTASTE);
  }

  /**
   * Check if User TASTE exists
   */
  async hasUserTASTE(userId: string): Promise<boolean> {
    const profilePath = path.join(this.userTasteDir, userId, 'profile.json');
    try {
      await fs.access(profilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if Project TASTE exists
   */
  async hasProjectTASTE(projectId: string): Promise<boolean> {
    const profilePath = path.join(this.projectTasteDir, projectId, 'profile.json');
    try {
      await fs.access(profilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear cache (useful for testing or when profiles are updated)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get from cache if not expired
   */
  private getFromCache(key: string): TASTEProfile | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.profile;
  }

  /**
   * Set cache entry
   */
  private setCache(key: string, profile: TASTEProfile): void {
    this.cache.set(key, {
      profile,
      timestamp: Date.now(),
    });
  }
}

// ============================================================================
// Singleton
// ============================================================================

let tasteLoaderInstance: TasteLoader | null = null;

/**
 * Get the singleton TasteLoader instance
 */
export function getTasteLoader(): TasteLoader {
  if (!tasteLoaderInstance) {
    tasteLoaderInstance = new TasteLoader();
  }
  return tasteLoaderInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetTasteLoader(): void {
  tasteLoaderInstance = null;
}
