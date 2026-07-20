/**
 * ThinkingContent Component
 * 推理内容容器 - Markdown 渲染和流式动画
 */

import type { ThinkingPreference } from '@originos/core/types';

interface ThinkingContentProps {
  /** 推理内容 */
  content: string;
  /** 是否正在流式输出 */
  isStreaming: boolean;
  /** 用户偏好设置 */
  preference?: ThinkingPreference;
  /** 自定义类名 */
  className?: string;
}

export type { ThinkingContentProps };

export function ThinkingContent({
  content,
  isStreaming,
  className = '',
}: ThinkingContentProps) {
  // 简单的分段显示（每 500 字符换一行）
  const renderContent = () => {
    return content.split('\n').map((line, idx) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return null;

      return (
        <p key={idx} className="cui-thinking__paragraph">
          {trimmedLine}
        </p>
      );
    });
  };

  // 显示工具调用信息（P1 功能，预留）
  const renderToolCalls = () => {
    // TODO: 实现 tool calls 可视化（P1）
    return null;
  };

  return (
    <div
      id="thinking-content"
      className={`cui-thinking-content ${isStreaming ? 'cui-thinking-content--streaming' : ''} ${className}`}
      role="log"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="cui-thinking__markdown">
        {content ? (
          renderContent()
        ) : (
          <p className="cui-thinking__empty">等待推理内容...</p>
        )}
      </div>

      {renderToolCalls()}

      {isStreaming && content && (
        <span className="cui-thinking__cursor" aria-hidden="true" />
      )}

      <style jsx>{`
        .cui-thinking-content {
          margin-top: 8px;
          padding: 8px 12px;
          background-color: rgba(31, 41, 55, 0.5);
          border-radius: 8px;
          max-height: 400px;
          overflow-y: auto;
        }

        .cui-thinking__markdown {
          font-size: 13px;
          line-height: 1.6;
          color: #D1D5DB;
        }

        .cui-thinking__paragraph {
          margin-bottom: 12px;
        }

        .cui-thinking__empty {
          color: #6B7280;
          font-style: italic;
        }

        /* 流式光标 */
        .cui-thinking__cursor {
          display: inline-block;
          width: 2px;
          height: 16px;
          margin-left: 2px;
          background-color: #9CA3AF;
          animation: cui-cursor-blink 1s infinite;
          vertical-align: text-bottom;
        }

        @keyframes cui-cursor-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        /* 滚动条样式 */
        .cui-thinking-content::-webkit-scrollbar {
          width: 6px;
        }

        .cui-thinking-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .cui-thinking-content::-webkit-scrollbar-thumb {
          background-color: rgba(107, 114, 128, 0.5);
          border-radius: 3px;
        }

        .cui-thinking-content::-webkit-scrollbar-thumb:hover {
          background-color: rgba(107, 114, 128, 0.7);
        }

        /* 浅色模式适配 */
        @media (prefers-color-scheme: light) {
          .cui-thinking-content {
            background-color: rgba(243, 244, 246, 0.8);
          }

          .cui-thinking__markdown {
            color: #4B5563;
          }

          .cui-thinking__empty {
            color: #9CA3AF;
          }

          .cui-thinking__cursor {
            background-color: #6B7280;
          }

          .cui-thinking-content::-webkit-scrollbar-thumb {
            background-color: rgba(156, 163, 175, 0.5);
          }

          .cui-thinking-content::-webkit-scrollbar-thumb:hover {
            background-color: rgba(156, 163, 175, 0.7);
          }
        }
      `}</style>
    </div>
  );
}
