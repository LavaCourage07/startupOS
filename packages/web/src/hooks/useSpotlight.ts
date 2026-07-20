/**
 * OS.4: Spotlight Hook
 */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable curly */
/* eslint-disable import/order */

import { useEffect, useMemo } from 'react';

import { useSpotlightStore } from '@/store/spotlightStore';
import { useGlobalShortcutForKey } from './useGlobalShortcut';

export function useSpotlight() {
  const { isOpen, open, close, selectNext, selectPrevious, executeSelected } = useSpotlightStore();

  // Cmd+K (Mac) or Ctrl+K (Windows/Linux) - 使用 useGlobalShortcutForKey 避免依赖问题
  const isMac = typeof window !== 'undefined' && /Mac/.test(navigator.platform);
  const shortcutOptions = useMemo(
    () => (isMac ? { meta: true } : { ctrl: true }),
    [isMac]
  );
  useGlobalShortcutForKey('k', open, shortcutOptions);

  // Keyboard navigation when open
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectPrevious();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        executeSelected();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close, selectNext, selectPrevious, executeSelected]);

  return { isOpen, open, close };
}
