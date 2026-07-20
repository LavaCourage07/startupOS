/**
 * OriginOS 任务栏组件
 * Fluent OS 风格的任务栏
 */

'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface PinnedApp {
  id: string;
  name: string;
  icon: string;
  path: string;
}

interface RunningApp {
  id: string;
  name: string;
  icon: string;
  isMinimized: boolean;
}

// ============================================================================
// Mock Data
// ============================================================================

const PINNED_APPS: PinnedApp[] = [
  {
    id: 'phone',
    name: '电话',
    icon: '📱',
    path: '/apps/phone',
  },
  {
    id: 'files',
    name: '文件',
    icon: '📄',
    path: '/apps/files',
  },
  {
    id: 'settings',
    name: '设置',
    icon: '⚙️',
    path: '/settings',
  },
];

// ============================================================================
// Component: Taskbar
// ============================================================================

interface TaskbarProps {
  pinnedApps?: PinnedApp[];
  onStartMenuClick?: () => void;
  className?: string;
}

export function Taskbar({
  pinnedApps = PINNED_APPS,
  onStartMenuClick,
  className,
}: TaskbarProps) {
  const [runningApps, setRunningApps] = useState<RunningApp[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  // Start application
  const startApp = (app: PinnedApp) => {
    setRunningApps((prev) => {
      const exists = prev.find((a) => a.id === app.id);
      if (exists) {
        // Toggle minimized state
        return prev.map((a) =>
          a.id === app.id ? { ...a, isMinimized: !a.isMinimized } : a
        );
      }
      // Add new running app
      return [
        ...prev,
        {
          id: app.id,
          name: app.name,
          icon: app.icon,
          isMinimized: false,
        },
      ];
    });
  };

  // Toggle app minimized
  const toggleMinimize = (appId: string) => {
    setRunningApps((prev) =>
      prev.map((a) =>
        a.id === appId ? { ...a, isMinimized: !a.isMinimized } : a
      )
    );
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 h-12 bg-surface/80 backdrop-blur-xl border-t border-border z-50',
        'flex items-center px-3 gap-2',
        className
      )}
    >
      {/* Start Button */}
      <Button
        onClick={onStartMenuClick}
        className="h-8 w-8 p-0 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center group"
      >
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <div className="absolute -right-2 top-0 w-2 h-2 rounded-full bg-primary" />
          <div className="absolute -left-1 top-1 w-2 h-2 rounded-full bg-primary" />
          <div className="absolute -right-1 top-1 w-2 h-2 rounded-full bg-primary" />
        </div>
      </Button>

      {/* Search Box */}
      {!searchFocused ? (
        <button
          onClick={() => setSearchFocused(true)}
          className="h-8 flex-1 max-w-md px-3 rounded-lg bg-muted/50 flex items-center gap-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <svg
            className="w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.44L11 11" stroke="currentColor" strokeWidth={2} />
          </svg>
          <span>搜索...</span>
        </button>
      ) : (
        <input
          autoFocus
          onBlur={() => setSearchFocused(false)}
          placeholder="搜索应用..."
          className="h-8 flex-1 max-w-md px-3 rounded-lg bg-muted/50 border-none outline-none focus:ring-2 focus:ring-primary/20 text-sm text-text-foreground"
        />
      )}

      {/* Pinned Apps */}
      <div className="flex items-center gap-1">
        {pinnedApps.map((app) => (
          <button
            key={app.id}
            onClick={() => startApp(app)}
            className={cn(
              'h-8 w-8 flex items-center justify-center rounded-lg transition-all',
              'hover:bg-primary/10 group',
              'relative'
            )}
            title={app.name}
          >
            <span className="text-base">{app.icon}</span>
            <span className="absolute -bottom-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>

      {/* Running Apps */}
      {runningApps.length > 0 && (
        <div className="flex items-center gap-1 border-l border-border pl-2">
          {runningApps.map((app) => (
            <button
              key={app.id}
              onClick={() => toggleMinimize(app.id)}
              className={cn(
                'h-8 w-8 flex items-center justify-center rounded-lg transition-all',
                'hover:bg-primary/10',
                app.isMinimized && 'opacity-50'
              )}
              title={app.isMinimized ? '恢复' : app.name}
            >
              <span className="text-base">{app.icon}</span>
            </button>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* System Tray */}
      <div className="flex items-center gap-1">
        <button className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
          <svg
            className="w-4 h-4 text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={1.5} />
          </svg>
        </button>
        <button className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
          <svg
            className="w-4 h-4 text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M18 8A6 6 0 0 1 12 0m0 0A6 6 0 0 1 12 0m-9 3V12a9 9 0 0 0 18 0m-9 3h.01M12 21v-3m0 0H9m12 0a9 9 0 1 0-18 0v-3" stroke="currentColor" strokeWidth={1.5} />
          </svg>
        </button>
        <button className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors relative">
          <svg
            className="w-4 h-4 text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M18 8v6m-2-5h6M2 10h6m11 5V5M2 22h12a2 2 0 002 2v-6a2 2 0 01-2-2v-4a2 2 0 012-2-2h-2.5" stroke="currentColor" strokeWidth={1.5} />
          </svg>
          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
        </button>
      </div>

      {/* Clock */}
      <div className="h-8 px-3 flex items-center gap-2 rounded-lg hover:bg-muted transition-colors">
        <svg
          className="w-4 h-4 text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
          <path
            d="M12 6v6l4-2"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-xs font-medium text-text-foreground" id="taskbar-clock">
          --:--:--
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Clock Update Hook
// ============================================================================

export function useTaskbarClock() {
  React.useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const clockElement = document.getElementById('taskbar-clock');
      if (clockElement) {
        clockElement.textContent = time;
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval);
  }, []);
}
