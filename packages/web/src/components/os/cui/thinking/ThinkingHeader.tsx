/**
 * ThinkingHeader Component
 * 推理过程折叠/展开头部组件
 */

import { StreamingDots } from './components/StreamingDots';

interface ThinkingHeaderProps {
  /** 是否展开 */
  isExpanded: boolean;
  /** 是否正在流式输出（思考中） */
  isStreaming: boolean;
  /** 点击回调 */
  onClick: () => void;
  /** 自定义类名 */
  className?: string;
  /** 显示步骤数量（可选） */
  stepCount?: number;
}

export type { ThinkingHeaderProps };

export function ThinkingHeader({
  isExpanded,
  isStreaming,
  onClick,
  className = '',
  stepCount,
}: ThinkingHeaderProps) {
  return (
    <button
      className={`cui-thinking-header ${isExpanded ? 'cui-thinking-header--expanded' : ''} ${className}`}
      onClick={onClick}
      type="button"
      aria-expanded={isExpanded}
      aria-controls="thinking-content"
    >
      <div className="cui-thinking-header__left">
        <span className="cui-thinking-header__icon" aria-hidden="true">🧠</span>
        <span className="cui-thinking-header__title">
          {isStreaming ? (
            <>
              思考中
              <StreamingDots />
            </>
          ) : (
            `推理过程${stepCount !==undefined ? ` (${stepCount}步骤)` : ''}`
          )}
        </span>
      </div>

      {!isStreaming && (
        <span className="cui-thinking-header__toggle" aria-hidden="true">
          {isExpanded ? '▲' : '▼'}
        </span>
      )}

      <style jsx>{`
        .cui-thinking-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 8px 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          user-select: none;
          transition: background-color 150ms;
          border-radius: 8px;
        }

        .cui-thinking-header:hover {
          background-color: rgba(107, 114, 128, 0.15);
        }

        .cui-thinking-header:active {
          background-color: rgba(107, 114, 128, 0.25);
        }

        .cui-thinking-header__left {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .cui-thinking-header__icon {
          font-size: 16px;
          color: #9CA3AF;
        }

        .cui-thinking-header__title {
          font-size: 13px;
          color: #9CA3AF;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .cui-thinking-header__toggle {
          font-size: 12px;
          color: #6B7280;
          transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .cui-thinking-header--expanded .cui-thinking-header__toggle {
          transform: rotate(180deg);
        }

        /* 深色模式适配 */
        @media (prefers-color-scheme: dark) {
          .cui-thinking-header:hover {
            background-color: rgba(255, 255, 255, 0.05);
          }

          .cui-thinking-header:active {
            background-color: rgba(255, 255, 255, 0.1);
          }
        }
      `}</style>
    </button>
  );
}
