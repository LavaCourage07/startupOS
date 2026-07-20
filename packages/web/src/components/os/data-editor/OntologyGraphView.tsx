'use client';

import { useCallback, useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ReactFlow, Controls, Background, Handle, Position, useNodesState, useEdgesState, type Node, type Edge, type OnConnect, MarkerType, SelectionMode } from '@xyflow/react';
import { Plus } from 'lucide-react';
import type { InstanceData } from '@originos/core/lib/features/ontology-data-store/types';
import type { InstanceRelation, ConceptRelation } from '@originos/core/lib/features/ontology-data-store/relation-validator';

interface ConceptInfo {
  id: string;
  name: string;
  domainId: string;
  description?: string;
}

interface OntologyGraphViewProps {
  ontologyId: string;
  concepts: ConceptInfo[];
  relations: ConceptRelation[];
  instances: InstanceData[];
  instanceRelations: InstanceRelation[];
  onNodeSelect: (instance: InstanceData) => void;
  onAddNode: (conceptId: string) => void;
  onCreateRelationRequest: (sourceId: string, targetId: string) => void;
  onDeleteNode: (instanceId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onCreateRelatedInstance: (sourceInstanceId: string, conceptId: string, relationType: string) => void;
  onCreateRelatedInstanceAsTarget: (targetInstanceId: string, conceptId: string, relationType: string) => void;
  onSelectionChange?: (instanceIds: string[]) => void;
}

interface NodeColorMap {
  bg: string;
  border: string;
  text: string;
  nodeBg: string;
}

const DEFAULT_COLORS: NodeColorMap = { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3', nodeBg: '#eef2ff' };

function hashColor(str: string): NodeColorMap {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return {
    bg: `hsl(${h}, 70%, 92%)`,
    border: `hsl(${h}, 60%, 50%)`,
    text: `hsl(${h}, 70%, 30%)`,
    nodeBg: `hsl(${h}, 70%, 96%)`,
  };
}

// Global callback registry so InstanceNode can call parent callbacks through node data
const hoverCallbacks = new Map<string, {
  getButtonElement: () => HTMLDivElement | null;
  onHover: (info: { nodeId: string; conceptId: string }) => void;
  onLeave: () => void;
}>();

function registerHoverCallback(nodeId: string, cb: {
  getButtonElement: () => HTMLDivElement | null;
  onHover: (info: { nodeId: string; conceptId: string }) => void;
  onLeave: () => void;
}) {
  hoverCallbacks.set(nodeId, cb);
}
function unregisterHoverCallback(nodeId: string) {
  hoverCallbacks.delete(nodeId);
}

function InstanceNode({ data }: { data: Record<string, unknown> }) {
  const colors = (data['colors'] as NodeColorMap | undefined) ?? DEFAULT_COLORS;
  const conceptName = (data['conceptName'] as string | undefined) ?? '';
  const label = (data['label'] as string | undefined) ?? '';
  const subtitle = (data['subtitle'] as string | undefined) ?? '';
  const conceptId = (data['conceptId'] as string | undefined) ?? '';
  const nodeId = (data['nodeId'] as string | undefined) ?? '';
  const onHandleHover = data['onHandleHover'] as ((info: { nodeId: string; conceptId: string }) => void) | undefined;
  const onHandleLeave = data['onHandleLeave'] as (() => void) | undefined;

  const handleRef = useRef<HTMLDivElement>(null);

  // Register callbacks on mount — includes a getter for the button DOM element
  useEffect(() => {
    registerHoverCallback(nodeId, {
      getButtonElement: () => handleRef.current,
      onHover: (info) => onHandleHover?.(info),
      onLeave: () => onHandleLeave?.(),
    });
    return () => unregisterHoverCallback(nodeId);
  }, [nodeId, onHandleHover, onHandleLeave]);

  const handleMouseEnter = useCallback(() => {
    const cb = hoverCallbacks.get(nodeId);
    cb?.onHover({ nodeId, conceptId });
  }, [nodeId, conceptId]);

  const handleMouseLeave = useCallback(() => {
    const cb = hoverCallbacks.get(nodeId);
    cb?.onLeave();
  }, [nodeId]);

  return (
    <div
      className={`rounded-lg border-2 shadow-sm transition-shadow relative shadow-sm hover:shadow-md`}
      style={{ backgroundColor: colors.nodeBg, borderColor: colors.border, minWidth: 160, maxWidth: 200 }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="px-3 py-2" style={{ borderBottom: `1px solid ${colors.border}33` }}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.border }} />
          <span className="text-xs font-semibold" style={{ color: colors.text }}>{conceptName}</span>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="text-sm font-medium text-gray-800 truncate">{label}</div>
        {subtitle && <div className="text-xs text-gray-500 truncate mt-0.5">{subtitle}</div>}
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} />

      {/* Right handle with "+" button */}
      <div
        ref={handleRef}
        className="absolute"
        style={{ right: -10, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
      >
        <Handle type="source" position={Position.Right} id="add-handle" className="!w-3 !h-3 !opacity-0" />
        <div
          className="w-5 h-5 rounded-full bg-white border-2 border-gray-300 shadow flex items-center justify-center cursor-pointer transition-all hover:border-blue-400 hover:text-blue-500 hover:scale-110 hover:shadow-md text-blue-500"
          style={{ width: 20, height: 20 }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Plus className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { instance: InstanceNode };

export function OntologyGraphView({
  concepts,
  relations,
  instances,
  instanceRelations,
  onNodeSelect,
  onAddNode,
  onCreateRelationRequest,
  onDeleteNode,
  onDeleteEdge,
  onCreateRelatedInstance,
  onCreateRelatedInstanceAsTarget,
  onSelectionChange,
}: OntologyGraphViewProps) {
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; instanceId: string } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const [handleHover, setHandleHover] = useState<{ nodeId: string; conceptId: string } | null>(null);

  // Portal container for popup to avoid transform/contain issues
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    setPortalContainer(el);
    return () => { document.body.removeChild(el); };
  }, []);

  // Delay clearing so mouse can travel from + button to popup
  const [hoverTimeout, setHoverTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const scheduleHoverClose = useCallback(() => {
    const t = setTimeout(() => setHandleHover(null), 500);
    setHoverTimeout(t);
  }, []);
  const cancelHoverClose = useCallback(() => {
    if (hoverTimeout) { clearTimeout(hoverTimeout); setHoverTimeout(null); }
  }, [hoverTimeout]);

  const conceptColorMap = useMemo(() => {
    const map: Record<string, NodeColorMap> = {};
    concepts.forEach(c => { map[c.id] = hashColor(c.id); });
    return map;
  }, [concepts]);

  // Connected concept IDs from relations definition — both outgoing and incoming
  const connectedConcepts = useMemo(() => {
    // outgoing: sourceId → targetId
    const outgoing: Record<string, Array<{ targetId: string; type: string }>> = {};
    // incoming: targetId → sourceId
    const incoming: Record<string, Array<{ sourceId: string; type: string }>> = {};
    relations.forEach(r => {
      const outs = outgoing[r.sourceId] ??= [];
      if (!outs.find(o => o.targetId === r.targetId)) {
        outs.push({ targetId: r.targetId, type: r.type });
      }
      const ins = incoming[r.targetId] ??= [];
      if (!ins.find(i => i.sourceId === r.sourceId)) {
        ins.push({ sourceId: r.sourceId, type: r.type });
      }
    });
    return { outgoing, incoming };
  }, [relations]);

  const rfNodes: Node[] = useMemo(() => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(instances.length)));
    return instances.map((inst, i) => {
      const colors = conceptColorMap[inst.conceptId] ?? DEFAULT_COLORS;
      const concept = concepts.find(c => c.id === inst.conceptId);
      const firstField = Object.entries(inst.fields)[0];
      return {
        id: inst.id,
        type: 'instance',
        position: { x: 50 + (i % cols) * 240, y: 50 + Math.floor(i / cols) * 130 },
        data: {
          nodeId: inst.id,
          label: String(firstField?.[1] ?? inst.id),
          subtitle: firstField ? `${String(firstField[0])}: ${String(firstField[1]).slice(0, 20)}` : '',
          conceptName: concept?.name ?? inst.conceptId,
          conceptId: inst.conceptId,
          colors,
          instance: inst,
          onHandleHover: (info: { nodeId: string; conceptId: string }) => { cancelHoverClose(); setHandleHover(info); },
          onHandleLeave: () => scheduleHoverClose(),
        },
      };
    });
  }, [instances, conceptColorMap, concepts]);

