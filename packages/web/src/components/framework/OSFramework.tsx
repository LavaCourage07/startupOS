/**
 * OriginOS 主框架组件
 * Fluent OS 风格的操作系统主界面框架
 *
 * 包含：
 * - 状态栏（顶部）：时间、天气、网络、通知
 * - 侧边栏：导航菜单
 * - 主工作区：应用内容区域
 * - 任务栏（底部）：开始按钮、应用图标、搜索、托盘
 */

'use client';

import * as React from 'react';
import { Sidebar } from './Sidebar';
import { Taskbar, useTaskbarClock } from './Taskbar';
import { StatusBar } from './StatusBar';
import { cn } from '@originos/core/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface OSFrameworkProps {
  children: React.ReactNode;
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
  className?: string;
}

// ============================================================================
// Component: OS Framework
// ============================================================================

export function OSFramework({
  children,
  sidebarOpen = true,
  onSidebarToggle,
  className,
}: OSFrameworkProps) {
  // Start clock on mount
  useTaskbarClock();

  return (
    <div className={cn('min-h-screen bg-background flex flex-col', className)}>
      {/* Status Bar */}
      <StatusBar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isCollapsed={!sidebarOpen}
          onCollapseToggle={onSidebarToggle}
        />

        {/* Main Workspace */}
        <main className="flex-1 overflow-auto relative">
          {children}
        </main>
      </div>

      {/* Taskbar */}
      <Taskbar />
    </div>
  );
}

// ============================================================================
// Export Components
// ============================================================================

export { Sidebar } from './Sidebar';
export { Taskbar, useTaskbarClock } from './Taskbar';
export { StatusBar } from './StatusBar';