'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import type { InstanceData } from '@originos/core/lib/features/ontology-data-store/types';
import type { ConceptRelation } from '@originos/core/lib/features/ontology-data-store/relation-validator';

interface CreateRelationDialogProps {
  instances: InstanceData[];
  concepts: Array<{ id: string; name: string }>;
  constraints: ConceptRelation[];
  sourceInstanceId: string;
  targetInstanceId?: string;
  onConfirm: (sourceId: string, targetId: string, type: string) => void;
  onClose: () => void;
  error?: string | null;
}

export function CreateRelationDialog({
  instances,
  concepts,
  constraints,
  sourceInstanceId,
  targetInstanceId,
  onConfirm,
  onClose,
  error,
}: CreateRelationDialogProps) {
  const [selectedSource, setSelectedSource] = useState(sourceInstanceId || '');
  const [selectedTarget, setSelectedTarget] = useState(targetInstanceId || '');
  const [selectedType, setSelectedType] = useState('');

  const sourceInstance = instances.find(i => i.id === selectedSource);
  const targetInstance = instances.find(i => i.id === selectedTarget);

  // Get allowed relation types and matched direction — check both directions
  const { allowedTypes, matchedDirection } = useMemo(() => {
    if (!sourceInstance || !targetInstance) return { allowedTypes: [], matchedDirection: 'forward' as const };
    // Forward: matches the ontology definition direction
    const forward = constraints.filter(
      c => c.sourceId === sourceInstance.conceptId && c.targetId === targetInstance.conceptId
    ).map(c => c.type);
    if (forward.length > 0) return { allowedTypes: forward, matchedDirection: 'forward' as const };
    // Reverse: ontology defines target→source, user dragged source→target
    const reverse = constraints.filter(
      c => c.sourceId === targetInstance.conceptId && c.targetId === sourceInstance.conceptId
    ).map(c => c.type);
    if (reverse.length > 0) return { allowedTypes: reverse, matchedDirection: 'reverse' as const };
    return { allowedTypes: [], matchedDirection: 'forward' as const };
  }, [sourceInstance, targetInstance, constraints]);

  const isValid = selectedSource && selectedTarget && selectedType && selectedSource !== selectedTarget;

  // Auto-select relation type when only one option
  useEffect(() => {
    if (allowedTypes.length === 1 && selectedType !== allowedTypes[0]) {
      setSelectedType(allowedTypes[0]!);
    } else if (allowedTypes.length > 1 && !allowedTypes.includes(selectedType)) {
      setSelectedType(allowedTypes[0]!);
    } else if (allowedTypes.length === 0 && selectedType !== '') {
      setSelectedType('');
    }
  }, [allowedTypes, selectedSource, selectedTarget]);

  const handleConfirm = useCallback(() => {
    if (!isValid) return;
    // If matched reverse direction, swap source/target so the API call follows ontology definition
    if (matchedDirection === 'reverse') {
      onConfirm(selectedTarget, selectedSource, selectedType);
    } else {
      onConfirm(selectedSource, selectedTarget, selectedType);
    }
  }, [isValid, matchedDirection, selectedSource, selectedTarget, selectedType, onConfirm]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-96 max-h-96 overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">创建关系</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Source */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">源实例</label>
            <select
              value={selectedSource}
              onChange={(e) => { setSelectedSource(e.target.value); setSelectedType(''); }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="" className="bg-gray-900 text-white">-- 选择 --</option>
              {instances.map(inst => (
                <option key={inst.id} value={inst.id} className="bg-gray-900 text-white">
                  {getInstanceLabel(inst)} ({getConceptName(inst.conceptId, concepts)})
                </option>
              ))}
            </select>
          </div>

          {/* Target */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">目标实例</label>
            <select
              value={selectedTarget}
              onChange={(e) => { setSelectedTarget(e.target.value); setSelectedType(''); }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="" className="bg-gray-900 text-white">-- 选择 --</option>
              {instances.filter(i => i.id !== selectedSource).map(inst => (
                <option key={inst.id} value={inst.id} className="bg-gray-900 text-white">
                  {getInstanceLabel(inst)} ({getConceptName(inst.conceptId, concepts)})
                </option>
              ))}
            </select>
          </div>

          {/* Relation type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">关系类型</label>
            {allowedTypes.length > 0 ? (
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="" className="bg-gray-900 text-white">-- 选择 --</option>
                {allowedTypes.map(t => (
                  <option key={t} value={t} className="bg-gray-900 text-white">{t}</option>
                ))}
              </select>
            ) : (
              <div className="px-2 py-1.5 text-sm text-gray-400 border border-gray-200 rounded bg-gray-50">
                {sourceInstance && targetInstance
                  ? '这两个概念之间没有定义关系'
                  : '请先选择源和目标实例'}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => { if (isValid) handleConfirm(); }}
            disabled={!isValid}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

function getInstanceLabel(inst: InstanceData): string {
  const firstField = Object.values(inst.fields)[0];
  return firstField ? String(firstField) : inst.id;
}

function getConceptName(conceptId: string, concepts: Array<{ id: string; name: string }>): string {
  return concepts.find(c => c.id === conceptId)?.name || conceptId;
}