  const rfEdges: Edge[] = useMemo(() => {
    return instanceRelations.map(r => ({
      id: r.id,
      source: r.sourceInstanceId,
      target: r.targetInstanceId,
      label: r.type,
      labelStyle: { fontSize: 11, fill: '#666' },
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#94a3b8' },
    }));
  }, [instanceRelations]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(rfNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(rfEdges);

  useEffect(() => {
    setFlowNodes(rfNodes);
  }, [rfNodes, setFlowNodes]);

  useEffect(() => {
    setFlowEdges(rfEdges);
  }, [rfEdges, setFlowEdges]);

  useEffect(() => {
    const selectedIds = flowNodes
      .filter(node => node.selected)
      .map(node => node.id);
    onSelectionChange?.(selectedIds);
  }, [flowNodes, onSelectionChange]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const inst = instances.find(i => i.id === node.id);
    if (inst) onNodeSelect(inst);
    setNodeContextMenu(null);
    setEdgeContextMenu(null);
  }, [instances, onNodeSelect]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setNodeContextMenu({ x: event.clientX, y: event.clientY, instanceId: node.id });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setEdgeContextMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
  }, []);

  const onPaneClick = useCallback(() => {
    setNodeContextMenu(null);
    setEdgeContextMenu(null);
  }, []);

