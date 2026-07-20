/**
 * OS.9: 窗口标题栏组件
 */

'use client';

import React from 'react';
import { WindowTitleBarProps } from '@originos/core/types';
import { WindowControls } from './WindowControls';

export function WindowTitleBar({
  title,
  icon,
  isFocused,
  isMaximized,
  constraints,
  onClose,
  onMinimize,
  onMaximize,
  onDragStart,
}: WindowTitleBarProps) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-2 cursor-move select-none border-b border-white/10 ${
        isFocused ? 'bg-white/20' : 'bg-white/10'
      }`}
      onMouseDown={onDragStart}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {icon && <span className="text-lg flex-shrink-0">{icon}</span>}
        <span
          className={`font-medium truncate ${
            isFocused ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {title}
        </span>
      </div>

      <WindowControls
        onClose={onClose}
        onMinimize={onMinimize}
        onMaximize={onMaximize}
        showMinimize={constraints.allowMinimize}
        showMaximize={constraints.allowMaximize}
        isMaximized={isMaximized}
      />
    </div>
  );
}

export default WindowTitleBar;
