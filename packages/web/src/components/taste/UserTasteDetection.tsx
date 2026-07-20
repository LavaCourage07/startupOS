/**
 * Story C.1: UserTasteDetection - 用户维度文化检测容器组件
 *
 * 功能:
 * - 管理检测会话生命周期
 * - 协调对话界面和完成界面
 * - 处理 API 调用和状态管理
 * - 提供关闭确认机制
 *
 * @module components/taste/UserTasteDetection
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AcrylicPanel from '@/components/os/acrylic/AcrylicPanel';
import TasteConversation from './TasteConversation';
import TasteComplete from './TasteComplete';
import { useTransition } from '@originos/core/lib/features/animations';
import { durations } from '@originos/core/lib/features/animations';
import type {
  StartDetectionResponse,
  SendMessageResponse,
  TASTEProfile,
  CultureDetectionMessage,
} from '@originos/core/types';
import {
  analyzeTasteDetection,
  getTasteDraft,
  sendTasteDetectionMessage,
  startTasteDetection,
} from '@originos/core/lib/integrations/electron/services/misc';

// ============================================================================
// Types
// ============================================================================

export type DetectionPhase = 'welcome' | 'conversation' | 'analyzing' | 'complete';

export interface UserTasteDetectionProps {
  /** 用户 ID */
  userId: string;
  /** 项目 ID (可选, Phase 1.5) */
  projectId?: string;
  /** 最大对话轮数 */
  maxTurns?: number;
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 完成回调 */
  onComplete?: (profile: TASTEProfile) => void;
}

