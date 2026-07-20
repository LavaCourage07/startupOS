'use client';

import { useState } from 'react';
import { Plus, X, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { ConceptRelation } from '@originos/core/lib/features/ontology-data-store/relation-validator';

interface OntologyStructureEditorProps {
  ontologyId: string;
  domains: Array<{ id: string; name: string; description?: string }>;
  concepts: Array<{ id: string; domainId: string; name: string; type: string; description?: string }>;
  relations: ConceptRelation[];
  onDomainCreate: (domain: { name: string; description?: string }) => void;
  onDomainDelete: (domainId: string) => void;
  onConceptCreate: (concept: { name: string; domainId: string; description?: string }) => void;
  onConceptDelete: (conceptId: string) => void;
  onRelationCreate: (rel: { sourceId: string; targetId: string; type: string; cardinality: string }) => void;
  onRelationDelete: (relationId: string) => void;
  onClose: () => void;
}

export function OntologyStructureEditor({
  domains, concepts, relations,
  onDomainCreate, onDomainDelete, onConceptCreate, onConceptDelete,
  onRelationCreate, onRelationDelete, onClose,
}: Omit<OntologyStructureEditorProps, 'ontologyId'> & { ontologyId?: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ domains: true, concepts: true, relations: true });
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [showConceptForm, setShowConceptForm] = useState(false);
  const [showRelationForm, setShowRelationForm] = useState(false);

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">本体结构</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Domains */}
        <Section
          title="领域" count={domains.length}
          expanded={expanded['domains'] ?? false} onToggle={() => toggle('domains')}
          onAdd={() => setShowDomainForm(true)}
        >
          {showDomainForm && (
            <CreateDomainForm
              onSubmit={(name, description) => { onDomainCreate({ name, description }); setShowDomainForm(false); }}
              onCancel={() => setShowDomainForm(false)}
            />
          )}
          {domains.map(d => (
            <ListItem key={d.id} name={d.name} description={d.description} onDelete={() => onDomainDelete(d.id)} />
          ))}
        </Section>

        {/* Concepts */}
        <Section
          title="概念" count={concepts.length}
          expanded={expanded['concepts'] ?? false} onToggle={() => toggle('concepts')}
          onAdd={() => setShowConceptForm(true)}
        >
          {showConceptForm && (
            <CreateConceptForm
              domains={domains}
              onSubmit={(name, domainId, description) => { onConceptCreate({ name, domainId, description }); setShowConceptForm(false); }}
              onCancel={() => setShowConceptForm(false)}
            />
          )}
          {concepts.map(c => {
            const domain = domains.find(d => d.id === c.domainId);
            return (
              <ListItem
                key={c.id} name={c.name}
                description={domain ? `${domain.name} · ${c.type}` : c.description}
                onDelete={() => onConceptDelete(c.id)}
              />
            );
          })}
        </Section>

        {/* Relations */}
        <Section
          title="关系定义" count={relations.length}
          expanded={expanded['relations'] ?? false} onToggle={() => toggle('relations')}
          onAdd={() => setShowRelationForm(true)}
        >
          {showRelationForm && (
            <CreateRelationForm
              concepts={concepts}
              onSubmit={(sourceId, targetId, type, cardinality) => {
                onRelationCreate({ sourceId, targetId, type, cardinality });
                setShowRelationForm(false);
              }}
              onCancel={() => setShowRelationForm(false)}
            />
          )}
          {relations.map(r => {
            const source = concepts.find(c => c.id === r.sourceId);
            const target = concepts.find(c => c.id === r.targetId);
            return (
              <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-800">{source?.name ?? r.sourceId}</span>
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{r.type}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-800">{target?.name ?? r.targetId}</span>
                  <span className="text-gray-400 ml-1">{r.cardinality}</span>
                </div>
                <button onClick={() => onRelationDelete(r.id)} className="p-1 hover:bg-red-50 rounded">
                  <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            );
          })}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, count, expanded, onToggle, onAdd, children }: {
  title: string; count: number; expanded: boolean;
  onToggle: () => void; onAdd: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-md">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {title} ({count})
        </div>
        <Plus className="w-3.5 h-3.5 text-gray-400" onClick={e => { e.stopPropagation(); onAdd(); }} />
      </button>
      {expanded && <div className="p-3 space-y-1">{children}</div>}
    </div>
  );
}

