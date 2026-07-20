'use client';

import { useState, useMemo } from 'react';
import type { SolutionAgent } from '@originos/core/types';
import { layout as dagreLayout, Graph as DagreGraph } from '@dagrejs/dagre';

// ============================================================================
// Types & Constants
// ============================================================================

interface AgentLayoutNode {
  id: string;
  type: 'agent' | 'role-agent';
  name: string;
  responsibility?: string;
  domain?: string;
  skills: Array<{ name: string; desc?: string; inputContract?: string; outputContract?: string }>;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: 'trigger' | 'notify' | 'depend';
  description?: string;
  path: string;
  midX: number;
  midY: number;
}

const AGENT_BASE_W = 180;
const AGENT_HEADER_H = 40;
const SKILL_PILL_H = 26;
const SKILL_PILL_PAD = 8;
const V_GAP = 40;
const LAYER_GAP = 100;
const PADDING = 40;
const PORT_EDGE_SPACING = 14;
const PARALLEL_EDGE_OFFSET = 24;
const EDGE_LABEL_OFFSET_FACTOR = 0.9;

type PortSide = 'top' | 'bottom' | 'left' | 'right';

interface PortPoint {
  port: PortSide;
  x: number;
  y: number;
}

const NODE_STYLES = {
  agent: { fill: '#eff6ff', stroke: '#3b82f6', label: 'Agent', headerFill: '#dbeafe' },
  'role-agent': { fill: '#f5f3ff', stroke: '#8b5cf6', label: 'RoleAgent', headerFill: '#ede9fe' },
};

const EDGE_COLORS: Record<string, string> = {
  trigger: '#ea580c',
  notify: '#16a34a',
  depend: '#2563eb',
};

const EDGE_TYPE_LABELS: Record<string, string> = {
  trigger: '触发',
  notify: '通知',
  depend: '依赖',
};

// ============================================================================
// Layout helpers
// ============================================================================

/**
 * Compute the height needed for an agent group given its skills.
 * Header + type badge + skill pills + padding.
 */
function computeAgentHeight(skills: unknown[] = []): number {
  const skillH = skills.length * (SKILL_PILL_H + 4);
  const padBottom = skills.length > 0 ? 12 : 16;
  return AGENT_HEADER_H + skillH + padBottom;
}

/**
 * Compute the width needed for an agent group given its skills.
 * Width is max(base width, widest skill pill).
 */
function computeAgentWidth(skills: Array<string | { name?: string }> = []): number {
  const maxSkillW = skills.reduce((max, s) => {
    const name = typeof s === 'string' ? s : (s.name || '');
    return Math.max(max, name.length * 7 + 20);
  }, 0);
  return Math.max(AGENT_BASE_W, maxSkillW + SKILL_PILL_PAD * 2);
}

/**
 * Determine which side of a node an edge should connect from,
 * based on the relative position of the target.
 * Returns { port, x, y } where port is 'top'|'bottom'|'left'|'right'.
 */
function computePort(
  cx: number, cy: number, w: number, h: number,
  targetCx: number, targetCy: number,
  edgeIndex: number, edgeTotal: number
): PortPoint {
  const dx = targetCx - cx;
  const dy = targetCy - cy;

  // Determine primary side based on relative position
  let port: PortSide;
  if (Math.abs(dx) > Math.abs(dy)) {
    port = dx > 0 ? 'right' : 'left';
  } else {
    port = dy > 0 ? 'bottom' : 'top';
  }

  // Offset multiple edges along the side to prevent overlap
  const offset = edgeTotal > 1
    ? ((edgeIndex - (edgeTotal - 1) / 2) * PORT_EDGE_SPACING)
    : 0;

  let x: number, y: number;
  switch (port) {
    case 'right':
      x = cx + w / 2;
      y = cy + offset;
      break;
    case 'left':
      x = cx - w / 2;
      y = cy + offset;
      break;
    case 'bottom':
      x = cx + offset;
      y = cy + h / 2;
      break;
    case 'top':
      x = cx + offset;
      y = cy - h / 2;
      break;
  }

  return { port, x, y };
}

function getPreferredPort(node: AgentLayoutNode, target: AgentLayoutNode): PortSide {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const targetCx = target.x + target.width / 2;
  const targetCy = target.y + target.height / 2;

  return computePort(cx, cy, node.width, node.height, targetCx, targetCy, 0, 1).port;
}

/**
 * Build a bezier edge path between two port points.
 */
