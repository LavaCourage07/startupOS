/**
 * ThinkingProcess Component
 * AI 推理过程主容器组件
 */

import { useThinkingProcess } from '@/hooks/useThinkingProcess';
import { ThinkingHeader } from './ThinkingHeader';
import { ThinkingContent } from './ThinkingContent';
import type { ThinkingData, ThinkingPreference } from '@originos/core/types';

interface ThinkingProcessProps {
  /** 推理过程数据 */
  thinking: ThinkingData | null;
  /** 用户偏好设置 */
  preference?: Partial<ThinkingPreference>;
  /** 展开/收起回调 */
  onToggle?: (expanded: boolean) => void;
  /** 自定义类名 */
  className?: string;
  error?: string | null;
}

export type { ThinkingProcessProps };

export function ThinkingProcess({
  thinking,
  preference,
  onToggle,
  className = '',
  error,
}: ThinkingProcessProps) {
  // 合并错误信息到 thinking
  const thinkingWithError = thinking
    ? { ...thinking, error: error || thinking.error }
    : null;

  const {
    isExpanded,
    preference: finalPreference,
    toggle,
  } = useThinkingProcess(thinkingWithError ?? undefined, preference);

  const handleToggle = () => {
    toggle();
    onToggle?.(!isExpanded);
  };

  if (!thinkingWithError) {
    return null;
  }

  const isStreaming = thinkingWithError.status === 'in-progress';
  const hasError = thinkingWithError.status === 'error';

  return (
    <div
      className={`cui-thinking-process cui-thinking-process--${isExpanded ? 'expanded' : 'collapsed'} ${
        hasError ? 'cui-thinking-process--error' : ''
      } ${isStreaming ? 'cui-thinking-process--streaming' : ''} ${className}`}
      role="region"
      aria-label="AI 推理过程"
      aria-live="polite"
    >
      {/* 错误提示 */}
      {hasError && thinkingWithError.error && (
        <div className="cui-thinking__error">
          <span className="cui-thinking__error-icon">⚠️</span>
          <span className="cui-thinking__error-text">{thinkingWithError.error}</span>
        </div>
      )}

      {/* 头部：折叠/展开 */}
      <ThinkingHeader
        isExpanded={isExpanded}
        isStreaming={isStreaming && !hasError}
        onClick={handleToggle}
        stepCount={thinkingWithError.steps?.length}
      />

      {/* 内容区域：仅在展开时显示 */}
      <div
        className={`cui-thinking__content-wrapper ${isExpanded ? 'cui-thinking__content-wrapper--visible' : ''}`}
      >
        {isExpanded && thinkingWithError.content && (
          <ThinkingContent
            content={thinkingWithError.content}
            isStreaming={isStreaming && !hasError}
            preference={finalPreference}
          />
        )}
      </div>

      <style jsx>{`
        .cui-thinking-process {
          border-left: 2px solid #6B7280;
          background: transparent;
          border-radius: 0 8px 8px 0;
          transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
          margin-bottom: 8px;
        }

        .cui-thinking-process--collapsed {
          border-left-width: 2px;
        }

        .cui-thinking-process--expanded {
          border-left-width: 3px;
        }

        .cui-thinking-process--streaming {
          animation: cui-thinking-pulse 2s ease-in-out infinite;
        }

        .cui-thinking-process--error {
          border-left-color: #EF4444;
        }

        @keyframes cui-thinking-pulse {
          0%, 100% {
            border-left-color: #6B7280;
            opacity: 1;
          }
          50% {
            border-left-color: #9CA3AF;
            opacity: 0.8;
          }
        }

        /* 错误提示 */
        .cui-thinking__error {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background-color: rgba(239, 68, 68, 0.1);
          border-left: 2px solid #EF4444;
          border-radius: 4px 4px 4px 0;
          margin-bottom: 6px;
          font-size: 12px;
        }

        .cui-thinking__error-text {
          color: #FCA5A5;
        }

        /* 内容容器过渡动画 */
        .cui-thinking__content-wrapper {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .cui-thinking__content-wrapper--visible {
          grid-template-rows: 1fr;
        }

        .cui-thinking__content-wrapper > div {
          overflow: hidden;
        }

        /* 浅色模式适配 */
        @media (prefers-color-scheme: light) {
          .cui-thinking-process {
            border-left-color: #D1D5DB;
            background-color: rgba(243, 244, 246, 0.5);
          }

          @keyframes cui-thinking-pulse {
            0%, 100% {
              border-left-color: #D1D5DB;
              opacity: 1;
            }
            50% {
              border-left-color: #9CA3AF;
              opacity: 0.8;
            }
          }

          .cui-thinking__error {
            background-color: rgba(239, 68, 68, 0.08);
          }

          .cui-thinking__error-text {
            color: #EF4444;
          }
        }

        /* 响应式：移动端 */
        @media (max-width: 767px) {
          .cui-thinking-process {
            border-left-width: 1px;
            border-radius: 0 6px 6px 0;
          }
        }
      `}</style>
    </div>
  );
}
