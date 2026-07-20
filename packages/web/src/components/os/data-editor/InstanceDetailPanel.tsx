'use client';

import { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { DataFormView } from './DataFormView';
import type { InstanceData, ConceptSchema } from '@originos/core/lib/features/ontology-data-store/types';
import type { InstanceRelation } from '@originos/core/lib/features/ontology-data-store/relation-validator';

interface InstanceDetailPanelProps {
  instance: InstanceData;
  schema: ConceptSchema;
  instanceRelations: InstanceRelation[];
  allInstances: InstanceData[];
  onSave: (fields: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete: (instanceId: string) => void;
}

export function InstanceDetailPanel({
  instance,
  schema,
  instanceRelations,
  allInstances,
  onSave,
  onClose,
  onDelete,
}: InstanceDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback((fields: Record<string, unknown>) => {
    onSave(fields);
    setIsEditing(false);
    setError(null);
  }, [onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setError(null);
  }, []);

  const relatedInstances = instanceRelations.map(r => {
    const isSource = r.sourceInstanceId === instance.id;
    const otherId = isSource ? r.targetInstanceId : r.sourceInstanceId;
    const other = allInstances.find(i => i.id === otherId);
    return { relation: r, direction: isSource ? '→' : '←', other, otherId };
  });

  // Close panel on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditing) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isEditing, onClose]);

  if (isEditing) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
          <span className="text-sm font-medium text-gray-700">编辑 — {schema.name}</span>
          <button onClick={handleCancel} className="p-1 hover:bg-gray-200 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <DataFormView
            schema={schema}
            initialValues={instance.fields}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={false}
          />
        </div>
        {error && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 truncate">{schema.name}</h3>
          <p className="text-xs text-gray-500 truncate">{instance.id}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEditing(true)}
            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            编辑
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {/* Instance properties */}
        <div className="p-4">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">属性</h4>
          <div className="space-y-2">
            {schema.fields.map(field => (
              <div key={field.name} className="flex justify-between items-start py-1.5 border-b border-gray-100">
                <span className="text-xs text-gray-600">{field.name}</span>
                <span className="text-xs text-gray-900 text-right max-w-40 truncate" title={formatValue(instance.fields[field.name])}>
                  {formatValue(instance.fields[field.name])}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Relations */}
        {relatedInstances.length > 0 && (
          <div className="p-4 border-t border-gray-200">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">关系 ({relatedInstances.length})</h4>
            <div className="space-y-1.5">
              {relatedInstances.map((rel, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-xs">
                  <span className="text-gray-400">{rel.direction}</span>
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{rel.relation.type}</span>
                  <span className="text-gray-800 truncate">
                    {rel.other ? getInstanceLabel(rel.other) : rel.otherId}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <button
          onClick={() => onDelete(instance.id)}
          className="w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          删除实例
        </button>
      </div>
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