  const onConnect: OnConnect = useCallback((params) => {
    const sourceNode = instances.find(i => i.id === params.source);
    const targetNode = instances.find(i => i.id === params.target);
    if (sourceNode && targetNode) {
      onCreateRelationRequest(sourceNode.id, targetNode.id);
    }
    const edge: Edge = {
      id: `temp-${params.source}-${params.target}`,
      source: params.source ?? '',
      target: params.target ?? '',
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#94a3b8' },
    };
    setFlowEdges((prev: Edge[]) => [...prev, edge]);
  }, [instances, onCreateRelationRequest, setFlowEdges]);

  const handleDeleteNode = useCallback(() => {
    if (nodeContextMenu?.instanceId) {
      onDeleteNode(nodeContextMenu.instanceId);
    }
    setNodeContextMenu(null);
  }, [nodeContextMenu, onDeleteNode]);

  const handleDeleteEdge = useCallback(() => {
    if (edgeContextMenu?.edgeId) {
      onDeleteEdge(edgeContextMenu.edgeId);
    }
    setEdgeContextMenu(null);
  }, [edgeContextMenu, onDeleteEdge]);

  // Handle "+" hover on node to create related instance
  const handleCreateFromHandle = useCallback((conceptId: string, relationType: string, direction: 'outgoing' | 'incoming') => {
    if (direction === 'outgoing') {
      // Current node is source, new instance is target
      onCreateRelatedInstance(handleHover?.nodeId ?? '', conceptId, relationType);
    } else {
      // Current node is target, new instance is source
      onCreateRelatedInstanceAsTarget(handleHover?.nodeId ?? '', conceptId, relationType);
    }
    setHandleHover(null);
  }, [handleHover, onCreateRelatedInstance, onCreateRelatedInstanceAsTarget]);

