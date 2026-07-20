'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow, ReactFlowProvider, Controls, Background, Handle, Position,
  useNodesState, useEdgesState, useReactFlow,
  type Node, type Edge, type OnConnect,
  MarkerType,
} from '@xyflow/react';
import { Plus, X, Trash2, Save } from 'lucide-react';
import type { ConceptRelation } from '@originos/core/lib/features/ontology-data-store/relation-validator';
import type { ConceptField } from '@originos/core/lib/features/ontology-data-store/types';
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force';
import { getConceptSchema } from '@originos/core/lib/integrations/electron/services/ontology-data';

const FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'array', 'object'] as const;
const CONCEPT_FIELD_TYPES = new Set(['string', 'number', 'boolean', 'date', 'array', 'object', 'relation']);

function isConceptField(value: unknown): value is ConceptField {
  if (!value || typeof value !== 'object') return false;
  const field = value as Partial<ConceptField>;
  return typeof field.name === 'string'
    && typeof field.type === 'string'
    && CONCEPT_FIELD_TYPES.has(field.type)
    && typeof field.required === 'boolean';
}

function hashColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return { bg: `hsl(${h}, 70%, 92%)`, border: `hsl(${h}, 60%, 50%)`, text: `hsl(${h}, 70%, 30%)` };
}

