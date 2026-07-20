/**
 * TasteLoader Service Tests
 *
 * Tests for loading and merging User and Project TASTE profiles.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import {
  TasteLoader,
  getTasteLoader,
  resetTasteLoader,
} from '../taste-loader';
import { TASTEProfile, createTASTEProfile } from '@/types/taste';

// Test directories
const TEST_USER_DIR = path.join(process.cwd(), 'data', 'taste', 'users');
const TEST_PROJECT_DIR = path.join(process.cwd(), 'data', 'taste', 'projects');

// Helper to create test profile
function createTestProfile(overrides: Partial<TASTEProfile> & { userId?: string; projectId?: string }): TASTEProfile {
  return createTASTEProfile({
    userId: overrides.userId,
    projectId: overrides.projectId,
    experience_topology: overrides.experience_topology ?? [],
    taste_standards: overrides.taste_standards ?? {},
    tension_position: overrides.tension_position,
    symbiosis_boundary: overrides.symbiosis_boundary,
    metadata: overrides.metadata,
  });
}

describe('TasteLoader', () => {
  let loader: TasteLoader;

  beforeEach(async () => {
    // Reset singleton
    resetTasteLoader();

    // Create fresh loader with no cache TTL for testing
    loader = new TasteLoader({ cacheTTL: 0 });

    // Ensure test directories exist
    await fs.mkdir(TEST_USER_DIR, { recursive: true });
    await fs.mkdir(TEST_PROJECT_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test data
    try {
      await fs.rm(path.join(TEST_USER_DIR, 'test-user-loader-1'), { recursive: true, force: true });
      await fs.rm(path.join(TEST_USER_DIR, 'test-user-loader-2'), { recursive: true, force: true });
      await fs.rm(path.join(TEST_PROJECT_DIR, 'test-project-loader-1'), { recursive: true, force: true });
      await fs.rm(path.join(TEST_PROJECT_DIR, 'test-project-loader-2'), { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('loadUserTASTE', () => {
    it('should return null when user TASTE does not exist', async () => {
      const profile = await loader.loadUserTASTE('non-existent-user');
      expect(profile).toBeNull();
    });

    it('should load user TASTE when it exists', async () => {
      const userId = 'test-user-loader-1';
      const userDir = path.join(TEST_USER_DIR, userId);
      await fs.mkdir(userDir, { recursive: true });

      const testProfile = createTestProfile({
        userId,
        experience_topology: ['web-development', 'frontend'],
        taste_standards: {
          development: {
            positive_vibes: ['clean-code'],
            negative_vibes: ['complexity'],
          },
        },
      });

      await fs.writeFile(
        path.join(userDir, 'profile.json'),
        JSON.stringify(testProfile, null, 2)
      );

      const loaded = await loader.loadUserTASTE(userId);

      expect(loaded).not.toBeNull();
      expect(loaded?.userId).toBe(userId);
      expect(loaded?.experience_topology).toContain('web-development');
      expect(loaded?.taste_standards.development.positive_vibes).toContain('clean-code');
    });

    it('should handle malformed JSON gracefully', async () => {
      const userId = 'test-user-loader-2';
      const userDir = path.join(TEST_USER_DIR, userId);
      await fs.mkdir(userDir, { recursive: true });

      await fs.writeFile(
        path.join(userDir, 'profile.json'),
        'not valid json'
      );

      const profile = await loader.loadUserTASTE(userId);
      expect(profile).toBeNull();
    });
  });

  describe('loadProjectTASTE', () => {
    it('should return null when project TASTE does not exist', async () => {
      const profile = await loader.loadProjectTASTE('non-existent-project');
      expect(profile).toBeNull();
    });

    it('should load project TASTE when it exists', async () => {
      const projectId = 'test-project-loader-1';
      const projectDir = path.join(TEST_PROJECT_DIR, projectId);
      await fs.mkdir(projectDir, { recursive: true });

      const testProfile = createTestProfile({
        projectId,
        experience_topology: ['mobile-development', 'testing'],
        taste_standards: {
          development: {
            positive_vibes: ['test-driven'],
            negative_vibes: ['manual-testing'],
          },
        },
        tension_position: {
          control_level: 0.8,
          trust_level: 0.3,
          intervention_threshold: 0.5,
        },
      });

      await fs.writeFile(
        path.join(projectDir, 'profile.json'),
        JSON.stringify(testProfile, null, 2)
      );

      const loaded = await loader.loadProjectTASTE(projectId);

      expect(loaded).not.toBeNull();
      expect(loaded?.projectId).toBe(projectId);
      expect(loaded?.experience_topology).toContain('mobile-development');
      expect(loaded?.taste_standards.development.positive_vibes).toContain('test-driven');
    });
  });

  describe('loadTASTE', () => {
    it('should return user TASTE when no projectId provided', async () => {
      const userId = 'test-user-loader-1';
      const userDir = path.join(TEST_USER_DIR, userId);
      await fs.mkdir(userDir, { recursive: true });

      const testProfile = createTestProfile({
        userId,
        experience_topology: ['web-development'],
      });

      await fs.writeFile(
        path.join(userDir, 'profile.json'),
        JSON.stringify(testProfile, null, 2)
      );

      const loaded = await loader.loadTASTE({ userId });

      expect(loaded).not.toBeNull();
      expect(loaded?.userId).toBe(userId);
      expect(loaded?.projectId).toBeUndefined();
    });

    it('should return user TASTE when project TASTE does not exist', async () => {
      const userId = 'test-user-loader-1';
      const userDir = path.join(TEST_USER_DIR, userId);
      await fs.mkdir(userDir, { recursive: true });

      const testProfile = createTestProfile({
        userId,
        experience_topology: ['web-development'],
      });

      await fs.writeFile(
        path.join(userDir, 'profile.json'),
        JSON.stringify(testProfile, null, 2)
      );

      const loaded = await loader.loadTASTE({ userId, projectId: 'non-existent-project' });

      expect(loaded).not.toBeNull();
      expect(loaded?.userId).toBe(userId);
    });

    it('should return project TASTE when user TASTE does not exist', async () => {
      const projectId = 'test-project-loader-1';
      const projectDir = path.join(TEST_PROJECT_DIR, projectId);
      await fs.mkdir(projectDir, { recursive: true });

      const testProfile = createTestProfile({
        projectId,
        experience_topology: ['mobile-development'],
      });

      await fs.writeFile(
        path.join(projectDir, 'profile.json'),
        JSON.stringify(testProfile, null, 2)
      );

      const loaded = await loader.loadTASTE({
        userId: 'non-existent-user',
        projectId,
      });

      expect(loaded).not.toBeNull();
      expect(loaded?.projectId).toBe(projectId);
    });

    it('should return merged TASTE when both exist', async () => {
      const userId = 'test-user-loader-1';
      const projectId = 'test-project-loader-1';

      // Create user TASTE
      const userDir = path.join(TEST_USER_DIR, userId);
      await fs.mkdir(userDir, { recursive: true });
      const userProfile = createTestProfile({
        userId,
        experience_topology: ['web-development', 'frontend'],
        taste_standards: {
          development: {
            positive_vibes: ['clean-code'],
            negative_vibes: ['complexity'],
          },
          design: {
            positive_vibes: ['minimalism'],
            negative_vibes: ['clutter'],
          },
        },
        tension_position: {
          control_level: 0.5,
          trust_level: 0.5,
          intervention_threshold: 0.7,
        },
      });
      await fs.writeFile(
        path.join(userDir, 'profile.json'),
        JSON.stringify(userProfile, null, 2)
      );

      // Create project TASTE
      const projectDir = path.join(TEST_PROJECT_DIR, projectId);
      await fs.mkdir(projectDir, { recursive: true });
      const projectProfile = createTestProfile({
        projectId,
        experience_topology: ['mobile-development', 'testing'],
        taste_standards: {
          development: {
            positive_vibes: ['test-driven'],
            negative_vibes: ['manual-testing'],
          },
        },
        tension_position: {
          control_level: 0.8,
          trust_level: 0.3,
          intervention_threshold: 0.5,
        },
      });
      await fs.writeFile(
        path.join(projectDir, 'profile.json'),
        JSON.stringify(projectProfile, null, 2)
      );

      const merged = await loader.loadTASTE({ userId, projectId });

      expect(merged).not.toBeNull();
      expect(merged?.metadata.source).toBe('merged');

      // Check experience_topology: Union (deduplicated)
      expect(merged?.experience_topology).toContain('web-development');
      expect(merged?.experience_topology).toContain('frontend');
      expect(merged?.experience_topology).toContain('mobile-development');
      expect(merged?.experience_topology).toContain('testing');

      // Check taste_standards: Project wins for 'development', User kept for 'design'
      expect(merged?.taste_standards.development.positive_vibes).toContain('test-driven');
      expect(merged?.taste_standards.development.negative_vibes).toContain('manual-testing');
      expect(merged?.taste_standards.design.positive_vibes).toContain('minimalism');

      // Check tension_position: Weighted average (Project 0.7, User 0.3)
      expect(merged?.tension_position.control_level).toBeCloseTo(0.5 * 0.3 + 0.8 * 0.7, 2);
      expect(merged?.tension_position.trust_level).toBeCloseTo(0.5 * 0.3 + 0.3 * 0.7, 2);
    });

    it('should return null when neither TASTE exists', async () => {
      const loaded = await loader.loadTASTE({
        userId: 'non-existent-user',
        projectId: 'non-existent-project',
      });

      expect(loaded).toBeNull();
    });
  });

  describe('hasUserTASTE', () => {
    it('should return false when user TASTE does not exist', async () => {
      const exists = await loader.hasUserTASTE('non-existent-user');
      expect(exists).toBe(false);
    });

    it('should return true when user TASTE exists', async () => {
      const userId = 'test-user-loader-1';
      const userDir = path.join(TEST_USER_DIR, userId);
      await fs.mkdir(userDir, { recursive: true });

      await fs.writeFile(
        path.join(userDir, 'profile.json'),
        JSON.stringify(createTestProfile({ userId }), null, 2)
      );

      const exists = await loader.hasUserTASTE(userId);
      expect(exists).toBe(true);
    });
  });

  describe('hasProjectTASTE', () => {
    it('should return false when project TASTE does not exist', async () => {
      const exists = await loader.hasProjectTASTE('non-existent-project');
      expect(exists).toBe(false);
    });

    it('should return true when project TASTE exists', async () => {
      const projectId = 'test-project-loader-1';
      const projectDir = path.join(TEST_PROJECT_DIR, projectId);
      await fs.mkdir(projectDir, { recursive: true });

      await fs.writeFile(
        path.join(projectDir, 'profile.json'),
        JSON.stringify(createTestProfile({ projectId }), null, 2)
      );

      const exists = await loader.hasProjectTASTE(projectId);
      expect(exists).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear cached profiles', async () => {
      const userId = 'test-user-loader-1';
      const userDir = path.join(TEST_USER_DIR, userId);
      await fs.mkdir(userDir, { recursive: true });

      await fs.writeFile(
        path.join(userDir, 'profile.json'),
        JSON.stringify(createTestProfile({ userId }), null, 2)
      );

      // Load once to cache
      await loader.loadUserTASTE(userId);

      // Clear cache
      loader.clearCache();

      // This should load from disk again
      const profile = await loader.loadUserTASTE(userId);
      expect(profile).not.toBeNull();
    });
  });
});

describe('getTasteLoader singleton', () => {
  it('should return the same instance', () => {
    const loader1 = getTasteLoader();
    const loader2 = getTasteLoader();

    expect(loader1).toBe(loader2);

    resetTasteLoader();
  });

  it('should return new instance after reset', () => {
    const loader1 = getTasteLoader();
    resetTasteLoader();
    const loader2 = getTasteLoader();

    expect(loader1).not.toBe(loader2);
  });
});
