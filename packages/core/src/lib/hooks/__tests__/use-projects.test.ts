/**
 * useProjects Hook Tests
 *
 * Tests for the project management React hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProjects } from '../use-projects';
import type { Project, ProjectListItem } from '@/types/project';

// ============================================================================
// Mock fetch for API calls
// ============================================================================

const mockProjects: ProjectListItem[] = [
  {
    id: 'proj-1',
    name: 'Project 1',
    description: 'First project',
    domain: 'Software',
    createdAt: Date.now() - 100000,
    lastModified: Date.now(),
    ontologySize: 10,
    ontologyId: 'ont-1',
    color: 'from-blue-500',
    status: 'active',
    hasSolution: false,
  },
  {
    id: 'proj-2',
    name: 'Project 2',
    description: 'Second project',
    domain: 'Design',
    createdAt: Date.now() - 200000,
    lastModified: Date.now() - 50000,
    ontologySize: 5,
    ontologyId: 'ont-2',
    color: 'from-purple-500',
    status: 'active',
    hasSolution: true,
  },
];

const mockProject: Project = {
  id: 'proj-new',
  name: 'New Project',
  description: 'A new project',
  domain: 'Test',
  type: 'generic',
  ontologyId: 'ont-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastModified: Date.now(),
  userId: 'current-user',
  status: 'active',
  color: 'from-green-500',
  metadata: {},
};

global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({ success: true, data: mockProjects }),
}) as any);

// ============================================================================
// Tests
// ============================================================================

describe('useProjects Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadProjects', () => {
    it('should load projects successfully', async () => {
      const { result } = renderHook(() => useProjects({ autoLoad: false }));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.projects.length).toBe(0);

      await act(async () => {
        await result.current.loadProjects();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.projects.length).toBeGreaterThan(0);
    });

    it('should set loading state during load', async () => {
      const { result } = renderHook(() => useProjects({ autoLoad: false }));

      let isLoadingDuringLoad = false;

      act(() => {
        result.current.loadProjects().then(() => {
          isLoadingDuringLoad = result.current.isLoading;
        });
      });

      await act(async () => {
        await result.current.loadProjects();
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should use query parameters', async () => {
      const { result } = renderHook(() =>
        useProjects({ autoLoad: false, query: { status: 'active' } })
      );

      await act(async () => {
        await result.current.loadProjects();
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain('status=active');
    });

    it('should handle load errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'Network error' },
        }),
      });

      const { result } = renderHook(() => useProjects({ autoLoad: false }));

      await act(async () => {
        try {
          await result.current.loadProjects();
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('createProject', () => {
    it('should create a new project', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockProject }),
      }).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [mockProject, ...mockProjects] }),
      });

      const { result } = renderHook(() => useProjects({ autoLoad: false }));

      let createdProject: Project | undefined;

      await act(async () => {
        createdProject = await result.current.createProject({
          name: 'New Project',
          domain: 'Test',
        });
      });

      expect(createdProject).toBeDefined();
      expect(createdProject?.name).toBe('New Project');
      expect(createdProject?.domain).toBe('Test');
    });

    it('should validate project name', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Project name is required' },
        }),
      });

      const { result } = renderHook(() => useProjects({ autoLoad: false }));

      await act(async () => {
        try {
          await result.current.createProject({
            name: '',
            domain: 'Test',
          });
        } catch (error) {
          // Expected
        }
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should refresh projects after creation', async () => {
      let fetchCallCount = 0;

      (global.fetch as any).mockImplementation(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          // First call: autoLoad
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: mockProjects }),
          });
        }
        if (fetchCallCount === 2) {
          // Second call: createProject POST
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: mockProject }),
          });
        }
        // Third call: refresh after create
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [mockProject, ...mockProjects] }),
        });
      });

      const { result } = renderHook(() => useProjects({ autoLoad: true }));

      // Wait for initial load
      await waitFor(() => {
        expect(fetchCallCount).toBe(1);
      });

      // Create a project (which should trigger refresh)
      await act(async () => {
        await result.current.createProject({
          name: 'New Project',
          domain: 'test',
        });
      });

      // Should have called fetch 3 times: autoLoad + create + refresh
      expect(fetchCallCount).toBe(3);
    });
  });

  describe('updateProject', () => {
    it('should update a project', async () => {
      const updatedProject = { ...mockProject, name: 'Updated Project' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: updatedProject }),
      });

      const { result } = renderHook(() =>
        useProjects({ autoLoad: false })
      );

      await act(async () => {
        const updated = await result.current.updateProject('proj-1', {
          name: 'Updated Project',
        });
        expect(updated?.name).toBe('Updated Project');
      });
    });
  });

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { deleted: true } }),
      });

      const { result } = renderHook(() => useProjects({ autoLoad: false }));

      await act(async () => {
        const deleted = await result.current.deleteProject('proj-1');
        expect(deleted).toBe(true);
      });
    });

    it('should handle non-existent project', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 404,
        json: () => Promise.resolve({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        }),
      });

      const { result } = renderHook(() => useProjects({ autoLoad: false }));

      const deleted = await result.current.deleteProject('non-existent');

      expect(deleted).toBe(false);
    });
  });

  describe('exportProject', () => {
    it('should export project as JSON', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ project: mockProject })),
      });

      const { result } = renderHook(() => useProjects({ autoLoad: false }));

      let exportJson = '';

      await act(async () => {
        exportJson = await result.current.exportProject('proj-1');
      });

      expect(exportJson).toBeDefined();
      expect(typeof exportJson).toBe('string');

      const data = JSON.parse(exportJson);
      expect(data.project).toBeDefined();
    });
  });

  describe('importProject', () => {
    it('should import a project from JSON', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockProject }),
      });

      const { result } = renderHook(() => useProjects({ autoLoad: false }));

      let importedProject: Project | undefined;

      await act(async () => {
        importedProject = await result.current.importProject(
          JSON.stringify({ project: mockProject })
        );
      });

      expect(importedProject).toBeDefined();
      expect(importedProject?.name).toBe(mockProject.name);
    });
  });

  describe('autoLoad', () => {
    it('should load projects automatically when autoLoad is true', async () => {
      renderHook(() => useProjects({ autoLoad: true }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should not load projects when autoLoad is false', () => {
      renderHook(() => useProjects({ autoLoad: false }));

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

});
