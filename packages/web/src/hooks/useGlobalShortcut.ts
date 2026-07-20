/**
 * OS.4: Global Shortcut Hook
 */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { useEffect } from 'react';

function isEditableElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * 全局快捷键 hook - 使用 capture 阶段确保优先捕获
 */
export function useGlobalShortcutForKey(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) {
        return;
      }

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        e.ctrlKey === (options.ctrl ?? false) &&
        e.metaKey === (options.meta ?? false) &&
        e.shiftKey === (options.shift ?? false)
      ) {
        e.preventDefault();
        e.stopPropagation();
        callback();
      }
    };

    window.addEventListener('keydown', handler, { capture: true, passive: false });
    return () => window.removeEventListener('keydown', handler, true);
  }, [callback, key, options.ctrl, options.meta, options.shift]);
}

/**
 * 通用快捷键 hook
 */
export function useGlobalShortcut(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) {
        return;
      }

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        e.ctrlKey === (options.ctrl ?? false) &&
        e.metaKey === (options.meta ?? false) &&
        e.shiftKey === (options.shift ?? false)
      ) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [callback, key, options.ctrl, options.meta, options.shift]);
}
