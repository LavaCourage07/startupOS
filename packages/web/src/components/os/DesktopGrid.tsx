/**
 * DesktopGrid Component - 图标网格容器
 */

import React, { useMemo } from 'react';
import type { DesktopGridProps } from '@originos/core/types';

export default function DesktopGrid({
  icons,
  onIconClick,
  onIconRightClick,
}: DesktopGridProps) {
  const { gridPositions } = useMemo(() => {
    const ICON_SIZE = 64;
    const GAP = 24;
    const START_X = 24;
    const START_Y = 40; // Offset for status bar

    const positions = new Map<string, { x: number; y: number }>();

    icons.forEach((icon) => {
      const gridCol = icon.position.x;
      const gridRow = icon.position.y;

      positions.set(icon.id, {
        x: START_X + gridCol * (ICON_SIZE + GAP),
        y: START_Y + gridRow * (ICON_SIZE + GAP),
      });
    });

    return { gridPositions: positions };
  }, [icons]);

  return (
    <div className="absolute inset-0 px-6 pt-12 pb-24">
      {icons.map((icon) => {
        const position = gridPositions.get(icon.id);
        if (!position) return null;

        return (
          <div
            key={icon.id}
            className="absolute flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer hover:bg-white/10 transition-colors select-none group"
            style={{ left: position.x, top: position.y }}
            onClick={() => onIconClick?.(icon.id)}
            onContextMenu={(e) => onIconRightClick?.(icon.id, e)}
          >
            <span className="text-4xl group-hover:scale-110 transition-transform">
              {icon.icon}
            </span>
            <span className="text-xs text-white/90 text-center max-w-[80px] truncate px-1">
              {icon.label}
            </span>
            {icon.status === 'running' && (
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
        );
      })}
    </div>
  );
}
