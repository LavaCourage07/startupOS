'use client';

import { useState, useCallback } from 'react';
import { Plus, X, Pencil, Trash2, Save } from 'lucide-react';
import type { ConceptField } from '@originos/core/lib/features/ontology-data-store/types';

interface SchemaEditorProps {
  conceptId: string;
  domainId: string;
  ontologyId: string;
  conceptName: string;
  fields: ConceptField[];
  onSave: (fields: ConceptField[]) => Promise<void>;
  onClose: () => void;
}

const FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'array', 'object'] as const;

function emptyField(): ConceptField {
  return { name: '', type: 'string', required: false, description: '', enum: [] };
}

export function SchemaEditor({ conceptName, fields: initialFields, onSave, onClose }: SchemaEditorProps) {
  const [fields, setFields] = useState<ConceptField[]>(initialFields.map(f => ({ ...f })));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (fields.some(f => !f.name.trim())) {
      setError('字段名称不能为空');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [fields, onSave]);

  const addField = () => {
    setFields(prev => [...prev, emptyField()]);
    setAdding(true);
    setEditingIndex(fields.length);
  };

  const removeField = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
    setAdding(false);
    setEditingIndex(null);
  };

  const updateField = (index: number, partial: Partial<ConceptField>) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, ...partial } : f));
  };

  const cancelEdit = () => {
    if (adding) {
      setFields(prev => prev.slice(0, -1));
      setAdding(false);
    }
    setEditingIndex(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">{conceptName} — Schema</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">{error}</div>
        )}

        {/* Field list */}
        {fields.map((field, i) => (
          <div key={i} className={`border rounded-md p-3 ${editingIndex === i ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}>
            {editingIndex === i ? (
              <FieldEditor
                field={field}
                onChange={(partial) => updateField(i, partial)}
                onCancel={cancelEdit}
              />
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{field.name}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{field.type}</span>
                    {field.required && <span className="text-xs text-red-400">必填</span>}
                  </div>
                  {field.description && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{field.description}</div>
                  )}
                  {field.enum && field.enum.length > 0 && (
                    <div className="text-xs text-gray-400 mt-0.5">枚举: {field.enum.join(', ')}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditingIndex(i)} className="p-1 hover:bg-gray-100 rounded">
                    <Pencil className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button onClick={() => removeField(i)} className="p-1 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add button */}
        <button
          onClick={addField}
          className="w-full py-2 text-sm text-gray-500 border border-dashed border-gray-300 rounded-md hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          添加字段
        </button>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
        <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors">
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-1"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}

function FieldEditor({ field, onChange, onCancel }: {
  field: ConceptField;
  onChange: (partial: Partial<ConceptField>) => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={field.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="字段名称"
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={field.type}
          onChange={e => onChange({ type: e.target.value as ConceptField['type'] })}
          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {FIELD_TYPES.map(t => <option key={t} value={t} className="bg-gray-900 text-white">{t}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={field.required}
            onChange={e => onChange({ required: e.target.checked })}
            className="h-3 w-3"
          />
          必填
        </label>
      </div>
      <input
        value={field.description || ''}
        onChange={e => onChange({ description: e.target.value })}
        placeholder="描述"
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <input
        value={field.enum?.join(', ') || ''}
        onChange={e => onChange({ enum: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
        placeholder="枚举值（逗号分隔）"
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex justify-end">
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700">完成</button>
      </div>
    </div>
  );
}
