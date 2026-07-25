import { create } from 'zustand';
import type {
  WorkspaceState,
  ProjectFile,
  FileListResponse,
  FileContentResponse,
} from '../../types/workspace';
import type { ApiResponse } from '../../types/api';
import { isElectron } from '../../lib/integrations/electron/env';
import { deleteLocalFile, listLocalFiles, readLocalFile, writeLocalFile } from '../../lib/integrations/electron/local-fs';
import {
  deleteWorkspaceFile,
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
} from '../integrations/electron/services/workspace';

function normalizeWorkspacePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

export function mapProjectFile(projectId: string, basePath: string, absolutePath: string, isDirectory: boolean, size: number, createdAt: string, modifiedAt: string): ProjectFile {
  const normalizedBasePath = normalizeWorkspacePath(basePath);
  const normalizedAbsolutePath = normalizeWorkspacePath(absolutePath);
  const relativePath = normalizedAbsolutePath === normalizedBasePath
    ? ''
    : normalizedAbsolutePath.startsWith(`${normalizedBasePath}/`)
      ? normalizedAbsolutePath.slice(normalizedBasePath.length + 1)
      : normalizedAbsolutePath;
  const name = relativePath.split('/').filter(Boolean).pop() ?? relativePath;

  return {
    id: Buffer.from(relativePath).toString('base64'),
    projectId,
    path: relativePath,
    name,
    size: isDirectory ? 0 : size,
    createdAt: new Date(createdAt).getTime(),
    modifiedAt: new Date(modifiedAt).getTime(),
    type: isDirectory ? 'folder' : 'file',
    extension: isDirectory ? undefined : name.split('.').slice(1).pop(),
    parentPath: relativePath.includes('/') ? relativePath.split('/').slice(0, -1).join('/') : undefined,
  };
}

interface WorkspaceActions {
  /** Set active project and base directory for workspace API */
  setActiveProject: (projectId: string | null, basePath?: string) => void;
  /** Load files for a project */
  loadFiles: (projectId: string) => Promise<void>;
  /** Open and read a file */
  openFile: (projectId: string, filePath: string) => Promise<void>;
  /** Close currently opened file */
  closeFile: () => void;
  /** Select a file */
  selectFile: (fileId: string | null) => void;
  /** Create a new file */
  createFile: (projectId: string, name: string, content?: string) => Promise<ProjectFile>;
  /** Save file content */
  saveFile: (projectId: string, filePath: string, content: string) => Promise<void>;
  /** Delete a file */
  deleteFile: (projectId: string, filePath: string) => Promise<void>;
  /** Clear error */
  clearError: () => void;
}

type WorkspaceStore = WorkspaceState & WorkspaceActions;

/**
 * Workspace state management hook
 */