function buildEdgePath(
  srcPort: PortPoint,
  tgtPort: PortPoint,
  parallelIndex = 0,
  parallelTotal = 1,
): { path: string; midX: number; midY: number } {
  const { x: sx, y: sy, port: srcPortName } = srcPort;
  const { x: tx, y: ty, port: tgtPortName } = tgtPort;

  // Control point distance based on port direction and span
  const dist = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);
  const cpDist = Math.max(dist * 0.35, 20);

  // Direction vectors for control points (outward from port)
  const portDir: Record<string, { dx: number; dy: number }> = {
    right:  { dx: 1, dy: 0 },
    left:   { dx: -1, dy: 0 },
    bottom: { dx: 0, dy: 1 },
    top:    { dx: 0, dy: -1 },
  };
  const srcDir = portDir[srcPortName] ?? { dx: 1, dy: 0 };
  const tgtDir = portDir[tgtPortName] ?? { dx: -1, dy: 0 };

  const cp1x = sx + srcDir.dx * cpDist;
  const cp1y = sy + srcDir.dy * cpDist;
  const cp2x = tx + tgtDir.dx * cpDist;
  const cp2y = ty + tgtDir.dy * cpDist;

  const normalX = ty - sy;
  const normalY = -(tx - sx);
  const normalLength = Math.hypot(normalX, normalY) || 1;
  const parallelOffset = parallelTotal > 1
    ? (parallelIndex - (parallelTotal - 1) / 2) * PARALLEL_EDGE_OFFSET
    : 0;
  const offsetX = (normalX / normalLength) * parallelOffset;
  const offsetY = (normalY / normalLength) * parallelOffset;

  const path = `M ${sx} ${sy} C ${cp1x + offsetX} ${cp1y + offsetY}, ${cp2x + offsetX} ${cp2y + offsetY}, ${tx} ${ty}`;

  return {
    path,
    midX: (sx + tx) / 2 + offsetX * EDGE_LABEL_OFFSET_FACTOR,
    midY: (sy + ty) / 2 + offsetY * EDGE_LABEL_OFFSET_FACTOR,
  };
}

/**
 * Build layout using dagre hierarchical algorithm.
 * Handles both workflow (LR flow) and team (TB flow with domain grouping) views.
 */
