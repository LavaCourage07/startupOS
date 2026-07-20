/**
 * OS.9: 窗口控制按钮组件
 */

'use client';

import React from 'react';
import { WindowControlsProps } from '@originos/core/types';

export function WindowControls({
  onClose,
  onMinimize,
  onMaximize,
  showMinimize,
  showMaximize,
  isMaximized,
}: WindowControlsProps) {
  return (
    <div className="flex items-center gap-2" data-no-drag>
      {showMinimize && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMinimize();
          }}
          className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors flex items-center justify-center group"
          aria-label="Minimize"
          title="最小化"
        >
          <span className="opacity-0 group-hover:opacity-100 text-yellow-900 text-xs font-bold">−</span>
        </button>
      )}
      {showMaximize && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMaximize();
          }}
          className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors flex items-center justify-center group"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          title={isMaximized ? '还原' : '最大化'}
        >
          <span className="opacity-0 group-hover:opacity-100 text-green-900 text-xs font-bold">
            {isMaximized ? '⤓' : '□'}
          </span>
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center group"
        aria-label="Close"
        title="关闭"
      >
        <span className="opacity-0 group-hover:opacity-100 text-red-900 text-xs font-bold">×</span>
      </button>
    </div>
  );
}

export default WindowControls;
