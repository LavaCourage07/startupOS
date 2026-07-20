"use strict";
/**
 * Project Service - real implementation for server-side
 *
 * Provides CRUD operations for projects using file system storage
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectService = void 0;
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const paths_1 = require("../../paths");
const TEMPLATES_DIR = (0, paths_1.getTemplatesDir)();
// ============================================================================
// Configuration
// ============================================================================
const DATA_DIR = path_1.default.join((0, paths_1.getDataRoot)(), 'projects');
const FILES_DIR = 'files';
// ============================================================================
// Helpers
// ============================================================================
async function ensureDataDir() {
    if (!(0, fs_1.existsSync)(DATA_DIR)) {
        await (0, promises_1.mkdir)(DATA_DIR, { recursive: true });
    }
}
function getProjectPath(projectId) {
    return path_1.default.join(DATA_DIR, `${projectId}.json`);
}
function getProjectDirPath(projectId) {
    return path_1.default.join(DATA_DIR, projectId, 'project.json');
}
function getProjectFilesPath(projectId) {
    return path_1.default.join(DATA_DIR, projectId, FILES_DIR);
}
function generateProjectId() {
    return `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
function generateRandomColor() {
    const colors = [
        'from-blue-500', 'from-purple-500', 'from-green-500',
        'from-yellow-500', 'from-pink-500', 'from-indigo-500',
        'from-red-500', 'from-orange-500',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}
// ============================================================================
// Project Service
// ============================================================================
exports.projectService = {
    /**
     * Create a new project
     */
    async createProject(request) {
        await ensureDataDir();
        const projectId = generateProjectId();
        const now = Date.now();
        const project = {
            id: projectId,
            name: request.name,
            description: request.description || '',
            domain: request.domain,
            type: request.type || 'generic',
            ontologyId: request.ontologyId ?? '',
            createdAt: now,
            updatedAt: now,
            lastModified: now,
            userId: request.userId || 'current-user',
            status: request.status || 'active',
            color: request.color || generateRandomColor(),
            icon: request.icon,
            metadata: (request.metadata || {}),
        };
        // Create standard project directory structure
        const projectDir = path_1.default.join(DATA_DIR, projectId);
        await (0, promises_1.mkdir)(projectDir, { recursive: true });
        // Create subdirectories following architecture standards
        const subdirs = [
            'reference', // 参考文件和知识库
            'skills', // 项目技能
            'output', // Agent 输出文件
            'output/documents',
            'output/diagrams',
            'output/code',
            'sessions', // 会话历史
            'files', // 用户上传的文件
        ];
        for (const subdir of subdirs) {
            await (0, promises_1.mkdir)(path_1.default.join(projectDir, subdir), { recursive: true });
        }
        // Save project data to project.json in project directory
        await (0, promises_1.writeFile)(path_1.default.join(projectDir, 'project.json'), JSON.stringify(project, null, 2), 'utf-8');
        // Copy Agent.md, Tool.md, MEMORY.md, and taste.md from templates (only if templates exist)
        for (const templateFile of ['Agent.md', 'Tool.md', 'MEMORY.md', 'taste.md']) {
            const src = path_1.default.join(TEMPLATES_DIR, templateFile);
            const dest = path_1.default.join(projectDir, templateFile);
            try {
                await (0, promises_1.access)(src);
                await (0, promises_1.copyFile)(src, dest);
            }
            catch {
                // Template doesn't exist, skip
            }
        }
        return project;
    },
    /**
     * Get a project by ID
     */
    async getProject(projectId) {
        // Check flat file first, then subdirectory layout
        const flatPath = getProjectPath(projectId);
        const dirPath = getProjectDirPath(projectId);
        const projectPath = (0, fs_1.existsSync)(flatPath) ? flatPath : (0, fs_1.existsSync)(dirPath) ? dirPath : null;
        if (!projectPath)
            return null;
        try {
            const content = await (0, promises_1.readFile)(projectPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            console.error('Error reading project:', error);
            return null;
        }
    },
    /**
     * Update a project
     */
    async updateProject(projectId, updates) {
        const project = await this.getProject(projectId);
        if (!project) {
            return null;
        }
        const updatedProject = {
            ...project,
            ...updates,
            updatedAt: Date.now(),
            lastModified: Date.now(),
        };
        // Save to project directory (new structure)
        const dirPath = path_1.default.join(DATA_DIR, projectId, 'project.json');
        if ((0, fs_1.existsSync)(dirPath)) {
            await (0, promises_1.writeFile)(dirPath, JSON.stringify(updatedProject, null, 2), 'utf-8');
        }
        else {
            // Fallback to flat file (old structure)
            await (0, promises_1.writeFile)(getProjectPath(projectId), JSON.stringify(updatedProject, null, 2), 'utf-8');
        }
        return updatedProject;
    },
    /**
     * Delete a project
     */
    async deleteProject(projectId) {
        // Check both flat file and subdirectory layouts
        const flatPath = getProjectPath(projectId);
        const dirPath = path_1.default.join(DATA_DIR, projectId);
        const isDirectory = (0, fs_1.existsSync)(dirPath) && !(0, fs_1.existsSync)(flatPath);
        const isFlatFile = (0, fs_1.existsSync)(flatPath);
        if (!isDirectory && !isFlatFile) {
            return false;
        }
        try {
            if (isDirectory) {
                // Delete entire project directory
                await (0, promises_1.rm)(dirPath, { recursive: true, force: true });
            }
            else {
                // Delete flat file
                await (0, promises_1.unlink)(flatPath);
                // Clean up files directory if exists (old structure)
                const filesDir = getProjectFilesPath(projectId);
                if ((0, fs_1.existsSync)(filesDir)) {
                    await (0, promises_1.rm)(filesDir, { recursive: true, force: true });
                }
            }
            return true;
        }
        catch (error) {
            console.error('Error deleting project:', error);
            return false;
        }
    },
    /**
     * List projects with filtering
     */
    async listProjects(query = {}) {
        await ensureDataDir();
        try {
            const entries = await (0, promises_1.readdir)(DATA_DIR, { withFileTypes: true });
            // Collect all project JSON paths: flat files + subdirectory project.json
            const projectPaths = [];
            for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith('.json')) {
                    projectPaths.push(path_1.default.join(DATA_DIR, entry.name));
                }
                else if (entry.isDirectory()) {
                    const dirProjectJson = path_1.default.join(DATA_DIR, entry.name, 'project.json');
                    if ((0, fs_1.existsSync)(dirProjectJson)) {
                        projectPaths.push(dirProjectJson);
                    }
                }
            }
            const projects = [];
            for (const projectPath of projectPaths) {
                const content = await (0, promises_1.readFile)(projectPath, 'utf-8');
                const project = JSON.parse(content);
                // Skip malformed project files (missing id or name)
                if (!project.id || typeof project.id !== 'string')
                    continue;
                if (!project.name || typeof project.name !== 'string')
                    continue;
                // Apply filters
                if (query.status && project.status !== query.status) {
                    continue;
                }
                if (query.userId && project.userId !== query.userId) {
                    continue;
                }
                if (query.domain && !project.domain.includes(query.domain)) {
                    continue;
                }
                // Calculate ontology size from business-model.json
                let ontologySize = 0;
                const businessModelPath = path_1.default.join(DATA_DIR, project.id, 'output', 'business-model.json');
                if ((0, fs_1.existsSync)(businessModelPath)) {
                    try {
                        const content = await (0, promises_1.readFile)(businessModelPath, 'utf-8');
                        const businessModel = JSON.parse(content);
                        ontologySize = businessModel.entities?.length || 0;
                    }
                    catch {
                        // Ignore errors, keep ontologySize as 0
                    }
                }
                // Check if solution manifest exists
                let hasSolution = false;
                const solutionsDir = path_1.default.join(DATA_DIR, project.id, 'solutions');
                if ((0, fs_1.existsSync)(solutionsDir)) {
                    try {
                        const solutionEntries = await (0, promises_1.readdir)(solutionsDir, { withFileTypes: true });
                        hasSolution = solutionEntries.some((e) => e.isDirectory() && e.name.match(/^v\d+\.\d+$/));
                    }
                    catch {
                        // Ignore errors
                    }
                }
                projects.push({
                    id: project.id,
                    name: project.name,
                    description: project.description,
                    domain: project.domain,
                    createdAt: project.createdAt,
                    lastModified: project.lastModified,
                    ontologySize,
                    ontologyId: project.ontologyId,
                    color: project.color,
                    status: project.status,
                    hasSolution,
                });
            }
            // Sort by last modified (newest first)
            projects.sort((a, b) => b.lastModified - a.lastModified);
            // Apply pagination
            const page = query.page || 1;
            const limit = query.limit || 20;
            const offset = (page - 1) * limit;
            return projects.slice(offset, offset + limit);
        }
        catch (error) {
            console.error('Error listing projects:', error);
            return [];
        }
    },
    /**
     * Export a project as JSON
     */
    async exportProject(projectId) {
        const project = await this.getProject(projectId);
        if (!project) {
            throw new Error('Project not found');
        }
        const exportData = {
            project,
            exportedAt: new Date().toISOString(),
            version: '1.0',
        };
        return JSON.stringify(exportData, null, 2);
    },
    /**
     * Import a project from JSON
     */
    async importProject(exportJson, options = {}) {
        const importData = JSON.parse(exportJson);
        if (!importData.project) {
            throw new Error('Invalid export format');
        }
        const originalProject = importData.project;
        const request = {
            name: originalProject.name,
            description: originalProject.description,
            domain: originalProject.domain,
            type: originalProject.type,
            userId: originalProject.userId || 'current-user',
            ontologyId: options.newId ? undefined : originalProject.ontologyId,
            status: originalProject.status,
            color: originalProject.color,
            icon: originalProject.icon,
            metadata: originalProject.metadata,
        };
        return this.createProject(request);
    },
    /**
     * Get project statistics
     */
    async getProjectStats(projectId) {
        const project = await this.getProject(projectId);
        if (!project) {
            return null;
        }
        const filesDir = getProjectFilesPath(projectId);
        let fileCount = 0;
        if ((0, fs_1.existsSync)(filesDir)) {
            try {
                const files = await (0, promises_1.readdir)(filesDir);
                fileCount = files.length;
            }
            catch {
                // Ignore
            }
        }
        // Calculate ontology size from business-model.json
        let ontologySize = 0;
        const businessModelPath = path_1.default.join(DATA_DIR, project.id, 'output', 'business-model.json');
        if ((0, fs_1.existsSync)(businessModelPath)) {
            try {
                const content = await (0, promises_1.readFile)(businessModelPath, 'utf-8');
                const businessModel = JSON.parse(content);
                ontologySize = businessModel.entities?.length || 0;
            }
            catch {
                // Ignore
            }
        }
        return {
            fileCount,
            lastModified: project.lastModified,
            ontologySize,
        };
    },
};
