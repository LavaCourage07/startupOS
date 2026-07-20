/**
 * Projects API Integration Tests
 *
 * Tests for the projects CRUD API endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { projectService } from '@originos/core/lib/features/services/project-service-real';

// ============================================================================
// Test Data
// ============================================================================


// ============================================================================
// Cleanup Helper
// ============================================================================

async function cleanupProjects() {
  try {
    const { readdir, rm } = await import('fs/promises');
    const { join } = await import('path');
    const dataDir = join(process.cwd(), 'data', 'projects');

    const files = await readdir(dataDir);
    for (const file of files) {
      if (file.includes('Test')) {
        await rm(join(dataDir, file), { force: true });
      }
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Project Service - CRUD Operations', () => {
  beforeAll(async () => {
    await cleanupProjects();
  });

  afterAll(async () => {
    await cleanupProjects();
  });

  describe('createProject', () => {
    it('should create a new project with valid data', async () => {
      const project = await projectService.createProject({
        name: 'Test Project',
        description: 'A test project',
        domain: 'Testing',
      });

      expect(project).toBeDefined();
      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Project');
      expect(project.domain).toBe('Testing');
      expect(project.status).toBe('active');
      expect(project.userId).toBe('current-user');
    });

    it('should generate unique IDs for each project', async () => {
      const project1 = await projectService.createProject({
        name: 'Project 1',
        domain: 'Test',
      });

      const project2 = await projectService.createProject({
        name: 'Project 2',
        domain: 'Test',
      });

      expect(project1.id).not.toBe(project2.id);
    });

    it('should assign a random color if not provided', async () => {
      const project = await projectService.createProject({
        name: 'Test Project',
        domain: 'Test',
      });

      expect(project.color).toBeDefined();
      expect(project.color).toMatch(/^from-[a-z]+-\d+$/);
    });
  });

  describe('getProject', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await projectService.createProject({
        name: 'Get Test',
        domain: 'Test',
      });
      projectId = project.id;
    });

    it('should retrieve a project by ID', async () => {
      const project = await projectService.getProject(projectId);

      expect(project).toBeDefined();
      expect(project?.id).toBe(projectId);
      expect(project?.name).toBe('Get Test');
    });

    it('should return null for non-existent project', async () => {
      const project = await projectService.getProject('does-not-exist');

      expect(project).toBeNull();
    });
  });

  describe('updateProject', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await projectService.createProject({
        name: 'Update Test',
        domain: 'Test',
      });
      projectId = project.id;
    });

    it('should update project name', async () => {
      const updated = await projectService.updateProject(projectId, {
        name: 'Updated Name',
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Name');
    });

    it('should update project description', async () => {
      const updated = await projectService.updateProject(projectId, {
        description: 'New description',
      });

      expect(updated?.description).toBe('New description');
    });

    it('should update multiple fields at once', async () => {
      const updated = await projectService.updateProject(projectId, {
        name: 'Multiple Updates',
        description: 'Updated desc',
        status: 'archived',
      });

      expect(updated?.name).toBe('Multiple Updates');
      expect(updated?.description).toBe('Updated desc');
      expect(updated?.status).toBe('archived');
    });

    it('should update lastModified timestamp', async () => {
      const original = await projectService.getProject(projectId);
      await new Promise((r) => setTimeout(r, 10)); // Small delay

      const updated = await projectService.updateProject(projectId, {
        name: 'Timestamp Test',
      });

      expect(updated?.lastModified).toBeGreaterThan(original!.lastModified);
    });
  });

  describe('deleteProject', () => {
    it('should delete an existing project', async () => {
      const project = await projectService.createProject({
        name: 'Delete Test',
        domain: 'Test',
      });
      const projectId = project.id;

      const deleted = await projectService.deleteProject(projectId);

      expect(deleted).toBe(true);

      const retrieved = await projectService.getProject(projectId);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent project', async () => {
      const deleted = await projectService.deleteProject('does-not-exist');

      expect(deleted).toBe(false);
    });
  });

  describe('listProjects', () => {
    beforeEach(async () => {
      await cleanupProjects();
      // Create some test projects
      await projectService.createProject({ name: 'Project A', domain: 'Domain A' });
      await projectService.createProject({ name: 'Project B', domain: 'Domain B' });
      await projectService.createProject({ name: 'Project C', domain: 'Domain A' });
    });

    it('should return all projects', async () => {
      const projects = await projectService.listProjects();

      expect(projects.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by status', async () => {
      const projects = await projectService.listProjects({ status: 'active' });

      projects.forEach((p) => {
        expect(p.status).toBe('active');
      });
    });

    it('should filter by domain (substring match)', async () => {
      const projects = await projectService.listProjects({ domain: 'Domain A' });

      expect(projects.length).toBeGreaterThan(0);
      projects.forEach((p) => {
        expect(p.domain).toContain('Domain A');
      });
    });

    it('should sort by lastModified (newest first)', async () => {
      const projects = await projectService.listProjects();

      for (let i = 1; i < projects.length; i++) {
        expect(projects[i - 1]!.lastModified).toBeGreaterThanOrEqual(
          projects[i]!.lastModified
        );
      }
    });
  });

  describe('exportProject', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await projectService.createProject({
        name: 'Export Test',
        domain: 'Test',
      });
      projectId = project.id;
    });

    it('should export project as JSON string', async () => {
      const json = await projectService.exportProject(projectId);

      expect(typeof json).toBe('string');

      const data = JSON.parse(json);
      expect(data.project).toBeDefined();
      expect(data.project.id).toBe(projectId);
      expect(data.exportedAt).toBeDefined();
    });

    it('should throw error for non-existent project', async () => {
      await expect(
        projectService.exportProject('does-not-exist')
      ).rejects.toThrow('Project not found');
    });
  });

  describe('importProject', () => {
    it('should import a project from JSON', async () => {
      const exportData = JSON.stringify({
        project: {
          id: 'export-test-id',
          name: 'Imported Project',
          description: 'Imported description',
          domain: 'Imported',
          type: 'generic',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastModified: Date.now(),
          userId: 'import-user',
          status: 'active',
          color: 'from-blue-500',
          metadata: {},
        },
        exportedAt: new Date().toISOString(),
        version: '1.0',
      });

      const project = await projectService.importProject(exportData);

      expect(project).toBeDefined();
      expect(project.name).toBe('Imported Project');
      // ID should be different unless newId is false
      expect(project.id).not.toBe('export-test-id');
    });

    it('should throw error for invalid JSON', async () => {
      await expect(
        projectService.importProject('not valid json')
      ).rejects.toThrow();
    });

    it('should throw error for missing project in export', async () => {
      await expect(
        projectService.importProject(JSON.stringify({}))
      ).rejects.toThrow('Invalid export format');
    });
  });

  describe('getProjectStats', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await projectService.createProject({
        name: 'Stats Test',
        domain: 'Test',
        ontologyId: 'test-ontology',
      });
      projectId = project.id;
    });

    it('should return stats for existing project', async () => {
      const stats = await projectService.getProjectStats(projectId);

      expect(stats).toBeDefined();
      expect(stats).toMatchObject({
        fileCount: expect.any(Number),
        lastModified: expect.any(Number),
        ontologySize: expect.any(Number),
      });
    });

    it('should return null for non-existent project', async () => {
      const stats = await projectService.getProjectStats('does-not-exist');

      expect(stats).toBeNull();
    });
  });
});
