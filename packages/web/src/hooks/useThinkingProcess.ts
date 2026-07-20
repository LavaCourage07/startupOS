/**
 * Thinking Process Hook
 * 管理 AI 推理过程展示状态
 */

import { useState, useCallback } from 'react';
import type { ThinkingData, ThinkingPreference } from '@originos/core/types';

interface UseThinkingProcessResult {
  /** 推理过程数据 */
  thinking: ThinkingData | null;
  /** 是否展开显示 */
  isExpanded: boolean;
  /** 用户偏好设置 */
  preference: ThinkingPreference;
  /** 展开/收起切换 */
  toggle: () => void;
  /** 展开推理过程 */
  expand: () => void;
  /** 收起推理过程 */
  collapse: () => void;
  /** 更新推理内容 */
  updateThinking: (content: string, status: ThinkingData['status']) => void;
}

const DEFAULT_PREFERENCE: ThinkingPreference = {
  displayMode: 'user-choice',
  autoExpandStreaming: false,
  showToolCalls: true,
  showConfidence: false,
};

/**
 * 管理 AI 推理过程展示状态的 Hook
 *
 * @param initialThinking - 初始推理数据
 * @param userPreference - 用户偏好设置
 * @returns 推理过程状态和操作方法
 */
export function useThinkingProcess(
  initialThinking?: ThinkingData,
  userPreference?: Partial<ThinkingPreference>
): UseThinkingProcessResult {
  const preference = { ...DEFAULT_PREFERENCE, ...userPreference };
  const [thinking, setThinking] = useState<ThinkingData | null>(initialThinking || null);

  // 判断是否应该自动展开
  const shouldAutoExpand =
    preference.displayMode === 'always-show' ||
    (preference.autoExpandStreaming && thinking?.status === 'in-progress');

  const [isExpanded, setIsExpanded] = useState(shouldAutoExpand);

  const toggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const expand = useCallback(() => {
    if (preference.displayMode !== 'always-hide') {
      setIsExpanded(true);
    }
  }, [preference]);

  const collapse = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const updateThinking = useCallback((content: string, status: ThinkingData['status']) => {
    setThinking(prev => ({
      content,
      status,
      steps: prev?.steps,
      signature: prev?.signature,
      error: status === 'error' ? prev?.error : undefined,
    }));

    // 如果自动展开偏好开启且正在思考，自动展开
    if (preference.autoExpandStreaming && status === 'in-progress' && !isExpanded) {
      setIsExpanded(true);
    }
  }, [preference.autoExpandStreaming, isExpanded]);

  return {
    thinking,
    // 如果用户偏好是 always-hide，则始终不展开
    isExpanded: preference.displayMode !== 'always-hide' && isExpanded,
    preference,
    toggle,
    expand,
    collapse,
    updateThinking,
  };
}

/**
 * Hook 的类型定义导出
 */
export type { UseThinkingProcessResult };
