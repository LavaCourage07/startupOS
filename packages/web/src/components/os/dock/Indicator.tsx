/**
 * Dock Indicator - 运行指示灯
 */

import React from 'react';
import type { DockIndicatorProps } from '@originos/core/types';

export default function DockIndicator({ isRunning }: DockIndicatorProps) {
  return (
    <div
      className={`w-1.5 h-1.5 rounded-full transition-opacity duration-200 ${
        isRunning ? 'bg-green-500 opacity-100' : 'opacity-0'
      }`}
    />
  );
}