function ListItem({ name, description, onDelete }: { name: string; description?: string; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-800 truncate">{name}</div>
        {description && <div className="text-xs text-gray-400 truncate">{description}</div>}
      </div>
      <button onClick={onDelete} className="p-1 hover:bg-red-50 rounded shrink-0 ml-2">
        <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
      </button>
    </div>
  );
}

function CreateDomainForm({ onSubmit, onCancel }: {
  onSubmit: (name: string, description?: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  return (
    <div className="space-y-2 mb-2">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="领域名称" className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <input value={description} onChange={e => setDescription(e.target.value)} placeholder="描述" className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-gray-500">取消</button>
        <button onClick={() => onSubmit(name, description)} disabled={!name.trim()} className="text-xs text-blue-600 disabled:opacity-50">创建</button>
      </div>
    </div>
  );
}

function CreateConceptForm({ domains, onSubmit, onCancel }: {
  domains: Array<{ id: string; name: string }>;
  onSubmit: (name: string, domainId: string, description?: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [domainId, setDomainId] = useState(domains[0]?.id ?? '');
  const [description, setDescription] = useState('');
  return (
    <div className="space-y-2 mb-2">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="概念名称" className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <select value={domainId} onChange={e => setDomainId(e.target.value)} className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-800 text-white">
        <option value="" className="bg-gray-900 text-white">选择领域</option>
        {domains.map(d => <option key={d.id} value={d.id} className="bg-gray-900 text-white">{d.name}</option>)}
      </select>
      <input value={description} onChange={e => setDescription(e.target.value)} placeholder="描述" className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-gray-500">取消</button>
        <button onClick={() => onSubmit(name, domainId, description)} disabled={!name.trim() || !domainId} className="text-xs text-blue-600 disabled:opacity-50">创建</button>
      </div>
    </div>
  );
}

function CreateRelationForm({ concepts, onSubmit, onCancel }: {
  concepts: Array<{ id: string; name: string }>;
  onSubmit: (sourceId: string, targetId: string, type: string, cardinality: string) => void; onCancel: () => void;
}) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [type, setType] = useState('');
  const [cardinality, setCardinality] = useState('N:M');
  return (
    <div className="space-y-2 mb-2">
      <select value={sourceId} onChange={e => setSourceId(e.target.value)} className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-800 text-white">
        <option value="" className="bg-gray-900 text-white">源概念</option>
        {concepts.map(c => <option key={c.id} value={c.id} className="bg-gray-900 text-white">{c.name}</option>)}
      </select>
      <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-800 text-white">
        <option value="" className="bg-gray-900 text-white">目标概念</option>
        {concepts.map(c => <option key={c.id} value={c.id} className="bg-gray-900 text-white">{c.name}</option>)}
      </select>
      <input value={type} onChange={e => setType(e.target.value)} placeholder="关系类型 (如: belongs_to)" className="w-full px-2 py-1 text-sm border border-gray-300 rounded" />
      <select value={cardinality} onChange={e => setCardinality(e.target.value)} className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-800 text-white">
        <option value="N:M" className="bg-gray-900 text-white">N:M</option>
        <option value="1:N" className="bg-gray-900 text-white">1:N</option>
        <option value="N:1" className="bg-gray-900 text-white">N:1</option>
        <option value="1:1" className="bg-gray-900 text-white">1:1</option>
      </select>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-gray-500">取消</button>
        <button onClick={() => onSubmit(sourceId, targetId, type, cardinality)} disabled={!sourceId || !targetId || !type} className="text-xs text-blue-600 disabled:opacity-50">创建</button>
      </div>
    </div>
  );
}
