"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceService = void 0;
const electron_1 = require("electron");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const ipc_protocol_1 = require("../ipc-protocol");
const paths_1 = require("../../../../core/src/lib/paths");
const skills_1 = require("../../../../core/src/lib/integrations/pi-agent/core/skills");
const upload_tracker_1 = require("../../../../core/src/lib/integrations/pi-agent/upload-tracker");
const ALLOWED_BASES = [
    (0, paths_1.getDataRoot)(),
    path_1.default.join((0, paths_1.getDataRoot)(), 'skills'),
    path_1.default.join((0, paths_1.getMonorepoRoot)(), 'skills'),
    path_1.default.join((0, paths_1.getMonorepoRoot)(), 'tmp'),
];
function assertAllowed(p) {
    let resolved;
    if (path_1.default.isAbsolute(p)) {
        resolved = p;
    }
    else if (p.startsWith('data' + path_1.default.sep) || p === 'data') {
        // Resolve relative data/ paths against getDataRoot() (respects DATA_ROOT env)
        const relativePart = p === 'data' ? '' : p.slice('data'.length + 1);
        resolved = path_1.default.join((0, paths_1.getDataRoot)(), relativePart);
    }
    else {
        resolved = path_1.default.join((0, paths_1.getMonorepoRoot)(), p);
    }
    const normalized = path_1.default.normalize(resolved);
    if (!ALLOWED_BASES.some(b => normalized.startsWith(b + path_1.default.sep) || normalized === b)) {
        throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
    }
}
const ENTRY_DIR_MAP = {
    'agent': (id) => path_1.default.join((0, paths_1.getDataRoot)(), 'agents', id),
    'role-agent': (id) => path_1.default.join((0, paths_1.getDataRoot)(), 'agents', id),
    'project': (id) => path_1.default.join((0, paths_1.getDataRoot)(), 'projects', id),
};
async function resolveProjectDir(entryId) {
    const projectsRoot = path_1.default.join((0, paths_1.getDataRoot)(), 'projects');
    const candidates = [
        entryId,
        entryId.startsWith('project-') ? entryId.slice('project-'.length) : null,
        `project-${entryId}`,
    ].filter((id) => Boolean(id));
    for (const candidate of [...new Set(candidates)]) {
        const baseDir = path_1.default.join(projectsRoot, candidate);
        try {
            const stats = await fs_1.promises.stat(baseDir);
            if (stats.isDirectory()) {
                return { baseDir, entryId: candidate, ontologyId: `ontology-${candidate}` };
            }
        }
        catch {
            // Try next compatibility candidate.
        }
    }
    const fallbackId = entryId.startsWith('project-') ? entryId.slice('project-'.length) : entryId;
    return {
        baseDir: path_1.default.join(projectsRoot, fallbackId),
        entryId: fallbackId,
        ontologyId: `ontology-${fallbackId}`,
    };
}
const MAX_UPLOAD_FILE_SIZE = 500 * 1024 * 1024; // 500MB
function decodeUploadContent(file) {
    if (file.encoding === 'base64') {
        if (typeof file.content !== 'string') {
            throw new Error(`Invalid upload payload for "${file.name}": base64 content must be a string`);
        }
        return Buffer.from(file.content, 'base64');
    }
    if (typeof file.content === 'string') {
        return Buffer.from(file.content, 'base64');
    }
    if (file.content instanceof ArrayBuffer) {
        return Buffer.from(file.content);
    }
    if (ArrayBuffer.isView(file.content)) {
        return Buffer.from(file.content.buffer, file.content.byteOffset, file.content.byteLength);
    }
    throw new Error(`Invalid upload payload for "${file.name}": unsupported content type ${Object.prototype.toString.call(file.content)}`);
}
class WorkspaceService {
    constructor() {
        this.registerHandlers();
    }
    registerHandlers() {
        // ── Workspace Resolve ─────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.WORKSPACE_RESOLVE, async (_event, request) => {
            try {
                console.log('[WorkspaceService] resolve request', request);
                if (!request.entryType || !request.entryId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'entryType and entryId are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                // Special handling for skills
                if (request.entryType === 'skill') {
                    const result = (0, skills_1.loadSkills)({ includeDefaults: true });
                    const skill = result.skills.find((s) => s.name === request.entryId || s.code === request.entryId);
                    if (!skill) {
                        return {
                            success: false,
                            error: { code: 'NOT_FOUND', message: `Skill "${request.entryId}" not found` },
                            timestamp: new Date().toISOString(),
                        };
                    }
                    // 技能工作区使用数据目录（可写），而不是 Resources 目录（只读）
                    const skillWorkspaceDir = path_1.default.join((0, paths_1.getDataRoot)(), 'skills', request.entryId);
                    console.log('[WorkspaceService] resolve skill result', {
                        entryId: request.entryId,
                        baseDir: skillWorkspaceDir,
                        sourceDir: skill.baseDir,
                    });
                    return {
                        success: true,
                        data: { baseDir: skillWorkspaceDir, entryType: request.entryType, entryId: request.entryId },
                        timestamp: new Date().toISOString(),
                    };
                }
                if (request.entryType === 'project') {
                    const resolved = await resolveProjectDir(request.entryId);
                    console.log('[WorkspaceService] resolve project result', {
                        requestedEntryId: request.entryId,
                        resolvedEntryId: resolved.entryId,
                        baseDir: resolved.baseDir,
                        ontologyId: resolved.ontologyId,
                    });
                    return {
                        success: true,
                        data: { ...resolved, entryType: request.entryType },
                        timestamp: new Date().toISOString(),
                    };
                }
                const resolver = ENTRY_DIR_MAP[request.entryType];
                if (!resolver) {
                    return {
                        success: false,
                        error: { code: 'INVALID_ENTRY_TYPE', message: `Unknown entryType: ${request.entryType}` },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: { baseDir: resolver(request.entryId), entryType: request.entryType, entryId: request.entryId },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[WorkspaceService] Resolve failed');
            }
        });
        // ── Workspace File List ───────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.WORKSPACE_FILE_LIST, async (_event, request) => {
            try {
                if (!request.basePath) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'basePath is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                assertAllowed(request.basePath);
                const files = await this.scanDir(request.basePath, request.basePath);
                files.sort((a, b) => b.modifiedAt - a.modifiedAt);
                return {
                    success: true,
                    data: { files, total: files.length },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                if (error.code === 'FORBIDDEN') {
                    return {
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'Access denied' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return this.toErrorResponse(error, '[WorkspaceService] File list failed');
            }
        });
        // ── Workspace File Read ───────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.WORKSPACE_FILE_READ, async (_event, request) => {
            try {
                if (!request.basePath || !request.filePath?.length) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'basePath and filePath are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const fullPath = this.resolveAndCheck(request.basePath, request.filePath);
                const stats = await fs_1.promises.stat(fullPath);
                const relPath = request.filePath.join('/');
                const content = await fs_1.promises.readFile(fullPath, 'utf-8');
                return {
                    success: true,
                    data: {
                        file: {
                            id: Buffer.from(relPath).toString('base64'),
                            projectId: request.basePath,
                            path: relPath,
                            name: path_1.default.basename(relPath),
                            size: Number(stats.size),
                            createdAt: Number(stats.birthtimeMs),
                            modifiedAt: Number(stats.mtimeMs),
                            type: 'file',
                            extension: path_1.default.extname(relPath).slice(1),
                        },
                        content,
                    },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                if (error.code === 'FORBIDDEN') {
                    return {
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'Access denied' },
                        timestamp: new Date().toISOString(),
                    };
                }
                if (error.code === 'ENOENT') {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'File not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return this.toErrorResponse(error, '[WorkspaceService] File read failed');
            }
        });
        // ── Workspace File Write ──────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.WORKSPACE_FILE_WRITE, async (_event, request) => {
            try {
                if (!request.basePath || !request.filePath?.length) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'basePath and filePath are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const fullPath = this.resolveAndCheck(request.basePath, request.filePath);
                await fs_1.promises.mkdir(path_1.default.dirname(fullPath), { recursive: true });
                await fs_1.promises.writeFile(fullPath, request.content, 'utf-8');
                const stats = await fs_1.promises.stat(fullPath);
                const relPath = request.filePath.join('/');
                return {
                    success: true,
                    data: {
                        id: Buffer.from(relPath).toString('base64'),
                        projectId: request.basePath,
                        path: relPath,
                        name: path_1.default.basename(relPath),
                        size: Number(stats.size),
                        createdAt: Number(stats.birthtimeMs),
                        modifiedAt: Number(stats.mtimeMs),
                        type: 'file',
                        extension: path_1.default.extname(relPath).slice(1),
                    },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                if (error.code === 'FORBIDDEN') {
                    return {
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'Access denied' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return this.toErrorResponse(error, '[WorkspaceService] File write failed');
            }
        });
        // ── Workspace File Delete ─────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.WORKSPACE_FILE_DELETE, async (_event, request) => {
            try {
                if (!request.basePath || !request.filePath?.length) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'basePath and filePath are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const fullPath = this.resolveAndCheck(request.basePath, request.filePath);
                await fs_1.promises.unlink(fullPath);
                return {
                    success: true,
                    data: { deleted: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                if (error.code === 'FORBIDDEN') {
                    return {
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'Access denied' },
                        timestamp: new Date().toISOString(),
                    };
                }
                if (error.code === 'ENOENT') {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'File not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return this.toErrorResponse(error, '[WorkspaceService] File delete failed');
            }
        });
        // ── Workspace File Upload ─────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.WORKSPACE_FILE_UPLOAD, async (_event, request) => {
            try {
                if (!request.basePath || !request.files?.length) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'basePath and files are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const resolvedBasePath = this.resolveAllowedBase(request.basePath);
                await fs_1.promises.mkdir(resolvedBasePath, { recursive: true });
                const uploadedFiles = [];
                for (const file of request.files) {
                    if (!file.name) {
                        return {
                            success: false,
                            error: { code: 'INVALID_REQUEST', message: 'file name is required' },
                            timestamp: new Date().toISOString(),
                        };
                    }
                    const buffer = decodeUploadContent(file);
                    if (buffer.length > MAX_UPLOAD_FILE_SIZE) {
                        return {
                            success: false,
                            error: { code: 'FILE_TOO_LARGE', message: `文件 "${file.name}" 超过 500MB 大小限制` },
                            timestamp: new Date().toISOString(),
                        };
                    }
                    const fullPath = this.resolveAndCheck(resolvedBasePath, [file.name]);
                    await fs_1.promises.mkdir(path_1.default.dirname(fullPath), { recursive: true });
                    await fs_1.promises.writeFile(fullPath, buffer);
                    uploadedFiles.push({
                        name: file.name,
                        path: path_1.default.relative(resolvedBasePath, fullPath),
                        size: buffer.length,
                    });
                }
                await (0, upload_tracker_1.recordUploads)(resolvedBasePath, uploadedFiles);
                return {
                    success: true,
                    data: { files: uploadedFiles },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                if (error.code === 'FORBIDDEN') {
                    return {
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'Access denied' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return this.toErrorResponse(error, '[WorkspaceService] File upload failed');
            }
        });
    }
    resolveAndCheck(basePath, segments) {
        const norm = this.resolveAllowedBase(basePath);
        const full = path_1.default.join(norm, ...segments);
        if (!path_1.default.normalize(full).startsWith(norm)) {
            throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
        }
        return full;
    }
    resolveAllowedBase(basePath) {
        let resolved;
        if (path_1.default.isAbsolute(basePath)) {
            resolved = basePath;
        }
        else if (basePath.startsWith('data' + path_1.default.sep) || basePath === 'data') {
            const relativePart = basePath === 'data' ? '' : basePath.slice('data'.length + 1);
            resolved = path_1.default.join((0, paths_1.getDataRoot)(), relativePart);
        }
        else {
            resolved = path_1.default.join((0, paths_1.getMonorepoRoot)(), basePath);
        }
        const norm = path_1.default.normalize(resolved);
        if (!ALLOWED_BASES.some(b => norm.startsWith(b + path_1.default.sep) || norm === b)) {
            throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
        }
        return norm;
    }
    async scanDir(dir, contextId, rel = '') {
        const files = [];
        try {
            const entries = await fs_1.promises.readdir(dir, { withFileTypes: true });
            for (const e of entries) {
                const full = path_1.default.join(dir, e.name);
                const relPath = rel ? `${rel}/${e.name}` : e.name;
                const stats = await fs_1.promises.stat(full);
                files.push({
                    id: Buffer.from(relPath).toString('base64'),
                    projectId: contextId,
                    path: relPath,
                    name: e.name,
                    size: e.isDirectory() ? 0 : stats.size,
                    createdAt: stats.birthtimeMs,
                    modifiedAt: stats.mtimeMs,
                    type: e.isDirectory() ? 'folder' : 'file',
                    extension: e.isFile() ? path_1.default.extname(e.name).slice(1) : undefined,
                    parentPath: rel || undefined,
                });
                if (e.isDirectory()) {
                    files.push(...await this.scanDir(full, contextId, relPath));
                }
            }
        }
        catch (e) {
            if (e.code !== 'ENOENT')
                throw e;
        }
        return files;
    }
    toErrorResponse(error, logMessage) {
        console.error(logMessage, error);
        return {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            timestamp: new Date().toISOString(),
        };
    }
}
exports.WorkspaceService = WorkspaceService;
