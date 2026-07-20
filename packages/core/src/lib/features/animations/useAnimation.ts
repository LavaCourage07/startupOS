/**
 * OS.6: useAnimation Hook
 * Provides animation control with Web Animations API support
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { easings, type EasingFunction } from './easings';
import { durations } from './durations';
import { useReducedMotion } from './useReducedMotion';

export interface AnimationKeyframes {
  from?: Partial<CSSStyleDeclaration>;
  to?: Partial<CSSStyleDeclaration>;
}

export interface AnimationConfig {
  /** Duration in milliseconds */
  duration?: number;
  /** Easing function name or custom cubic-bezier */
  easing?: EasingFunction | string;
  /** Delay before animation starts */
  delay?: number;
  /** Number of iterations (Infinity for infinite) */
  iterations?: number;
  /** Direction: normal, reverse, alternate, alternate-reverse */
  direction?: PlaybackDirection;
  /** Fill mode: none, forwards, backwards, both */
  fill?: FillMode;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Callback when animation starts */
  onStart?: () => void;
  /** Callback on each iteration */
  onIteration?: () => void;
  /** Callback when animation is cancelled */
  onCancel?: () => void;
}

export interface AnimationControls {
  /** Start the animation */
  start: () => void;
  /** Stop/pause the animation */
  stop: () => void;
  /** Reset animation to initial state */
  reset: () => void;
  /** Resume a paused animation */
  resume: () => void;
  /** Reverse the animation direction */
  reverse: () => void;
  /** Finish the animation immediately */
  finish: () => void;
  /** Whether the animation is currently running */
  isAnimating: boolean;
  /** Whether the animation is paused */
  isPaused: boolean;
  /** Current playback position (0-1) */
  progress: number;
}

/**
 * Hook to control animations with Web Animations API
 *
 * @example
 * ```tsx
 * const { start, stop, isAnimating } = useAnimation({
 *   duration: 300,
 *   easing: 'decelerate',
 *   onComplete: () => console.log('done')
 * });
 * ```
 */
export function useAnimation(
  keyframes?: AnimationKeyframes,
  config: AnimationConfig = {}
): AnimationControls {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const animationRef = useRef<Animation | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const frameRef = useRef<number | null>(null);

  const getEasing = useCallback((easing?: EasingFunction | string): string => {
    if (!easing) return easings.standard;
    if (easing in easings) return easings[easing as EasingFunction];
    return easing;
  }, []);

  const clearProgressTracking = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const trackProgress = useCallback(() => {
    if (!animationRef.current || !isAnimating) return;

    const animation = animationRef.current;
    const currentTime = typeof animation.currentTime === 'number' ? animation.currentTime : 0;
    setProgress(currentTime ? currentTime / (config.duration || durations.normal) : 0);

    if (animation.playState === 'running') {
      frameRef.current = requestAnimationFrame(trackProgress);
    }
  }, [config.duration, isAnimating]);

  const createAnimation = useCallback((element: HTMLElement) => {
    if (prefersReducedMotion) {
      // Skip animation for reduced motion preference
      if (keyframes?.to) {
        Object.assign(element.style, keyframes.to);
      }
      config.onComplete?.();
      return null;
    }

    const duration = config.duration || durations.normal;
    const easing = getEasing(config.easing);

    const animationKeyframes: Keyframe[] = [
      (keyframes?.from || {}) as unknown as Keyframe,
      (keyframes?.to || {}) as unknown as Keyframe,
    ].filter(kf => Object.keys(kf).length > 0);

    if (animationKeyframes.length < 2) {
      return null;
    }

    const animation = element.animate(animationKeyframes, {
      duration,
      easing,
      delay: config.delay || 0,
      iterations: config.iterations || 1,
      direction: config.direction || 'normal',
      fill: config.fill || 'forwards',
    });

    animation.addEventListener('start', () => {
      setIsAnimating(true);
      setIsPaused(false);
      config.onStart?.();
      trackProgress();
    });

    animation.addEventListener('finish', () => {
      setIsAnimating(false);
      setIsPaused(false);
      setProgress(1);
      clearProgressTracking();
      config.onComplete?.();
    });

    animation.addEventListener('cancel', () => {
      setIsAnimating(false);
      setIsPaused(false);
      setProgress(0);
      clearProgressTracking();
      config.onCancel?.();
    });

    animation.addEventListener('iteration', () => {
      config.onIteration?.();
    });

    return animation;
  }, [config, keyframes, getEasing, prefersReducedMotion, trackProgress, clearProgressTracking]);

  const start = useCallback(() => {
    if (!elementRef.current || animationRef.current) return;

    const animation = createAnimation(elementRef.current);
    if (animation) {
      animationRef.current = animation;
      animation.play();
    }
  }, [createAnimation]);

  const stop = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (animationRef.current && isPaused) {
      animationRef.current.play();
      setIsPaused(false);
      setIsAnimating(true);
      trackProgress();
    }
  }, [isPaused, trackProgress]);

  const reset = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.cancel();
      animationRef.current = null;
    }
    clearProgressTracking();
    setIsAnimating(false);
    setIsPaused(false);
    setProgress(0);
  }, [clearProgressTracking]);

  const reverse = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.reverse();
    }
  }, []);

  const finish = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.finish();
    }
  }, []);

  useEffect(() => {
    return () => {
      clearProgressTracking();
      if (animationRef.current) {
        animationRef.current.cancel();
      }
    };
  }, [clearProgressTracking]);

  return {
    start,
    stop,
    reset,
    resume,
    reverse,
    finish,
    isAnimating,
    isPaused,
    progress,
  };
}

/**
 * Hook to get a ref for the animated element
 */
export function useAnimationRef<T extends HTMLElement = HTMLDivElement>(): React.RefObject<T> {
  return useRef<T>(null);
}
