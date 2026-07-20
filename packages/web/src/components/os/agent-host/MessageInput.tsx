/**
 * OS.7: MessageInput Component
 */

import React, { useState } from 'react';

interface MessageInputProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || disabled || isSending) return;

    setIsSending(true);
    try {
      await onSend(input);
      setInput('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        disabled={disabled || isSending}
        placeholder="输入消息..."
        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      />
      <button
        onClick={handleSend}
        disabled={disabled || isSending || !input.trim()}
        className="px-4 py-2 rounded-lg bg-blue-500 text-white disabled:opacity-50"
      >
        发送
      </button>
    </div>
  );
}
