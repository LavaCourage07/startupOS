'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Clock, Play, Pause, RotateCcw, ChevronDown } from 'lucide-react';

export interface SkillExecutionStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  error?: string;
  output?: string;
}

export type SkillExecution = {
  executionId: string;
  skillName: string;
  status: 'initializing' | 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  steps: SkillExecutionStep[];
  result?: any;
  error?: string;
};

export interface SkillExecutionProps {
  execution: SkillExecution | null;
  isStreaming?: boolean;
}

/**
 * SkillExecutionComponent - 技能执行进度和结果展示组件
 *
 * 显示技能执行过程中的步骤、进度和最终结果
 */
export function SkillExecution({ execution, isStreaming }: SkillExecutionProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  if (!execution) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500">
        <div className="text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">等待执行...</p>
        </div>
      </div>
    );
  }

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getStepIcon = (status: SkillExecutionStep['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'running':
        return <Play className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-teal-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusIcon = (status: SkillExecution['status']) => {
    switch (status) {
      case 'initializing':
        return <Clock className="w-5 h-5 text-gray-500" />;
      case 'running':
        return <Play className="w-5 h-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-teal-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusText = (status: SkillExecution['status']) => {
    switch (status) {
      case 'initializing':
        return '正在初始化';
      case 'running':
        return '执行中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '执行失败';
      default:
        return '未知';
    }
  };

  const progress = execution.steps.length > 0
    ? (execution.steps.filter(s => s.status !== 'pending').length / execution.steps.length) * 100
    : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            {getStatusIcon(execution.status)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{execution.skillName}</h3>
            <p className="text-sm text-gray-500">
              {getStatusText(execution.status)}
              {execution.status === 'running' && isStreaming && (
                <span className="ml-2 text-blue-500">实时更新中...</span>
              )}
            </p>
          </div>
        </div>
        {execution.status === 'running' && (
          <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="暂停">
            <Pause className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>{execution.steps.filter(s => s.status === 'completed').length} / {execution.steps.length} 完成</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {execution.steps.map((step, index) => (
          <div
            key={step.id}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggleStep(step.id)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-gray-400 w-6">{index + 1}</span>
                {getStepIcon(step.status)}
                <span className="text-sm font-medium text-gray-900">{step.name}</span>
              </div>
              {(step.output || step.error) && (
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedSteps.has(step.id) ? 'rotate-180' : ''
                  }`}
                />
              )}
            </button>

            {/* Step Details */}
            {expandedSteps.has(step.id) && (step.output || step.error) && (
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                {step.error ? (
                  <div className="text-sm text-red-600">
                    <span className="font-semibold">错误: </span>
                    {step.error}
                  </div>
                ) : step.output ? (
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {step.output}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Result */}
      {execution.status === 'completed' && execution.result && (
        <div className="mt-4 p-3 bg-teal-950/20 border border-teal-800/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-medium text-teal-300">执行结果</span>
          </div>
          <pre className="text-xs text-teal-200 whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(execution.result, null, 2)}
          </pre>
        </div>
      )}

      {/* Error */}
      {execution.status === 'failed' && execution.error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">执行失败</span>
          </div>
          <p className="text-sm text-red-900">{execution.error}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex justify-end">
        {execution.status === 'failed' && (
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm">
            <RotateCcw className="w-3 h-3" />
            重试
          </button>
        )}
      </div>
    </div>
  );
}
