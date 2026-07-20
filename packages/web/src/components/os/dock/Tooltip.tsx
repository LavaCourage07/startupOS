/**
 * Dock Tooltip - 工具提示
 */

import React from 'react';
import type { DockTooltipProps } from '@originos/core/types';

export default function DockTooltip({
  text,
  visible,
  position,
  side = 'bottom',
}: DockTooltipProps) {
  if (!visible) return null;

  const style: React.CSSProperties = side === 'left'
    ? {
        left: position.x + 36,
        top: position.y,
        transform: 'translateY(-50%)',
      }
    : side === 'right'
      ? {
          left: position.x - 36,
          top: position.y,
          transform: 'translate(-100%, -50%)',
        }
    : {
        left: position.x,
        top: position.y - 12,
        transform: 'translate(-50%, -100%)',
      };

  return (
    <div
      className="fixed max-w-56 break-words px-2.5 py-1 bg-black/75 backdrop-blur-md text-white text-xs leading-snug rounded-md pointer-events-none transition-opacity duration-150 z-[60]"
      style={style}
      title={text}
    >
      {text}
    </div>
  );
}