function buildLayout(
  agents: SolutionAgent[],
  view: 'workflow' | 'team',
  skillDefs?: Array<{ id: string; name: string; code: string; description: string; capability: string; inputContract?: unknown; outputContract?: unknown; derivedFrom?: string[]; dependsOn?: string[] }>
): { nodes: AgentLayoutNode[]; edges: GraphEdge[]; width: number; height: number } {
  // Build skill lookup map
  const skillMap = new Map<string, { id: string; name: string; code: string; description: string; capability: string; inputContract?: unknown; outputContract?: unknown }>();
  for (const sd of skillDefs ?? []) {
    skillMap.set(sd.code ?? sd.id ?? sd.name, sd);
  }

  // Helper: resolve agent skill strings to full objects
  const resolveSkills = (skills: Array<unknown>) => {
    return (skills ?? []).map(s => {
      if (typeof s === 'string') {
        const def = skillMap.get(s);
        return { name: def?.name ?? s, id: s, code: s, description: def?.description ?? '', capability: def?.capability ?? '', inputContract: def?.inputContract, outputContract: def?.outputContract };
      }
      return { name: (s as any)?.name ?? (s as any)?.id ?? '', id: (s as any)?.id, code: (s as any)?.code, description: (s as any)?.description ?? '', capability: (s as any)?.capability ?? '', inputContract: (s as any)?.inputContract, outputContract: (s as any)?.outputContract };
    });
  };

  // Compute node sizes
  const agentSizes = new Map<string, { w: number; h: number }>();
  for (const ag of agents) {
    const resolved = resolveSkills(ag.skills ?? []);
    agentSizes.set(ag.id, {
      w: computeAgentWidth(resolved),
      h: computeAgentHeight(resolved),
    });
  }

  // Build dagre graph
  const g = new DagreGraph({ multigraph: true, compound: true });
  g.setGraph({
    rankdir: view === 'workflow' ? 'LR' : 'TB',
    nodesep: view === 'workflow' ? 30 : 40,
    ranksep: view === 'workflow' ? LAYER_GAP : V_GAP + 30,
    edgesep: 20,
    marginx: PADDING,
    marginy: PADDING,
    ranker: 'network-simplex',
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes with dimensions
  for (const ag of agents) {
    const size = agentSizes.get(ag.id)!;
    g.setNode(ag.id, {
      id: ag.id,
      type: ag.type,
      name: ag.name,
      responsibility: ag.responsibility,
      domain: ag.domain,
      skills: resolveSkills(ag.skills ?? []),
      width: size.w,
      height: size.h,
    });
  }

  // Add edges
  const edgeSeen = new Set<string>();
  for (const ag of agents) {
    for (const c of ag.collaborations ?? []) {
      if (!agentSizes.has(c.targetAgentId)) continue;
      const edgeKey = `${ag.id}-${c.targetAgentId}-${c.type}`;
      if (edgeSeen.has(edgeKey)) continue;
      edgeSeen.add(edgeKey);
      g.setEdge(ag.id, c.targetAgentId, { type: c.type, description: c.description, edgeKey });
    }
  }

  // Run layout
  dagreLayout(g);

  // Extract node positions
  const nodes: AgentLayoutNode[] = [];
  for (const id of g.nodes()) {
    const node = g.node(id);
    if (!node.width || !node.height) continue; // skip non-node entries
    const x = node.x - node.width / 2;
    const y = node.y - node.height / 2;
    nodes.push({
      id: node.id,
      type: node.type,
      name: node.name,
      responsibility: node.responsibility,
      domain: node.domain,
      skills: node.skills.map((s: any) => {
      const name = typeof s === 'string' ? s : (s.name || s.id || s.code || '');
      const desc = typeof s === 'string' ? '' : (s.capability || s.description || '');
      const inputContract = typeof s === 'string' ? '' : (s.inputContract?.requires?.map((r: any) => r.objectType).join(', ') || '');
      const outputContract = typeof s === 'string' ? '' : (s.outputContract?.produces?.map((p: any) => p.objectType).join(', ') || '');
      return { name, desc, inputContract, outputContract };
    }),
      x,
      y,
      width: node.width,
      height: node.height,
    });
  }

  // Extract edges with 4-directional ports
  const posLookup = new Map(nodes.map((n) => [n.id, n]));
  const graphEdges: GraphEdge[] = [];

  // Group edges by (source, target) pair to compute parallel offsets
  const edgeGroups = new Map<string, Array<{ edge: { v: string; w: string }; data: unknown }>>();
  for (const e of g.edges()) {
    const pairKey = `${e.v}-${e.w}`;
    if (!edgeGroups.has(pairKey)) edgeGroups.set(pairKey, []);
    edgeGroups.get(pairKey)!.push({ edge: e, data: g.edge(e) });
  }

  // Track edge distribution per node side so lines leaving the same side are staggered.
  const nodePortGroups = new Map<string, Array<{ edge: { v: string; w: string }; role: 'src' | 'tgt' }>>();
  for (const e of g.edges()) {
    const s = posLookup.get(e.v);
    const t = posLookup.get(e.w);
    if (!s || !t) continue;

    const srcPort = getPreferredPort(s, t);
    const tgtPort = getPreferredPort(t, s);
    const srcKey = `${s.id}:${srcPort}`;
    const tgtKey = `${t.id}:${tgtPort}`;

    if (!nodePortGroups.has(srcKey)) nodePortGroups.set(srcKey, []);
    if (!nodePortGroups.has(tgtKey)) nodePortGroups.set(tgtKey, []);
    nodePortGroups.get(srcKey)!.push({ edge: e, role: 'src' });
    nodePortGroups.get(tgtKey)!.push({ edge: e, role: 'tgt' });
  }

  const nodePortOrder = new Map<string, number>();
  const nodePortCount = new Map<string, number>();
  for (const [key, group] of nodePortGroups) {
    nodePortCount.set(key, group.length);
    group
      .slice()
      .sort((a, b) => {
        const aPeer = a.role === 'src' ? a.edge.w : a.edge.v;
        const bPeer = b.role === 'src' ? b.edge.w : b.edge.v;
        if (aPeer !== bPeer) {
          return aPeer.localeCompare(bPeer);
        }

        const aType = ((g.edge(a.edge) as { type?: string } | undefined)?.type) ?? '';
        const bType = ((g.edge(b.edge) as { type?: string } | undefined)?.type) ?? '';
        return aType.localeCompare(bType);
      })
      .forEach((item, index) => {
        const edgeType = ((g.edge(item.edge) as { type?: string } | undefined)?.type) ?? '';
        const edgeKey = `${item.edge.v}->${item.edge.w}:${item.role}:${edgeType}`;
        nodePortOrder.set(edgeKey, index);
      });
  }

  for (const [, group] of edgeGroups) {
    const sortedGroup = group
      .slice()
      .sort((a, b) => {
        const typeA = ((a.data as { type?: string } | undefined)?.type) ?? '';
        const typeB = ((b.data as { type?: string } | undefined)?.type) ?? '';
        return typeA.localeCompare(typeB);
      });

    sortedGroup.forEach(({ edge: e, data: edgeData }, parallelIndex) => {
      const s = posLookup.get(e.v);
      const t = posLookup.get(e.w);
      if (!s || !t) return;

      const sCx = s.x + s.width / 2;
      const sCy = s.y + s.height / 2;
      const tCx = t.x + t.width / 2;
      const tCy = t.y + t.height / 2;

      const srcPortName = getPreferredPort(s, t);
      const tgtPortName = getPreferredPort(t, s);
      const srcKey = `${s.id}:${srcPortName}`;
      const tgtKey = `${t.id}:${tgtPortName}`;
      const edgeType = ((edgeData as { type?: string } | undefined)?.type) ?? '';
      const srcIdx = nodePortOrder.get(`${e.v}->${e.w}:src:${edgeType}`) ?? 0;
      const tgtIdx = nodePortOrder.get(`${e.v}->${e.w}:tgt:${edgeType}`) ?? 0;

      const srcPort = computePort(sCx, sCy, s.width, s.height, tCx, tCy, srcIdx, nodePortCount.get(srcKey) ?? 1);
      const tgtPort = computePort(tCx, tCy, t.width, t.height, sCx, sCy, tgtIdx, nodePortCount.get(tgtKey) ?? 1);

      const { path, midX, midY } = buildEdgePath(srcPort, tgtPort, parallelIndex, sortedGroup.length);
      graphEdges.push({
        source: e.v,
        target: e.w,
        type: (edgeData as any)?.type ?? 'trigger',
        description: (edgeData as any)?.description,
        path,
        midX,
        midY,
      });
    });
  }

  const graphWidth = g.graph().width ?? Math.max(...nodes.map((n) => n.x + n.width + PADDING), 400);
  const graphHeight = g.graph().height ?? Math.max(...nodes.map((n) => n.y + n.height + PADDING), 200);

  return { nodes, edges: graphEdges, width: graphWidth, height: graphHeight };
}

// ============================================================================
// Detail Panel (right side)
// ============================================================================

interface DetailPanelProps {
  agent: SolutionAgent | null;
  onClose: () => void;
}

interface SkillDetail {
  name: string;
  desc: string;
  inputContract: string;
  outputContract: string;
  agentName: string;
}

interface SkillDetailPanelProps {
  skill: SkillDetail;
  onClose: () => void;
}

function SkillDetailPanel({ skill, onClose }: SkillDetailPanelProps) {
  return (
    <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto" style={{ maxHeight: '70vh' }}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">技能详情</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
            ✕
          </button>
        </div>

        {/* Skill name */}
        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
          {skill.name}
        </span>

        {/* Source agent */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">所属 Agent</h4>
          <p className="text-xs text-gray-700">{skill.agentName}</p>
        </div>

        {/* Description / Capability */}
        {skill.desc && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">能力描述</h4>
            <p className="text-xs text-gray-700 leading-relaxed">{skill.desc}</p>
          </div>
        )}

        {/* Input Contract */}
        {skill.inputContract && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">输入契约</h4>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
              <p className="text-xs text-gray-700 leading-relaxed">{skill.inputContract}</p>
            </div>
          </div>
        )}

        {/* Output Contract */}
        {skill.outputContract && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">输出契约</h4>
            <div className="rounded-lg border border-green-200 bg-green-50 p-2.5">
              <p className="text-xs text-gray-700 leading-relaxed">{skill.outputContract}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentDetailPanel({ agent, onClose }: DetailPanelProps) {
  if (!agent) return null;

  return (
    <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto" style={{ maxHeight: '70vh' }}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{agent.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
            ✕
          </button>
        </div>

        {/* Type badge */}
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
          {agent.type === 'role-agent' ? 'RoleAgent' : 'Agent'}
        </span>

        {/* Responsibility */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">职责</h4>
          <p className="text-xs text-gray-700 leading-relaxed">{String(agent.responsibility || '')}</p>
        </div>

        {/* Domain */}
        {agent.domain && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">业务领域</h4>
            <p className="text-xs text-gray-700">{agent.domain}</p>
          </div>
        )}

        {/* Skills */}
        {agent.skills && agent.skills.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">技能</h4>
            <div className="space-y-2">
              {agent.skills.map((skill, i) => {
                const name = typeof skill === 'string' ? skill : (skill.name || skill.id || skill.code || '');
                const desc = typeof skill === 'string' ? '' : (skill.capability || skill.description || '');
                const inputContract = typeof skill === 'string' ? '' : (skill as any).inputContract?.requires?.map((r: any) => r.objectType).join(', ') || '';
                const outputContract = typeof skill === 'string' ? '' : (skill as any).outputContract?.produces?.map((p: any) => p.objectType).join(', ') || '';
                return (
                  <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                    <span className="text-xs font-medium text-emerald-700">{name}</span>
                    {desc && <p className="mt-1 text-[11px] text-gray-600 leading-relaxed">{desc}</p>}
                    {(inputContract || outputContract) && (
                      <div className="flex gap-3 mt-1.5">
                        {inputContract && (
                          <span className="text-[10px] text-gray-500">
                            输入: <span className="text-gray-700">{inputContract}</span>
                          </span>
                        )}
                        {outputContract && (
                          <span className="text-[10px] text-gray-500">
                            输出: <span className="text-gray-700">{outputContract}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ontology Operations */}
        {('ontologyOperations' in agent) && Array.isArray((agent as any).ontologyOperations) && (agent as any).ontologyOperations.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">本体操作</h4>
            <div className="space-y-2">
              {(agent as any).ontologyOperations.map((op: { objectType: string; operations: string[] }, i: number) => (
                <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <span className="text-xs font-medium text-gray-800">{op.objectType}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {op.operations.map((o: string) => (
                      <span key={o} className="px-1.5 py-0.5 rounded bg-white text-[10px] font-medium text-gray-600 border border-gray-200">
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collaborations */}
        {agent.collaborations && agent.collaborations.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">协作关系</h4>
            <div className="space-y-2">
              {agent.collaborations.map((collab, i) => (
                <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EDGE_COLORS[collab.type] }} />
                    <span className="text-xs font-medium text-gray-800">{collab.targetAgentName}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 ml-3.5">{collab.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Edge Tooltip
// ============================================================================

function EdgeTooltip({
  type,
  description,
  sourceName,
  targetName,
}: {
  type: 'trigger' | 'notify' | 'depend';
  description?: string;
  sourceName?: string;
  targetName?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-lg px-3 py-2 text-xs max-w-[240px]">
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EDGE_COLORS[type] }} />
        <span className="font-semibold text-gray-800">{EDGE_TYPE_LABELS[type]}</span>
      </div>
      {(sourceName || targetName) && (
        <div className="text-[11px] text-gray-500 mb-1">
          {sourceName} → {targetName}
        </div>
      )}
      {description && <p className="text-gray-600 leading-snug">{description}</p>}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export const SolutionGraphView = ({ agents, view = 'workflow', skillDefs = [] }: { agents: SolutionAgent[]; view?: 'workflow' | 'team'; skillDefs?: Array<{ id: string; name: string; code: string; description: string; capability: string; inputContract?: unknown; outputContract?: unknown; derivedFrom?: string[]; dependsOn?: string[] }> }) => {
  const [selectedAgent, setSelectedAgent] = useState<SolutionAgent | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ edgeId: string; cx: number; cy: number } | null>(null);

  const layout = useMemo(() => {
    return buildLayout(agents, view, skillDefs);
  }, [agents, view, skillDefs]);

  // Build full collaboration map for edge labels
  const collabMap = useMemo(() => {
    const map = new Map<string, { sourceName: string; targetName: string }>();
    for (const ag of agents) {
      for (const c of ag.collaborations ?? []) {
        map.set(`${ag.id}-${c.targetAgentId}`, { sourceName: ag.name, targetName: c.targetAgentName });
      }
    }
    return map;
  }, [agents]);

  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        暂无 Agent 数据
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex-1 flex flex-col min-w-0 gap-3">
        {/* Graph container */}
        <div className="overflow-auto rounded-lg border border-gray-200 bg-white relative" style={{ maxHeight: '70vh' }}>
          <div style={{ width: Math.max(layout.width, 800), height: Math.max(layout.height, 200), position: 'relative' }}>
            <svg
              width={Math.max(layout.width, 800)}
              height={Math.max(layout.height, 200)}
              style={{ display: 'block' }}
            >
              <defs>
                {Object.entries(EDGE_COLORS).map(([type, color]) => (
                  <marker
                    key={type}
                    id={`arrow-${type}`}
                    viewBox="0 0 10 10"
                    refX="10"
                    refY="5"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill={color} />
                  </marker>
                ))}
                {/* Skill pill gradient */}
                <linearGradient id="skillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ecfdf5" />
                  <stop offset="100%" stopColor="#d1fae5" />
                </linearGradient>
              </defs>

              {/* Domain labels (Team view) */}
              {view === 'team' && Array.from(new Set(agents.map((a) => a.domain || 'default'))).map((domain) => {
                const domainAgents = agents.filter((a) => (a.domain || 'default') === domain);
                const firstNode = layout.nodes.find((n) => n.id === domainAgents[0]?.id);
                if (!firstNode) return null;
                return (
                  <text
                    key={domain}
                    x={firstNode.x}
                    y={firstNode.y - 8}
                    className="text-[11px] font-semibold"
                    fill="#6b7280"
                  >
                    {domain}
                  </text>
                );
              })}

              {/* Edges */}
              {layout.edges.map((edge) => {
                const edgeId = `${edge.source}-${edge.target}-${edge.type}`;
                const isHovered = hoveredEdge?.edgeId === edgeId;
                return (
                  <g key={edgeId}>
                    <path
                      d={edge.path}
                      fill="none"
                      stroke={EDGE_COLORS[edge.type] ?? '#9ca3af'}
                      strokeWidth={isHovered ? 3 : 2}
                      markerEnd={`url(#arrow-${edge.type})`}
                      className="transition-all duration-200"
                      style={{ opacity: isHovered ? 1 : 0.6 }}
                    />
                    <path
                      d={edge.path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16}
                      onMouseEnter={() => setHoveredEdge({ edgeId, cx: edge.midX, cy: edge.midY })}
                      onMouseLeave={() => setHoveredEdge(null)}
                      className="cursor-pointer"
                    />
                    {/* Edge type badge (always visible) */}
                    <rect
                      x={edge.midX - 16}
                      y={edge.midY - 8}
                      width={32}
                      height={16}
                      rx={8}
                      fill="white"
                      stroke={EDGE_COLORS[edge.type] ?? '#9ca3af'}
                      strokeWidth={1}
                    />
                    <text
                      x={edge.midX}
                      y={edge.midY + 4}
                      textAnchor="middle"
                      fill={EDGE_COLORS[edge.type] ?? '#9ca3af'}
                      style={{ fontSize: 9 }}
                      fontWeight={600}
                    >
                      {EDGE_TYPE_LABELS[edge.type]}
                    </text>
                  </g>
                );
              })}

              {/* Agent Groups — clickable */}
              {layout.nodes.map((node) => {
                const style = NODE_STYLES[node.type] ?? NODE_STYLES.agent;
                const r = 12;
                const isSelected = selectedAgent?.id === node.id;
                const agentData = agents.find(a => a.id === node.id);

                return (
                  <g key={node.id} onClick={() => setSelectedAgent(agentData ?? null)} className="cursor-pointer">
                    {/* Selection highlight */}
                    {isSelected && (
                      <rect
                        x={node.x - 3}
                        y={node.y - 3}
                        width={node.width + 6}
                        height={node.height + 6}
                        rx={r + 2}
                        fill="none"
                        stroke={style.stroke}
                        strokeWidth={2}
                        opacity={0.4}
                      />
                    )}
                    {/* Group shadow */}
                    <rect
                      x={node.x + 2}
                      y={node.y + 2}
                      width={node.width}
                      height={node.height}
                      rx={r}
                      fill="rgba(0,0,0,0.06)"
                    />
                    {/* Group body */}
                    <rect
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={node.height}
                      rx={r}
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    {/* Header bar */}
                    <path
                      d={`M ${node.x + r} ${node.y} L ${node.x + node.width - r} ${node.y} Q ${node.x + node.width} ${node.y} ${node.x + node.width} ${node.y + r} L ${node.x + node.width} ${node.y + AGENT_HEADER_H - 4} L ${node.x} ${node.y + AGENT_HEADER_H - 4} L ${node.x} ${node.y + r} Q ${node.x} ${node.y} ${node.x + r} ${node.y} Z`}
                      fill={style.headerFill}
                      opacity={0.6}
                    />
                    {/* Type badge */}
                    <rect
                      x={node.x + 8}
                      y={node.y + 8}
                      width={style.label.length * 6.5 + 8}
                      height={14}
                      rx={7}
                      fill={style.stroke}
                      opacity={0.2}
                    />
                    <text
                      x={node.x + 12}
                      y={node.y + 19}
                      style={{ fontSize: 9 }}
                      fill={style.stroke}
                      fontWeight={600}
                    >
                      {style.label}
                    </text>
                    {/* Agent name */}
                    <text
                      x={node.x + node.width / 2}
                      y={node.y + AGENT_HEADER_H - 8}
                      textAnchor="middle"
                      style={{ fontSize: 12 }}
                      fontWeight={700}
                      fill="#1e293b"
                    >
                      {node.name}
                    </text>

                    {/* Divider line after header */}
                    <line
                      x1={node.x + 8}
                      y1={node.y + AGENT_HEADER_H - 2}
                      x2={node.x + node.width - 8}
                      y2={node.y + AGENT_HEADER_H - 2}
                      stroke={style.stroke}
                      strokeWidth={1}
                      opacity={0.2}
                    />

                    {/* Skill pills — clickable */}
                    {node.skills.map((skill, si) => {
                      const pillX = node.x + SKILL_PILL_PAD;
                      const pillW = node.width - SKILL_PILL_PAD * 2;
                      const pillY = node.y + AGENT_HEADER_H + 4 + si * (SKILL_PILL_H + 4);

                      return (
                        <g
                          key={skill.name}
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSkill({
                              name: skill.name,
                              desc: skill.desc || '',
                              inputContract: skill.inputContract || '',
                              outputContract: skill.outputContract || '',
                              agentName: node.name,
                            });
                          }}
                        >
                          <rect
                            x={pillX}
                            y={pillY}
                            width={pillW}
                            height={SKILL_PILL_H}
                            rx={SKILL_PILL_H / 2}
                            fill="url(#skillGrad)"
                            stroke="#059669"
                            strokeWidth={1}
                            opacity={0.9}
                          />
                          <text
                            x={node.x + node.width / 2}
                            y={pillY + SKILL_PILL_H / 2 + 4}
                            textAnchor="middle"
                            style={{ fontSize: 10 }}
                            fontWeight={500}
                            fill="#065f46"
                          >
                            {(() => {
                              const n = skill.name || 'Unnamed';
                              const maxChars = Math.floor((pillW - 16) / 7);
                              return n.length > maxChars ? n.slice(0, maxChars) + '…' : n;
                            })()}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>

            {/* Hover tooltip for edge descriptions */}
            {hoveredEdge && (() => {
              const edge = layout.edges.find(e => `${e.source}-${e.target}-${e.type}` === hoveredEdge.edgeId);
              if (!edge) return null;
              const collab = collabMap.get(`${edge.source}-${edge.target}`);
              return (
                <div
                  className="absolute pointer-events-none z-10"
                  style={{
                    left: hoveredEdge.cx + 12,
                    top: hoveredEdge.cy - 10,
                  }}
                >
                  <EdgeTooltip
                    type={edge.type}
                    description={edge.description}
                    sourceName={collab?.sourceName}
                    targetName={collab?.targetName}
                  />
                </div>
              );
            })()}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-blue-500 bg-blue-50" />
            Agent
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-violet-500 bg-violet-50" />
            RoleAgent
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-emerald-500 bg-emerald-50" />
            Skill
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-orange-600" />
            触发
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-green-600" />
            通知
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-blue-600" />
            依赖
          </div>
          <div className="ml-auto text-gray-400">
            点击 Agent / Skill 查看详情 · 悬停连线查看描述
          </div>
        </div>
      </div>

      {/* Right detail panel */}
      {(selectedSkill || selectedAgent) && (
        <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto" style={{ maxHeight: '70vh' }}>
          {selectedSkill && (
            <SkillDetailPanel skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
          )}
          {selectedAgent && !selectedSkill && (
            <AgentDetailPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
          )}
          {selectedAgent && selectedSkill && (
            <AgentDetailPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
          )}
        </div>
      )}
    </div>
  );
};
