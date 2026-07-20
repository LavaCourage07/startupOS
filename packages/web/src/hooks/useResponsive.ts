/**
 * useResponsive Hook
 * 响应式布局逻辑
 */

import { useState, useEffect } from 'react';
import type { ResponsiveConfig } from '@originos/core/types';

interface useResponsiveReturn {
  size: {
    width: number;
    height: number;
    type: 'tablet' | 'desktop';
  };
  gridSize: {
    columns: number;
    rows: number;
  };
}

const DEFAULT_CONFIG: ResponsiveConfig = {
  breakpoints: {
    tablet: 1366,
    desktop: 1920,
  },
  gridSize: {
    tablet: { columns: 2, rows: 8 },
    desktop: { columns: 4, rows: 6 },
  },
};

export function useResponsive(
  config: ResponsiveConfig = DEFAULT_CONFIG
): useResponsiveReturn {
  const [size, setSize] = useState<{
    width: number;
    height: number;
    type: 'tablet' | 'desktop';
  }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    type:
      typeof window !== 'undefined' && window.innerWidth >= config.breakpoints.tablet
        ? 'desktop'
        : 'tablet',
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setSize({
        width,
        height,
        type: width >= config.breakpoints.tablet ? 'desktop' : 'tablet',
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [config.breakpoints.tablet]);

  const gridSize =
    size.type === 'desktop' ? config.gridSize.desktop : config.gridSize.tablet;

  return { size, gridSize };
}
