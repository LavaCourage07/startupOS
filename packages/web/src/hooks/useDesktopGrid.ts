/**
 * useDesktopGrid Hook
 * 图标网格逻辑
 */

import { useState, useCallback } from 'react';
import type { GridPosition } from '@originos/core/types';

interface UseDesktopGridOptions {
  columns: number;
  rows?: number;
  gap?: number;
}

interface UseDesktopGridReturn {
  grid: Map<string, GridPosition>;
  addToGrid: (iconId: string, position?: GridPosition) => void;
  removeFromGrid: (iconId: string) => void;
  moveInGrid: (iconId: string, to: GridPosition) => void;
  clearGrid: () => void;
  getIconAtPosition: (position: GridPosition) => string | null;
}

export function useDesktopGrid(
  options: UseDesktopGridOptions
): UseDesktopGridReturn {
  const [grid, setGrid] = useState<Map<string, GridPosition>>(new Map());
  const maxRows = options.rows ?? 10;

  const addToGrid = useCallback((iconId: string, position?: GridPosition) => {
    setGrid((prev) => {
      const newGrid = new Map(prev);
      const pos = position ?? getAvailablePosition(newGrid, options.columns, maxRows);
      if (pos) {
        newGrid.set(iconId, pos);
      }
      return newGrid;
    });
  }, [options.columns, maxRows]);

  const removeFromGrid = useCallback((iconId: string) => {
    setGrid((prev) => {
      const newGrid = new Map(prev);
      newGrid.delete(iconId);
      return newGrid;
    });
  }, []);

  const moveInGrid = useCallback((iconId: string, to: GridPosition) => {
    setGrid((prev) => {
      const newGrid = new Map(prev);
      newGrid.set(iconId, to);
      return newGrid;
    });
  }, []);

  const clearGrid = useCallback(() => {
    setGrid(new Map());
  }, []);

  const getIconAtPosition = useCallback(
    (position: GridPosition): string | null => {
      for (const [iconId, pos] of Array.from(grid.entries())) {
        if (pos.column === position.column && pos.row === position.row) {
          return iconId;
        }
      }
      return null;
    },
    [grid]
  );

  return {
    grid,
    addToGrid,
    removeFromGrid,
    moveInGrid,
    clearGrid,
    getIconAtPosition,
  };
}

// 辅助函数：获取可用位置
function getAvailablePosition(
  grid: Map<string, GridPosition>,
  columns: number,
  rows: number
): GridPosition | null {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const found = Array.from(grid.values()).some(
        (pos) => pos.column === col && pos.row === row
      );
      if (!found) return { column: col, row };
    }
  }
  return null;
}

// 计算图标在屏幕上的实际位置
export function calculateIconPosition(
  gridPos: GridPosition,
  iconSize: number = 64,
  gap: number = 24,
  startX: number = 24,
  startY: number = 24
): { x: number; y: number } {
  return {
    x: startX + gridPos.column * (iconSize + gap),
    y: startY + gridPos.row * (iconSize + gap),
  };
}

// 根据屏幕位置计算网格位置
export function calculateGridFromPosition(
  screenX: number,
  screenY: number,
  iconSize: number = 64,
  gap: number = 24,
  startX: number = 24,
  startY: number = 24
): GridPosition {
  const column = Math.round((screenX - startX) / (iconSize + gap));
  const row = Math.round((screenY - startY) / (iconSize + gap));
  return {
    column: Math.max(0, column),
    row: Math.max(0, row),
  };
}
