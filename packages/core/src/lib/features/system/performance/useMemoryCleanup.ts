/**
 * OS.8: Memory Cleanup Hook
 */

import { useEffect, useRef } from 'react';

export function useMemoryCleanup() {
  const timers = useRef<NodeJS.Timeout[]>([]);
  const listeners = useRef<Array<{ element: EventTarget; event: string; handler: EventListener }>>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      listeners.current.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
    };
  }, []);

  return {
    addTimer: (timer: NodeJS.Timeout) => timers.current.push(timer),
    addListener: (element: EventTarget, event: string, handler: EventListener) => {
      element.addEventListener(event, handler);
      listeners.current.push({ element, event, handler });
    },
  };
}
