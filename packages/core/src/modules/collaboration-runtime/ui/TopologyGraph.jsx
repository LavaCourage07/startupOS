"use client";
import { useMemo } from "react";
const NODE_WIDTH = 180;
const HEADER_HEIGHT = 32;
const BODY_MIN_HEIGHT = 28;
const BADGE_HEIGHT = 16;
const PADDING = 32;
const STATUS_STYLES = {
    idle: { shell: "#ffffff", header: "#f8fafc", accent: "#e2e8f0", dot: "#94a3b8", label: "Idle" },
    thinking: { shell: "#ffffff", header: "#eff6ff", accent: "#bfdbfe", dot: "#3b82f6", label: "Thinking" },
    tool_call: { shell: "#ffffff", header: "#fff7ed", accent: "#fed7aa", dot: "#f97316", label: "Tool Call" },
    complete: { shell: "#ffffff", header: "#ecfdf5", accent: "#a7f3d0", dot: "#10b981", label: "Complete" },
    fail: { shell: "#ffffff", header: "#fef2f2", accent: "#fecaca", dot: "#ef4444", label: "Failed" },
    waiting: { shell: "#ffffff", header: "#fffbeb", accent: "#fde68a", dot: "#f59e0b", label: "Waiting" },
};
const EDGE_STYLES = {
    trigger: { stroke: "#f97316", label: "触发" },
    notify: { stroke: "#22c55e", label: "通知", dash: "7 6" },
    depend: { stroke: "#3b82f6", label: "依赖" },
};
function estimateNodeHeight() {
    return HEADER_HEIGHT + BODY_MIN_HEIGHT + 4;
}
function buildLayout(topology) {
    if (!topology) {
        return { nodes: [], edges: [], width: 0, height: 0 };
    }
    const agents = Object.values(topology.agents);
    const layoutEdgesSource = topology.edges.filter((edge) => edge.type === "trigger" || edge.type === "depend");
    const inDegree = new Map();
    const outgoing = new Map();
    const depthMap = new Map();
    for (const agent of agents) {
        inDegree.set(agent.id, 0);
        outgoing.set(agent.id, []);
    }
    for (const edge of layoutEdgesSource) {
        inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
        outgoing.get(edge.from)?.push(edge.to);
    }
    const queue = [];
    for (const agent of agents) {
        if ((inDegree.get(agent.id) ?? 0) === 0) {
            queue.push(agent.id);
            depthMap.set(agent.id, 0);
        }
    }
    while (queue.length > 0) {
        const current = queue.shift();
        const currentDepth = depthMap.get(current) ?? 0;
        for (const next of outgoing.get(current) ?? []) {
            depthMap.set(next, Math.max(depthMap.get(next) ?? 0, currentDepth + 1));
            const nextInDegree = (inDegree.get(next) ?? 0) - 1;
            inDegree.set(next, nextInDegree);
            if (nextInDegree === 0) {
                queue.push(next);
            }
        }
    }
    const layers = new Map();
    for (const agent of agents) {
        const depth = depthMap.get(agent.id) ?? 0;
        const layer = layers.get(depth) ?? [];
        layer.push(agent);
        layers.set(depth, layer);
    }
    const levelGapX = 240;
    const levelGapY = 120;
    const nodes = [];
    const layerEntries = Array.from(layers.entries()).sort((a, b) => a[0] - b[0]);
    for (const [depth, layerAgents] of layerEntries) {
        layerAgents.forEach((agent, index) => {
            nodes.push({
                id: agent.id,
                name: agent.name,
                domain: agent.domain,
                width: NODE_WIDTH,
                height: estimateNodeHeight(),
                x: PADDING + depth * levelGapX,
                y: PADDING + index * levelGapY,
            });
        });
    }
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const edges = topology.edges
        .map((edge) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) {
            return null;
        }
        const fromX = from.x + from.width;
        const fromY = from.y + from.height / 2;
        const toX = to.x;
        const toY = to.y + to.height / 2;
        const midX = (fromX + toX) / 2;
        const bend = edge.type === "notify" ? 28 : 0;
        const path = `M ${fromX} ${fromY} C ${midX + bend} ${fromY}, ${midX - bend} ${toY}, ${toX} ${toY}`;
        return {
            id: `${edge.from}-${edge.to}-${edge.type}`,
            from: edge.from,
            to: edge.to,
            type: edge.type,
            description: edge.description,
            path,
            labelX: midX,
            labelY: (fromY + toY) / 2 - 14,
        };
    })
        .filter((edge) => edge !== null);
    const width = Math.max(...nodes.map((node) => node.x + node.width), 0) + PADDING;
    const height = Math.max(...nodes.map((node) => node.y + node.height), 0) + PADDING;
    return { nodes, edges, width, height };
}
export function TopologyGraph({ topology, activities, recentlyActiveAgents = [], onNodeClick }) {
    const layout = useMemo(() => buildLayout(topology), [topology]);
    if (!topology || layout.nodes.length === 0) {
        return (<div className="flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-slate-50 text-sm text-slate-400">
        暂无拓扑数据
      </div>);
    }
    return (<div className="flex h-full flex-col rounded-2xl bg-gradient-to-br from-blue-50/60 via-indigo-50/40 to-slate-50/80 p-4">
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-blue-50/40 p-3">
        <svg width="100%" height="100%" className="block" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="node-shadow" x="-8%" y="-8%" width="116%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="rgba(15,23,42,0.06)"/>
            </filter>
            {Object.entries(EDGE_STYLES).map(([type, style]) => (<marker key={type} id={`collab-arrow-${type}`} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 6 L 0 11 z" fill={style.stroke}/>
              </marker>))}
          </defs>

          {layout.edges.map((edge) => {
            const style = EDGE_STYLES[edge.type] ?? EDGE_STYLES["trigger"];
            return (<g key={edge.id}>
                <path d={edge.path} fill="none" stroke={style.stroke} strokeWidth={1.5} strokeDasharray={style.dash} markerEnd={`url(#collab-arrow-${edge.type})`} opacity={0.75}/>
                <g transform={`translate(${edge.labelX}, ${edge.labelY})`}>
                  <rect x={-24} y={-9} width={48} height={18} rx={9} fill="white" stroke={style.stroke} strokeWidth={0.7} opacity={0.92}/>
                  <text textAnchor="middle" dy="0.35em" className="text-[9px] font-medium" fill={style.stroke}>
                    {style.label}
                  </text>
                </g>
              </g>);
        })}

          {layout.nodes.map((node) => {
            const activity = activities?.[node.id];
            const status = activity?.status ?? "idle";
            const styles = STATUS_STYLES[status];
            const statusLabel = styles.label;
            const isActive = recentlyActiveAgents.includes(node.id);
            return (<g key={node.id} onClick={() => onNodeClick?.(node.id)} className="cursor-pointer">
                {/* Pulse glow for newly active agents */}
                {isActive && (<rect x={node.x - 3} y={node.y - 3} width={node.width + 6} height={node.height + 6} rx={18} fill="none" stroke={styles.dot} strokeWidth={1.5} opacity={0.5}>
                    <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.2s" repeatCount="indefinite"/>
                  </rect>)}
                <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={16} fill={styles.shell} stroke={styles.accent} strokeWidth={0.8} filter="url(#node-shadow)"/>
                <rect x={node.x} y={node.y} width={node.width} height={HEADER_HEIGHT} rx={20} fill={styles.header}/>
                <rect x={node.x} y={node.y + HEADER_HEIGHT - 12} width={node.width} height={12} fill={styles.header}/>
                <circle cx={node.x + 14} cy={node.y + 16} r={4} fill={styles.dot}/>
                <text x={node.x + 28} y={node.y + 17} className="fill-slate-900 text-[10px] font-semibold">
                  {node.name}
                </text>

                <g transform={`translate(${node.x + node.width - 56}, ${node.y + 8})`}>
                  <rect width={46} height={BADGE_HEIGHT} rx={8} fill={styles.header} stroke={styles.accent} strokeWidth={0.5}/>
                  <text x={23} y={10} textAnchor="middle" className="text-[7px] font-semibold" fill={styles.dot}>
                    {statusLabel}
                  </text>
                </g>

                <text x={node.x + 14} y={node.y + 50} className="fill-slate-500 text-[8px] font-medium">
                  {node.domain || "未分配领域"}
                </text>
              </g>);
        })}
        </svg>
      </div>
    </div>);
}
