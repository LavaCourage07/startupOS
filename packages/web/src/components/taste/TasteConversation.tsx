/**
 * Story C.1: TasteConversation - 对话界面组件
 *
 * 功能:
 * - 显示对话消息列表
 * - 用户输入框
 * - 进度指示器
 * - 发送按钮
 * - 消息气泡动画
 *
 * @module components/taste/TasteConversation
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { CultureDetectionMessage } from '@originos/core/types';
import { easings } from '@originos/core/lib/features/animations';

// ============================================================================
// Types
// ============================================================================

export interface TasteConversationProps {
  /** 对话消息列表 */
  messages: CultureDetectionMessage[];
  /** 当前轮次 */
  currentTurn: number;
  /** 最大轮次 */
  maxTurns: number;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 发送消息回调 */
  onSendMessage: (content: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export default function TasteConversation({
  messages,
  currentTurn,
  maxTurns,
  isLoading,
  error,
  onSendMessage,
}: TasteConversationProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle send
  const handleSend = () => {
    const content = inputValue.trim();
    if (!content || isLoading) return;

    onSendMessage(content);
    setInputValue('');
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Progress percentage
  const progress = Math.min((currentTurn / maxTurns) * 100, 100);

  return (
    <div className="flex flex-col h-full">
      {/* Progress Bar */}
      <div className="px-6 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            对话进度
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {currentTurn} / {maxTurns}
          </span>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLatest={index === messages.length - 1}
          />
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800/50 rounded-2xl px-4 py-3">
              <TypingIndicator />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex justify-center">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-6 py-4 border-t border-white/10">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入你的回答..."
              disabled={isLoading}
              className="w-full px-4 py-3 bg-white/50 dark:bg-black/20 border border-white/30 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all disabled:opacity-50"
              style={{
                backdropFilter: 'blur(10px)',
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                发送中
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                发送
              </>
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500 text-center">
          按 Enter 发送消息
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface MessageBubbleProps {
  message: CultureDetectionMessage;
  isLatest: boolean;
}

function MessageBubble({ message, isLatest }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${
        isLatest ? 'animate-fade-in' : ''
      }`}
      style={{
        animation: isLatest ? `fadeIn 0.3s ${easings.decelerate}` : undefined,
      }}
    >
      <div className="flex items-start gap-2 max-w-[85%]">
        {/* Avatar for assistant */}
        {isAssistant && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs mt-0.5">
            O
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-tr-sm'
              : 'bg-gray-100 dark:bg-gray-800/50 text-gray-900 dark:text-white rounded-tl-sm'
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Avatar for user */}
        {isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-xs mt-0.5">
            U
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

// ============================================================================
// Styles (Global CSS Keyframes)
// ============================================================================

// Note: Add this to your global CSS or tailwind config
// @keyframes fadeIn {
//   from {
//     opacity: 0;
//     transform: translateY(10px);
//   }
//   to {
//     opacity: 1;
//     transform: translateY(0);
//   }
// }
