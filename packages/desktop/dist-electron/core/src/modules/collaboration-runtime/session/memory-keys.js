"use strict";
/**
 * Memory Keys — 结构化键值约定（Ruflo 风格）
 *
 * 借鉴 Ruflo 的 `swarm$<role>$<category>` 键值结构，
 * 为 Blackboard sharedData 提供统一的命名规范。
 *
 * 键值格式: `<prefix>$<role>$<category>$<subkey>?$<tag>`
 * 示例:
 * - swarm$supervisor$status
 * - swarm$supervisor$report
 * - swarm$worker-coder$status
 * - swarm$worker-coder$progress
 * - swarm$shared$hierarchy
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryKeyCategory = exports.MemoryKeyPrefix = void 0;
exports.buildSupervisorKey = buildSupervisorKey;
exports.buildWorkerKey = buildWorkerKey;
exports.buildSharedKey = buildSharedKey;
exports.buildUpstreamOutputKey = buildUpstreamOutputKey;
exports.buildUpstreamMetaKey = buildUpstreamMetaKey;
exports.buildProjectContextKey = buildProjectContextKey;
exports.buildSharedKnowledgeKey = buildSharedKnowledgeKey;
exports.buildDiscoveryKey = buildDiscoveryKey;
exports.buildToolResultKey = buildToolResultKey;
exports.buildOntologyStateKey = buildOntologyStateKey;
exports.parseMemoryKey = parseMemoryKey;
exports.hasPrefix = hasPrefix;
exports.belongsToRole = belongsToRole;
exports.filterKeysByPrefix = filterKeysByPrefix;
exports.filterKeysByRole = filterKeysByRole;
exports.filterKeysByCategory = filterKeysByCategory;
/**
 * 键值前缀分类
 */
var MemoryKeyPrefix;
(function (MemoryKeyPrefix) {
    MemoryKeyPrefix["SWARM"] = "swarm";
    MemoryKeyPrefix["AGENT"] = "agent";
    MemoryKeyPrefix["SHARED"] = "shared";
    MemoryKeyPrefix["ONTOLOGY"] = "ontology";
    MemoryKeyPrefix["UPSTREAM"] = "upstream";
    MemoryKeyPrefix["METADATA"] = "metadata";
    MemoryKeyPrefix["PROJECT"] = "project";
})(MemoryKeyPrefix || (exports.MemoryKeyPrefix = MemoryKeyPrefix = {}));
/**
 * 键值类别
 */
var MemoryKeyCategory;
(function (MemoryKeyCategory) {
    /** 状态快照 */
    MemoryKeyCategory["STATUS"] = "status";
    /** 进度更新 */
    MemoryKeyCategory["PROGRESS"] = "progress";
    /** 完成报告 */
    MemoryKeyCategory["COMPLETE"] = "complete";
    /** 阻塞报告 */
    MemoryKeyCategory["BLOCKED"] = "blocked";
    /** 性能指标 */
    MemoryKeyCategory["METRICS"] = "metrics";
    /** 权威指令 */
    MemoryKeyCategory["DIRECTIVE"] = "directive";
    /** 健康监控 */
    MemoryKeyCategory["HEALTH"] = "health";
    /** 定期报告 */
    MemoryKeyCategory["REPORT"] = "report";
    /** 发现/观察 */
    MemoryKeyCategory["DISCOVERY"] = "discovery";
})(MemoryKeyCategory || (exports.MemoryKeyCategory = MemoryKeyCategory = {}));
/**
 * Supervisor 键值构建器
 */
function buildSupervisorKey(category, _sessionId, subkey) {
    if (subkey) {
        return `${MemoryKeyPrefix.SWARM}$supervisor$${category}$${subkey}`;
    }
    return `${MemoryKeyPrefix.SWARM}$supervisor$${category}`;
}
/**
 * Worker 键值构建器
 */
function buildWorkerKey(category, workerId, subkey) {
    if (subkey) {
        return `${MemoryKeyPrefix.SWARM}$worker-${workerId}$${category}$${subkey}`;
    }
    return `${MemoryKeyPrefix.SWARM}$worker-${workerId}$${category}`;
}
/**
 * 共享键值构建器
 */
function buildSharedKey(category, _sessionId, subkey) {
    if (subkey) {
        return `${MemoryKeyPrefix.SHARED}$${category}$${subkey}`;
    }
    return `${MemoryKeyPrefix.SHARED}$${category}`;
}
/**
 * 上游产出键值构建器
 */
function buildUpstreamOutputKey(agentId) {
    return `${MemoryKeyPrefix.UPSTREAM}$${agentId}$output`;
}
/**
 * 上游元数据键值构建器
 */
function buildUpstreamMetaKey(agentId) {
    return `${MemoryKeyPrefix.METADATA}$upstream$${agentId}`;
}
/**
 * 项目上下文键值构建器
 */
function buildProjectContextKey(projectId, agentId, suffix = "summary") {
    return `${MemoryKeyPrefix.PROJECT}$context$${projectId}$${agentId}$${suffix}`;
}
/**
 * 共享知识键值构建器
 */
function buildSharedKnowledgeKey(key) {
    return `${MemoryKeyPrefix.SHARED}$knowledge$${key}`;
}
/**
 * 发现键值构建器
 */
function buildDiscoveryKey(agentId, timestamp) {
    const ts = timestamp ?? Date.now();
    return `discovery$${agentId}_${ts}`;
}
/**
 * 工具调用缓存键值构建器
 */
function buildToolResultKey(toolName, argsHash) {
    return `shared$tool_result$${toolName}_${argsHash}`;
}
/**
 * 本体状态键值构建器
 */
function buildOntologyStateKey(agentId) {
    return `${MemoryKeyPrefix.ONTOLOGY}_state$${agentId}`;
}
/**
 * 解析键值组件
 */
function parseMemoryKey(key) {
    const parts = key.split("$");
    if (parts.length < 2)
        return null;
    const prefix = parts[0];
    // 检查是否是有效的已知前缀
    const validPrefixes = Object.values(MemoryKeyPrefix);
    if (!validPrefixes.includes(prefix)) {
        return null;
    }
    const role = parts[1];
    const category = parts[2];
    const subkey = parts.length > 3 ? parts.slice(3).join("$") : undefined;
    return { prefix, role, category, subkey };
}
/**
 * 检查键值是否属于特定前缀
 */
function hasPrefix(key, prefix) {
    return key.startsWith(`${prefix}$`);
}
/**
 * 检查键值是否属于特定角色
 */
function belongsToRole(key, role) {
    const parsed = parseMemoryKey(key);
    if (!parsed)
        return false;
    return parsed.role === role;
}
/**
 * 提取所有符合前缀的键值
 */
function filterKeysByPrefix(keys, prefix) {
    return keys.filter(key => hasPrefix(key, prefix));
}
/**
 * 提取所有符合角色的键值
 */
function filterKeysByRole(keys, role) {
    return keys.filter(key => belongsToRole(key, role));
}
/**
 * 提取所有符合类别的键值
 */
function filterKeysByCategory(keys, category) {
    return keys.filter(key => {
        const parsed = parseMemoryKey(key);
        return parsed?.category === category;
    });
}
