"use strict";
/**
 * Agent Manager
 *
 * Manages OriginOSAgent instances for each session
 * Provides caching, lifecycle management, and cleanup
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentManager = exports.AgentManager = void 0;
const agent_1 = require("./core/agent");
const index_1 = require("./tools/index");
const server_config_1 = require("./server-config");
const context_1 = require("./tools/context");
const bind_session_1 = require("./tools/bind-session");
const correction_detector_1 = require("./cognitive/pattern/correction-detector");
/**
 * 将工具列表绑定到指定 session：每次工具执行前刷新 defaultContext，
 * 避免多 session 并发时 defaultContext 被最后一个 session 覆盖导致文件写到错误目录。
 *
 * 实现已迁移至 ./tools/bind-session.ts，作为 AgentManager 与 PersistentAgent 的共享工具。
 */
function filterDisallowedToolsForAgentType(tools, agentType) {
    if (agentType === "worker" || agentType === "skill") {
        return tools.filter((tool) => tool.name !== "ask_user_question");
    }
    return tools;
}
/**
 * Global Agent Manager
 * Manages OriginOSAgent instances per session
 */
class AgentManager {
    constructor(config) {
        this.agents = new Map();
        this.config = {
            maxIdleAgents: config?.maxIdleAgents ?? 50,
            idleTimeoutMs: config?.idleTimeoutMs ?? 30 * 60 * 1000, // 30 minutes
            debug: config?.debug ?? false,
        };
        // Start cleanup interval
        if (typeof setInterval !== 'undefined') {
            setInterval(() => this.cleanup(), 60 * 1000); // Cleanup every minute
        }
    }
    /**
     * Get or create an agent for a session
     */
    async getOrCreateAgent(sessionId, projectId, options) {
        const startAt = Date.now();
        const entry = this.agents.get(sessionId);
        if (entry) {
            // Update last accessed time
            entry.lastAccessedAt = Date.now();
            // Update systemPrompt if provided and different
            if (options?.systemPrompt && entry.agent.isInitialized()) {
                entry.agent.setSystemPrompt(options.systemPrompt);
            }
            // Apply llmConfig if provided (launcher may have created agent without it)
            if (options?.llmConfig && entry.agent.isInitialized()) {
                const lc = options.llmConfig;
                try {
                    const updatedModel = (0, server_config_1.createRuntimeModel)(lc);
                    console.log(`[AgentManager] Applying llmConfig, model: ${updatedModel.id}`);
                    entry.agent.setModel(updatedModel);
                }
                catch (e) {
                    console.warn('[AgentManager] Failed to apply llmConfig:', e);
                }
            }
            // Always refresh tool context — working directory may change between calls
            const context = {
                sessionId,
                workingDirectory: options?.agentBaseDir,
            };
            (0, context_1.setToolContext)(sessionId, context);
            (0, context_1.getToolContextManager)().setDefaultContext(context);
            console.log(`[AgentManager] Reusing existing agent for session: ${sessionId} in ${Date.now() - startAt}ms`);
            return entry.agent;
        }
        // Create new agent
        console.log(`[AgentManager] Creating new agent for session: ${sessionId}`, {
            projectId,
            agentType: options?.agentType,
            hasSystemPrompt: !!options?.systemPrompt,
            hasBaseDir: !!options?.agentBaseDir,
        });
        // Ensure built-in tools are registered
        const toolsInitAt = Date.now();
        (0, index_1.initializeBuiltInTools)();
        console.log(`[AgentManager] Built-in tools ready in ${Date.now() - toolsInitAt}ms`);
        // Set tool execution context so file tools resolve to the correct directory
        const context = {
            sessionId,
            workingDirectory: options?.agentBaseDir,
        };
        (0, context_1.setToolContext)(sessionId, context);
        (0, context_1.getToolContextManager)().setDefaultContext(context);
        let agent;
        console.log(`[AgentManager] Creating OriginOSAgent for session ${sessionId}`);
        const createAt = Date.now();
        agent = await this.createInProcessAgent(sessionId, projectId, options);
        console.log(`[AgentManager] createInProcessAgent completed in ${Date.now() - createAt}ms`);
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log(`[AgentManager] Agent created for session ${sessionId} [initialized: ${agent.isInitialized()}] in ${Date.now() - startAt}ms`);
        this.agents.set(sessionId, {
            agent,
            cognitiveManager: this.getCognitiveManager(agent),
            sessionId,
            projectId,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            isWindowBound: options?.isWindowBound ?? false,
        });
        return agent;
    }
    /**
     * 创建 in-process OriginOSAgent（原有逻辑）
     */
    async createInProcessAgent(sessionId, projectId, options) {
        const t0 = Date.now();
        const agent = (0, agent_1.createOriginOSAgent)({
            sessionId,
            systemPrompt: options?.systemPrompt,
            variables: {
                projectId,
                projectName: options?.agentType || 'Agent Session',
            },
            llmConfig: options?.llmConfig,
        });
        // Register built-in tools on the agent, filtered by agent type scopes
        const scopeTools = (0, index_1.getAgentToolsForScope)(options?.agentType);
        const tools = (0, bind_session_1.bindToolsToSession)(filterDisallowedToolsForAgentType(scopeTools, options?.agentType), sessionId);
        agent.setTools(tools);
        console.log(`[AgentManager] OriginOSAgent + ${tools.length} tools prepared in ${Date.now() - t0}ms`);
        // 接入 Memory Core（三层记忆 + CognitiveManager + 记忆工具）
        if (options?.agentBaseDir) {
            try {
                const memoryStart = Date.now();
                const { MemoryCore } = await Promise.resolve().then(() => __importStar(require('../../../modules/memory-core')));
                const { MemoryProvider } = await Promise.resolve().then(() => __importStar(require('../../../modules/memory-core/session/memory-provider')));
                const { CognitiveManager } = await Promise.resolve().then(() => __importStar(require('./cognitive/manager')));
                const { CoreMemoryTools } = await Promise.resolve().then(() => __importStar(require('../../../modules/memory-core/tools/core-memory-tools')));
                const { ArchivalMemoryTools } = await Promise.resolve().then(() => __importStar(require('../../../modules/memory-core/tools/archival-memory-tools')));
                const { PracticeLogger } = await Promise.resolve().then(() => __importStar(require('./cognitive/practice-logger')));
                const { PatternProvider } = await Promise.resolve().then(() => __importStar(require('./cognitive/pattern/index')));
                const memoryCore = new MemoryCore(options.agentBaseDir, sessionId);
                const memoryProvider = new MemoryProvider(memoryCore, sessionId);
                const cognitiveManager = new CognitiveManager(options.agentBaseDir);
                cognitiveManager.register(new PracticeLogger(options.agentBaseDir));
                cognitiveManager.register(memoryProvider);
                const patternProvider = new PatternProvider(options.agentBaseDir, memoryCore.archival);
                patternProvider.initialize()
                    .then(() => console.log(`[AgentManager] PatternProvider initialized in background for ${sessionId}`))
                    .catch((e) => console.warn('[AgentManager] PatternProvider init error:', e));
                cognitiveManager.register(patternProvider);
                const coreMemoryTools = new CoreMemoryTools(memoryCore.memory);
                const archivalMemoryTools = new ArchivalMemoryTools(memoryCore.archival);
                const registerMemoryTool = (name, description, label, params, execute) => {
                    agent.registerTool({ name, description, label, parameters: params, execute });
                };
                registerMemoryTool('core_memory_append', 'Append content to a core memory block. Available blocks: human, persona, project, scratchpad, temporal.', 'core_memory_append', { type: 'object', properties: { label: { type: 'string' }, content: { type: 'string' } }, required: ['label', 'content'] }, async (_toolCallId, args) => {
                    if (!args?.label)
                        return { content: [{ type: 'text', text: "Error: 'label' parameter is required. Available blocks: human, persona, project, scratchpad, temporal." }], details: {} };
                    if (!args?.content)
                        return { content: [{ type: 'text', text: "Error: 'content' parameter is required." }], details: {} };
                    const result = await coreMemoryTools.core_memory_append(args.label, args.content);
                    return { content: [{ type: 'text', text: result }], details: {} };
                });
                registerMemoryTool('core_memory_replace', 'Replace content in a core memory block. Available blocks: human, persona, project, scratchpad, temporal.', 'core_memory_replace', { type: 'object', properties: { label: { type: 'string' }, old_content: { type: 'string' }, new_content: { type: 'string' } }, required: ['label', 'old_content', 'new_content'] }, async (_toolCallId, args) => {
                    if (!args?.label)
                        return { content: [{ type: 'text', text: "Error: 'label' parameter is required. Available blocks: human, persona, project, scratchpad, temporal." }], details: {} };
                    if (!args?.old_content)
                        return { content: [{ type: 'text', text: "Error: 'old_content' parameter is required." }], details: {} };
                    if (!args?.new_content)
                        return { content: [{ type: 'text', text: "Error: 'new_content' parameter is required." }], details: {} };
                    const result = await coreMemoryTools.core_memory_replace(args.label, args.old_content, args.new_content);
                    return { content: [{ type: 'text', text: result }], details: {} };
                });
                registerMemoryTool('insert_memory_block', 'Create a new custom core memory block.', 'insert_memory_block', { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' }, description: { type: 'string' } }, required: ['label', 'value'] }, async (_toolCallId, args) => {
                    const result = await coreMemoryTools.insert_memory_block(args.label, args.value, args.description);
                    return { content: [{ type: 'text', text: result }], details: {} };
                });
                registerMemoryTool('read_memory_block', 'Read a core memory block.', 'read_memory_block', { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] }, async (_toolCallId, args) => {
                    const result = await coreMemoryTools.read_memory_block(args.label);
                    return { content: [{ type: 'text', text: result }], details: {} };
                });
                registerMemoryTool('archival_memory_insert', 'Insert text into archival memory.', 'archival_memory_insert', { type: 'object', properties: { text: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['text'] }, async (_toolCallId, args) => {
                    const result = await archivalMemoryTools.archival_memory_insert(args.text, args.tags);
                    return { content: [{ type: 'text', text: result }], details: {} };
                });
                registerMemoryTool('archival_memory_search', 'Semantically search archival memory.', 'archival_memory_search', { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] }, async (_toolCallId, args) => {
                    const result = await archivalMemoryTools.archival_memory_search(args.query, args.limit);
                    return { content: [{ type: 'text', text: result }], details: {} };
                });
                // 将 Memory 快照注入 system prompt
                this.injectMemoryIntoSystemPrompt(agent, memoryProvider);
                // 订阅 turn_end → cognitiveManager.on_turn_end
                this.subscribeInProcessCognitive(agent, cognitiveManager, sessionId);
                this.setCognitiveManager(agent, cognitiveManager);
                console.log(`[AgentManager] Memory Core integrated for in-process agent session ${sessionId} in ${Date.now() - memoryStart}ms`);
            }
            catch (err) {
                console.warn('[AgentManager] Failed to integrate Memory Core for in-process agent:', err);
            }
        }
        return agent;
    }
    /**
     * 将 Memory 快照注入 system prompt
     */
    injectMemoryIntoSystemPrompt(agent, memoryProvider) {
        memoryProvider.system_prompt_block()
            .then(block => {
            if (block) {
                const existing = agent.agent?.state?.systemPrompt ?? '';
                const augmented = existing
                    ? existing + '\n\n---\n\n# Core Memory\n\n' + block
                    : block;
                agent.setSystemPrompt?.(augmented);
            }
        })
            .catch(err => console.warn('[AgentManager] Failed to inject memory into prompt:', err));
    }
    /**
     * 订阅 in-process agent 的 turn_end 事件，同步到 CognitiveManager
     */
    subscribeInProcessCognitive(agent, cognitiveManager, _sessionId) {
        let turnCounter = 0;
        let lastUserMessage = '';
        let lastAssistantMessage = '';
        const extractText = (content) => {
            if (typeof content === 'string')
                return content;
            if (Array.isArray(content)) {
                return content
                    .filter((b) => b.type === 'text' && b.text)
                    .map((b) => b.text)
                    .join(' ');
            }
            return '';
        };
        const extractToolCalls = (event) => (event.toolResults ?? []).map((tr) => ({
            name: tr.toolName ?? 'unknown',
            params: {},
            result: extractText(tr.content),
            success: !tr.isError,
        }));
        agent.subscribe((event) => {
            if (event.type === 'message_end') {
                const role = event.message?.role;
                const text = extractText(event.message?.content) || '';
                if (role === 'user' && text) {
                    lastUserMessage = text;
                }
                if (role === 'assistant' && text) {
                    lastAssistantMessage = text;
                }
            }
            if (event.type === 'turn_end') {
                const assistantMsg = lastAssistantMessage || extractText(event.message?.content) || '';
                const userMsg = lastUserMessage;
                const corrections = (0, correction_detector_1.detectCorrections)(userMsg);
                cognitiveManager.on_turn_end({
                    turnNumber: ++turnCounter,
                    userMessage: userMsg,
                    assistantMessage: assistantMsg,
                    assistantThinking: '',
                    toolCalls: extractToolCalls(event),
                    outcome: {
                        resolved: true,
                        toolChainLength: event.toolResults?.length ?? 0,
                        userCorrections: corrections.length || undefined,
                    },
                    timestamp: Date.now(),
                }).catch(err => console.error('[AgentManager] Cognitive sync_turn error:', err));
                lastUserMessage = '';
                lastAssistantMessage = '';
            }
        });
    }
    /**
     * Get an existing agent without creating one
     */
    getAgent(sessionId) {
        const entry = this.agents.get(sessionId);
        if (entry) {
            entry.lastAccessedAt = Date.now();
            return entry.agent;
        }
        return null;
    }
    /**
     * Check if an agent exists for a session
     */
    hasAgent(sessionId) {
        return this.agents.has(sessionId);
    }
    /**
     * Subscribe to agent events for a session
     */
    subscribeToAgent(sessionId, listener) {
        const entry = this.agents.get(sessionId);
        if (!entry) {
            return null;
        }
        return entry.agent.subscribe(listener);
    }
    /**
     * Remove an agent for a session
     */
    removeAgent(sessionId) {
        const entry = this.agents.get(sessionId);
        if (!entry) {
            return false;
        }
        if (this.config.debug) {
            console.log(`[AgentManager] Removing agent for session: ${sessionId}`);
        }
        entry.agent.destroy();
        (0, context_1.removeToolContext)(sessionId);
        this.agents.delete(sessionId);
        return true;
    }
    /**
     * Finalize cognitive providers before removing an agent.
     *
     * Closing a window is the practical session boundary for in-process
     * role/project/skill agents. PatternProvider renders Patterns.md from
     * archival memory in on_session_end, so destruction must flush that hook
     * before the agent state is cleared.
     */
    async finalizeAndRemoveAgent(sessionId) {
        const entry = this.agents.get(sessionId);
        if (!entry) {
            return false;
        }
        await this.flushCognitiveSessionEnd(entry);
        return this.removeAgent(sessionId);
    }
    setCognitiveManager(agent, cognitiveManager) {
        agent.__originosCognitiveManager = cognitiveManager;
    }
    getCognitiveManager(agent) {
        return agent.__originosCognitiveManager;
    }
    async flushCognitiveSessionEnd(entry) {
        const cognitiveManager = entry.cognitiveManager ?? this.getCognitiveManager(entry.agent);
        if (!cognitiveManager) {
            return;
        }
        try {
            const state = await entry.agent.getSessionState();
            await cognitiveManager.on_session_end(state.messages ?? []);
        }
        catch (error) {
            console.error(`[AgentManager] Cognitive session_end error for ${entry.sessionId}:`, error);
        }
    }
    /**
     * Abort an agent's current operation
     */
    abortAgent(sessionId) {
        const entry = this.agents.get(sessionId);
        if (!entry) {
            return false;
        }
        entry.agent.abort();
        return true;
    }
    /**
     * Cleanup idle agents that exceed timeout
     */
    cleanup() {
        const now = Date.now();
        const toRemove = [];
        // Sort by last accessed time
        const entries = Array.from(this.agents.entries())
            .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);
        // Remove idle agents that exceed timeout (skip window-bound agents)
        for (const [sessionId, entry] of entries) {
            if (entry.isWindowBound)
                continue;
            const idleTime = now - entry.lastAccessedAt;
            if (idleTime > this.config.idleTimeoutMs) {
                toRemove.push(sessionId);
            }
        }
        // Remove excess agents if over limit (skip window-bound agents)
        const nonWindowBoundEntries = entries.filter(([_, e]) => !e.isWindowBound);
        if (nonWindowBoundEntries.length > this.config.maxIdleAgents) {
            const excess = nonWindowBoundEntries.length - this.config.maxIdleAgents;
            for (let i = 0; i < excess; i++) {
                const entry = nonWindowBoundEntries[i];
                if (!entry)
                    break;
                const sessionId = entry[0];
                if (!toRemove.includes(sessionId)) {
                    toRemove.push(sessionId);
                }
            }
        }
        // Perform cleanup
        for (const sessionId of toRemove) {
            this.removeAgent(sessionId);
        }
        if (this.config.debug && toRemove.length > 0) {
            console.log(`[AgentManager] Cleaned up ${toRemove.length} idle agents`);
        }
    }
    /**
     * Get statistics about active agents
     */
    getStats() {
        return {
            totalAgents: this.agents.size,
            sessions: Array.from(this.agents.values()).map(entry => ({
                sessionId: entry.sessionId,
                projectId: entry.projectId,
                createdAt: entry.createdAt,
                lastAccessedAt: entry.lastAccessedAt,
                isWindowBound: entry.isWindowBound,
            })),
        };
    }
    /**
     * Destroy all agents
     */
    destroyAll() {
        for (const [sessionId] of this.agents) {
            this.removeAgent(sessionId);
        }
    }
}
exports.AgentManager = AgentManager;
function getGlobalAgentManager() {
    if (!globalThis.__globalAgentManager) {
        globalThis.__globalAgentManager = new AgentManager({
            maxIdleAgents: 50,
            idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
            debug: process.env['NODE_ENV'] === 'development',
        });
    }
    return globalThis.__globalAgentManager;
}
exports.agentManager = getGlobalAgentManager();
