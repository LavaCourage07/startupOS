'use client';

import { useState, useCallback, useEffect } from 'react';
import { Settings, Layers } from 'lucide-react';
import type { ConceptField } from '@originos/core/lib/features/ontology-data-store/types';
import type { ConceptRelation } from '@originos/core/lib/features/ontology-data-store/relation-validator';
import { SchemaEditor, OntologyConceptGraphEditor } from '@/components/os/data-editor';
import { listOntologyConcepts, createOntologyConcept, listConceptRelations, createConceptRelation, deleteConceptRelation, getConceptSchema, updateConceptSchema, deleteOntologyConcept, syncOntologyData } from '@originos/core/lib/integrations/electron/services/ontology-data';

interface ConceptInfo {
  id: string;
  name: string;
  domainId: string;
  type: string;
  description?: string;
}

interface OntologyTabViewProps {
  ontologyId: string;
}

type OntologyTab = 'schema' | 'structure';

export function OntologyTabView({ ontologyId }: OntologyTabViewProps) {
  const [activeTab, setActiveTab] = useState<OntologyTab>('schema');
  const [concepts, setConcepts] = useState<ConceptInfo[]>([]);
  const [constraints, setConstraints] = useState<ConceptRelation[]>([]);
  const [loading, setLoading] = useState(true);

  // Schema editor state
  const [schemaEditorConceptId, setSchemaEditorConceptId] = useState<string | null>(null);
  const [schemaEditorFields, setSchemaEditorFields] = useState<ConceptField[]>([]);
  const [schemaEditorName, setSchemaEditorName] = useState('');
  const [schemaEditorDomainId, setSchemaEditorDomainId] = useState('');

  // Sync from business-model.json first, then load concepts + relations
  useEffect(() => {
    console.log('[OntologyTabView] sync + load start', { ontologyId });
    setLoading(true);
    syncOntologyData(ontologyId)
      .catch(() => { /* sync failure is non-fatal */ })
      .finally(() => {
        const loadConcepts = listOntologyConcepts(ontologyId)
          .then(result => {
            if (result.success) setConcepts((result.data as { concepts?: ConceptInfo[] }).concepts ?? []);
          })
          .catch(error => console.error('[OntologyTabView] concept load failed', { ontologyId, error }));

        const loadRelations = listConceptRelations(ontologyId)
          .then(result => {
            if (result.success) setConstraints((result.data as any).relations ?? []);
          })
          .catch(error => console.error('[OntologyTabView] relation load failed', { ontologyId, error }));

        Promise.all([loadConcepts, loadRelations]).finally(() => setLoading(false));
      });
  }, [ontologyId]);

  // Load schema for selected concept
  useEffect(() => {
    if (!schemaEditorConceptId) return;
    console.log('[OntologyTabView] schema load start', { ontologyId, conceptId: schemaEditorConceptId });
    getConceptSchema(schemaEditorConceptId, ontologyId)
      .then(result => {
        console.log('[OntologyTabView] schema load result', {
          ontologyId,
          conceptId: schemaEditorConceptId,
          success: result.success,
          data: result.data,
          error: result.error,
        });
        if (result.success) {
          setSchemaEditorFields((result.data as any).fields ?? []);
          setSchemaEditorName((result.data as any).name ?? '');
          setSchemaEditorDomainId((result.data as any).domainId ?? '');
        }
      })
      .catch(error => {
        console.error('[OntologyTabView] schema load failed', { ontologyId, conceptId: schemaEditorConceptId, error });
      });
  }, [schemaEditorConceptId, ontologyId]);

  const handleSchemaSave = useCallback(async (fields: ConceptField[]) => {
    const concept = concepts.find(c => c.id === schemaEditorConceptId);
    if (!concept) return;
    await updateConceptSchema(schemaEditorConceptId!, ontologyId, concept.domainId, fields);
    setSchemaEditorFields(fields);
  }, [schemaEditorConceptId, concepts, ontologyId]);

  const handleConceptCreate = useCallback(async (concept: { name: string; domainId: string; description?: string }) => {
    await createOntologyConcept(ontologyId, concept.domainId, concept.name, 'entity', concept.description);
    listOntologyConcepts(ontologyId)
      .then(result => { if (result.success) setConcepts((result.data as { concepts?: ConceptInfo[] }).concepts ?? []); });
  }, [ontologyId]);

  const handleConceptDelete = useCallback(async (conceptId: string) => {
    if (!confirm('确定删除此概念及其数据？')) return;
    const concept = concepts.find(c => c.id === conceptId);
    if (!concept) return;
    await deleteOntologyConcept(conceptId, ontologyId, concept.domainId);
    listOntologyConcepts(ontologyId)
      .then(result => { if (result.success) setConcepts((result.data as { concepts?: ConceptInfo[] }).concepts ?? []); });
  }, [concepts, ontologyId]);

  const handleRelationCreate = useCallback(async (rel: { sourceId: string; targetId: string; type: string; cardinality: string }) => {
    await createConceptRelation(ontologyId, rel);
    listConceptRelations(ontologyId)
      .then(result => { if (result.success) setConstraints((result.data as any).relations ?? []); });
  }, [ontologyId]);

  const handleRelationDelete = useCallback(async (relationId: string) => {
    await deleteConceptRelation(ontologyId, relationId);
    listConceptRelations(ontologyId)
      .then(result => { if (result.success) setConstraints((result.data as any).relations ?? []); });
  }, [ontologyId]);

  const handleConceptSchemaSave = useCallback(async (
    conceptId: string,
    _conceptData: { name: string; domainId: string; type: string; description?: string },
    fields: ConceptField[]
  ) => {
    // Update concept basic info if needed (current API doesn't support direct update, skip for now)
    // Save schema fields
    const concept = concepts.find(c => c.id === conceptId);
    if (!concept) return;
    await updateConceptSchema(conceptId, ontologyId, concept.domainId, fields);
  }, [ontologyId, concepts]);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-sm text-gray-400">加载中...</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
        <button
          onClick={() => setActiveTab('schema')}
          className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded transition-colors ${
            activeTab === 'schema' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Schema编辑
        </button>
        <button
          onClick={() => setActiveTab('structure')}
          className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded transition-colors ${
            activeTab === 'structure' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          结构编辑
        </button>
      </div>

      {/* Schema tab */}
      {activeTab === 'schema' && (
        <div className="flex-1 min-h-0">
          {!schemaEditorConceptId ? (
            <div className="p-6">
              <h4 className="text-sm font-medium text-gray-700 mb-4">选择要编辑 Schema 的概念:</h4>
              <div className="grid grid-cols-2 gap-2">
                {concepts.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSchemaEditorConceptId(c.id)}
                    className="px-4 py-3 text-sm text-left border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-400 transition-colors"
                  >
                    <div className="font-medium text-gray-800">{c.name}</div>
                    {c.description && <div className="text-xs text-gray-400 mt-0.5">{c.description}</div>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <SchemaEditor
              conceptId={schemaEditorConceptId}
              domainId={schemaEditorDomainId}
              ontologyId={ontologyId}
              conceptName={schemaEditorName}
              fields={schemaEditorFields}
              onSave={handleSchemaSave}
              onClose={() => setSchemaEditorConceptId(null)}
            />
          )}
        </div>
      )}

      {/* Structure tab */}
      {activeTab === 'structure' && (
        <div className="flex-1 min-h-0">
          <OntologyConceptGraphEditor
            ontologyId={ontologyId}
            concepts={concepts}
            relations={constraints}
            onConceptCreate={handleConceptCreate}
            onConceptDelete={handleConceptDelete}
            onRelationCreate={handleRelationCreate}
            onRelationDelete={handleRelationDelete}
            onConceptSchemaSave={handleConceptSchemaSave}
            onClose={() => setActiveTab('schema')}
          />
        </div>
      )}
    </div>
  );
}
