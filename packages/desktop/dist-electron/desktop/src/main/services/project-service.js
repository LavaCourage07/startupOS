"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const ipc_protocol_1 = require("../ipc-protocol");
const project_creation_1 = require("../../../../core/src/types/project-creation");
const project_service_real_1 = require("../../../../core/src/lib/features/services/project-service-real");
const project_creation_service_1 = require("../../../../core/src/lib/features/project/project-creation-service");
const paths_1 = require("../../../../core/src/lib/paths");
const registry_1 = require("../../../../core/src/lib/features/services/launcher/registry");
const PROJECT_DEFAULT_SKILLS = [
    'domain-discovery',
    'business-refinement',
    'model-review',
    'solution-design',
    'project-skill-creator',
    'agent-creator',
];
function inferFieldType(value) {
    if (typeof value === 'string')
        return 'string';
    if (typeof value === 'number')
        return 'number';
    if (typeof value === 'boolean')
        return 'boolean';
    if (Array.isArray(value))
        return 'array';
    if (typeof value === 'object' && value !== null)
        return 'object';
    return 'string';
}
class ProjectService {
    constructor() {
        this.registerHandlers();
    }
    broadcastProjectUpdated(projectId, project) {
        const payload = {
            type: 'project_updated',
            projectId,
            project,
        };
        for (const window of electron_1.BrowserWindow.getAllWindows()) {
            if (!window.isDestroyed()) {
                window.webContents.send(ipc_protocol_1.IPC_CHANNELS.PROJECT_EVENT, payload);
            }
        }
    }
    async copySkillDirectory(projectDir, skillName) {
        const skillsDir = path_1.default.join((0, paths_1.getMonorepoRoot)(), 'skills');
        const srcDir = path_1.default.join(skillsDir, skillName);
        const dstDir = path_1.default.join(projectDir, 'skills', skillName);
        const srcSkillMd = path_1.default.join(srcDir, 'SKILL.md');
        const dstSkillMd = path_1.default.join(dstDir, 'SKILL.md');
        if (!(0, fs_1.existsSync)(srcSkillMd)) {
            return 'missing';
        }
        if ((0, fs_1.existsSync)(dstSkillMd)) {
            return 'existing';
        }
        await promises_1.default.mkdir(dstDir, { recursive: true });
        await promises_1.default.copyFile(srcSkillMd, dstSkillMd);
        for (const entry of ['references', 'agents', 'assets', 'scripts']) {
            const srcEntry = path_1.default.join(srcDir, entry);
            if (!(0, fs_1.existsSync)(srcEntry)) {
                continue;
            }
            await promises_1.default.cp(srcEntry, path_1.default.join(dstDir, entry), { recursive: true });
        }
        return 'created';
    }
    async initializeProjectWorkspace(projectId) {
        const projectDir = path_1.default.join((0, paths_1.getDataRoot)(), 'projects', projectId);
        const templateDir = path_1.default.join((0, paths_1.getMonorepoRoot)(), 'templates', 'project-interview');
        const createdFiles = [];
        await promises_1.default.mkdir(projectDir, { recursive: true });
        const templateFiles = ['Agent.md', 'Tool.md', 'Taste.md', 'MEMORY.md', 'Knowledge.md', 'Patterns.md'];
        for (const fileName of templateFiles) {
            const targetPath = path_1.default.join(projectDir, fileName);
            if ((0, fs_1.existsSync)(targetPath)) {
                createdFiles.push(`${fileName} (existing)`);
                continue;
            }
            const templatePath = path_1.default.join(templateDir, fileName);
            if (!(0, fs_1.existsSync)(templatePath)) {
                continue;
            }
            await promises_1.default.copyFile(templatePath, targetPath);
            createdFiles.push(`${fileName} (created)`);
        }
        for (const dirName of ['output', 'sessions', 'skills']) {
            await promises_1.default.mkdir(path_1.default.join(projectDir, dirName), { recursive: true });
            createdFiles.push(`${dirName}/ (created)`);
        }
        for (const skillName of PROJECT_DEFAULT_SKILLS) {
            const result = await this.copySkillDirectory(projectDir, skillName);
            if (result !== 'missing') {
                createdFiles.push(`skills/${skillName}/SKILL.md (${result})`);
            }
        }
        return createdFiles;
    }
    async syncBusinessModelToOntology(projectId) {
        const projectDir = path_1.default.join((0, paths_1.getDataRoot)(), 'projects', projectId);
        const businessModelPath = path_1.default.join(projectDir, 'output', 'business-model.json');
        if (!(0, fs_1.existsSync)(businessModelPath)) {
            throw new Error(`business-model.json not found for project ${projectId}`);
        }
        const content = await promises_1.default.readFile(businessModelPath, 'utf-8');
        const businessModel = JSON.parse(content);
        const ontologyId = `ontology-${projectId}`;
        const domainId = 'domain_main';
        const now = new Date().toISOString();
        const concepts = [];
        const nameToConceptId = new Map();
        if (Array.isArray(businessModel.entities)) {
            for (let i = 0; i < businessModel.entities.length; i++) {
                const entity = businessModel.entities[i];
                const conceptId = `concept_${i}`;
                if (typeof entity === 'string') {
                    concepts.push({ id: conceptId, domainId, name: entity, type: 'entity', description: '' });
                    nameToConceptId.set(entity, conceptId);
                    continue;
                }
                const name = entity?.name || entity?.label || `实体${i}`;
                const attributes = {};
                if (entity?.properties && typeof entity.properties === 'object') {
                    for (const [key, value] of Object.entries(entity.properties)) {
                        attributes[key] = {
                            type: inferFieldType(value),
                            description: typeof value === 'string' ? value : undefined,
                        };
                    }
                }
                concepts.push({
                    id: conceptId,
                    domainId,
                    name,
                    type: 'entity',
                    description: entity?.definition || entity?.description || '',
                    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
                });
                nameToConceptId.set(name, conceptId);
                if (entity?.name)
                    nameToConceptId.set(entity.name, conceptId);
                if (entity?.label)
                    nameToConceptId.set(entity.label, conceptId);
            }
        }
        const relations = [];
        if (Array.isArray(businessModel.relationships)) {
            for (let i = 0; i < businessModel.relationships.length; i++) {
                const relationship = businessModel.relationships[i];
                let from;
                let to;
                let relationType = 'related_to';
                let cardinality = 'N:M';
                if (typeof relationship === 'string') {
                    const parts = relationship.split('→').map((part) => part.trim()).filter(Boolean);
                    from = parts[0];
                    to = parts[1];
                }
                else {
                    from = relationship?.from;
                    to = relationship?.to;
                    relationType = relationship?.type || relationType;
                    cardinality = relationship?.cardinality || cardinality;
                }
                const sourceId = from ? nameToConceptId.get(from) : undefined;
                const targetId = to ? nameToConceptId.get(to) : undefined;
                if (sourceId && targetId) {
                    relations.push({
                        id: `rel_${i}`,
                        sourceId,
                        targetId,
                        type: relationType,
                        cardinality,
                    });
                }
            }
        }
        const ontologyDir = path_1.default.join(projectDir, 'ontology');
        await promises_1.default.mkdir(ontologyDir, { recursive: true });
        const ontologyPath = path_1.default.join(ontologyDir, 'ontology.json');
        const ontologyData = {
            version: '1.0.0',
            projectId,
            ontologyId,
            domains: [{
                    id: domainId,
                    name: businessModel.projectName || '主域',
                    description: businessModel.background || businessModel.description || '',
                    confidence: 0.8,
                }],
            concepts,
            instances: [],
            relations,
            metadata: {
                synced_from: 'business-model.json',
                synced_at: now,
                runtime: 'electron-ipc',
            },
            createdAt: now,
            updatedAt: now,
        };
        await promises_1.default.writeFile(ontologyPath, JSON.stringify(ontologyData, null, 2), 'utf-8');
        for (const concept of concepts) {
            const conceptDataDir = path_1.default.join(ontologyDir, 'data', domainId, concept.id);
            await promises_1.default.mkdir(conceptDataDir, { recursive: true });
            const indexPath = path_1.default.join(conceptDataDir, '_index.json');
            if (!(0, fs_1.existsSync)(indexPath)) {
                await promises_1.default.writeFile(indexPath, JSON.stringify({ instanceIds: [] }, null, 2), 'utf-8');
            }
        }
        const instanceRelationsPath = path_1.default.join(ontologyDir, 'instance-relations.json');
        if (!(0, fs_1.existsSync)(instanceRelationsPath)) {
            await promises_1.default.writeFile(instanceRelationsPath, JSON.stringify({ relations: [] }, null, 2), 'utf-8');
        }
        return {
            ontologyId,
            ontologyPath,
            conceptsCount: concepts.length,
            relationsCount: relations.length,
        };
    }
    registerHandlers() {
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_LIST, async (_event, query = {}) => {
            try {
                const projects = await project_service_real_1.projectService.listProjects(query);
                return {
                    success: true,
                    data: projects,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] List projects failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_GET, async (_event, projectId) => {
            try {
                const project = await project_service_real_1.projectService.getProject(projectId);
                if (!project) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Project not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: project,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Get project failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_CREATE, async (_event, request) => {
            try {
                if (!request.name || typeof request.name !== 'string' || request.name.trim().length === 0) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'Project name is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                if (!request.domain || typeof request.domain !== 'string') {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'Project domain is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const project = await project_service_real_1.projectService.createProject(request);
                return {
                    success: true,
                    data: project,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Create project failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_UPDATE, async (_event, projectId, updates) => {
            try {
                const project = await project_service_real_1.projectService.updateProject(projectId, updates);
                if (!project) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Project not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                this.broadcastProjectUpdated(projectId, project);
                return {
                    success: true,
                    data: project,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Update project failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_DELETE, async (_event, projectId) => {
            try {
                const deleted = await project_service_real_1.projectService.deleteProject(projectId);
                if (!deleted) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Project not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: { deleted: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Delete project failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_ARTIFACT_GET, async (_event, request) => {
            try {
                const { readFileSync, existsSync } = require('fs');
                const { join } = require('path');
                const baseDir = join((0, paths_1.getDataRoot)(), 'projects', request.projectId, 'output');
                const fileMap = {
                    'business-model': 'business-model.json',
                    'interview-markdown': 'interview-progress.md',
                };
                const filename = fileMap[request.artifactType] || `${request.artifactType}.json`;
                const filePath = join(baseDir, filename);
                console.log('[ProjectService] artifact:get request', {
                    projectId: request.projectId,
                    artifactType: request.artifactType,
                    baseDir,
                    filePath,
                    exists: existsSync(filePath),
                });
                if (!existsSync(filePath)) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: `Artifact not found: ${request.artifactType}` },
                        timestamp: new Date().toISOString(),
                    };
                }
                const content = readFileSync(filePath, 'utf-8');
                const data = request.artifactType === 'interview-markdown'
                    ? { content }
                    : JSON.parse(content);
                console.log('[ProjectService] artifact:get result', {
                    projectId: request.projectId,
                    artifactType: request.artifactType,
                    bytes: content.length,
                    hasData: Boolean(data),
                });
                return {
                    success: true,
                    data,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Get artifact failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_INITIALIZE, async (_event, request) => {
            try {
                const files = await this.initializeProjectWorkspace(request.projectId);
                return {
                    success: true,
                    data: {
                        initialized: true,
                        projectId: request.projectId,
                        files,
                    },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Initialize project failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_SYNC_ONTOLOGY, async (_event, request) => {
            try {
                const result = await this.syncBusinessModelToOntology(request.projectId);
                const project = await project_service_real_1.projectService.updateProject(request.projectId, {
                    ontologyId: result.ontologyId,
                });
                if (project) {
                    this.broadcastProjectUpdated(request.projectId, project);
                }
                console.log('[ProjectService] sync ontology completed', {
                    projectId: request.projectId,
                    ...result,
                });
                return {
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Sync ontology failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_SOLUTION_INITIALIZE, async (_event, request) => {
            try {
                const projectId = request.projectId;
                const projectDir = path_1.default.join((0, paths_1.getDataRoot)(), 'projects', projectId);
                if (!(0, fs_1.existsSync)(projectDir)) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: `Project ${projectId} not found` },
                        timestamp: new Date().toISOString(),
                    };
                }
                // Copy skills to project directory (same as web API route)
                const copySkill = async (name) => {
                    await this.copySkillDirectory(projectDir, name);
                };
                await copySkill('solution-design');
                await copySkill('project-skill-creator');
                await copySkill('role-agent-creator');
                await copySkill('agent-creator');
                // Create solutions/ directory
                await promises_1.default.mkdir(path_1.default.join(projectDir, 'solutions'), { recursive: true });
                // Launch via SkillLauncher
                const result = await (0, registry_1.launch)({
                    entryType: 'skill',
                    entryId: 'solution-design',
                    agentBaseDir: projectDir,
                    projectId,
                });
                if (!result.success) {
                    return {
                        success: false,
                        error: { code: 'LAUNCH_FAILED', message: result.error || 'Failed to launch skill' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: { sessionId: result.sessionId, projectDir },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Initialize solution failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_SOLUTION_LIST, async (_event, request) => {
            try {
                const solutionsDir = path_1.default.join((0, paths_1.getDataRoot)(), 'projects', request.projectId, 'solutions');
                if (!(0, fs_1.existsSync)(solutionsDir)) {
                    return { success: true, data: [], timestamp: new Date().toISOString() };
                }
                const entries = await promises_1.default.readdir(solutionsDir, { withFileTypes: true });
                const solutions = [];
                // Scan version folders (new format)
                for (const entry of entries) {
                    if (!entry.isDirectory())
                        continue;
                    const versionDir = path_1.default.join(solutionsDir, entry.name);
                    const manifestPath = path_1.default.join(versionDir, 'manifest.json');
                    const agentsPath = path_1.default.join(versionDir, 'agents.json');
                    if (!(0, fs_1.existsSync)(manifestPath))
                        continue;
                    try {
                        const manifestContent = await promises_1.default.readFile(manifestPath, 'utf-8');
                        const manifest = JSON.parse(manifestContent);
                        let agentCount = 0;
                        if ((0, fs_1.existsSync)(agentsPath)) {
                            const agentsContent = await promises_1.default.readFile(agentsPath, 'utf-8');
                            const agentsData = JSON.parse(agentsContent);
                            agentCount = Array.isArray(agentsData?.agents) ? agentsData.agents.length : 0;
                        }
                        const version = manifest.solutionVersion || entry.name;
                        const modelDim = manifest.modeling?.dimension || 'task';
                        solutions.push({
                            id: version,
                            projectId: request.projectId,
                            name: `方案 ${version}`,
                            version,
                            status: manifest.status || 'draft',
                            modelingDimension: modelDim,
                            agentCount,
                            createdAt: manifest.createdAt ? new Date(manifest.createdAt).getTime() : 0,
                            updatedAt: manifest.updatedAt ? new Date(manifest.updatedAt).getTime() : 0,
                        });
                    }
                    catch {
                        // Skip malformed
                    }
                }
                // Also scan legacy single-file format
                for (const entry of entries) {
                    if (!entry.isFile() || !entry.name.startsWith('solution-v') || !entry.name.endsWith('.json'))
                        continue;
                    if (entry.name.includes('-manifest') || entry.name.includes('-incomplete') || entry.name.includes('-dataflow'))
                        continue;
                    const versionMatch = entry.name.match(/solution-(v[\d.]+)\.json/);
                    if (!versionMatch)
                        continue;
                    const version = versionMatch[1];
                    // Skip if already migrated (folder exists)
                    if (solutions.some((s) => s.version === version))
                        continue;
                    try {
                        const content = await promises_1.default.readFile(path_1.default.join(solutionsDir, entry.name), 'utf-8');
                        const raw = JSON.parse(content);
                        const data = raw.data || raw;
                        const agents = data.agents || [];
                        solutions.push({
                            id: version,
                            projectId: request.projectId,
                            name: `方案 ${version}`,
                            version,
                            status: data.status || 'draft',
                            modelingDimension: data.modeling?.dimension || data.modelingDimension || 'task',
                            agentCount: Array.isArray(agents) ? agents.length : 0,
                            createdAt: data.createdAt ?? 0,
                            updatedAt: data.updatedAt ?? 0,
                        });
                    }
                    catch {
                        // Skip malformed
                    }
                }
                solutions.sort((a, b) => b.createdAt - a.createdAt);
                return {
                    success: true,
                    data: solutions,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] List solutions failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_SOLUTION_GET, async (_event, request) => {
            try {
                const solutionsDir = path_1.default.join((0, paths_1.getDataRoot)(), 'projects', request.projectId, 'solutions');
                // Try new folder format first
                const versionDir = path_1.default.join(solutionsDir, request.version);
                const manifestPath = path_1.default.join(versionDir, 'manifest.json');
                const agentsPath = path_1.default.join(versionDir, 'agents.json');
                const skillsPath = path_1.default.join(versionDir, 'skills.json');
                if ((0, fs_1.existsSync)(manifestPath)) {
                    const [manifest, agentsData, skillsData] = await Promise.all([
                        promises_1.default.readFile(manifestPath, 'utf-8').then((c) => JSON.parse(c)),
                        (0, fs_1.existsSync)(agentsPath)
                            ? promises_1.default.readFile(agentsPath, 'utf-8').then((c) => JSON.parse(c)).then((d) => d.agents || [])
                            : Promise.resolve([]),
                        (0, fs_1.existsSync)(skillsPath)
                            ? promises_1.default.readFile(skillsPath, 'utf-8').then((c) => JSON.parse(c)).then((d) => d.skills || [])
                            : Promise.resolve([]),
                    ]);
                    return {
                        success: true,
                        data: {
                            manifest,
                            agents: agentsData,
                            skills: skillsData,
                            solutionVersion: request.version,
                        },
                        timestamp: new Date().toISOString(),
                    };
                }
                // Fallback: legacy single-file format
                const legacyFile = path_1.default.join(solutionsDir, `solution-${request.version}.json`);
                if ((0, fs_1.existsSync)(legacyFile)) {
                    const content = await promises_1.default.readFile(legacyFile, 'utf-8');
                    const raw = JSON.parse(content);
                    const data = raw.data || raw;
                    return {
                        success: true,
                        data: {
                            manifest: {
                                status: data.status,
                                solutionVersion: data.solutionVersion || request.version,
                                modeling: data.modeling,
                                executionMode: data.executionMode,
                                changesFromPrevious: data.changesFromPrevious,
                            },
                            agents: data.agents || [],
                            skills: Array.isArray(data.skills) ? data.skills : [],
                            solutionVersion: request.version,
                        },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: false,
                    error: { code: 'NOT_FOUND', message: `Solution not found: ${request.version}` },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Get solution failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_EXPORT, async (_event, request) => {
            try {
                const project = await project_service_real_1.projectService.getProject(request.projectId);
                if (!project) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Project not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: JSON.stringify(project, null, 2),
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Export project failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_IMPORT, async (_event, request) => {
            try {
                if (!request.exportJson || typeof request.exportJson !== 'string') {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'exportJson is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const project = await project_service_real_1.projectService.importProject(request.exportJson, {
                    overwrite: request.overwrite || false,
                    newId: request.newId || false,
                });
                return {
                    success: true,
                    data: project,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Import project failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_CREATION_START, async (_event, request) => {
            try {
                const { session, question } = await project_creation_service_1.projectCreationService.startSession(request);
                return {
                    success: true,
                    data: {
                        sessionId: session.sessionId,
                        projectId: session.projectId,
                        currentStep: 1,
                        question,
                        progress: {
                            current: session.currentStep,
                            total: session.maxSteps,
                            percentage: 25,
                        },
                    },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Start project creation failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_CREATION_ANSWER, async (_event, request) => {
            try {
                const { session, nextQuestion } = await project_creation_service_1.projectCreationService.submitAnswer(request.sessionId, request);
                return {
                    success: true,
                    data: {
                        sessionId: session.sessionId,
                        step: request.step,
                        saved: true,
                        nextStep: session.currentStep > request.step ? session.currentStep : null,
                        nextQuestion: nextQuestion ?? undefined,
                        progress: {
                            current: session.currentStep,
                            total: session.maxSteps,
                            percentage: (0, project_creation_1.calculateProgress)(session.currentStep, session.maxSteps),
                        },
                    },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Submit project creation answer failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.PROJECT_CREATION_COMPLETE, async (_event, request) => {
            try {
                const result = await project_creation_service_1.projectCreationService.completeCreation(request.sessionId, request);
                return {
                    success: true,
                    data: {
                        success: true,
                        project: result.project,
                        taste: {
                            generated: true,
                            confidence: result.taste.metadata.confidence,
                        },
                        ontology: {
                            generated: true,
                            domainCount: result.ontology.domains,
                        },
                    },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[ProjectService] Complete project creation failed');
            }
        });
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
exports.ProjectService = ProjectService;
