/**
 * OS.8: useShortcut Hook
 */

import { useEffect } from 'react';
import { shortcutRegistry } from './ShortcutRegistry';

export function useShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  options: {
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    priority?: number;
    context?: string;
  } = {}
): void {
  useEffect(() => {
    const unregister = shortcutRegistry.register('hook', {
      key,
      ...options,
      handler,
    });

    return unregister;
  }, [key, handler, options.ctrl, options.meta, options.shift, options.priority, options.context]);
}
