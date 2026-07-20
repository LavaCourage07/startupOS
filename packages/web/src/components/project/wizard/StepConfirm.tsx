/**
 * Story C.5: Step 4 - Confirm Project Creation
 */

'use client';

import type { ProjectCreationData } from '../ProjectCreationWizard';
import { WorkMode } from '@originos/core/types';

interface StepConfirmProps {
  data: ProjectCreationData;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  onEdit: (step: number) => void;
  isLoading?: boolean;
  error?: string | null;
}

const WORK_MODE_LABELS: Record<WorkMode, string> = {
  solo: '我自己开发和维护',
  team: '和小团队一起协作',
  'product-owner': '交给其他人使用',
  custom: '自定义模式',
};

const PRIORITY_LABELS: Record<string, string> = {
  velocity: '快速上线',
  stability: '稳定可靠',
  maintainability: '易于维护',
};

export function StepConfirm({
  data,
  projectName,
  onProjectNameChange,
  onConfirm,
  onBack,
  onEdit,
  isLoading,
  error,
}: StepConfirmProps) {
  const hasPriorities = data.priorities.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          项目信息确认
        </h2>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Project Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            项目名称
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder="输入项目名称..."
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Background */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              项目类型
            </label>
            <button
              onClick={() => onEdit(1)}
              className="text-xs text-primary hover:text-primary/80"
            >
              修改
            </button>
          </div>
          <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-sm text-gray-300">
              {data.background || '未填写'}
            </p>
          </div>
        </div>

        {/* Priorities */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              核心目标
            </label>
            <button
              onClick={() => onEdit(2)}
              className="text-xs text-primary hover:text-primary/80"
            >
              修改
            </button>
          </div>
          <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg">
            {hasPriorities ? (
              <div className="flex flex-wrap gap-2">
                {data.priorities.map((priority: string) => (
                  <span
                    key={priority}
                    className="px-2 py-1 bg-primary/20 rounded text-sm text-white"
                  >
                    ✓ {PRIORITY_LABELS[priority] || priority}
                  </span>
                ))}
                {data.customDescriptions.priorities && (
                  <span className="px-2 py-1 bg-primary/20 rounded text-sm text-white">
                    {data.customDescriptions.priorities}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">未选择</p>
            )}
          </div>
        </div>

        {/* Work Mode */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              工作模式
            </label>
            <button
              onClick={() => onEdit(3)}
              className="text-xs text-primary hover:text-primary/80"
            >
              修改
            </button>
          </div>
          <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-sm text-gray-300">
              {data.workMode ? WORK_MODE_LABELS[data.workMode as WorkMode] : '未选择'}
              {data.customDescriptions.workMode && (
                <span className="text-gray-400 ml-2">
                  ({data.customDescriptions.workMode})
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Info Notice */}
      <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-sm text-blue-300">
          ℹ️ 系统将根据以上信息自动配置项目环境和智能辅助设置
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-4">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
        >
          ← 修改信息
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading || !projectName.trim()}
          className="px-6 py-2 bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              创建中...
            </>
          ) : (
            '创建项目 →'
          )}
        </button>
      </div>
    </div>
  );
}
