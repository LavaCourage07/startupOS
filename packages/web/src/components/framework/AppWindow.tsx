/**
 * OriginOS 应用容器（窗口）组件
 * 支持窗口模式、全屏模式、最小化、最大化
 */

'use client';

import * as React from 'react';
import { X, Minus, Copy, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@originos/core/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface AppWindowProps {
  app: {
    name: string;
    icon: string;
  };
  children: React.ReactNode;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  className?: string;
  // Optional initial state
  defaultPosition?: { x: number; y: number; width: number; height: number };
}

interface WindowPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isMinimized: boolean;
}

// ============================================================================
// Component: Window Controls
// ============================================================================

function WindowControls({
  onClose,
  onMinimize,
  onMaximize,
  isMaximized,
}: {
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 -mr-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 p-0 hover:bg-white/10 text-muted-foreground hover:text-foreground"
        onClick={onMinimize}
        title="最小化"
      >
        <Minus className="w-3 h-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 p-0 hover:bg-white/10 text-muted-foreground hover:text-foreground"
        onClick={onMaximize}
        title={isMaximized ? "还原" : "最大化"}
      >
        {isMaximized ? <Copy className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 p-0 hover:bg-white/10 text-muted-foreground hover:text-foreground hover:text-red-500"
        onClick={onClose}
        title="关闭"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ============================================================================
// Component: App Window
// ============================================================================

export function AppWindow({
  app,
  children,
  onClose,
  onMinimize,
  onMaximize,
  defaultPosition,
  className,
}: AppWindowProps) {
  const [position, setPosition] = React.useState<WindowPosition>({
    x: defaultPosition?.x || 200,
    y: defaultPosition?.y || 100,
    width: defaultPosition?.width || 800,
    height: defaultPosition?.height || 600,
    isMaximized: false,
    isMinimized: false,
  });

  const [isDragging, setIsDragging] = React.useState(false);
  const [_isResizing, _setIsResizing] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });

  const handleMaximize = () => {
    if (position.isMaximized) {
      // Restore
      setPosition(prev => ({
        ...prev,
        isMaximized: false,
        width: 600,
        height: 400,
      }));
    } else {
      // Maximize
      setPosition(prev => ({
        ...prev,
        isMaximized: true,
        width: window.innerWidth,
        height: window.innerHeight - 56, // Subtract status bar
      }));
    }
    onMaximize?.();
  };

  const handleMinimize = () => {
    setPosition(prev => ({ ...prev, isMinimized: true }));
    onMinimize?.();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest?.('button')) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      setPosition((prev) => ({
        ...prev,
        x: e.clientX - dragOffset.x,
        y: Math.max(0, e.clientY - dragOffset.y),
      }));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  if (position.isMinimized) {
    return null;
  }

  const windowStyle: React.CSSProperties = position.isMaximized
    ? {
        position: 'fixed',
        left: 0,
        top: '32px', // Below status bar
        width: '100%',
        height: 'calc(100vh - 32px)',
        zIndex: 50,
      }
    : {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
        zIndex: 40,
        minWidth: '400px',
        minHeight: '300px',
      };

  return (
    <div
      className={cn(
        'app-window bg-surface border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden',
        'transition-all duration-200 ease-out',
        className
      )}
      style={windowStyle}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">{app.icon}</span>
          <span className="text-sm font-medium text-text-primary">{app.name}</span>
        </div>
        <WindowControls
          onClose={onClose || (() => {})}
          onMinimize={handleMinimize}
          onMaximize={handleMaximize}
          isMaximized={position.isMaximized}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {children}
      </div>

      {/* Resize Handle */}
      {!position.isMaximized && (
        <div className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize hover:bg-primary/20 rounded-br-lg" />
      )}
    </div>
  );
}