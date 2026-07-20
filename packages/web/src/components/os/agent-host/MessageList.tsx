/**
 * OS.7: MessageList Component
 */

import React, { useRef, useEffect } from 'react';
import { AgentMessage } from '@originos/core/types';

interface MessageListProps {
  messages: AgentMessage[];
  agentId: string;
}

export default function MessageList({ messages }: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current?.scrollTo) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  return (
    <div ref={listRef} className="h-96 overflow-y-auto space-y-4 mb-4">
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] px-4 py-2 rounded-lg ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}
    </div>
  );
}
