/**
 * MessageList Component
 * Displays conversation messages with auto-scroll and Markdown support
 * Uses the shared ChatMessageList component.
 */

import { ThinkingProcess } from '@/components/os/cui/thinking';
import type { ThinkingData } from '@originos/core/types';
import type { ChatMessageItem } from '@/components/ui/chat';
import type { ToolExecution } from '@/components/os/agent-dialog/ToolExecutionFrame';
import { ChatMessageList } from '@/components/ui/chat';

export interface Message extends ChatMessageItem {
  // AI Thinking data
  thinking?: ThinkingData;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  toolExecutions?: ToolExecution[];
  onQuestionAnswer?: (messageIndex: number | string, selectedLabels: string[]) => void;
  answeredQuestions?: Set<number | string>;
}

export default function MessageList({ messages, isLoading, toolExecutions, onQuestionAnswer, answeredQuestions }: MessageListProps) {
  return (
    <ChatMessageList
      messages={messages}
      isLoading={isLoading}
      isThinking={isLoading}
      toolExecutions={toolExecutions}
      onQuestionAnswer={onQuestionAnswer}
      answeredQuestions={answeredQuestions}
      assistantMessageExtra={(msg) => {
        // Render thinking process for assistant messages with thinking data
        if (msg.role === 'assistant' && (msg as Message).thinking) {
          return (
            <ThinkingProcess
              thinking={(msg as Message).thinking!}
              preference={{
                displayMode: 'user-choice',
                autoExpandStreaming: false,
                showToolCalls: true,
                showConfidence: false,
              }}
            />
          );
        }
        return null;
      }}
    />
  );
}
