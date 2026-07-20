'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import type { ApiResponse } from '@originos/core/types';
import { createAgentSession, sendAgentMessage } from '@originos/core/lib/integrations/electron/services/agent-session';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface SkillInterviewProps {
  projectId?: string;
  onComplete?: (result: any) => void;
  onCancel?: () => void;
}

/**
 * SkillInterview - 基于 Skill 系统的项目访谈组件
 *
 * 使用 project-interview Skill 通过对话式交互完成访谈流程
 */
export function SkillInterview({ projectId, onComplete, onCancel }: SkillInterviewProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize agent session with project-interview skill
  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      setIsInitializing(true);

      // Create agent session
      const sessionData = await createAgentSession({
        projectId: projectId || `temp-${Date.now()}`,
        projectName: '新项目',
        agentType: 'project-interview',
        systemPrompt: '你是一个项目访谈助手，负责引导用户完成项目访谈流程。',
      });

      if (!sessionData.success || !sessionData.data) {
        throw new Error('Failed to create session');
      }

      setSessionId(sessionData.data.sessionId);

      // Send initial message to start the interview
      await sendMessage('开始访谈', sessionData.data.sessionId, true);

    } catch (error) {
      console.error('Failed to initialize session:', error);
      setMessages([{
        role: 'assistant',
        content: '抱歉，初始化访谈失败。请刷新页面重试。',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsInitializing(false);
    }
  };

  const sendMessage = async (content: string, sid?: string, isInitial = false) => {
    const currentSessionId = sid || sessionId;
    if (!currentSessionId) return;

    // Add user message to UI (unless it's the initial trigger)
    if (!isInitial) {
      const userMessage: Message = {
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, userMessage]);
    }

    setInput('');
    setIsLoading(true);

    try {
      // Send message to agent session
      const data = await sendAgentMessage({
        sessionId: currentSessionId,
        content: isInitial ? '请开始项目访谈流程' : content,
        role: 'user',
      }) as ApiResponse<{ response?: string; content?: string; metadata?: { interviewComplete?: boolean; result?: unknown } }>;

      if (!data.success || !data.data) {
        throw new Error('Failed to send message');
      }

      // Add assistant response to UI
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.data.response || data.data.content || '收到',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Check if interview is complete
      if (data.data.metadata?.interviewComplete) {
        onComplete?.(data.data.metadata.result);
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: '抱歉，发送消息失败。请重试。',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-text-secondary">正在初始化访谈...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-primary text-foreground'
                  : 'bg-muted text-text-primary'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
              <div
                className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-foreground/70' : 'text-text-secondary'
                }`}
              >
                {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-3">
              <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的回答..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary text-text-primary placeholder:text-text-secondary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 rounded-lg bg-primary text-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>

        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            取消访谈
          </button>
        )}
      </div>
    </div>
  );
}
