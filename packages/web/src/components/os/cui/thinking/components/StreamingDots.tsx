/**
 * StreamingDots Component
 * 流式动画点组件 - 用于显示"思考中"状态的跳动点
 */

import type { CSSProperties } from 'react';

interface StreamingDotsProps {
  /** 点的容器类名 */
  className?: string;
  /** 点的颜色 */
  color?: string;
  /** 点的大小（CSS值） */
  size?: string | CSSProperties['width'];
  /** 动画持续时间（毫秒） */
  duration?: number;
}

export type { StreamingDotsProps };

export function StreamingDots({
  className = '',
  color = 'currentColor',
  size = '3px',
  duration = 1400,
}: StreamingDotsProps) {
  return (
    <span className={`cui-streaming-dots ${className}`}>
      <style jsx>{`
        .cui-streaming-dots {
          display: inline-flex;
          gap: 3px;
          align-items: center;
        }

        .cui-streaming-dots__dot {
          width: ${size};
          height: ${size};
          border-radius: 50%;
          background: ${color};
          animation: cui-bounce ${duration}ms infinite ease-in-out both;
        }

        .cui-streaming-dots__dot:nth-child(1) { animation-delay: -${duration * 0.32}ms; }
        .cui-streaming-dots__dot:nth-child(2) { animation-delay: -${duration * 0.16}ms; }
        .cui-streaming-dots__dot:nth-child(3) { animation-delay: 0ms; }

        @keyframes cui-bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <span className="cui-streaming-dots__dot" />
      <span className="cui-streaming-dots__dot" />
      <span className="cui-streaming-dots__dot" />
    </span>
  );
}
