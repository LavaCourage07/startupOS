"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useWorkspace = void 0;
const zustand_1 = require("zustand");
const env_1 = require("../../lib/integrations/electron/env");
const local_fs_1 = require("../../lib/integrations/electron/local-fs");
function mapProjectFile(projectId, basePath, absolutePath, isDirectory, size, createdAt, modifiedAt) {
    const relativePath = absolutePath.startsWith(basePath)
        ? absolutePath.slice(basePath.length).replace(/^\/+/, '')
        : absolutePath;
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
/**
 * Workspace state management hook
 */
exports.useWorkspace = (0, zustand_1.create)((set, get) => ({
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
            if ((0, env_1.isElectron)()) {
                const entries = await (0, local_fs_1.listLocalFiles)(basePath);
                const files = entries.map((entry) => mapProjectFile(projectId, basePath, entry.path, entry.isDirectory, entry.size, entry.createdAt, entry.modifiedAt));
                set((state) => ({
                    files: {
                        ...state.files,
                        [projectId]: files,
                    },
                    isLoading: false,
                }));
                return;
            }
            const response = await fetch(`/api/workspace/files?basePath=${encodeURIComponent(basePath)}`);
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to load files');
            }
            set((state) => ({
                files: {
                    ...state.files,
                    [projectId]: result.data.files,
                },
                isLoading: false,
            }));
        }
        catch (error) {
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
            if ((0, env_1.isElectron)()) {
                const result = await (0, local_fs_1.readLocalFile)(`${basePath}/${filePath}`);
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
            const response = await fetch(`/api/workspace/files/${filePath}?basePath=${encodeURIComponent(basePath)}`);
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to open file');
            }
            set({
                openedFile: {
                    file: result.data.file,
                    content: result.data.content,
                    encoding: result.data.encoding || 'utf-8',
                },
                selectedFileId: result.data.file.id,
                isLoading: false,
            });
        }
        catch (error) {
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
            if ((0, env_1.isElectron)()) {
                await (0, local_fs_1.writeLocalFile)(`${basePath}/${name}`, content);
                await get().loadFiles(projectId);
                const created = get().files[projectId]?.find((item) => item.path === name);
                if (!created) {
                    throw new Error(`Created file not found: ${name}`);
                }
                set({ isLoading: false });
                return created;
            }
            const response = await fetch(`/api/workspace/files/${name}?basePath=${encodeURIComponent(basePath)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to create file');
            }
            // Reload files list
            await get().loadFiles(projectId);
            set({ isLoading: false });
            return result.data;
        }
        catch (error) {
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
            if ((0, env_1.isElectron)()) {
                await (0, local_fs_1.writeLocalFile)(`${basePath}/${filePath}`, content);
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
            const response = await fetch(`/api/workspace/files/${filePath}?basePath=${encodeURIComponent(basePath)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to save file');
            }
            // Update opened file if it's the same file
            const state = get();
            if (state.openedFile && state.openedFile.file.path === filePath) {
                set({
                    openedFile: {
                        file: result.data.file,
                        content: result.data.content,
                        encoding: result.data.encoding || 'utf-8',
                    },
                });
            }
            // Reload files list to update modified time
            await get().loadFiles(projectId);
            set({ isLoading: false });
        }
        catch (error) {
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
            if ((0, env_1.isElectron)()) {
                await (0, local_fs_1.deleteLocalFile)(`${basePath}/${filePath}`);
                const state = get();
                if (state.openedFile && state.openedFile.file.path === filePath) {
                    set({ openedFile: null, selectedFileId: null });
                }
                await get().loadFiles(projectId);
                set({ isLoading: false });
                return;
            }
            const response = await fetch(`/api/workspace/files/${filePath}?basePath=${encodeURIComponent(basePath)}`, {
                method: 'DELETE',
            });
            const result = await response.json();
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
        }
        catch (error) {
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
