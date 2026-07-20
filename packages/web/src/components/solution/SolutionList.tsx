'use client';

import { useState, useEffect } from 'react';
import type { SolutionListItem, SolutionStatus } from '@originos/core/types';
import { listSolutions } from '@originos/core/lib/integrations/electron/services/project';

interface SolutionListProps {
  projectId: string;
  onSelect: (version: string) => void;
  activeVersion?: string | null;
}

const STATUS_COLORS: Record<SolutionStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  reviewing: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
};

const STATUS_LABELS: Record<SolutionStatus, string> = {
  draft: '草稿',
  reviewing: '审阅',
  confirmed: '已确认',
};

export function SolutionList({ projectId, onSelect, activeVersion }: SolutionListProps) {
  const [solutions, setSolutions] = useState<SolutionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSolutions = async () => {
      try {
        const result = await listSolutions(projectId);
        if (result.success && Array.isArray(result.data)) {
          setSolutions(result.data);
        }
      } catch {
        // Ignore fetch errors
      } finally {
        setLoading(false);
      }
    };

    fetchSolutions();
  }, [projectId]);

  // Poll for new solutions every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      listSolutions(projectId)
        .then(result => {
          if (result.success && Array.isArray(result.data)) {
            setSolutions(result.data);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  if (loading) {
    return (
      <div className="w-48 border-r border-white/20 bg-white/5 p-3">
        <p className="text-xs text-gray-500">加载方案列表...</p>
      </div>
    );
  }

  if (solutions.length === 0) {
    return (
      <div className="w-48 border-r border-white/20 bg-white/5 p-3">
        <p className="text-xs text-gray-500">暂无方案版本</p>
      </div>
    );
  }

  return (
    <div className="w-48 border-r border-white/20 bg-white/5 flex flex-col">
      <div className="px-3 py-2 border-b border-white/10">
        <h3 className="text-xs font-medium text-gray-600">方案版本</h3>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {solutions.map((sol) => (
          <button
            key={sol.id}
            onClick={() => onSelect(sol.version)}
            className={`w-full text-left px-3 py-2 hover:bg-white/10 transition-colors border-b border-white/5 ${
              sol.version === activeVersion ? 'bg-primary/10' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-800 truncate">{sol.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[sol.status as SolutionStatus] || STATUS_COLORS.draft}`}>
                {STATUS_LABELS[sol.status as SolutionStatus] || '草稿'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
              <span>{sol.modelingDimension === 'task' ? '事' : '人'}</span>
              <span>·</span>
              <span>{sol.agentCount} Agent</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
