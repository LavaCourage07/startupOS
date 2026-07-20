"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillServiceError = void 0;
exports.extractTextContent = extractTextContent;
exports.listSkills = listSkills;
exports.refreshSkills = refreshSkills;
exports.getSkillContent = getSkillContent;
exports.getSkillDetail = getSkillDetail;
exports.listSkillSessions = listSkillSessions;
exports.startSkillExecution = startSkillExecution;
exports.completeSkillExecution = completeSkillExecution;
exports.getSkillExecutionTimeline = getSkillExecutionTimeline;
exports.sendSkillExecutionMessage = sendSkillExecutionMessage;
exports.streamSkillExecutionMessage = streamSkillExecutionMessage;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const paths_1 = require("../../paths");
const session_service_1 = require("../agent/session-service");
const storage_1 = require("../ontology/storage");
const agent_manager_1 = require("../../integrations/pi-agent/agent-manager");
const handler_1 = require("./bundled/task-manager/handler");
const handler_2 = require("./bundled/info-query/handler");
const handler_3 = require("./bundled/ontology-editor/handler");
const skills_1 = require("../../integrations/pi-agent/core/skills");
const display_content_1 = require("../../integrations/pi-agent/display-content");
const stream_dedupe_1 = require("../../integrations/pi-agent/stream-dedupe");
function resolveSkillWorkingDirectory(skill) {
    const skillCode = skill.code ?? skill.name;
    const dir = skill.source === 'bundled'
        ? path_1.default.join((0, paths_1.getDataRoot)(), 'skills', skillCode)
        : skill.baseDir;
    if (!(0, fs_1.existsSync)(dir)) {
        (0, fs_1.mkdirSync)(dir, { recursive: true });
    }
    return dir;
}
function resolveOutputDirFromFrontmatter(outputDir) {
    if (path_1.default.isAbsolute(outputDir)) {
        return outputDir;
    }
    const normalized = outputDir.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+$/, '');
    if (normalized === 'data') {
        return (0, paths_1.getDataRoot)();
    }
    if (normalized.startsWith('data/')) {
        return path_1.default.join((0, paths_1.getDataRoot)(), normalized.slice('data/'.length));
    }
    return path_1.default.join((0, paths_1.getDataRoot)(), normalized);
}
/**
 * 解析技能的产物输出目录
 * - 有 frontmatter outputDir → 基于数据根目录解析相对路径
 *   - outputDir: data/ → getDataRoot()
 *   - outputDir: data/agents → getDataRoot()/agents
 * - 无 outputDir → 默认等于 workingDirectory
 */