  // Get connected concepts with their relationship type for the popup — both directions
  const getConnectedConceptNames = useCallback((sourceConceptId: string) => {
    const results: Array<{ id: string; name: string; relType: string; direction: 'outgoing' | 'incoming' }> = [];
    // Outgoing: this concept → other concept
    const outs = connectedConcepts.outgoing[sourceConceptId] ?? [];
    for (const o of outs) {
      const c = concepts.find(con => con.id === o.targetId);
      if (c) results.push({ id: c.id, name: c.name, relType: o.type, direction: 'outgoing' });
    }
    // Incoming: other concept → this concept
    const ins = connectedConcepts.incoming[sourceConceptId] ?? [];
    for (const i of ins) {
      const c = concepts.find(con => con.id === i.sourceId);
      if (c) results.push({ id: c.id, name: c.name, relType: i.type, direction: 'incoming' });
    }
    return results;
  }, [connectedConcepts, concepts]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Controls />
        <Background />
      </ReactFlow>

      <div className="pointer-events-none absolute left-3 bottom-3 rounded border border-gray-200 bg-white/95 px-3 py-2 text-xs text-gray-500 shadow-sm">
        拖拽空白区域可框选实例，按住 Shift 可继续多选
      </div>

      {/* Node context menu */}
      {nodeContextMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-36"
          style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 text-gray-700"
            onClick={() => {
              const inst = instances.find(i => i.id === nodeContextMenu.instanceId);
              if (inst) onNodeSelect(inst);
              setNodeContextMenu(null);
            }}
          >
            编辑实例
          </button>
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 text-blue-600"
            onClick={() => {
              onAddNode('');
              setNodeContextMenu(null);
            }}
          >
            新增实例
          </button>
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-red-50 text-red-600"
            onClick={handleDeleteNode}
          >
            删除实例
          </button>
        </div>
      )}

      {/* Edge context menu */}
      {edgeContextMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-32"
          style={{ left: edgeContextMenu.x, top: edgeContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-red-50 text-red-600"
            onClick={handleDeleteEdge}
          >
            删除关系
          </button>
        </div>
      )}

      {/* Hover handle popup: create related instance — rendered via portal to body */}
      {handleHover && portalContainer && (() => {
        const cb = hoverCallbacks.get(handleHover.nodeId);
        const buttonEl = cb?.getButtonElement?.();
        if (!buttonEl) return null;

        // Calculate viewport position at render time from the actual DOM element
        const rect = buttonEl.getBoundingClientRect();
        const left = rect.right + 12;
        const top = rect.top + rect.height / 2 - 40;

        const node = instances.find(i => i.id === handleHover.nodeId);
        if (!node) return null;
        const connected = getConnectedConceptNames(node.conceptId);
        if (connected.length === 0) return null;
        return createPortal(
          <div
            className="fixed z-[9999] bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-40"
            style={{ left, top }}
            onMouseEnter={cancelHoverClose}
            onMouseLeave={() => setHandleHover(null)}
          >
            <div className="px-3 py-1 text-xs text-gray-400 border-b border-gray-100">创建关联实例</div>
            {connected.map(c => (
              <button
                key={c.id}
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-blue-50 text-gray-700 transition-colors flex items-center gap-2"
                onClick={() => handleCreateFromHandle(c.id, c.relType, c.direction)}
              >
                <span className="text-xs text-blue-500 font-medium whitespace-nowrap">[{c.relType}]</span>
                <span className="text-gray-400 whitespace-nowrap">{c.direction === 'incoming' ? '←' : '→'}</span>
                <span>+ {c.name}</span>
              </button>
            ))}
          </div>,
          portalContainer
        );
      })()}

      {/* Click outside to close context menus */}
      {(nodeContextMenu || edgeContextMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setNodeContextMenu(null); setEdgeContextMenu(null); }}
        />
      )}
    </div>
  );
}
