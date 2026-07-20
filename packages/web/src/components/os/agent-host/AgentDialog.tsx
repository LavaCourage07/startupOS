/**
 * OS.7: AgentDialog Component
 */

import { useState, useRef, useEffect } from 'react';
import { AgentStatus } from '@originos/core/types';
import { useAgentRegistryStore } from '@/store/agentRegistry';
import AcrylicDialog from '@/components/os/acrylic/AcrylicDialog';
import { createAgentSession, sendAgentMessage } from '@originos/core/lib/integrations/electron/services/agent-session';

interface AgentDialogProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export default function AgentDialog({ agentId, isOpen, onClose }: AgentDialogProps) {
  // 获取 agent 数据
  const agent = useAgentRegistryStore((state) => state.agents[agentId]);

  // 如果 agent 不存在，不渲染
  if (!agent) return null;


  // 消息状态
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: `你好！我是 ${agent.displayName}。有什么我可以帮助你的吗？` },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    // 添加用户消息
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // 如果没有 session ID，创建一个
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const initResponse = await createAgentSession({
          projectName: '对话项目',
          projectId: `agent-${agent.id}-${Date.now()}`,
        });

        if (initResponse.success) {
          currentSessionId = (initResponse.data as { sessionId: string }).sessionId;
          setSessionId(currentSessionId);
        } else {
          throw new Error(initResponse.error?.message || 'Failed to create session');
        }
      }

      // 发送消息
      const messageData = await sendAgentMessage({
        sessionId: currentSessionId,
        content: message,
      });

      if (messageData.success) {
        const data = messageData.data as { assistantMessage?: { id: string; content: string; timestamp?: number } };
        if (data.assistantMessage) {
          setMessages((prev) => [
            ...prev,
            {
              id: data.assistantMessage!.id,
              role: 'assistant',
              content: data.assistantMessage!.content,
              timestamp: data.assistantMessage!.timestamp,
            },
          ]);
        }
      } else {
        throw new Error(messageData.error?.message || 'Failed to send message');
      }
    } catch (error) {
      console.error(`[${agent.displayName}] 发送消息失败:`, error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: '抱歉，发送消息时出现错误。请稍后再试。',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AcrylicDialog
      isOpen={isOpen}
      onClose={onClose}
      title={agent.displayName}
      size="lg"
      variant="standard"
      mode="nonModal"
    >
      <div className="flex flex-col h-full min-h-[300px]">
        {/* 消息列表区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === 'assistant' ? 'justify-start' : 'justify-end'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.role === 'assistant'
                    ? 'bg-white/20 text-white'
                    : 'bg-primary text-white border border-primary/50'
                }`}
              >
                <div className="text-sm">{msg.content}</div>
              </div>
            </div>
          ))}
          {/* 加载指示器 */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/20 text-white rounded-2xl px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="border-t border-white/20 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              autoFocus
              placeholder={`向 ${agent.displayName} 发送消息...`}
              className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-primary/50"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputRef.current?.value.trim()) {
                  handleSendMessage(inputRef.current.value);
                  if (inputRef.current) inputRef.current.value = '';
                }
              }}
            />
            <button
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation(); // 防止事件冒泡到遮罩层
                e.preventDefault(); // 防止默认行为
                if (inputRef.current?.value.trim()) {
                  handleSendMessage(inputRef.current.value);
                  if (inputRef.current) inputRef.current.value = '';
                }
              }}
              className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '发送中...' : '发送'}
            </button>
          </div>
        </div>

        {/* 状态信息 */}
        <div className="mt-2 text-xs text-white/50">
          {agent.status === AgentStatus.RUNNING ? (
            <span className="text-green-400">● 已连接</span>
          ) : (
            <span className="text-gray-400">○ 已离线</span>
          )}
          {' · '}
          <span>{agent.displayName}</span>
        </div>
      </div>
    </AcrylicDialog>
  );
}
