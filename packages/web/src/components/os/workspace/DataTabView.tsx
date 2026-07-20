'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Network, ChevronRight, X, Table, RefreshCw, Trash2 } from 'lucide-react';
import type { InstanceData, ConceptSchema, ConceptField } from '@originos/core/lib/features/ontology-data-store/types';
import type { InstanceRelation, ConceptRelation } from '@originos/core/lib/features/ontology-data-store/relation-validator';
import { OntologyGraphView, CreateRelationDialog, DataFormView, DataTableView } from '@/components/os/data-editor';
import { createOntologyInstance, updateOntologyInstance, deleteOntologyInstance, syncOntologyData, listOntologyConcepts, listOntologyInstances, listInstanceRelations, getConceptSchema, createInstanceRelation, deleteInstanceRelation } from '@originos/core/lib/integrations/electron/services/ontology-data';

interface ConceptInfo {
  id: string;
  name: string;
  domainId: string;
  type: string;
  description?: string;
}

interface DataTabViewProps {
  ontologyId: string;
}

type PanelMode = 'closed' | 'create' | 'detail' | 'edit';
type DataViewTab = 'graph' | 'table';

export function DataTabView({ ontologyId }: DataTabViewProps) {
  const [concepts, setConcepts] = useState<ConceptInfo[]>([]);
  const [constraints, setConstraints] = useState<ConceptRelation[]>([]);
  const [instances, setInstances] = useState<InstanceData[]>([]);
  const [instanceRelations, setInstanceRelations] = useState<InstanceRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<DataViewTab>('graph');
  const [graphConceptFilter, setGraphConceptFilter] = useState<string>('all');
  const [selectedGraphInstanceIds, setSelectedGraphInstanceIds] = useState<string[]>([]);

  const [panelMode, setPanelMode] = useState<PanelMode>('closed');
  const [selectedInstance, setSelectedInstance] = useState<InstanceData | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<ConceptSchema | null>(null);
  const [createConceptId, setCreateConceptId] = useState<string | null>(null);
  const [createFromSourceInstanceId, setCreateFromSourceInstanceId] = useState<string | null>(null);
  const [createFromSourceConceptId, setCreateFromSourceConceptId] = useState<string | null>(null);
  const [createFromRelationType, setCreateFromRelationType] = useState<string | null>(null);
  const [createFromDirection, setCreateFromDirection] = useState<'outgoing' | 'incoming'>('outgoing');

  const [showRelationDialog, setShowRelationDialog] = useState<{ sourceId: string; targetId?: string } | null>(null);
  const [relationError, setRelationError] = useState<string | null>(null);

  // Sync from business-model.json, then fetch concepts + relations on mount
  useEffect(() => {
    setLoading(true);

    // 先从 business-model.json 同步本体结构（concepts/relations/attributes）
    syncOntologyData(ontologyId)
      .then(result => {
        if (result.success) {
          console.log(`[本体同步] 已同步 ${(result.data as any).conceptsCount} 个概念, ${(result.data as any).relationsCount} 个关系`);
        }
      })
      .catch(() => {
        // 同步失败不影响后续数据加载
      })
      .finally(() => {
        listOntologyConcepts(ontologyId)
          .then(result => {
            if (result.success) setConcepts((result.data as any).concepts ?? []);
          })
          .catch(console.error)
          .finally(() => setLoading(false));

        listInstanceRelations(ontologyId)
          .then(result => {
            if (result.success) {
              setInstanceRelations((result.data as any).relations ?? []);
              setConstraints((result.data as any).constraints ?? []);
            }
          })
          .catch(console.error);
      });
  }, [ontologyId]);

  // Fetch instances when concepts change
  useEffect(() => {
    if (concepts.length === 0) return;
    setLoading(true);
    Promise.all(
      concepts.map(c =>
        listOntologyInstances(ontologyId, c.id)
          .then(result => result.success ? ((result.data as any).items ?? []) : [])
          .catch(() => [] as InstanceData[])
      )
    ).then(all => {
      setInstances(all.flat());
    }).finally(() => setLoading(false));
  }, [concepts, ontologyId]);

  const refreshAll = useCallback(async () => {
    try {
      const [conceptsResult, relationsResult] = await Promise.all([
        listOntologyConcepts(ontologyId),
        listInstanceRelations(ontologyId),
      ]);
      if (conceptsResult.success) setConcepts((conceptsResult.data as any).concepts ?? []);
      if (relationsResult.success) {
        setInstanceRelations((relationsResult.data as any).relations ?? []);
        setConstraints((relationsResult.data as any).constraints ?? []);
      }

      // Re-fetch instances
      const currentConcepts = conceptsResult.success ? ((conceptsResult.data as any).concepts ?? []) : concepts;
      const instanceResults = await Promise.all(
        currentConcepts.map((c: ConceptInfo) =>
          listOntologyInstances(ontologyId, c.id)
            .then(result => result.success ? ((result.data as any).items ?? []) : [])
            .catch(() => [] as InstanceData[])
        )
      );
      setInstances(instanceResults.flat());
    } catch (e) {
      console.error('刷新失败:', e);
    }
  }, [concepts, ontologyId]);

  const refreshSchema = useCallback(async () => {
    if (!selectedInstance) return;
    try {
      const result = await getConceptSchema(selectedInstance.conceptId, ontologyId);
      if (result.success) setSelectedSchema(result.data as ConceptSchema);
    } catch (e) {
      console.error('刷新 schema 失败:', e);
    }
  }, [selectedInstance, ontologyId]);

  const refreshInstances = useCallback(async () => {
    try {
      const results = await Promise.all(
        concepts.map(c =>
          listOntologyInstances(ontologyId, c.id)
            .then(result => result.success ? ((result.data as any).items ?? []) : [])
            .catch(() => [] as InstanceData[])
        )
      );
      setInstances(results.flat());
    } catch (e) {
      console.error('刷新实例失败:', e);
    }
  }, [concepts, ontologyId]);

  const loadSchema = useCallback(async (conceptId: string) => {
    try {
      const result = await getConceptSchema(conceptId, ontologyId);
      if (result.success) return result.data as ConceptSchema;
    } catch (e) {
      console.error('加载 schema 失败:', e);
    }
    return null;
  }, [ontologyId]);

  const handleNodeSelect = useCallback(async (instance: InstanceData) => {
    setSelectedInstance(instance);
    // Always re-fetch schema to pick up any ontology changes
    const schema = await loadSchema(instance.conceptId);
    if (schema) {
      setSelectedSchema(schema);
      setPanelMode('detail');
    }
  }, [loadSchema]);

  const handleAddNode = useCallback(() => {
    setCreateConceptId(null);
    setCreateFromSourceInstanceId(null);
    setCreateFromSourceConceptId(null);
    setCreateFromRelationType(null);
    setCreateFromDirection('outgoing');
    setPanelMode('create');
    setSelectedInstance(null);
  }, []);

  const handleDeleteNode = useCallback(async (instanceId: string) => {
    if (!confirm('确定删除此实例？')) return;
    try {
      const instance = instances.find(i => i.id === instanceId);
      if (!instance) return;
      await deleteOntologyInstance(ontologyId, instanceId, instance.conceptId, instance.domainId);
      if (selectedInstance?.id === instanceId) {
        setPanelMode('closed');
        setSelectedInstance(null);
        setSelectedSchema(null);
      }
      await refreshInstances();
    } catch (e) {
      console.error('删除失败:', e);
    }
  }, [instances, ontologyId, refreshInstances, selectedInstance]);

  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    try {
      await deleteInstanceRelation(ontologyId, edgeId);
      const relResult = await listInstanceRelations(ontologyId);
      if (relResult.success) setInstanceRelations((relResult.data as { relations: InstanceRelation[] }).relations ?? []);
    } catch (e) {
      console.error('删除关系失败:', e);
    }
  }, [ontologyId]);

  const handleCreateRelatedInstance = useCallback(async (sourceInstanceId: string, conceptId: string, relationType: string) => {
    const concept = concepts.find(c => c.id === conceptId);
    if (!concept) return;
    const source = instances.find(i => i.id === sourceInstanceId);
    setCreateConceptId(conceptId);
    setCreateFromSourceInstanceId(sourceInstanceId);
    setCreateFromSourceConceptId(source?.conceptId ?? null);
    setCreateFromRelationType(relationType);
    setCreateFromDirection('outgoing');
    setPanelMode('create');
  }, [concepts, instances]);

  const handleCreateRelatedInstanceAsTarget = useCallback(async (targetInstanceId: string, conceptId: string, relationType: string) => {
    const concept = concepts.find(c => c.id === conceptId);
    if (!concept) return;
    setCreateConceptId(conceptId);
    setCreateFromSourceInstanceId(targetInstanceId);
    setCreateFromSourceConceptId(conceptId);
    setCreateFromRelationType(relationType);
    setCreateFromDirection('incoming');
    setPanelMode('create');
  }, [concepts]);

  const handleCreateInstance = useCallback(async (fields: Record<string, unknown>) => {
    if (!createConceptId) return;
    const concept = concepts.find(c => c.id === createConceptId);
    if (!concept) return;
    try {
      const result = await createOntologyInstance(ontologyId, concept.id, fields, 'user');
      if (result.success) {
        const newInstance = result.data as InstanceData;
        await refreshInstances();
        if (createFromSourceInstanceId && createFromRelationType && createFromSourceConceptId) {
          const isOutgoing = createFromDirection === 'outgoing';
          const relResult = await createInstanceRelation(ontologyId, {
            sourceInstanceId: isOutgoing ? createFromSourceInstanceId : newInstance.id,
            targetInstanceId: isOutgoing ? newInstance.id : createFromSourceInstanceId,
            sourceConceptId: isOutgoing ? createFromSourceConceptId : concept.id,
            targetConceptId: isOutgoing ? concept.id : createFromSourceConceptId,
            type: createFromRelationType,
          });
          if (relResult.success) {
            const refreshRel = await listInstanceRelations(ontologyId);
            if (refreshRel.success) setInstanceRelations((refreshRel.data as { relations: InstanceRelation[] }).relations ?? []);
          } else {
            console.warn('创建实例关系失败:', relResult.error);
          }
        }
        setSelectedInstance(newInstance);
        const schema = await loadSchema(concept.id);
        if (schema) setSelectedSchema(schema);
        setPanelMode('detail');
        setCreateConceptId(null);
        setCreateFromSourceInstanceId(null);
        setCreateFromSourceConceptId(null);
        setCreateFromRelationType(null);
        setCreateFromDirection('outgoing');
      } else {
        setError(result.error?.message || '创建失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    }
  }, [createConceptId, createFromSourceInstanceId, createFromSourceConceptId, createFromRelationType, createFromDirection, concepts, ontologyId, refreshInstances, loadSchema]);

  const handleSaveInstance = useCallback(async (fields: Record<string, unknown>) => {
    if (!selectedInstance || !selectedSchema) return;
    try {
      const result = await updateOntologyInstance(ontologyId, selectedInstance.id, selectedSchema.conceptId, selectedSchema.domainId, fields);
      if (result.success) {
        await refreshInstances();
        if (result.data) setSelectedInstance(result.data as InstanceData);
        setPanelMode('detail');
      } else {
        setError(result.error?.message || '保存失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    }
  }, [selectedInstance, selectedSchema, ontologyId, refreshInstances]);

  const handleTableCellEdit = useCallback(async (instanceId: string, fieldName: string, value: unknown) => {
    const instance = instances.find(i => i.id === instanceId);
    if (!instance) return;
    try {
      const newFields = { ...instance.fields, [fieldName]: value };
      await updateOntologyInstance(ontologyId, instanceId, instance.conceptId, instance.domainId, newFields);
      await refreshInstances();
    } catch (e) {
      console.error('单元格编辑失败:', e);
    }
  }, [instances, ontologyId, refreshInstances]);

  const handleTableDelete = useCallback(async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => {
        const inst = instances.find(i => i.id === id);
        if (!inst) return Promise.resolve();
        return deleteOntologyInstance(ontologyId, id, inst.conceptId, inst.domainId);
      }));
      await refreshInstances();
    } catch (e) {
      console.error('批量删除失败:', e);
    }
  }, [instances, ontologyId, refreshInstances]);

  const handleBulkDeleteFromGraph = useCallback(async () => {
    if (selectedGraphInstanceIds.length === 0) return;
    if (!confirm(`确定删除已选中的 ${selectedGraphInstanceIds.length} 个实例吗？`)) return;

    try {
      await Promise.all(selectedGraphInstanceIds.map(id => {
        const inst = instances.find(i => i.id === id);
        if (!inst) return Promise.resolve();
        return deleteOntologyInstance(ontologyId, id, inst.conceptId, inst.domainId);
      }));

      if (selectedInstance && selectedGraphInstanceIds.includes(selectedInstance.id)) {
        setPanelMode('closed');
        setSelectedInstance(null);
        setSelectedSchema(null);
      }

      setSelectedGraphInstanceIds([]);
      await refreshAll();
    } catch (e) {
      console.error('图谱批量删除失败:', e);
    }
  }, [instances, ontologyId, refreshAll, selectedGraphInstanceIds, selectedInstance]);

  const handleCreateRelationRequest = useCallback((sourceId: string, targetId: string) => {
    setRelationError(null);
    setShowRelationDialog({ sourceId, targetId });
  }, []);

  const handleCreateRelation = useCallback(async (sourceId: string, targetId: string, type: string) => {
    setRelationError(null);
    const sourceInstance = instances.find(i => i.id === sourceId);
    const targetInstance = instances.find(i => i.id === targetId);
    if (!sourceInstance || !targetInstance) return;

    try {
      const result = await createInstanceRelation(ontologyId, {
        sourceInstanceId: sourceId,
        targetInstanceId: targetId,
        type,
        sourceConceptId: sourceInstance.conceptId,
        targetConceptId: targetInstance.conceptId,
      });
      if (result.success) {
        setShowRelationDialog(null);
        const relResult = await listInstanceRelations(ontologyId);
        if (relResult.success) setInstanceRelations((relResult.data as { relations: InstanceRelation[] }).relations ?? []);
      } else {
        setRelationError(result.error?.message || '创建关系失败');
      }
    } catch (e) {
      setRelationError('创建关系失败');
    }
  }, [instances, ontologyId]);

  const allFields = useMemo(() => {
    const fieldMap = new Map<string, ConceptField>();
    concepts.forEach(c => {
      if (c.id) {
        const nameField: ConceptField = { name: '名称', type: 'string', required: false };
        if (!fieldMap.has('名称')) fieldMap.set('名称', nameField);
      }
    });
    return Array.from(fieldMap.values());
  }, [concepts]);

  const conceptCounts = useMemo(() => {
    const map: Record<string, number> = {};
    instances.forEach(i => { map[i.conceptId] = (map[i.conceptId] || 0) + 1; });
    return map;
  }, [instances]);

  const filteredGraphInstances = useMemo(() => {
    if (graphConceptFilter === 'all') return instances;
    return instances.filter(instance => instance.conceptId === graphConceptFilter);
  }, [graphConceptFilter, instances]);

  const filteredGraphInstanceRelations = useMemo(() => {
    const visibleInstanceIds = new Set(filteredGraphInstances.map(instance => instance.id));
    return instanceRelations.filter(
      relation => visibleInstanceIds.has(relation.sourceInstanceId) && visibleInstanceIds.has(relation.targetInstanceId)
    );
  }, [filteredGraphInstances, instanceRelations]);

  useEffect(() => {
    const visibleInstanceIds = new Set(filteredGraphInstances.map(instance => instance.id));
    setSelectedGraphInstanceIds(currentIds => currentIds.filter(id => visibleInstanceIds.has(id)));
  }, [filteredGraphInstances]);

  const relatedInstances = useMemo(() => {
    if (!selectedInstance) return [];
    return instanceRelations
      .filter(r => r.sourceInstanceId === selectedInstance.id || r.targetInstanceId === selectedInstance.id)
      .map(r => {
        const isSource = r.sourceInstanceId === selectedInstance.id;
        const otherId = isSource ? r.targetInstanceId : r.sourceInstanceId;
        const other = instances.find(i => i.id === otherId);
        return { relation: r, direction: isSource ? '→' : '←', other, otherId };
      });
  }, [selectedInstance, instanceRelations, instances]);

  const tabs: Array<{ key: DataViewTab; label: string; icon: React.ReactNode }> = [
    { key: 'graph', label: '图谱', icon: <Network className="w-3.5 h-3.5" /> },
    { key: 'table', label: '表格', icon: <Table className="w-3.5 h-3.5" /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
          <button
            onClick={async () => {
              await refreshAll();
              await refreshSchema();
            }}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="刷新数据"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {activeTab === 'graph' && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400">
                    ({filteredGraphInstances.length} / {instances.length} 个实例, {filteredGraphInstanceRelations.length} 个关系)
                  </span>
                  <select
                    value={graphConceptFilter}
                    onChange={(event) => setGraphConceptFilter(event.target.value)}
                    className="h-8 rounded border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none transition-colors focus:border-blue-400"
                    title="按概念筛选实例"
                  >
                    <option value="all" className="bg-gray-900 text-white">全部概念</option>
                    {concepts.map(c => (
                      <option key={c.id} value={c.id} className="bg-gray-900 text-white">
                        {c.name} ({conceptCounts[c.id] || 0})
                      </option>
                    ))}
                  </select>
                  {selectedGraphInstanceIds.length > 0 && (
                    <span className="text-xs text-blue-600">
                      已选 {selectedGraphInstanceIds.length} 个
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedGraphInstanceIds.length > 0 && (
                    <button
                      onClick={handleBulkDeleteFromGraph}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
                      title="删除当前已选实例"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      批量删除
                    </button>
                  )}
                  <button
                    onClick={handleAddNode}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新增实例
                  </button>
                </div>
              </div>
              {concepts.length > 0 && (
                <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-gray-100 bg-white shrink-0 overflow-x-auto">
                  <span className="text-xs text-gray-400 shrink-0">概念:</span>
                  {concepts.map(c => (
                    <span
                      key={c.id}
                      className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 whitespace-nowrap"
                    >
                      {c.name} ({conceptCounts[c.id] || 0})
                    </span>
                  ))}
                </div>
              )}
              <div className="flex-1 min-h-0">
                <OntologyGraphView
                  ontologyId={ontologyId}
                  concepts={concepts}
                  relations={constraints}
                  instances={filteredGraphInstances}
                  instanceRelations={filteredGraphInstanceRelations}
                  onNodeSelect={handleNodeSelect}
                  onAddNode={handleAddNode}
                  onCreateRelationRequest={handleCreateRelationRequest}
                  onDeleteNode={handleDeleteNode}
                  onDeleteEdge={handleDeleteEdge}
                  onCreateRelatedInstance={handleCreateRelatedInstance}
                  onCreateRelatedInstanceAsTarget={handleCreateRelatedInstanceAsTarget}
                  onSelectionChange={setSelectedGraphInstanceIds}
                />
              </div>
            </div>
          )}

          {activeTab === 'table' && (
            <DataTableView
              fields={allFields}
              instances={instances}
              onSelect={handleNodeSelect}
              onDelete={handleTableDelete}
              onCellEdit={handleTableCellEdit}
            />
          )}
        </div>
      </div>

      {panelMode !== 'closed' && (
        <div className="w-80 border-l border-gray-200 bg-white shrink-0 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">
              {panelMode === 'create' ? '新增实例' : selectedSchema?.name ?? '实例详情'}
            </h3>
            <button onClick={() => { setPanelMode('closed'); setError(null); }} className="p-1 hover:bg-gray-200 rounded">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {error && (
              <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                {error}
              </div>
            )}

            {panelMode === 'create' && !createConceptId && (
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-3">选择概念类型:</p>
                <div className="space-y-2">
                  {concepts.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setCreateConceptId(c.id)}
                      className="w-full px-3 py-2.5 text-sm text-left border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-400 transition-colors"
                    >
                      <div className="font-medium text-gray-800">{c.name}</div>
                      {c.description && <div className="text-xs text-gray-400 mt-0.5">{c.description}</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {panelMode === 'create' && createConceptId && (
              <CreateInstanceForm
                conceptId={createConceptId}
                ontologyId={ontologyId}
                concept={concepts.find(c => c.id === createConceptId)!}
                onSave={handleCreateInstance}
                onCancel={() => { setCreateConceptId(null); setError(null); }}
              />
            )}

            {panelMode === 'detail' && selectedInstance && (
              <DetailPanelContent
                instance={selectedInstance}
                schema={selectedSchema!}
                relatedInstances={relatedInstances}
                onEdit={() => setPanelMode('edit')}
                onDelete={() => handleDeleteNode(selectedInstance.id)}
              />
            )}

            {panelMode === 'edit' && selectedInstance && selectedSchema && (
              <DataFormView
                schema={selectedSchema}
                initialValues={selectedInstance.fields}
                onSave={handleSaveInstance}
                onCancel={() => { setPanelMode('detail'); setError(null); }}
                isSaving={false}
              />
            )}
          </div>
        </div>
      )}

      {showRelationDialog && (
        <CreateRelationDialog
          instances={instances}
          concepts={concepts}
          constraints={constraints}
          sourceInstanceId={showRelationDialog.sourceId}
          targetInstanceId={showRelationDialog.targetId}
          onConfirm={handleCreateRelation}
          onClose={() => { setShowRelationDialog(null); setRelationError(null); }}
          error={relationError}
        />
      )}
    </div>
  );
}

function DetailPanelContent({
  instance,
  schema,
  relatedInstances,
  onEdit,
  onDelete,
}: {
  instance: InstanceData;
  schema: ConceptSchema;
  relatedInstances: Array<{ relation: InstanceRelation; direction: string; other?: InstanceData; otherId: string }>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">属性</h4>
        <div className="space-y-1.5">
          {schema.fields.map(field => (
            <div key={field.name} className="flex justify-between items-start py-1.5 border-b border-gray-100">
              <span className="text-xs text-gray-600">{field.name}{field.required && <span className="text-red-400 ml-0.5">*</span>}</span>
              <span className="text-xs text-gray-900 text-right max-w-36 truncate" title={formatValue(instance.fields[field.name])}>
                {formatValue(instance.fields[field.name])}
              </span>
            </div>
          ))}
        </div>
      </div>

      {relatedInstances.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            关系 ({relatedInstances.length})
          </h4>
          <div className="space-y-1.5">
            {relatedInstances.map((rel, i) => (
              <div key={i} className="flex items-center gap-2 py-1 text-xs">
                <span className="text-gray-400">{rel.direction}</span>
                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 shrink-0">{rel.relation.type}</span>
                <span className="text-gray-800 truncate">
                  {rel.other ? getInstanceLabel(rel.other) : rel.otherId}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-3 space-y-2">
        <button
          onClick={onEdit}
          className="w-full px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          编辑
        </button>
        <button
          onClick={onDelete}
          className="w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          删除实例
        </button>
      </div>
    </div>
  );
}

function CreateInstanceForm({
  conceptId,
  ontologyId,
  concept,
  onSave,
  onCancel,
}: {
  conceptId: string;
  ontologyId: string;
  concept: ConceptInfo;
  onSave: (fields: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [schema, setSchema] = useState<ConceptSchema | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConceptSchema(conceptId, ontologyId)
      .then(result => { if (result.success) setSchema(result.data as ConceptSchema); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [conceptId, ontologyId]);

  if (loading) {
    return <div className="p-4 text-sm text-gray-400">加载表单...</div>;
  }

  if (!schema) {
    return <div className="p-4 text-sm text-red-500">无法加载概念 schema</div>;
  }

  return (
    <div>
      <div className="px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <span>新增</span>
          <ChevronRight className="w-3 h-3" />
          <span>{concept.name}</span>
        </div>
      </div>
      <DataFormView
        schema={schema}
        initialValues={{}}
        onSave={onSave}
        onCancel={onCancel}
        isSaving={false}
      />
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

function getInstanceLabel(inst: InstanceData): string {
  const firstField = Object.values(inst.fields)[0];
  return firstField ? String(firstField) : inst.id;
}