function resolveSkillOutputDir(skill) {
    const workingDir = resolveSkillWorkingDirectory(skill);
    if (skill.outputDir) {
        return resolveOutputDirFromFrontmatter(skill.outputDir);
    }
    return workingDir;
}
class SkillServiceError extends Error {
    constructor(code, message, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'SkillServiceError';
    }
}
exports.SkillServiceError = SkillServiceError;
function toListItem(skill) {
    return {
        name: skill.name,
        code: skill.code,
        description: skill.description,
        source: skill.source,
        filePath: skill.filePath,
        baseDir: skill.baseDir,
        disableModelInvocation: skill.disableModelInvocation,
    };
}
function findSkill(name) {
    const result = (0, skills_1.loadSkills)({ includeDefaults: true });
    return result.skills.find((skill) => skill.code === name || skill.name === name);
}
function generateExecutionId(skillName) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `skill-${skillName}-${timestamp}-${random}`;
}
function generateEntityId(type) {
    const prefix = type.toLowerCase().substring(0, 4);
    const suffix = Math.random().toString(36).substring(2, 10);
    return `${prefix}_${suffix}`;
}
function getTimestamp() {
    return new Date().toISOString();
}
function extractMessage(data) {
    if (typeof data === 'string') {
        return data;
    }
    if (typeof data === 'object' && data !== null) {
        const obj = data;
        if (typeof obj['message'] === 'string') {
            return obj['message'];
        }
        if (typeof obj['content'] === 'string') {
            return obj['content'];
        }
        return JSON.stringify(data);
    }
    return String(data);
}
function extractTextContent(content) {
    return (0, display_content_1.extractDisplayContent)(content);
}
function createSkillContextTools() {
    return {
        createEntity: async (type, properties) => {
            const entityId = generateEntityId(type);
            const timestamp = getTimestamp();
            return storage_1.ontologyStorage.createEntity({
                id: entityId,
                type,
                properties,
                created: timestamp,
                updated: timestamp,
            });
        },
        updateEntity: async (entityId, properties) => {
            return storage_1.ontologyStorage.updateEntity(entityId, properties);
        },
        queryEntities: async (type, where) => {
            return storage_1.ontologyStorage.queryEntities(type, where);
        },
    };
}
function loadSkillHandler(skillName) {
    switch (skillName) {
        case 'task-manager':
            return {
                handler: handler_1.handle,
                displayName: '任务助手',
            };
        case 'info-query':
            return {
                handler: handler_2.handle,
                displayName: '信息查询',
            };
        case 'ontology-editor':
            return {
                handler: handler_3.handle,
                displayName: '知识图谱编辑',
            };
        default:
            return null;
    }
}
function resolveExecutionInput(request) {
    const { data, args, input } = request;
    if (typeof data === 'string' || typeof data === 'object') {
        return data;
    }
    if (typeof args === 'string' || typeof args === 'object') {
        return args;
    }
    if (typeof input === 'string') {
        return input;
    }
    if (input && typeof input === 'object') {
        if ('data' in input) {
            return input.data;
        }
        if ('input' in input) {
            return input.input;
        }
        return input;
    }
    return undefined;
}
function getMessageSkillName(session) {
    return String(session.messages.find((message) => message.metadata?.['skillName'])?.metadata?.['skillName'] ?? 'unknown');
}
function messagesToTimeline(messages) {
    const timeline = [];
    if (messages.length > 0) {
        timeline.push({
            type: 'start',
            timestamp: new Date(messages[0]?.timestamp ?? Date.now()).toISOString(),
            data: {
                status: 'running',
            },
        });
    }
    for (const message of messages) {
        if (message.toolResults && message.toolResults.length > 0) {
            for (const tool of message.toolResults) {
                timeline.push({
                    type: 'tool',
                    timestamp: new Date(message.timestamp).toISOString(),
                    data: {
                        toolName: tool.toolCallId || 'unknown',
                        toolResult: tool.result,
                    },
                });
            }
        }
        if (message.role === 'user' || message.role === 'assistant') {
            timeline.push({
                type: 'message',
                timestamp: new Date(message.timestamp).toISOString(),
                data: {
                    role: message.role,
                    content: typeof message.content === 'string' && message.content.length > 500
                        ? `${message.content.substring(0, 500)}...`
                        : message.content,
                },
            });
        }
        if (message.metadata?.['error']) {
            timeline.push({
                type: 'error',
                timestamp: new Date(message.timestamp).toISOString(),
                data: {
                    error: String(message.metadata['error']),
                },
            });
        }
        if (message.metadata?.['status'] === 'completed' || message.metadata?.['status'] === 'cancelled') {
            timeline.push({
                type: 'end',
                timestamp: new Date(message.timestamp).toISOString(),
                data: {
                    status: message.metadata['status'],
                },
            });
        }
    }
    return timeline;
}
function listSkills(request = {}) {
    const { source, includeInvisible = false, includeDiagnostics = true, } = request;
    const result = (0, skills_1.loadSkills)({ includeDefaults: true });
    let skills = result.skills;
    if (source) {
        skills = skills.filter((skill) => skill.source === source);
    }
    if (!includeInvisible) {
        skills = skills.filter((skill) => !skill.disableModelInvocation);
    }
    return {
        skills: skills.map(toListItem),
        diagnostics: includeDiagnostics ? result.diagnostics : [],
    };
}
function refreshSkills() {
    const result = (0, skills_1.loadSkills)({ includeDefaults: true });
    return {
        skills: result.skills.map(toListItem),
        diagnostics: result.diagnostics,
    };
}
function getSkillContent(request) {
    const skill = findSkill(request.name);
    if (!skill) {
        throw new SkillServiceError('NOT_FOUND', `Skill "${request.name}" not found`, 404);
    }
    const content = (0, fs_1.readFileSync)(skill.filePath, 'utf-8');
    const workingDir = resolveSkillWorkingDirectory(skill);
    const outputDir = resolveSkillOutputDir(skill);
    const response = {
        content,
        baseDir: skill.baseDir,
        workingDir,
        outputDir,
    };
    if (request.includeFrontmatter) {
        response.frontmatter = (0, skills_1.parseFrontmatter)(content).frontmatter;
    }
    return response;
}
function getSkillDetail(request) {
    const skill = findSkill(request.name);
    if (!skill) {
        throw new SkillServiceError('NOT_FOUND', `Skill "${request.name}" not found`, 404);
    }
    if (skill.disableModelInvocation && request.includeInvisible === false) {
        throw new SkillServiceError('DISABLED', `Skill "${request.name}" has disableModelInvocation enabled`, 403);
    }
    const { frontmatter, body } = (0, skills_1.loadSkillContent)(skill);
    return {
        name: skill.name,
        description: skill.description,
        source: skill.source,
        filePath: skill.filePath,
        baseDir: skill.baseDir,
        disableModelInvocation: skill.disableModelInvocation,
        content: body,
        frontmatter,
    };
}
async function listSkillSessions(request) {
    if (!request.skillName) {
        throw new SkillServiceError('INVALID_REQUEST', 'skillName is required', 400);
    }
    const sessions = await session_service_1.agentSessionService.listSessions(`skill-${request.skillName}`);
    return {
        sessions,
        count: sessions.length,
    };
}
async function startSkillExecution(request) {
    const skillName = request.skillName;
    if (!skillName) {
        throw new SkillServiceError('INVALID_REQUEST', 'skillName is required', 400);
    }
    const skill = findSkill(skillName);
    if (!skill) {
        throw new SkillServiceError('NOT_FOUND', `Skill "${skillName}" not found`, 404);
    }
    const loadedSkill = loadSkillHandler(skillName);
    if (!loadedSkill) {
        throw new SkillServiceError('NOT_FOUND', `Skill "${skillName}" not found`, 404);
    }
    const inputData = resolveExecutionInput(request);
    let sessionId = request.sessionId;
    if (sessionId) {
        const existing = await session_service_1.agentSessionService.getSession(sessionId);
        if (!existing) {
            throw new SkillServiceError('INVALID_REQUEST', `Session "${sessionId}" not found`, 404);
        }
    }
    else {
        const workingDirectory = resolveSkillWorkingDirectory(skill);
        const outputDirectory = resolveSkillOutputDir(skill);
        const newSession = await session_service_1.agentSessionService.createSession({
            projectId: `skill-${skillName}`,
            projectName: `Skill: ${loadedSkill.displayName || skillName}`,
            systemPrompt: `You are executing skill: ${loadedSkill.displayName || skillName}`,
            agentType: 'skill',
            projectContext: {
                currentPath: workingDirectory,
                outputDir: outputDirectory,
            },
        });
        sessionId = newSession.sessionId;
    }
    const executionId = generateExecutionId(skillName);
    const session = await session_service_1.agentSessionService.getSession(sessionId);
    if (!session) {
        throw new SkillServiceError('INTERNAL_ERROR', 'Failed to get session', 500);
    }
    const skillContext = {
        sessionId,
        session: {
            projectContext: {
                projectId: session.projectContext.projectId || `skill-${skillName}`,
                projectName: session.projectContext.projectName || `Skill: ${skillName}`,
                ontologyId: session.projectContext.ontologyId,
                currentPath: session.projectContext.currentPath,
                userId: session.projectContext.userId,
            },
            messages: session.messages,
        },
        input: {
            message: typeof inputData === 'string' ? inputData : undefined,
            data: typeof inputData === 'object' && inputData !== null
                ? inputData
                : undefined,
        },
        tools: createSkillContextTools(),
        config: typeof request.config === 'object' && request.config !== null
            ? request.config
            : undefined,
    };
    await session_service_1.agentSessionService.addMessage(sessionId, {
        role: 'system',
        content: `[Skill] Starting skill: ${skillName}`,
        metadata: {
            skillName,
            executionId,
            args: inputData,
        },
    });
    if (inputData) {
        try {
            const result = await loadedSkill.handler(skillContext);
            await session_service_1.agentSessionService.addMessage(sessionId, {
                role: 'assistant',
                content: result.message || (result.data ? JSON.stringify(result.data) : 'Skill executed successfully'),
                metadata: {
                    skillName,
                    executionId,
                    success: result.success,
                    complete: result.complete ?? true,
                },
            });
            if (result.complete !== false) {
                return {
                    status: 200,
                    data: {
                        executionId,
                        skillName,
                        status: 'completed',
                        startedAt: new Date().toISOString(),
                        sessionId,
                        message: result.message || (result.data ? extractMessage(result.data) : 'Skill executed successfully'),
                        data: result.data,
                    },
                };
            }
        }
        catch (error) {
            console.error('Skill execution error:', error);
            await session_service_1.agentSessionService.addMessage(sessionId, {
                role: 'system',
                content: `[Error] Skill execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                metadata: {
                    skillName,
                    executionId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            });
        }
    }
    return {
        status: 201,
        data: {
            executionId,
            skillName,
            status: 'running',
            startedAt: new Date().toISOString(),
            sessionId,
        },
    };
}
async function completeSkillExecution(request) {
    if (!request.sessionId) {
        throw new SkillServiceError('INVALID_REQUEST', 'sessionId is required', 400);
    }
    const session = await session_service_1.agentSessionService.getSession(request.sessionId);
    if (!session) {
        throw new SkillServiceError('NOT_FOUND', 'Session not found', 404);
    }
    const skillName = getMessageSkillName(session);
    const startedAt = new Date(session.createdAt);
    const endedAt = new Date();
    const duration = endedAt.getTime() - startedAt.getTime();
    const status = request.cancelled ? 'cancelled' : 'completed';
    await session_service_1.agentSessionService.updateSession(request.sessionId, {
        status,
    });
    await session_service_1.agentSessionService.addMessage(request.sessionId, {
        role: 'system',
        content: `[Skill] Execution ${status}: ${skillName}`,
        metadata: {
            skillName,
            executionId: request.executionId,
            status,
            endedAt: endedAt.toISOString(),
        },
    });
    return {
        success: !request.cancelled,
        status,
        endedAt: endedAt.toISOString(),
        summary: {
            totalMessages: session.messages.length,
            duration,
        },
    };
}
async function getSkillExecutionTimeline(request) {
    if (!request.sessionId) {
        throw new SkillServiceError('INVALID_REQUEST', 'sessionId is required', 400);
    }
    const session = await session_service_1.agentSessionService.getSession(request.sessionId);
    if (!session) {
        throw new SkillServiceError('NOT_FOUND', 'Session not found', 404);
    }
    const status = session.status === 'completed'
        ? 'completed'
        : session.status === 'cancelled'
            ? 'failed'
            : 'running';
    return {
        executionId: request.executionId,
        skillName: getMessageSkillName(session),
        startedAt: new Date(session.createdAt).toISOString(),
        status,
        endedAt: session.status !== 'active' ? new Date(session.updatedAt).toISOString() : undefined,
        timeline: messagesToTimeline(session.messages),
    };
}
async function sendSkillExecutionMessage(request) {
    if (!request.sessionId) {
        throw new SkillServiceError('INVALID_REQUEST', 'sessionId is required', 400);
    }
    if (!request.content) {
        throw new SkillServiceError('INVALID_REQUEST', 'content is required', 400);
    }
    const session = await session_service_1.agentSessionService.getSession(request.sessionId);
    if (!session) {
        throw new SkillServiceError('NOT_FOUND', 'Session not found', 404);
    }
    const updatedSession = await session_service_1.agentSessionService.addMessage(request.sessionId, {
        role: request.role || 'user',
        content: request.content,
        metadata: {
            ...request.metadata,
            executionId: request.executionId,
        },
    });
    if (!updatedSession) {
        throw new SkillServiceError('INTERNAL_ERROR', 'Failed to add message to session', 500);
    }
    const skillName = getMessageSkillName(session);
    const agent = await agent_manager_1.agentManager.getOrCreateAgent(request.sessionId, session.projectContext.projectId, {
        systemPrompt: `You are executing skill: ${skillName}\n\nProcess user input and respond appropriately for the skill context.`,
        agentType: 'skill',
        agentBaseDir: session.projectContext.currentPath,
        outputDir: session.projectContext.outputDir,
    });
    try {
        let assistantContent = '';
        let hasError = false;
        let errorMessage = '';
        const unsubscribe = agent.subscribe((event) => {
            const eventData = event;
            switch (eventData?.type) {
                case 'message_delta':
                    if (eventData.delta?.text) {
                        assistantContent = (0, stream_dedupe_1.getVisibleStreamDelta)(assistantContent, eventData.delta.text).content;
                    }
                    break;
                case 'message_end': {
                    if (eventData.message?.content) {
                        const content = extractTextContent(eventData.message.content);
                        if (content) {
                            assistantContent = (0, stream_dedupe_1.reconcileFinalStreamContent)(assistantContent, content);
                        }
                    }
                    break;
                }
                case 'agent_error':
                    hasError = true;
                    errorMessage = eventData.error?.message || 'Unknown error';
                    break;
            }
        });
        try {
            await agent.prompt(request.content);
        }
        catch (promptError) {
            hasError = true;
            errorMessage = promptError instanceof Error ? promptError.message : 'Failed to call LLM';
        }
        finally {
            unsubscribe();
        }
        let assistantMessage;
        if (assistantContent) {
            const finalSession = await session_service_1.agentSessionService.addMessage(request.sessionId, {
                role: 'assistant',
                content: assistantContent,
                metadata: { skillName, executionId: request.executionId },
            });
            assistantMessage = finalSession?.messages[finalSession.messages.length - 1];
        }
        const data = {
            message: {
                role: request.role || 'user',
                content: request.content,
                timestamp: new Date().toISOString(),
            },
            executionStatus: assistantMessage ? {
                status: hasError ? 'failed' : 'running',
                progress: undefined,
            } : undefined,
        };
        if (assistantMessage) {
            data.assistantMessage = {
                role: 'assistant',
                content: assistantMessage.content,
                timestamp: new Date(assistantMessage.timestamp).toISOString(),
            };
        }
        return {
            status: hasError ? 500 : 201,
            data,
            error: hasError ? { code: 'LLM_ERROR', message: errorMessage } : undefined,
        };
    }
    catch (llmError) {
        console.error('LLM processing error:', llmError);
        return {
            status: 500,
            data: {
                message: {
                    role: request.role || 'user',
                    content: request.content,
                    timestamp: new Date().toISOString(),
                },
            },
            error: {
                code: 'LLM_ERROR',
                message: llmError instanceof Error ? llmError.message : 'LLM processing failed',
            },
        };
    }
}
async function streamSkillExecutionMessage(request, emit) {
    if (!request.sessionId) {
        throw new SkillServiceError('INVALID_REQUEST', 'sessionId is required', 400);
    }
    if (!request.content) {
        throw new SkillServiceError('INVALID_REQUEST', 'content is required', 400);
    }
    const session = await session_service_1.agentSessionService.getSession(request.sessionId);
    if (!session) {
        throw new SkillServiceError('NOT_FOUND', 'Session not found', 404);
    }
    const updatedSession = await session_service_1.agentSessionService.addMessage(request.sessionId, {
        role: request.role || 'user',
        content: request.content,
        metadata: {
            ...request.metadata,
            executionId: request.executionId,
        },
    });
    if (!updatedSession) {
        throw new SkillServiceError('INTERNAL_ERROR', 'Failed to add message to session', 500);
    }
    const userMessage = updatedSession.messages[updatedSession.messages.length - 1];
    await emit({
        executionId: request.executionId,
        type: 'user_message',
        data: userMessage,
    });
    const skillName = getMessageSkillName(session);
    const agent = await agent_manager_1.agentManager.getOrCreateAgent(request.sessionId, session.projectContext.projectId, {
        systemPrompt: `You are executing skill: ${skillName}\n\nProcess user input and respond appropriately for the skill context.`,
        agentType: 'skill',
        agentBaseDir: session.projectContext.currentPath,
        outputDir: session.projectContext.outputDir,
    });
    let assistantContent = '';
    const pendingEmits = [];
    const queueEmit = (event) => {
        pendingEmits.push(Promise.resolve(emit(event)));
    };
    const unsubscribe = agent.subscribe((event) => {
        const eventData = event;
        switch (eventData?.type) {
            case 'message_delta':
                if (eventData.delta?.text) {
                    const merged = (0, stream_dedupe_1.getVisibleStreamDelta)(assistantContent, eventData.delta.text);
                    assistantContent = merged.content;
                    if (!merged.delta) {
                        break;
                    }
                    queueEmit({
                        executionId: request.executionId,
                        type: 'assistant_message',
                        data: {
                            content: merged.delta,
                            fullContent: assistantContent,
                            isStreaming: true,
                        },
                    });
                }
                break;
            case 'message_end': {
                if (eventData.message?.content) {
                    const content = extractTextContent(eventData.message.content);
                    if (content) {
                        assistantContent = (0, stream_dedupe_1.reconcileFinalStreamContent)(assistantContent, content);
                    }
                }
                if (assistantContent) {
                    pendingEmits.push(session_service_1.agentSessionService
                        .addMessage(request.sessionId, {
                        role: 'assistant',
                        content: assistantContent,
                        metadata: { skillName, executionId: request.executionId },
                    })
                        .then(() => emit({
                        executionId: request.executionId,
                        type: 'assistant_message',
                        data: {
                            content: assistantContent,
                            fullContent: assistantContent,
                            isStreaming: false,
                        },
                    })));
                }
                break;
            }
            case 'agent_error':
                queueEmit({
                    executionId: request.executionId,
                    type: 'error',
                    data: { message: eventData.error?.message || 'Unknown error' },
                });
                break;
        }
    });
    try {
        await agent.prompt(request.content);
        await Promise.all(pendingEmits);
        await emit({
            executionId: request.executionId,
            type: 'done',
            data: null,
        });
    }
    catch (error) {
        await Promise.all(pendingEmits);
        await emit({
            executionId: request.executionId,
            type: 'error',
            data: { message: error instanceof Error ? error.message : 'Unknown error' },
        });
    }
    finally {
        unsubscribe();
    }
}