export interface DetectionSession {
  sessionId: string;
  status: 'active' | 'analyzing' | 'completed' | 'failed' | 'expired';
  currentTurn: number;
  maxTurns: number;
  messages: CultureDetectionMessage[];
  tasteProfile: TASTEProfile | null;
  error: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const WELCOME_MESSAGES = [
  '你好! 欢迎来到 OriginOS。',
  '在开始之前, 我想了解一下你平时的工作方式, 这样 Agent 的建议会更符合你的直觉。',
  '让我们聊几句吧!',
];

// ============================================================================
// Component
// ============================================================================

export default function UserTasteDetection({
  userId,
  projectId,
  maxTurns = 3,
  isOpen,
  onClose,
  onComplete,
}: UserTasteDetectionProps) {
  // State
  const [phase, setPhase] = useState<DetectionPhase>('welcome');
  const [session, setSession] = useState<DetectionSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  // Animation transition
  const transitionStatus = useTransition(isOpen, { duration: durations.normal });

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen && !session) {
      startSession();
    }
  }, [isOpen]);

  // Start detection session
  const startSession = useCallback(async () => {
    setIsLoading(true);
    setPhase('welcome');

    try {
      const result = await startTasteDetection({ userId, projectId, maxTurns });

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to start detection session');
      }

      const data = result.data as StartDetectionResponse;

      setSession({
        sessionId: data.sessionId,
        status: data.status,
        currentTurn: data.currentTurn,
        maxTurns: data.maxTurns,
        messages: [
          {
            id: `msg-welcome-${Date.now()}`,
            role: 'assistant',
            content: data.firstQuestion,
            turn: 0,
            timestamp: new Date().toISOString(),
          },
        ],
        tasteProfile: null,
        error: null,
      });

      // Transition to conversation after welcome delay
      setTimeout(() => setPhase('conversation'), 1500);
    } catch (error) {
      console.error('Failed to start session:', error);
      setSession({
        sessionId: '',
        status: 'failed',
        currentTurn: 0,
        maxTurns: maxTurns,
        messages: [],
        tasteProfile: null,
        error: '无法启动检测会话, 请稍后重试',
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectId, maxTurns]);

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!session || session.status !== 'active') return;

      setIsLoading(true);

      // Add user message optimistically
      const userMessage: CultureDetectionMessage = {
        id: `msg-user-${Date.now()}`,
        role: 'user',
        content,
        turn: session.currentTurn + 1,
        timestamp: new Date().toISOString(),
      };

      setSession((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, userMessage],
              currentTurn: prev.currentTurn + 1,
            }
          : null
      );

      try {
        const result = await sendTasteDetectionMessage(session.sessionId, content);

        if (!result.success || !result.data) {
          throw new Error(result.error?.message || 'Failed to send message');
        }

        const data = result.data as SendMessageResponse;

        // Add assistant message
        const assistantMessage: CultureDetectionMessage = {
          id: `msg-assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          turn: data.turn,
          timestamp: new Date().toISOString(),
        };

        setSession((prev) =>
          prev
            ? {
                ...prev,
                messages: [...prev.messages, assistantMessage],
                status: data.isComplete ? 'completed' : 'active',
              }
            : null
        );

        // Check if conversation is complete
        if (data.isComplete || data.nextAction === 'analyze') {
          await triggerAnalysis();
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        setSession((prev) =>
          prev
            ? {
                ...prev,
                error: '发送消息失败, 请重试',
              }
            : null
        );
      } finally {
        setIsLoading(false);
      }
    },
    [session]
  );

  // Trigger LLM analysis
  const triggerAnalysis = useCallback(async () => {
    if (!session) return;

    setPhase('analyzing');
    setSession((prev) => (prev ? { ...prev, status: 'analyzing' } : null));

    try {
      const analysisResult = await analyzeTasteDetection(session.sessionId);

      if (!analysisResult.success) {
        throw new Error(analysisResult.error?.message || 'Analysis failed');
      }

      const draftResult = await getTasteDraft(session.sessionId);
      if (!draftResult.success || !draftResult.data) {
        throw new Error(draftResult.error?.message || 'Failed to load taste draft');
      }
      const draftData = draftResult.data as { draft?: TASTEProfile };
      const tasteDraft = draftData.draft;

      if (tasteDraft) {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                status: 'completed',
                tasteProfile: tasteDraft,
              }
            : null
        );
        setPhase('complete');
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: 'failed',
              error: '分析失败, 请重试',
            }
          : null
      );
      setPhase('conversation');
    }
  }, [session]);

  // Handle complete
  const handleComplete = useCallback(() => {
    if (session?.tasteProfile && onComplete) {
      onComplete(session.tasteProfile);
    }
    handleClose(false);
  }, [session?.tasteProfile, onComplete]);

  // Handle close with confirmation
  const handleClose = useCallback(
    (forceClose: boolean = false) => {
      if (!forceClose && phase === 'conversation' && session && session.currentTurn > 0) {
        setShowConfirmClose(true);
        return;
      }
      onClose();
      // Reset state
      setSession(null);
      setPhase('welcome');
      setShowConfirmClose(false);
    },
    [phase, session, onClose]
  );

  // Confirm close
  const confirmClose = useCallback(() => {
    handleClose(true);
  }, [handleClose]);

  // Don't render if not open or not in DOM
  if (transitionStatus === 'exited' || !isOpen) {
    return null;
  }

  // Render portal
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
        transitionStatus === 'entering' || transitionStatus === 'entered'
          ? 'opacity-100'
          : 'opacity-0'
      }`}
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
    >
      <AcrylicPanel
        variant="strong"
        className="w-full max-w-2xl mx-4 min-h-[500px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20">
          <div className="flex items-center gap-3">
            {/* OriginOS Logo/Icon */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
              O
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                品味检测
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                让我了解一下你的工作方式
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={() => handleClose(false)}
            className="p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="关闭"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Welcome Phase */}
          {phase === 'welcome' && (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl animate-pulse">
                O
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                {WELCOME_MESSAGES[0]}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {WELCOME_MESSAGES[1]}
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-sm">
                {WELCOME_MESSAGES[2]}
              </p>
            </div>
          )}

          {/* Conversation Phase */}
          {phase === 'conversation' && session && (
            <TasteConversation
              messages={session.messages}
              currentTurn={session.currentTurn}
              maxTurns={session.maxTurns}
              isLoading={isLoading}
              error={session.error}
              onSendMessage={sendMessage}
            />
          )}

          {/* Analyzing Phase */}
          {phase === 'analyzing' && (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-16 h-16 mb-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                正在分析你的风格...
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                请稍候, 我正在理解你的工作方式
              </p>
            </div>
          )}

          {/* Complete Phase */}
          {phase === 'complete' && session?.tasteProfile && (
            <TasteComplete
              tasteProfile={session.tasteProfile}
              onComplete={handleComplete}
            />
          )}

          {/* Error State */}
          {session?.status === 'failed' && (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-16 h-16 mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                出错了
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {session.error || '检测过程中出现问题'}
              </p>
              <button
                onClick={startSession}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                重试
              </button>
            </div>
          )}
        </div>
      </AcrylicPanel>

      {/* Close Confirmation Dialog */}
      {showConfirmClose && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <AcrylicPanel variant="standard" className="max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              确定要离开吗?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              当前进度将会丢失, 需要重新开始品味检测。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmClose(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
              >
                继续
              </button>
              <button
                onClick={confirmClose}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                离开
              </button>
            </div>
          </AcrylicPanel>
        </div>
      )}
    </div>,
    document.body
  );
}
