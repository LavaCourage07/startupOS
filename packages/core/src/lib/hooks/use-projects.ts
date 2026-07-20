/**
 * useProjects Hook
 *
 * 用于项目列表管理（使用真实 API）
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { Project, ProjectListItem, ProjectQuery } from "@/types/project";
import {
  createProject as createProjectViaAdapter,
  deleteProject as deleteProjectViaAdapter,
  exportProject as exportProjectViaAdapter,
  getProject as getProjectViaAdapter,
  importProject as importProjectViaAdapter,
  listProjects as listProjectsViaAdapter,
  updateProject as updateProjectViaAdapter,
} from "../integrations/electron/services/project";

// ============================================================================
// Types
// ============================================================================

export interface UseProjectsOptions {
  autoLoad?: boolean;
  query?: ProjectQuery;
  refreshInterval?: number;
}

export interface UseProjectsReturn {
  projects: ProjectListItem[];
  activeProject: Project | null;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadProjects: (query?: ProjectQuery) => Promise<void>;
  refreshProjects: () => Promise<void>;
  createProject: (data: { name: string; description?: string; domain: string; }) => Promise<Project>;
  updateProject: (projectId: string, data: any) => Promise<Project | null>;
  deleteProject: (projectId: string) => Promise<boolean>;
  getProject: (projectId: string) => Promise<Project | null>;
  setActiveProject: (project: Project | null) => void;
  exportProject: (projectId: string) => Promise<string>;
  importProject: (
    exportJson: string,
    options?: { overwrite?: boolean; newId?: boolean }
  ) => Promise<Project>;
  loadMore: () => Promise<void>;
}

const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds

// ============================================================================
// Helper Functions
// ============================================================================

export function useProjects(options: UseProjectsOptions = {}): UseProjectsReturn {
  const {
    autoLoad = false,
    query: baseQuery = {},
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
  } = options;

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // 缓存 baseQuery 对象，避免每次组件渲染时创建新对象从而导致 loadProjects 重新定义
  const memoizedBaseQuery = useMemo(
    () => baseQuery,
    [JSON.stringify(baseQuery)]
  );

  const loadProjects = useCallback(async (queryOverride?: ProjectQuery) => {
    try {
      setIsLoading(true);
      setError(null);

      const query = { ...memoizedBaseQuery, ...queryOverride };
      const response = await listProjectsViaAdapter({
        ...query,
        page: query.page || 1,
        limit: query.limit || 20,
      });

      if (response.success) {
        const newProjects = response.data || [];
        if (queryOverride === undefined) {
          // Full reload
          setProjects(newProjects);
        } else {
          // Load more
          setProjects(prev => [...prev, ...newProjects]);
        }
        setHasMore(newProjects.length === (query.limit || 20));
        if (query.page) setCurrentPage(query.page);
      } else {
        throw new Error('Failed to load projects');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加载项目列表失败";
      setError(errorMessage);
      console.error("加载项目列表失败:", err);
    } finally {
      setIsLoading(false);
    }
  }, [memoizedBaseQuery]);

  const refreshProjects = useCallback(async () => {
    await loadProjects();
  }, [loadProjects]);

  const createProject = useCallback(
    async (data: { name: string; description?: string; domain: string }): Promise<Project> => {
      try {
        setError(null);
        setIsLoading(true);

        const response = await createProjectViaAdapter(data);

        if (response.success) {
          const newProject = response.data;
          // Refresh the list
          await loadProjects();
          return newProject;
        } else {
          throw new Error('Failed to create project');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "创建项目失败";
        setError(errorMessage);
        console.error("创建项目失败:", err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadProjects]
  );

  const updateProject = useCallback(
    async (projectId: string, data: any): Promise<Project | null> => {
      try {
        setError(null);

        const response = await updateProjectViaAdapter(projectId, data);

        if (response.success) {
          const updatedProject = response.data;
          // Update in local state
          setProjects(prev =>
            prev.map(p =>
              p.id === projectId
                ? { ...p, name: updatedProject.name, description: updatedProject.description }
                : p
            )
          );
          // Update active project if it matches
          if (activeProject?.id === projectId) {
            setActiveProject(updatedProject);
          }
          return updatedProject;
        } else {
          return null;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "更新项目失败";
        setError(errorMessage);
        console.error("更新项目失败:", err);
        throw err;
      }
    },
    [activeProject]
  );

  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    try {
      setError(null);

      const response = await deleteProjectViaAdapter(projectId);

      if (response.success && response.data?.deleted) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (activeProject?.id === projectId) {
          setActiveProject(null);
        }
        return true;
      } else {
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "删除项目失败";
      setError(errorMessage);
      console.error("删除项目失败:", err);
      return false;
    }
  }, [activeProject]);

  const getProject = useCallback(async (projectId: string): Promise<Project | null> => {
    try {
      setError(null);

      const response = await getProjectViaAdapter(projectId);

      if (response.success) {
        return response.data;
      }
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "获取项目失败";
      setError(errorMessage);
      console.error("获取项目失败:", err);
      return null;
    }
  }, []);

  const exportProject = useCallback(async (projectId: string): Promise<string> => {
    try {
      setError(null);

      const response = await exportProjectViaAdapter(projectId);
      if (!response.success || typeof response.data !== 'string') {
        throw new Error(response.error?.message || 'Export failed');
      }
      return response.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "导出项目失败";
      setError(errorMessage);
      console.error("导出项目失败:", err);
      throw err;
    }
  }, []);

  const importProject = useCallback(
    async (
      exportJson: string,
      options?: { overwrite?: boolean; newId?: boolean }
    ): Promise<Project> => {
      try {
        setError(null);

        const response = await importProjectViaAdapter(exportJson, options);

        if (response.success) {
          await loadProjects();
          return response.data;
        } else {
          throw new Error('Import failed');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "导入项目失败";
        setError(errorMessage);
        console.error("导入项目失败:", err);
        throw err;
      }
    },
    [loadProjects]
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) {
      return;
    }
    await loadProjects({ ...memoizedBaseQuery, page: currentPage + 1 });
  }, [hasMore, isLoading, currentPage, loadProjects, memoizedBaseQuery]);

  useEffect(() => {
    if (autoLoad) {
      loadProjects();
    }
  }, [autoLoad, loadProjects]);

  useEffect(() => {
    if (!autoLoad || refreshInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      refreshProjects();
    }, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [autoLoad, refreshInterval, refreshProjects]);

  return {
    projects,
    activeProject,
    isLoading,
    error,
    hasMore,
    loadProjects,
    refreshProjects,
    createProject,
    updateProject,
    deleteProject,
    getProject,
    setActiveProject,
    exportProject,
    importProject,
    loadMore,
  };
}
