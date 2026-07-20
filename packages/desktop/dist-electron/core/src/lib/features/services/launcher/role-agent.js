"use strict";
/**
 * RoleAgent Launcher（Story R.6 重构）
 *
 * 启动流程（data/agents/{id}/）：
 * 1. 读取 Agent.md → systemPrompt
 * 2. 加载 RoleContext（5 个 .md 文件 + 已安装技能）
 * 3. 成功加载时用 6 层 prompt 替换旧流程
 * 4. 失败时降级到 buildAgentSystemPrompt（向后兼容）
 * 5. 初始化 MemoryTracker + StateMachine
 * 6. 注册 turn_end 钩子（状态机检查 + 记忆追踪）
 * 7. 创建会话 + 注册 Agent
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleAgentLauncher = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const base_1 = require("./base");
const agent_manager_1 = require("../../../../lib/integrations/pi-agent/agent-manager");
const role_context_1 = require("../../../../lib/integrations/pi-agent/role-agent/role-context");
const skill_resolver_1 = require("../../../../lib/integrations/pi-agent/role-agent/skill-resolver");
const state_machine_1 = require("../../../../lib/integrations/pi-agent/role-agent/state-machine");
const system_prompt_1 = require("../../../../lib/integrations/pi-agent/role-agent/system-prompt");
const memory_tracker_1 = require("../../../../lib/integrations/pi-agent/role-agent/memory-tracker");
const paths_1 = require("../../../paths");
const AGENTS_DIR = (0, paths_1.getAgentsDataDir)();
/** 计算字符串 hash */
function hashContent(content) {
    return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
}
// 每个 sessionId 对应一个 RoleAgent 状态
const roleSessions = new Map();
// ============================================================================
// turn_end 处理（全局事件拦截器）
// ============================================================================
/**
 * 在 agentManager 中注册全局 turn_end 拦截器。
 * 对 role-agent 类型执行状态机检查 + 记忆追踪。
 */
function setupGlobalRoleAgentHook() {
    const gh = globalThis;
    if (gh['__roleAgentHookInstalled']) {
        console.log('[RoleAgent][hook] Already installed, skipping');
        return;
    }
    gh['__roleAgentHookInstalled'] = true;
    console.log('[RoleAgent][hook] Installing global role-agent hook');
    const originalSubscribeToAgent = agent_manager_1.agentManager.subscribeToAgent.bind(agent_manager_1.agentManager);
    agent_manager_1.agentManager.subscribeToAgent = (sessionId, listener) => {
        console.log(`[RoleAgent][hook] subscribeToAgent called for session ${sessionId}`);
        const originalCleanup = originalSubscribeToAgent(sessionId, listener);
        if (!originalCleanup)
            return null;
        // 额外注册 role-agent turn_start 和 turn_end hooks
        const startCleanup = setupRoleAgentTurnStartHook(sessionId);
        const endCleanup = setupRoleAgentTurnHook(sessionId);
        return () => {
            originalCleanup();
            startCleanup?.();
            endCleanup?.();
        };
    };
}
/**
 * 为特定 session 设置 turn_start hook。
 * 检查 Tool.md 是否变更，有则刷新 system prompt。
 */
function setupRoleAgentTurnStartHook(sessionId) {
    return agent_manager_1.agentManager.subscribeToAgent(sessionId, (event) => {
        if (event.type !== 'turn_start')
            return;
        console.log(`[RoleAgent][turn_start] Checking Tool.md refresh for session ${sessionId}`);
        const state = roleSessions.get(sessionId);
        if (!state) {
            console.log(`[RoleAgent][turn_start] No role session state found for ${sessionId}`);
            return;
        }
        console.log(`[RoleAgent][turn_start] Found role session state, agentBaseDir=${state.roleContext.agentBaseDir}, lastToolMdHash=${state.lastToolMdHash.slice(0, 8)}...`);
        refreshToolMdIfNeeded(sessionId, state);
    });
}
/**
 * 检查 Tool.md 或 .skills/ 是否变更，有则只更新对应层并重新拼接 system prompt。
 */
