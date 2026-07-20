"use strict";
/**
 * SharedMemoryHelper — Blackboard 共享记忆的高层语义 API
 *
 * 提供结构化的共享内存操作，支持：
 * - 上游 Agent 产出存储与查询
 * - 共享知识写入与读取
 * - Agent 发现共享
 * - 工具调用结果缓存
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedMemoryHelper = void 0;
class SharedMemoryHelper {
    constructor(blackboard) {
        this.blackboard = blackboard;
        this.sessionId = blackboard.sessionId;
    }
    /**
     * 写入共享知识（供所有 Agent 读取）
     */
    writeSharedKnowledge(key, knowledge) {
        const memoryKey = `shared$knowledge$${key}`;
        this.blackboard.setData(memoryKey, knowledge.content, knowledge.sourceAgent ?? "system", {
            sourceUri: `shared-memory:knowledge:${this.sessionId}`,
        });
    }
    /**
     * 读取共享知识
     */
    readSharedKnowledge(key) {
        const memoryKey = `shared$knowledge$${key}`;
        const value = this.blackboard.getData(memoryKey);
        return value ? String(value) : null;
    }
    /**
     * 写入 Agent 中间发现（临时共享，用于并行 Agent）
     */
    writeDiscovery(agentId, discovery) {
        const key = `discovery$${agentId}$${Date.now()}`;
        this.blackboard.setData(key, discovery, agentId, {
            sourceUri: `shared-memory:discovery:${this.sessionId}:${agentId}`,
        });
    }
    /**
     * 查询所有最新发现（按时间排序）
     */
    listRecentDiscoverions(limit = 10) {
        const allEntries = this.blackboard.getEntries().filter((entry) => entry.key.startsWith("discovery$"));
        return allEntries
            .sort((a, b) => b.provenance.timestamp.localeCompare(a.provenance.timestamp))
            .slice(0, limit)
            .map((entry) => ({
            key: entry.key,
            discovery: entry.value,
            time: entry.provenance.timestamp,
        }));
    }
    /**
     * 写入共享工具调结果（避免重复调用）
     */
    writeToolResult(toolCall) {
        const hash = this.hashToolCall(toolCall.toolName, toolCall.arguments);
        const key = `shared$tool_result$${toolCall.toolName}$${hash}`;
        const cacheEntry = {
            toolName: toolCall.toolName,
            arguments: toolCall.arguments,
            result: toolCall.result,
            cachedAt: new Date().toISOString(),
        };
        this.blackboard.setData(key, cacheEntry, "system", {
            sourceUri: `shared-memory:tool-cache:${this.sessionId}`,
        });
    }
    /**
     * 读取共享工具调结果
     */
    readToolResult(toolName, args) {
        const hash = this.hashToolCall(toolName, args);
        const key = `shared$tool_result$${toolName}$${hash}`;
        const entry = this.blackboard.getDataEntry(key);
        if (!entry)
            return null;
        const cacheEntry = entry.value;
        // 简单 TTL：30 分钟
        const ageMs = Date.now() - new Date(cacheEntry.cachedAt).getTime();
        if (ageMs > 30 * 60 * 1000)
            return null;
        return cacheEntry.result;
    }
    /**
     * 检查工具调用缓存是否存在（不读取内容，仅检查存在性和 TTL）
     */
    hasToolResult(toolName, args) {
        const hash = this.hashToolCall(toolName, args);
        const key = `shared$tool_result$${toolName}$${hash}`;
        const entry = this.blackboard.getDataEntry(key);
        if (!entry)
            return false;
        const cacheEntry = entry.value;
        const ageMs = Date.now() - new Date(cacheEntry.cachedAt).getTime();
        return ageMs <= 30 * 60 * 1000;
    }
    hashToolCall(toolName, args) {
        return `${toolName}:${JSON.stringify(args)}`;
    }
}
exports.SharedMemoryHelper = SharedMemoryHelper;