function ConceptNode({ data }: { data: Record<string, unknown> }) {
  const colors = (data['colors'] as { bg: string; border: string; text: string }) ?? { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' };
  const name = (data['name'] as string) ?? '';
  const conceptType = (data['conceptType'] as string) ?? '';

  return (
    <div
      className="rounded-lg border-2 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
      style={{ backgroundColor: colors.bg, borderColor: colors.border, minWidth: 150, maxWidth: 200 }}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="px-3 py-2">
        <div className="text-sm font-semibold truncate" style={{ color: colors.text }}>{name}</div>
        {conceptType && <div className="text-xs px-1.5 py-0.5 rounded bg-white/40 text-gray-500 mt-1">{conceptType}</div>}
      </div>
    </div>
  );
}

const nodeTypes = { concept: ConceptNode };

interface OntologyConceptGraphEditorProps {
  ontologyId: string;
  concepts: Array<{ id: string; domainId: string; name: string; type: string; description?: string }>;
  relations: ConceptRelation[];
  onConceptCreate: (concept: { name: string; domainId: string; description?: string }) => void;
  onConceptDelete: (conceptId: string) => void;
  onConceptSchemaSave?: (conceptId: string, conceptData: { name: string; domainId: string; type: string; description?: string }, fields: ConceptField[]) => void;
  onRelationCreate: (rel: { sourceId: string; targetId: string; type: string; cardinality: string }) => void;
  onRelationDelete: (relationId: string) => void;
  onClose: () => void;
}

export function OntologyConceptGraphEditor({
  ontologyId, concepts, relations,
  onConceptCreate, onConceptDelete,
  onConceptSchemaSave, onRelationCreate, onRelationDelete,
  onClose: _onClose,
}: OntologyConceptGraphEditorProps) {
  return (
    <ReactFlowProvider>
      <OntologyConceptGraphEditorInner
        ontologyId={ontologyId}
        concepts={concepts}
        relations={relations}
        onConceptCreate={onConceptCreate}
        onConceptDelete={onConceptDelete}
        onConceptSchemaSave={onConceptSchemaSave}
        onRelationCreate={onRelationCreate}
        onRelationDelete={onRelationDelete}
        onClose={_onClose}
      />
    </ReactFlowProvider>
  );
}

function OntologyConceptGraphEditorInner({
  ontologyId, concepts, relations,
  onConceptCreate, onConceptDelete,
  onConceptSchemaSave, onRelationCreate, onRelationDelete,
  onClose: _onClose,
}: OntologyConceptGraphEditorProps) {
  const { fitView } = useReactFlow();
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; conceptId: string } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; relationId: string } | null>(null);
  const [editingConceptId, setEditingConceptId] = useState<string | null>(null);
  const [showConceptCreate, setShowConceptCreate] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Schema loading state for the right panel
  const [panelFields, setPanelFields] = useState<ConceptField[]>([]);
  const [panelFieldsLoading, setPanelFieldsLoading] = useState(false);
  const [panelEditingField, setPanelEditingField] = useState<number | null>(null);
  const [panelAddingField, setPanelAddingField] = useState(false);

  // Edit form state for right panel
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const rfEdges: Edge[] = useMemo(() => {
    return relations.map(r => ({
      id: r.id,
      source: r.sourceId,
      target: r.targetId,
      label: `${r.type} (${r.cardinality})`,
      labelStyle: { fontSize: 11, fill: '#666' },
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#94a3b8' },
    }));
  }, [relations]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([] as Node[]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  // Build node positions with d3 force layout — only when the concept list itself changes
  const conceptIds = concepts.map(c => c.id).join(',');
  useEffect(() => {
    if (concepts.length === 0) return;

    const simNodes = concepts.map(c => ({
      id: c.id,
      x: (Math.random() - 0.5) * 400,
      y: (Math.random() - 0.5) * 400,
    }));
    const simLinks = relations
      .filter(r => concepts.some(c => c.id === r.sourceId) && concepts.some(c => c.id === r.targetId))
      .map(r => ({ source: r.sourceId, target: r.targetId }));

    const simulation = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(-800))
      .force('link', forceLink(simLinks).id(d => (d as { id: string }).id).distance(250).strength(0.3))
      .force('center', forceCenter(0, 0).strength(0.05))
      .force('collide', forceCollide().radius(120).strength(0.7))
      .stop();

    for (let i = 0; i < 300; i++) simulation.tick();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const sn of simNodes) {
      minX = Math.min(minX, sn.x);
      minY = Math.min(minY, sn.y);
      maxX = Math.max(maxX, sn.x);
      maxY = Math.max(maxY, sn.y);
    }
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const nodes: Node[] = concepts.map((c, i) => {
      const colors = hashColor(c.id);
      const raw = simNodes[i] ?? { x: 0, y: 0 };
      return {
        id: c.id,
        type: 'concept',
        position: { x: raw.x - centerX + 100, y: raw.y - centerY + 100 },
        data: {
          name: c.name,
          conceptType: c.type,
          colors,
        },
      };
    });

    setFlowNodes(nodes);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitView({ padding: 0.3, duration: 200 });
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptIds]);

  // Sync edges whenever relations change (without touching node positions)
  useEffect(() => {
    setFlowEdges(rfEdges);
  }, [rfEdges, setFlowEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setEditingConceptId(node.id);
    setNodeContextMenu(null);
    setEdgeContextMenu(null);
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setNodeContextMenu({ x: event.clientX, y: event.clientY, conceptId: node.id });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setEdgeContextMenu({ x: event.clientX, y: event.clientY, relationId: edge.id });
  }, []);

  const onPaneClick = useCallback(() => {
    setNodeContextMenu(null);
    setEdgeContextMenu(null);
    setShowConceptCreate(false);
  }, []);

  const onConnect: OnConnect = useCallback((params) => {
    const sourceId = params.source;
    const targetId = params.target;
    if (!sourceId || !targetId) return;
    onRelationCreate({
      sourceId, targetId,
      type: 'relates_to',
      cardinality: 'N:M',
    });
  }, [onRelationCreate]);

  const handleDeleteNode = useCallback(() => {
    if (nodeContextMenu?.conceptId) onConceptDelete(nodeContextMenu.conceptId);
    setNodeContextMenu(null);
  }, [nodeContextMenu, onConceptDelete]);

  const handleDeleteEdge = useCallback(() => {
    if (edgeContextMenu?.relationId) onRelationDelete(edgeContextMenu.relationId);
    setEdgeContextMenu(null);
  }, [edgeContextMenu, onRelationDelete]);

  // Load schema data when opening the edit panel
  const editingConcept = concepts.find(c => c.id === editingConceptId);
  useEffect(() => {
    if (editingConcept) {
      setEditName(editingConcept.name);
      setEditType(editingConcept.type);
      setEditDescription(editingConcept.description ?? '');
      setPanelEditingField(null);
      setPanelAddingField(false);

      // Fetch schema fields
      setPanelFieldsLoading(true);
      setPanelFields([]);
      getConceptSchema(editingConcept.id, ontologyId)
        .then(result => {
          if (result.success) {
            const fields = (result.data as { fields?: unknown[] }).fields ?? [];
            setPanelFields(fields.filter(isConceptField));
          }
        })
        .catch(() => {
          // ignore
        })
        .finally(() => setPanelFieldsLoading(false));
    }
  }, [editingConcept?.id]);

  const handlePanelSchemaSave = () => {
    if (!editingConcept || !editName.trim()) return;
    const conceptData = {
      name: editName.trim(),
      domainId: editingConcept.domainId,
      type: editType,
      description: editDescription,
    };
    onConceptSchemaSave?.(editingConcept.id, conceptData, panelFields);
    setEditingConceptId(null);
  };

  const addField = () => {
    setPanelFields(prev => [...prev, { name: '', type: 'string' as const, required: false, description: '', enum: [] }]);
    setPanelAddingField(true);
    setPanelEditingField(panelFields.length);
  };

  const removeField = (index: number) => {
    setPanelFields(prev => prev.filter((_, i) => i !== index));
    setPanelAddingField(false);
    setPanelEditingField(null);
  };

  const updateField = (index: number, partial: Partial<ConceptField>) => {
    setPanelFields(prev => prev.map((f, i) => i === index ? { ...f, ...partial } : f));
  };

  const cancelEditField = () => {
    if (panelAddingField) {
      setPanelFields(prev => prev.slice(0, -1));
      setPanelAddingField(false);
    }
    setPanelEditingField(null);
  };

  return (
    <div className="flex h-full w-full">
      {/* Graph area */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-white shrink-0">
          <span className="text-xs text-gray-400">({concepts.length} 个概念, {relations.length} 个关系)</span>
          <button
            onClick={() => setShowConceptCreate(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-3 h-3" />
            添加概念
          </button>
        </div>

        <div className="flex-1 min-h-0 relative" ref={containerRef}>
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
          >
            <Controls />
            <Background />
          </ReactFlow>

          {/* Node context menu */}
          {nodeContextMenu && (
            <div
              className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-36"
              style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
              onClick={e => e.stopPropagation()}
            >
              <button className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 text-gray-700"
                onClick={() => { setEditingConceptId(nodeContextMenu.conceptId); setNodeContextMenu(null); }}>
                编辑概念
              </button>
              <button className="w-full px-3 py-1.5 text-sm text-left hover:bg-red-50 text-red-600"
                onClick={handleDeleteNode}>
                删除概念
              </button>
            </div>
          )}

          {/* Edge context menu */}
          {edgeContextMenu && (
            <div
              className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-32"
              style={{ left: edgeContextMenu.x, top: edgeContextMenu.y }}
              onClick={e => e.stopPropagation()}
            >
              <button className="w-full px-3 py-1.5 text-sm text-left hover:bg-red-50 text-red-600"
                onClick={handleDeleteEdge}>
                删除关系
              </button>
            </div>
          )}

          {/* Concept create dialog */}
          {showConceptCreate && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20" onClick={() => setShowConceptCreate(false)}>
              <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-72" onClick={e => e.stopPropagation()}>
                <div className="text-sm font-medium text-gray-700 mb-3">创建概念</div>
                <ConceptCreateForm
                  onSubmit={(name, description) => { onConceptCreate({ name, domainId: 'domain_main', description }); setShowConceptCreate(false); }}
                  onCancel={() => setShowConceptCreate(false)}
                />
              </div>
            </div>
          )}

          {/* Click outside to close menus */}
          {(nodeContextMenu || edgeContextMenu) && (
            <div className="fixed inset-0 z-40" onClick={() => { setNodeContextMenu(null); setEdgeContextMenu(null); setShowConceptCreate(false); }} />
          )}
        </div>
      </div>

      {/* Right edit panel: only shown when editing a concept */}
      {editingConceptId && editingConcept && (
        <div className="w-96 bg-white border-l border-gray-200 shrink-0 shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <h3 className="text-sm font-semibold text-gray-800">{editingConcept.name} — 编辑</h3>
            <button onClick={() => setEditingConceptId(null)} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-auto">
            {/* Section: Ontology data */}
            <div className="p-4 space-y-3 border-b border-gray-200">
              <h4 className="text-xs font-semibold text-gray-500 uppercase">本体数据</h4>
              <div>
                <label className="text-xs text-gray-500">名称</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500">类型</label>
                <input value={editType} onChange={e => setEditType(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500">描述</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>

            {/* Section: Schema fields */}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Schema 字段 ({panelFields.length})</h4>
                <button onClick={addField} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
                  <Plus className="w-3 h-3" /> 添加
                </button>
              </div>

              {panelFieldsLoading && (
                <div className="text-xs text-gray-400 py-4 text-center">加载字段中...</div>
              )}

              {panelFields.map((field, i) => (
                <div key={i} className={`border rounded-md p-2 ${panelEditingField === i ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}>
                  {panelEditingField === i ? (
                    <FieldEditorInline
                      field={field}
                      onChange={(partial) => updateField(i, partial)}
                      onCancel={cancelEditField}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => { setPanelEditingField(i); setPanelAddingField(false); }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-800 truncate">{field.name || <span className="text-gray-400 italic">未命名</span>}</span>
                          <span className="text-[10px] px-1 bg-gray-100 rounded text-gray-500">{field.type}</span>
                          {field.required && <span className="text-[10px] text-red-400">必填</span>}
                        </div>
                        {field.description && (
                          <div className="text-[10px] text-gray-400 mt-0.5 truncate">{field.description}</div>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeField(i); }}
                        className="p-0.5 hover:bg-red-50 rounded shrink-0"
                      >
                        <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {!panelFieldsLoading && panelFields.length === 0 && (
                <div className="text-xs text-gray-400 py-4 text-center">暂无字段，点击"添加"创建</div>
              )}
            </div>
          </div>

          {/* Footer: Save button */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
            <button onClick={() => setEditingConceptId(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors">
              取消
            </button>
            <button
              onClick={handlePanelSchemaSave}
              disabled={!editName.trim()}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldEditorInline({ field, onChange, onCancel }: {
  field: ConceptField;
  onChange: (partial: Partial<ConceptField>) => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input
          value={field.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="字段名称"
          className="flex-1 px-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={field.type}
          onChange={e => onChange({ type: e.target.value as ConceptField['type'] })}
          className="px-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {FIELD_TYPES.map(t => <option key={t} value={t} className="bg-gray-900 text-white">{t}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-1 text-[10px] text-gray-600">
        <input
          type="checkbox"
          checked={field.required}
          onChange={e => onChange({ required: e.target.checked })}
          className="h-2.5 w-2.5"
        />
        必填
      </label>
      <input
        value={field.description || ''}
        onChange={e => onChange({ description: e.target.value })}
        placeholder="描述"
        className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <input
        value={field.enum?.join(', ') || ''}
        onChange={e => onChange({ enum: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
        placeholder="枚举值（逗号分隔）"
        className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex justify-end">
        <button onClick={onCancel} className="text-[10px] text-gray-500 hover:text-gray-700">完成</button>
      </div>
    </div>
  );
}

function ConceptCreateForm({ onSubmit, onCancel }: {
  onSubmit: (name: string, description: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  return (
    <div className="space-y-2">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="概念名称" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <input value={description} onChange={e => setDescription(e.target.value)} placeholder="描述" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-sm text-gray-500">取消</button>
        <button onClick={() => onSubmit(name.trim(), description)} disabled={!name.trim()} className="text-sm text-blue-600 disabled:opacity-50">创建</button>
      </div>
    </div>
  );
}