function refreshToolMdIfNeeded(sessionId, state) {
    const agentBaseDir = state.roleContext.agentBaseDir;
    const toolMdPath = path_1.default.join(agentBaseDir, 'Tool.md');
    try {
        const newToolMdContent = (0, fs_1.existsSync)(toolMdPath) ? (0, fs_1.readFileSync)(toolMdPath, 'utf-8') : '';
        const newToolMdHash = hashContent(newToolMdContent);
        const newSkills = (0, skill_resolver_1.scanInstalledSkills)(agentBaseDir);
        const newSkillsHash = hashContent(newSkills.map(s => s.code).sort().join(','));
        const toolMdChanged = newToolMdHash !== state.lastToolMdHash;
        const skillsChanged = newSkillsHash !== state.lastSkillsHash;
        if (!toolMdChanged && !skillsChanged)
            return;
        console.log(`[RoleAgent][refresh] Changes — toolMd=${toolMdChanged}, skills=${skillsChanged}`);
        // 更新上下文中变化的部分
        if (toolMdChanged && newToolMdContent) {
            state.roleContext.toolMd = newToolMdContent;
            const { allowedTools } = (0, role_context_1.parseToolMdTools)(newToolMdContent);
            state.roleContext.allowedTools = allowedTools;
        }
        if (skillsChanged) {
            state.roleContext.installedSkills = newSkills;
        }
        // 只重建 toolbox 层
        state.promptLayers.toolbox = (0, system_prompt_1.rebuildToolboxLayer)(state.roleContext);
        const newPrompt = (0, system_prompt_1.assemblePrompt)(state.promptLayers);
        const agent = agent_manager_1.agentManager.getAgent(sessionId);
        if (agent) {
            agent.setSystemPrompt(newPrompt);
            console.log(`[RoleAgent][refresh] Toolbox layer updated, skills=${newSkills.length}`);
        }
        state.lastToolMdHash = newToolMdHash;
        state.lastSkillsHash = newSkillsHash;
    }
    catch (err) {
        console.error('[RoleAgent] refresh failed:', err);
    }
}
/**
 * 为特定 session 设置 role-agent turn_end hook。
 * 仅对 role-agent 类型生效。
 */
