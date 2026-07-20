"use strict";
/**
 * Topology Parser — 解析 Solution Manifest → CollaborationTopology。
 *
 * Story 9.7: 协作拓扑解析器
 *
 * 功能：
 * - 从 Solution Manifest JSON 解析 agents map + edges
 * - 识别 entryPoints（无入边的 Agent）和 exitPoints（无出边的 Agent）
 * - 自动判定执行模式（Workflow vs System）
 * - 检测循环依赖
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTopology = parseTopology;
// ============================================================================
// 拓扑解析
// ============================================================================
/**
 * 从 Solution Manifest 解析协作拓扑。
 */
function parseTopology(manifest) {
    const agents = parseAgents(manifest.agents ?? []);
    const edges = parseEdges(manifest.collaboration?.edges ?? []);
    const entryPoints = findEntryPoints(agents, edges);
    const exitPoints = findExitPoints(agents, edges);
    const mode = determineMode(edges);
    // System 模式允许双向通信（hub-and-spoke、回报边等），只在 Workflow 模式检测循环
    if (mode === "workflow") {
        detectCycles(agents, edges);
    }
    return { agents, edges, entryPoints, exitPoints, mode };
}
/**
 * 从 Agent 定义列表构建 AgentNode map。
 * 从 responsibility 字段提取 capabilities（简单关键词解析）。
 */
function parseAgents(agents) {
    const result = {};
    for (const a of agents) {
        const capabilities = extractCapabilities(a.responsibility);
        result[a.id] = {
            id: a.id,
            name: a.name,
            domain: a.domain ?? a.businessDomain ?? "",
            responsibility: a.responsibility,
            capabilities,
            dataOperations: a.dataOperations ?? {},
            skills: a.skills ?? [],
        };
    }
    return result;
}
/**
 * 从 responsibility 文本中提取能力关键词。
 * 简单策略：按句号/分号分割，取每句的第一个动词短语。
 */
function extractCapabilities(responsibility) {
    const sentences = responsibility
        .split(/[.;，。；\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    return sentences
        .map((s) => {
        // 提取动词开头的短语（中文或英文）
        const match = s.match(/^(?:负责|处理|管理|执行|分析|生成|创建|验证|协调|驱动|实现)\s*[:：]?\s*(.{2,30}?)(?:，|,|。|;|$)/i)
            ?? s.match(/^(\w+(?:\s+\w+){0,3})\s*[-:：]/);
        return match ? match[1]?.trim() ?? s.slice(0, 30).trim() : s.slice(0, 30).trim();
    })
        .filter((c) => c.length > 1);
}
/**
 * 解析协作边列表。
 */
function parseEdges(edges) {
    return edges.map((e) => ({
        from: e.from,
        to: e.to,
        type: e.type,
        description: e.description ?? "",
    }));
}
/**
 * 找出 entryPoints — 无入边的 Agent。
 */
function findEntryPoints(agents, edges) {
    const hasIncoming = new Set();
    for (const e of edges) {
        hasIncoming.add(e.to);
    }
    return Object.keys(agents).filter((id) => !hasIncoming.has(id));
}
/**
 * 找出 exitPoints — 无出边的 Agent。
 */
function findExitPoints(agents, edges) {
    const hasOutgoing = new Set();
    for (const e of edges) {
        hasOutgoing.add(e.from);
    }
    return Object.keys(agents).filter((id) => !hasOutgoing.has(id));
}
/**
 * 判定执行模式。
 * - 全 trigger 且无双向 trigger 边 → Workflow 模式（单向 DAG）
 * - 存在 notify/depend，或存在双向 trigger（hub-and-spoke 汇报模式）→ System 模式
 */
function determineMode(edges) {
    const hasNotifyOrDepend = edges.some((e) => e.type === "notify" || e.type === "depend");
    if (hasNotifyOrDepend)
        return "system";
    // 双向 trigger（A→B 且 B→A）= hub-and-spoke 汇报模式 → System
    const triggerPairs = new Set(edges.filter((e) => e.type === "trigger").map((e) => `${e.from}→${e.to}`));
    const hasBidirectional = edges.some((e) => e.type === "trigger" && triggerPairs.has(`${e.to}→${e.from}`));
    return hasBidirectional ? "system" : "workflow";
}
/**
 * 检测循环依赖（DFS）。
 * 若检测到循环则抛出异常。
 */
function detectCycles(agents, edges) {
    // 构建邻接表 — 只含 trigger/depend 边（notify 是发布-订阅，允许双向，不构成 DAG 依赖）
    const adj = {};
    for (const id of Object.keys(agents)) {
        adj[id] = [];
    }
    for (const e of edges) {
        if (e.type === "notify")
            continue;
        if (adj[e.from]) {
            adj[e.from].push(e.to);
        }
    }
    // DFS 三色标记法检测循环
    const WHITE = 0; // 未访问
    const GRAY = 1; // 正在访问（当前 DFS 栈中）
    const BLACK = 2; // 已访问完成
    const color = {};
    for (const id of Object.keys(agents)) {
        color[id] = WHITE;
    }
    const cycle = [];
    function dfs(node) {
        color[node] = GRAY;
        cycle.push(node);
        for (const neighbor of adj[node] ?? []) {
            if (color[neighbor] === GRAY) {
                // 找到循环：从 neighbor 到当前 node 的路径
                const cycleStart = cycle.indexOf(neighbor);
                const cyclePath = cycle.slice(cycleStart).join(" → ");
                throw new Error(`Circular dependency detected: ${cyclePath} → ${neighbor}`);
            }
            if (color[neighbor] === WHITE) {
                if (dfs(neighbor))
                    return true;
            }
        }
        color[node] = BLACK;
        cycle.pop();
        return false;
    }
    for (const id of Object.keys(agents)) {
        if (color[id] === WHITE) {
            dfs(id);
        }
    }
}
