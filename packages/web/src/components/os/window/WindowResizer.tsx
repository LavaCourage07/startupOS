/**
 * OS.9: 窗口调整大小手柄组件
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { WindowResizerProps, AppWindowPosition } from '@originos/core/types';

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export function WindowResizer({
  windowId: _windowId,
  position,
  constraints,
  onResize,
  onResizeStart,
  onResizeEnd,
}: WindowResizerProps) {
  const [resizing, setResizing] = useState<{
    direction: ResizeDirection;
    startX: number;
    startY: number;
    startPos: AppWindowPosition;
  } | null>(null);

  const handleMouseDown = useCallback(
    (direction: ResizeDirection) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      onResizeStart();
      setResizing({
        direction,
        startX: e.clientX,
        startY: e.clientY,
        startPos: position,
      });
    },
    [position, onResizeStart]
  );

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizing.startX;
      const deltaY = e.clientY - resizing.startY;

      let newPosition: Partial<AppWindowPosition> = {};
      const { startPos, direction } = resizing;

      // 根据方向计算新位置
      switch (direction) {
        case 'e': // 东
          newPosition = {
            width: Math.max(constraints.minWidth, Math.min(constraints.maxWidth, startPos.width + deltaX)),
          };
          break;
        case 'w': // 西
          const newWidthW = Math.max(constraints.minWidth, Math.min(constraints.maxWidth, startPos.width - deltaX));
          newPosition = {
            x: startPos.x + startPos.width - newWidthW,
            width: newWidthW,
          };
          break;
        case 's': // 南
          newPosition = {
            height: Math.max(constraints.minHeight, Math.min(constraints.maxHeight, startPos.height + deltaY)),
          };
          break;
        case 'n': // 北
          const newHeightN = Math.max(constraints.minHeight, Math.min(constraints.maxHeight, startPos.height - deltaY));
          newPosition = {
            y: startPos.y + startPos.height - newHeightN,
            height: newHeightN,
          };
          break;
        case 'se': // 东南
          newPosition = {
            width: Math.max(constraints.minWidth, Math.min(constraints.maxWidth, startPos.width + deltaX)),
            height: Math.max(constraints.minHeight, Math.min(constraints.maxHeight, startPos.height + deltaY)),
          };
          break;
        case 'sw': // 西南
          const newWidthSW = Math.max(constraints.minWidth, Math.min(constraints.maxWidth, startPos.width - deltaX));
          newPosition = {
            x: startPos.x + startPos.width - newWidthSW,
            width: newWidthSW,
            height: Math.max(constraints.minHeight, Math.min(constraints.maxHeight, startPos.height + deltaY)),
          };
          break;
        case 'ne': // 东北
          const newHeightNE = Math.max(constraints.minHeight, Math.min(constraints.maxHeight, startPos.height - deltaY));
          newPosition = {
            width: Math.max(constraints.minWidth, Math.min(constraints.maxWidth, startPos.width + deltaX)),
            y: startPos.y + startPos.height - newHeightNE,
            height: newHeightNE,
          };
          break;
        case 'nw': // 西北
          const newWidthNW = Math.max(constraints.minWidth, Math.min(constraints.maxWidth, startPos.width - deltaX));
          const newHeightNW = Math.max(constraints.minHeight, Math.min(constraints.maxHeight, startPos.height - deltaY));
          newPosition = {
            x: startPos.x + startPos.width - newWidthNW,
            width: newWidthNW,
            y: startPos.y + startPos.height - newHeightNW,
            height: newHeightNW,
          };
          break;
      }

      onResize(newPosition);
    };

    const handleMouseUp = () => {
      setResizing(null);
      onResizeEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, constraints, onResize, onResizeEnd]);

  // 渲染调整手柄
  const handles: { direction: ResizeDirection; className: string; cursor: string }[] = [
    { direction: 'n', className: 'top-0 left-2 right-2 h-1 -translate-y-1/2', cursor: 'ns-resize' },
    { direction: 's', className: 'bottom-0 left-2 right-2 h-1 translate-y-1/2', cursor: 'ns-resize' },
    { direction: 'e', className: 'right-0 top-2 bottom-2 w-1 translate-x-1/2', cursor: 'ew-resize' },
    { direction: 'w', className: 'left-0 top-2 bottom-2 w-1 -translate-x-1/2', cursor: 'ew-resize' },
    { direction: 'ne', className: 'top-0 right-0 w-3 h-3 -translate-y-1/2 translate-x-1/2', cursor: 'nesw-resize' },
    { direction: 'nw', className: 'top-0 left-0 w-3 h-3 -translate-y-1/2 -translate-x-1/2', cursor: 'nwse-resize' },
    { direction: 'se', className: 'bottom-0 right-0 w-3 h-3 translate-y-1/2 translate-x-1/2', cursor: 'nwse-resize' },
    { direction: 'sw', className: 'bottom-0 left-0 w-3 h-3 translate-y-1/2 -translate-x-1/2', cursor: 'nesw-resize' },
  ];

  return (
    <>
      {handles.map(({ direction, className, cursor }) => (
        <div
          key={direction}
          className={`absolute ${className} z-10`}
          style={{ cursor }}
          onMouseDown={handleMouseDown(direction)}
        />
      ))}
    </>
  );
}

export default WindowResizer;
