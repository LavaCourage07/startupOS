'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface ResizableLayoutProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  className?: string;
}

/**
 * ResizableLayout - 可调整大小的左右分栏布局
 *
 * 参考 AuraForce WorkspacePanel 的实现
 */
export function ResizableLayout({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 400,
  minLeftWidth = 300,
  maxLeftWidth = 800,
  className = '',
}: ResizableLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle drag resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;

      // Clamp width between min and max
      const clampedWidth = Math.max(
        minLeftWidth,
        Math.min(maxLeftWidth, newWidth)
      );

      setLeftWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minLeftWidth, maxLeftWidth]);

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full ${className}`}
    >
      {/* Left Panel */}
      <div
        style={{ width: `${leftWidth}px` }}
        className="flex-shrink-0 h-full overflow-hidden"
      >
        {leftPanel}
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`w-1 bg-border hover:bg-primary cursor-col-resize transition-colors ${
          isResizing ? 'bg-primary' : ''
        }`}
      />

      {/* Right Panel */}
      <div className="flex-1 h-full overflow-hidden">
        {rightPanel}
      </div>
    </div>
  );
}
