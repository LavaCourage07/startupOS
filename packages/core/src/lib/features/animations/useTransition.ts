/**
 * OS.6: useTransition Hook
 */

import { useEffect, useState } from 'react';
import { durations } from './durations';

export type TransitionStatus = 'entering' | 'entered' | 'exiting' | 'exited';

interface TransitionConfig {
  duration?: number;
  onEnter?: () => void;
  onExit?: () => void;
}

export function useTransition(show: boolean, config: TransitionConfig = {}) {
  const [status, setStatus] = useState<TransitionStatus>('exited');
  const duration = config.duration || durations.normal;

  useEffect(() => {
    if (show) {
      setStatus('entering');
      config.onEnter?.();
      const timer = setTimeout(() => setStatus('entered'), duration);
      return () => clearTimeout(timer);
    } else {
      setStatus('exiting');
      config.onExit?.();
      const timer = setTimeout(() => setStatus('exited'), duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, config]);

  return status;
}
