/**
 * OriginOS 状态栏组件
 * 显示系统信息（时间、天气、网络等）
 */

'use client';

import * as React from 'react';
import { cn } from '@originos/core/lib/utils';

// ============================================================================
// Component: Status Bar
// ============================================================================

interface StatusBarProps {
  className?: string;
}

export function StatusBar({ className }: StatusBarProps) {
  const [_currentTime, setCurrentTime] = React.useState('');
  const [isConnected, setIsConnected] = React.useState(true);
  const [hasNotifications, setHasNotifications] = React.useState(false);

  // Update time
  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 h-8 bg-surface/80 backdrop-blur-xl border-b border-border z-50',
        'flex items-center justify-between px-4 text-xs text-muted-foreground',
        className
      )}
    >
      {/* Left Side */}
      <div className="flex items-center gap-4">
        {/* Weather */}
        <div className="flex items-center gap-1 cursor-pointer hover:text-text transition-colors">
          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="4" r="2" fill="currentColor" />
            <path d="M12 7V5" stroke="currentColor" strokeWidth={1.5} />
            <path d="M12 7a5.5 5.5 0 015.882 0l.917.912A6 6 0 0016 13H4a6 6 0 002.118-.912" strokeWidth={1.5} />
          </svg>
          <span>25°C</span>
        </div>

        {/* Date */}
        <div className="hidden sm:block cursor-pointer hover:text-text transition-colors">
          {new Date().toLocaleDateString('zh-CN', {
            month: 'long',
            day: 'numeric',
            weekday: 'short',
          })}
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-4">
        {/* Network */}
        <button
          onClick={() => setIsConnected(!isConnected)}
          className={cn(
            'flex items-center gap-1 cursor-pointer hover:text-text transition-colors',
            !isConnected && 'text-red-400'
          )}
          title="网络连接"
        >
          <svg
            className="w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path d="M5 12.55a11 11 0 0 111.697 6M12.001 21a9 9 0 10-9 9 0 009.017 5.01M19.999 4a9 9 0 11-7.768 4.22h-.05a8 8 0 10-5.517 6.336m2.33-2.33c.336.336.336.893.336 1.445" strokeWidth={1.5} />
          </svg>
          <span className="hidden sm:inline">
            {isConnected ? '已连接' : '未连接'}
          </span>
        </button>

        {/* Battery */}
        <div className="flex items-center gap-1 cursor-pointer hover:text-text transition-colors">
          <svg
            className="w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <rect
              x="4"
              y="6"
              width="16"
              height="12"
              rx="2"
              strokeWidth={1.5}
            />
            <path d="M14 4.5h.5" stroke="currentColor" strokeWidth={1.5} />
          </svg>
          <span className="hidden sm:inline">85%</span>
        </div>

        {/* Notifications */}
        <button
          onClick={() => setHasNotifications(!hasNotifications)}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-full transition-colors',
            'hover:bg-muted',
            hasNotifications && 'bg-primary text-background hover:bg-primary/90'
          )}
          title="通知"
        >
          <svg
            className="w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 22c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2s-.9 2-2 2v.1c.07.39.17.79.21 1.1C6.27 4.06 4.6 6.6 4.6 6.6v1.2c0 .66.54 1.2 1.2 1.2 1.2.1 1.8.2 3.42 2 5.5v.5.1.29.53.29 1.06 0h5.76c.53 0 1.06.48 1.06 1.06v.8c0 .66-.54 1.2-1.2 1.2-1.2 1.7-1.9 2.96-3.4 2.96v.06c0 .66-.54 1.2-1.2 1.2-1.2 1.7-1.9 2.96-3.4 2.96v.06c0 .66-.54 1.2-1.2 1.2z" />
          </svg>
          {hasNotifications && (
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
          )}
        </button>
      </div>
    </div>
  );
}