export const useWorkspace = create<WorkspaceStore>((set, get) => ({
  // State
  activeProjectId: null,
  selectedFileId: null,
  files: {},
  openedFile: null,
  isLoading: false,
  error: null,
  activeBasePath: null,

  // Actions
  setActiveProject: (projectId, basePath) => {
    set({ activeProjectId: projectId, selectedFileId: null, openedFile: null, activeBasePath: basePath || null });
  },

  loadFiles: async (projectId) => {
    set({ isLoading: true, error: null });

    try {
      const basePath = get().activeBasePath;
      if (!basePath) {
        throw new Error('basePath is not set');
      }

      if (isElectron()) {
        const entries = await listLocalFiles(basePath);
        const files = entries.map((entry) =>
          mapProjectFile(projectId, basePath, entry.path, entry.isDirectory, entry.size, entry.createdAt, entry.modifiedAt)
        );

        set((state) => ({
          files: {
            ...state.files,
            [projectId]: files,
          },
          isLoading: false,
        }));
        return;
      }

      const result = await listWorkspaceFiles(basePath) as ApiResponse<FileListResponse>;

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to load files');
      }

      set((state) => ({
        files: {
          ...state.files,
          [projectId]: result.data!.files,
        },
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load files',
        isLoading: false,
      });
    }
  },

  openFile: async (projectId, filePath) => {
    set({ isLoading: true, error: null });

    try {
      const basePath = get().activeBasePath;
      if (!basePath) {
        throw new Error('basePath is not set');
      }

      if (isElectron()) {
        const result = await readLocalFile(`${basePath}/${filePath}`);
        const file = get().files[projectId]?.find((item) => item.path === filePath);

        if (!file) {
          throw new Error(`File not found in workspace index: ${filePath}`);
        }

        set({
          openedFile: {
            file,
            content: result.content,
            encoding: result.encoding === 'utf-8' ? 'utf-8' : 'utf-8',
          },
          selectedFileId: file.id,
          isLoading: false,
        });
        return;
      }

      const result = await readWorkspaceFile(basePath, filePath.split('/')) as ApiResponse<FileContentResponse>;

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to open file');
      }

      set({
        openedFile: {
          file: result.data!.file,
          content: result.data!.content,
          encoding: (result.data!.encoding as 'utf-8') || 'utf-8',
        },
        selectedFileId: result.data!.file.id,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to open file',
        isLoading: false,
      });
    }
  },

  closeFile: () => {
    set({ openedFile: null });
  },

  selectFile: (fileId) => {
    set({ selectedFileId: fileId });
  },

  createFile: async (projectId, name, content = '') => {
    set({ isLoading: true, error: null });

    try {
      const basePath = get().activeBasePath;
      if (!basePath) {
        throw new Error('basePath is not set');
      }

      if (isElectron()) {
        await writeLocalFile(`${basePath}/${name}`, content);
        await get().loadFiles(projectId);
        const created = get().files[projectId]?.find((item) => item.path === name);
        if (!created) {
          throw new Error(`Created file not found: ${name}`);
        }
        set({ isLoading: false });
        return created;
      }

      const result = await writeWorkspaceFile(basePath, name.split('/'), content) as ApiResponse<ProjectFile>;

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to create file');
      }

      // Reload files list
      await get().loadFiles(projectId);

      set({ isLoading: false });
      return result.data!;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create file',
        isLoading: false,
      });
      throw error;
    }
  },

  saveFile: async (projectId, filePath, content) => {
    set({ isLoading: true, error: null });

    try {
      const basePath = get().activeBasePath;
      if (!basePath) {
        throw new Error('basePath is not set');
      }

      if (isElectron()) {
        await writeLocalFile(`${basePath}/${filePath}`, content);

        const state = get();
        if (state.openedFile && state.openedFile.file.path === filePath) {
          set({
            openedFile: {
              file: state.openedFile.file,
              content,
              encoding: 'utf-8',
            },
          });
        }

        await get().loadFiles(projectId);
        set({ isLoading: false });
        return;
      }

      const result = await writeWorkspaceFile(basePath, filePath.split('/'), content) as ApiResponse<ProjectFile>;

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to save file');
      }

      // Update opened file if it's the same file
      const state = get();
      if (state.openedFile && state.openedFile.file.path === filePath) {
        set({
          openedFile: {
            file: {
              ...state.openedFile.file,
              ...result.data!,
            },
            content,
            encoding: 'utf-8',
          },
        });
      }

      // Reload files list to update modified time
      await get().loadFiles(projectId);

      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save file',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteFile: async (projectId, filePath) => {
    set({ isLoading: true, error: null });

    try {
      const basePath = get().activeBasePath;
      if (!basePath) {
        throw new Error('basePath is not set');
      }

      if (isElectron()) {
        await deleteLocalFile(`${basePath}/${filePath}`);

        const state = get();
        if (state.openedFile && state.openedFile.file.path === filePath) {
          set({ openedFile: null, selectedFileId: null });
        }

        await get().loadFiles(projectId);
        set({ isLoading: false });
        return;
      }

      const result = await deleteWorkspaceFile(basePath, filePath.split('/')) as ApiResponse<{ deleted: boolean }>;

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete file');
      }

      // Close opened file if it's the deleted file
      const state = get();
      if (state.openedFile && state.openedFile.file.path === filePath) {
        set({ openedFile: null, selectedFileId: null });
      }

      // Reload files list
      await get().loadFiles(projectId);

      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete file',
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