function setupRoleAgentTurnHook(sessionId) {
    return agent_manager_1.agentManager.subscribeToAgent(sessionId, (event) => {
        if (event.type !== 'turn_end')
            return;
        const state = roleSessions.get(sessionId);
        if (!state)
            return;
        const turnEnd = event;
        // 1. 状态机检查
        const messages = [turnEnd.message];
        const transition = (0, state_machine_1.checkTransition)(state.stateMachine, messages);
        if (transition) {
            (0, state_machine_1.applyTransition)(state.stateMachine, transition.to);
            state.roleContext.currentPhase = transition.to;
            console.log(`[RoleAgent] 状态转换: ${transition.from} → ${transition.to}`);
            updateRoleMdPhase(state.roleContext.agentBaseDir, transition.to);
        }
        // 2. 记忆追踪
        const userText = extractUserText(turnEnd.message);
        state.memoryTracker.recordTurn(userText, state.memoryTracker.turnCount + 1);
        if (state.memoryTracker.shouldFlush()) {
            const memoryPath = path_1.default.join(state.roleContext.agentBaseDir, 'Memory.md');
            const existingMemory = (0, fs_1.existsSync)(memoryPath) ? (0, fs_1.readFileSync)(memoryPath, 'utf-8') : null;
            state.memoryTracker.flushMemory(existingMemory).catch(err => {
                console.error('[RoleAgent] Memory flush failed:', err);
            });
        }
    });
}
/** 从 AgentMessage 中提取文本内容 */
function extractUserText(msg) {
    const m = msg;
    if (typeof m.content === 'string')
        return m.content;
    if (Array.isArray(m.content)) {
        const items = m.content;
        return items
            .filter(c => c.type === 'text' && c.text)
            .map(c => c.text)
            .join(' ');
    }
    return '';
}
/** 状态转换时更新 Role.md 的 currentPhase */
function updateRoleMdPhase(agentDir, newPhase) {
    const roleMdPath = path_1.default.join(agentDir, 'Role.md');
    if (!(0, fs_1.existsSync)(roleMdPath))
        return;
    try {
        let content = (0, fs_1.readFileSync)(roleMdPath, 'utf-8');
        // 尝试更新 frontmatter 中的 currentPhase
        const fmMatch = content.match(/^(---\n)([\s\S]*?)\n(---)/m);
        if (fmMatch?.[2]) {
            const frontmatter = fmMatch[2];
            if (/^currentPhase:/m.test(frontmatter)) {
                content = content.replace(/^(currentPhase:).*$/m, `currentPhase: ${newPhase}`);
            }
            else {
                // 插入 currentPhase 到 frontmatter
                content = content.replace(/^(---\n)/m, `---\ncurrentPhase: ${newPhase}\n`);
            }
        }
        else {
            // 没有 frontmatter，在最前面添加
            content = `---\ncurrentPhase: ${newPhase}\n---\n\n${content}`;
        }
        (0, fs_1.writeFileSync)(roleMdPath, content, 'utf-8');
    }
    catch (err) {
        console.error('[RoleAgent] Failed to update Role.md phase:', err);
    }
}
// 安装全局 hook
setupGlobalRoleAgentHook();
// ============================================================================
// RoleAgentLauncher
// ============================================================================
class RoleAgentLauncher extends base_1.Launcher {
    constructor() {
        super(...arguments);
        this.entryType = 'role-agent';
    }
    async launch(ctx) {
        try {
            const agentBaseDir = path_1.default.join(AGENTS_DIR, ctx.entryId);
            // 1. 读取入口内容（向后兼容）
            const content = await this.loadEntryContent(ctx.entryId);
            const agentMd = content['Agent.md'] || '';
            // 2. 尝试加载 RoleContext（新流程）
            const roleContext = await (0, role_context_1.loadRoleContext)(agentBaseDir);
            let systemPrompt;
            if (roleContext) {
                // 成功加载 → 使用 6 层 system prompt
                const stateMachine = (0, state_machine_1.parseStateMachine)(roleContext.roleMd);
                // 更新角色上下文的当前阶段
                roleContext.currentPhase = stateMachine.currentPhase;
                // 初始化 MemoryTracker
                const memoryTracker = new memory_tracker_1.MemoryTracker(agentBaseDir);
                // 记录 Tool.md 初始 hash
                const toolMdPath = path_1.default.join(agentBaseDir, 'Tool.md');
                const initialToolMd = (0, fs_1.existsSync)(toolMdPath) ? (0, fs_1.readFileSync)(toolMdPath, 'utf-8') : '';
                const initialToolMdHash = hashContent(initialToolMd);
                const initialSkillsHash = hashContent(roleContext.installedSkills.map(s => s.code).sort().join(','));
                const promptLayers = (0, system_prompt_1.buildPromptLayers)(roleContext, stateMachine);
                systemPrompt = (0, system_prompt_1.assemblePrompt)(promptLayers);
                // 存储会话状态
                roleSessions.set(ctx.entryId, {
                    roleContext,
                    stateMachine,
                    memoryTracker,
                    lastToolMdHash: initialToolMdHash,
                    lastSkillsHash: initialSkillsHash,
                    promptLayers,
                });
                console.log(`[RoleAgent] Loaded role context for ${ctx.entryId}, phase=${stateMachine.currentPhase}, skills=${roleContext.installedSkills.length}, toolMdHash=${initialToolMdHash.slice(0, 8)}..., sessionId to be created`);
            }
            else {
                // 降级到旧流程
                systemPrompt = (0, base_1.buildAgentSystemPrompt)(agentMd, {
                    role: content['Role.md'],
                    memory: content['Memory.md'],
                    taste: content['Taste.md'],
                    baseDir: agentBaseDir,
                });
                console.log(`[RoleAgent] RoleContext not found, using legacy prompt for ${ctx.entryId}`);
            }
            // 3. 创建/恢复会话
            const { sessionId } = await this.createOrRestoreSession({
                projectId: ctx.entryId,
                projectName: ctx.entryId,
                systemPrompt,
                agentType: 'role-agent',
                agentBaseDir,
                sessionId: ctx.restoreSessionId || ctx.sessionId,
            });
            // 4. 注册 Agent 到 AgentManager
            await this.registerAgent(sessionId, ctx.entryId, {
                systemPrompt,
                agentType: 'role-agent',
                agentBaseDir,
                isWindowBound: ctx.isWindowBound,
            });
            return {
                success: true,
                sessionId,
                systemPrompt,
                agentType: 'role-agent',
                baseDir: agentBaseDir,
                tools: [],
            };
        }
        catch (error) {
            return {
                success: false,
                sessionId: '',
                systemPrompt: '',
                agentType: 'role-agent',
                baseDir: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async loadEntryContent(id) {
        const agentBaseDir = path_1.default.join(AGENTS_DIR, id);
        const result = {};
        for (const file of ['Agent.md', 'Role.md', 'Tool.md', 'Memory.md', 'Taste.md']) {
            const content = this.readMdFile(agentBaseDir, file);
            if (content !== null) {
                result[file] = content;
            }
        }
        return result;
    }
}
exports.RoleAgentLauncher = RoleAgentLauncher;
