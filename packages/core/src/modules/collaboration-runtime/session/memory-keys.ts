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

/**
 * 键值前缀分类
 */
export enum MemoryKeyPrefix {
  SWARM = "swarm",                       // 协作 Agent 集群
  AGENT = "agent",                       // 单个 Agent 状态
  SHARED = "shared",                     // 跨 Agent 共享数据
  ONTOLOGY = "ontology",                 // 本体相关
  UPSTREAM = "upstream",                 // 上游产出
  METADATA = "metadata",                 // 元数据
  PROJECT = "project",                   // 项目上下文
}

/**
 * 键值类别
 */
export enum MemoryKeyCategory {
  /** 状态快照 */
  STATUS = "status",
  /** 进度更新 */
  PROGRESS = "progress",
  /** 完成报告 */
  COMPLETE = "complete",
  /** 阻塞报告 */
  BLOCKED = "blocked",
  /** 性能指标 */
  METRICS = "metrics",
  /** 权威指令 */
  DIRECTIVE = "directive",
  /** 健康监控 */
  HEALTH = "health",
  /** 定期报告 */
  REPORT = "report",
  /** 发现/观察 */
  DISCOVERY = "discovery",
}

/**
 * Supervisor 键值构建器
 */
export function buildSupervisorKey(
  category: MemoryKeyCategory,
  _sessionId: string,
  subkey?: string
): string {
  if (subkey) {
    return `${MemoryKeyPrefix.SWARM}$supervisor$${category}$${subkey}`;
  }
  return `${MemoryKeyPrefix.SWARM}$supervisor$${category}`;
}

/**
 * Worker 键值构建器
 */
export function buildWorkerKey(
  category: MemoryKeyCategory,
  workerId: string,
  subkey?: string
): string {
  if (subkey) {
    return `${MemoryKeyPrefix.SWARM}$worker-${workerId}$${category}$${subkey}`;
  }
  return `${MemoryKeyPrefix.SWARM}$worker-${workerId}$${category}`;
}

/**
 * 共享键值构建器
 */
export function buildSharedKey(
  category: MemoryKeyCategory,
  _sessionId: string,
  subkey?: string
): string {
  if (subkey) {
    return `${MemoryKeyPrefix.SHARED}$${category}$${subkey}`;
  }
  return `${MemoryKeyPrefix.SHARED}$${category}`;
}

/**
 * 上游产出键值构建器
 */
export function buildUpstreamOutputKey(agentId: string): string {
  return `${MemoryKeyPrefix.UPSTREAM}$${agentId}$output`;
}

/**
 * 上游元数据键值构建器
 */
export function buildUpstreamMetaKey(agentId: string): string {
  return `${MemoryKeyPrefix.METADATA}$upstream$${agentId}`;
}

/**
 * 项目上下文键值构建器
 */
export function buildProjectContextKey(
  projectId: string,
  agentId: string,
  suffix = "summary"
): string {
  return `${MemoryKeyPrefix.PROJECT}$context$${projectId}$${agentId}$${suffix}`;
}

/**
 * 共享知识键值构建器
 */
export function buildSharedKnowledgeKey(key: string): string {
  return `${MemoryKeyPrefix.SHARED}$knowledge$${key}`;
}

/**
 * 发现键值构建器
 */
export function buildDiscoveryKey(agentId: string, timestamp?: number): string {
  const ts = timestamp ?? Date.now();
  return `discovery$${agentId}_${ts}`;
}

/**
 * 工具调用缓存键值构建器
 */
export function buildToolResultKey(toolName: string, argsHash: string): string {
  return `shared$tool_result$${toolName}_${argsHash}`;
}

/**
 * 本体状态键值构建器
 */
export function buildOntologyStateKey(agentId: string): string {
  return `${MemoryKeyPrefix.ONTOLOGY}_state$${agentId}`;
}

/**
 * 解析键值组件
 */
export function parseMemoryKey(key: string): {
  prefix: string;
  role?: string;
  category?: string;
  subkey?: string;
} | null {
  const parts = key.split("$");
  if (parts.length < 2) return null;

  const prefix = parts[0]!;

  // 检查是否是有效的已知前缀
  const validPrefixes = Object.values(MemoryKeyPrefix);
  if (!validPrefixes.includes(prefix as MemoryKeyPrefix)) {
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
export function hasPrefix(key: string, prefix: MemoryKeyPrefix): boolean {
  return key.startsWith(`${prefix}$`);
}

/**
 * 检查键值是否属于特定角色
 */
export function belongsToRole(key: string, role: string): boolean {
  const parsed = parseMemoryKey(key);
  if (!parsed) return false;
  return parsed.role === role;
}

/**
 * 提取所有符合前缀的键值
 */
export function filterKeysByPrefix(keys: string[], prefix: MemoryKeyPrefix): string[] {
  return keys.filter(key => hasPrefix(key, prefix));
}

/**
 * 提取所有符合角色的键值
 */
export function filterKeysByRole(keys: string[], role: string): string[] {
  return keys.filter(key => belongsToRole(key, role));
}

/**
 * 提取所有符合类别的键值
 */
export function filterKeysByCategory(keys: string[], category: MemoryKeyCategory): string[] {
  return keys.filter(key => {
    const parsed = parseMemoryKey(key);
    return parsed?.category === category;
  });
}
