"use strict";
/**
 * 认知管理器（Story C.1）
 *
 * 编排多个 CognitiveProvider，生命周期钩子自动触发。
 * 借鉴 hermes-agent MemoryManager 模式。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CognitiveManager = void 0;
class CognitiveManager {
    constructor(_agentDir) {
        this.providers = new Map();
        this.providerPaths = new Map();
        if (!_agentDir) {
            throw new Error('CognitiveManager requires a valid agentDir');
        }
    }
    /** 注册 Provider */
    register(provider) {
        this.providers.set(provider.name, provider);
        // 如果 Provider 有 agentDir 字段，记录其目录路径用于验证
        if ('agentDir' in provider && typeof provider.agentDir === 'string') {
            this.providerPaths.set(provider.name, provider.agentDir);
        }
    }
    /** 取消注册 Provider */
    unregister(name) {
        this.providers.delete(name);
    }
    /** Turn 结束钩子 */
    async on_turn_end(data) {
        // 异步执行，不阻塞主流程
        setImmediate(async () => {
            for (const [, provider] of this.providers) {
                try {
                    await provider.sync_turn(data);
                }
                catch (e) {
                    console.error(`[CognitiveManager] ${provider.name} sync_turn error:`, e);
                }
            }
        });
    }
    /** Session 结束钩子（周期分析） */
    async on_session_end(messages) {
        // 各 Provider 各自实现批量分析逻辑
        for (const [, provider] of this.providers) {
            try {
                if ('on_session_end' in provider) {
                    await provider.on_session_end(messages);
                }
            }
            catch (e) {
                console.error(`[CognitiveManager] ${provider.name} on_session_end error:`, e);
            }
        }
    }
    /** 构建 Frozen Snapshot：启动时加载所有 Provider 的快照到 system prompt */
    async build_snapshot_prompt() {
        const blocks = [];
        for (const [, provider] of this.providers) {
            try {
                const block = await provider.system_prompt_block();
                if (block)
                    blocks.push(block);
            }
            catch (e) {
                console.error(`[CognitiveManager] ${provider.name} system_prompt_block error:`, e);
            }
        }
        return blocks.join('\n\n');
    }
    /** Prefetch：从所有 Provider 召回相关上下文 */
    async prefetch(query) {
        const results = [];
        for (const [, provider] of this.providers) {
            try {
                const content = await provider.prefetch(query);
                if (content) {
                    results.push({ provider: provider.name, content });
                }
            }
            catch (e) {
                console.error(`[CognitiveManager] ${provider.name} prefetch error:`, e);
            }
        }
        return results;
    }
    /** 获取统一本体实例（从 KnowledgeProvider） */
    getOntology() {
        const kp = this.providers.get('knowledge');
        return kp?.getOntology() ?? null;
    }
    /** 睡眠任务执行钩子（由 PersistentAgent agent_end 调用） */
    async on_sleep_tasks(tasks) {
        // 异步执行，不阻塞主流程
        setImmediate(async () => {
            for (const task of tasks) {
                try {
                    // 各 Provider 根据自身能力处理睡眠任务
                    for (const [, provider] of this.providers) {
                        if ('handle_sleep_task' in provider) {
                            await provider.handle_sleep_task(task);
                        }
                    }
                }
                catch (e) {
                    console.error(`[CognitiveManager] sleep task ${task.task.type} error:`, e);
                }
            }
        });
    }
}
exports.CognitiveManager = CognitiveManager;
