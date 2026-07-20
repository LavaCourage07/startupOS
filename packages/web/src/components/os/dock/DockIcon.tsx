/**
 * DockIcon - Dock 应用图标
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { DockIconProps } from '@originos/core/types';
import { useDockIconAnimation } from '@/hooks/useDockIconAnimation';
import { useDockContextMenu } from '@/hooks/useDockContextMenu';
import DockIndicator from './Indicator';
import DockTooltip from './Tooltip';
import ContextMenu from '../ContextMenu';
import { X } from 'lucide-react';
import useDockStore from '@/store/dockStore';
import { AppIcon } from '@/components/ui/icon-registry';

export default function DockIcon({
  app,
  index,
  side = 'bottom',
  onClick,
  onRightClick,
}: DockIconProps) {
  // Track if drag actually moved
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const [_isActuallyDragging, setIsActuallyDragging] = useState(false);

  // Long press state for delete mode
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [showDeleteButton, setShowDeleteButton] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const { removeApp } = useDockStore();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: app.id,
    data: { index },
  });

  const { styles, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp, tooltipVisible } =
    useDockIconAnimation();

  const { isOpen: contextMenuOpen, position: contextMenuPosition, items: contextMenuItems, close: closeContextMenu } =
    useDockContextMenu({
      appId: app.id,
      appName: app.name,
      isPinned: app.isPinned,
    });

  const handleRightClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onRightClick?.(e, app.id);
    },
    [onRightClick, app.id]
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setIsActuallyDragging(false);

    // Start long press timer (800ms)
    longPressTimer.current = setTimeout(() => {
      setIsLongPressing(true);
      setShowDeleteButton(true);
      // Vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 800);
  }, []);

  const handlePointerUp = useCallback(() => {
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);

    // Reset drag tracking
    dragStartPos.current = null;
    setIsActuallyDragging(false);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartPos.current) {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      // If moved more than 5px, consider it a drag and cancel long press
      if (distance > 5) {
        setIsActuallyDragging(true);
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        setIsLongPressing(false);
      }
    }
  }, []);

  const handleClick = useCallback(() => {
    // Only trigger click if not in delete mode
    if (!showDeleteButton) {
      onClick?.(app.id);
    }
  }, [onClick, showDeleteButton, app.id]);

  // Handle delete button click
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    removeApp(app.id);
    setShowDeleteButton(false);
  }, [app.id, removeApp]);

  // Click outside to exit delete mode
  useEffect(() => {
    if (!showDeleteButton) return;

    const handleClickOutside = () => {
      setShowDeleteButton(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showDeleteButton]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  // 获取工具提示位置（图标中心）
  const iconRef = React.useRef<HTMLDivElement>(null);
  const getTooltipPosition = () => {
    if (!iconRef.current) return { x: 0, y: 0 };
    const rect = iconRef.current.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top };
  };

  return (
    <div
      ref={setNodeRef}
      className="relative flex flex-col items-center"
      style={{ cursor: 'pointer' }}
      onClick={handleClick}
      {...attributes}
    >
      <div
        ref={iconRef}
        className={`relative bg-transparent p-0 transition-transform ${
          isLongPressing ? 'animate-wiggle' : ''
        }`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseDown={() => {
          // Merge dnd-kit mouseDown with custom handlers
          if (listeners?.['onMouseDown']) listeners['onMouseDown']();
          onMouseDown();
        }}
        onMouseUp={() => {
          // Merge dnd-kit mouseUp with custom handlers
          if (listeners?.['onMouseUp']) listeners['onMouseUp']();
          onMouseUp();
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
        onContextMenu={handleRightClick}
        style={styles}
        role="button"
        tabIndex={0}
      >
        <div
          className={`w-12 h-12 flex items-center justify-center overflow-hidden transition-shadow duration-200 ${
            isDragging ? 'shadow-2xl shadow-black/50' : ''
          }`}
        >
          <AppIcon emoji={app.icon} size={36} />
        </div>

        {/* 运行指示灯 */}
        <div className="absolute -bottom-1">
          <DockIndicator isRunning={app.isRunning} />
        </div>
      </div>

      {/* Delete button - outside to avoid nested button issue */}
      {showDeleteButton && !app.isPinned && (
        <button
          onClick={handleDelete}
          onPointerDown={e => e.stopPropagation()}
          className="absolute -top-2 right-0 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg z-10 animate-scale-in"
          type="button"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      )}

      {/* 工具提示 */}
      <DockTooltip
        text={app.name}
        visible={tooltipVisible}
        position={getTooltipPosition()}
        side={side}
      />

      {/* 右键菜单 */}
      <ContextMenu
        position={contextMenuPosition ?? { x: 0, y: 0 }}
        items={contextMenuItems}
        isOpen={contextMenuOpen}
        onClose={closeContextMenu}
      />
    </div>
  );
}
