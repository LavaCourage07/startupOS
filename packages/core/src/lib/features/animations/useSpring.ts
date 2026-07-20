/**
 * OS.6: useSpring Hook
 * Physics-based spring animation for natural motion
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

export interface SpringConfig {
  /** Stiffness of the spring (default: 180) */
  stiffness?: number;
  /** Damping factor (default: 12) */
  damping?: number;
  /** Mass of the object (default: 1) */
  mass?: number;
  /** Target duration in ms (alternative to physics config) */
  duration?: number;
  /** Precision for settling detection (default: 0.001) */
  precision?: number;
  /** Velocity overshoot (default: 0) */
  velocity?: number;
  /** Callback when spring settles */
  onRest?: () => void;
}

export interface SpringValue<T = number> {
  /** Current animated value */
  value: T;
  /** Whether the spring is animating */
  isAnimating: boolean;
  /** Whether the spring has settled */
  isAtRest: boolean;
  /** Current velocity */
  velocity: number;
}

interface SpringState {
  value: number;
  velocity: number;
  lastTime: number;
}

const defaultConfig: Required<Omit<SpringConfig, 'onRest'>> = {
  stiffness: 180,
  damping: 12,
  mass: 1,
  duration: 300,
  precision: 0.001,
  velocity: 0,
};

/**
 * Hook for physics-based spring animations
 *
 * @example
 * ```tsx
 * const { value, isAnimating } = useSpring(100, {
 *   stiffness: 200,
 *   damping: 15,
 * });
 *
 * return <div style={{ transform: `translateX(${value}px)` }} />;
 * ```
 */
export function useSpring(
  target: number,
  config: SpringConfig = {}
): SpringValue<number> {
  const prefersReducedMotion = useReducedMotion();
  const [state, setState] = useState<SpringState>({
    value: 0,
    velocity: config.velocity || 0,
    lastTime: 0,
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [isAtRest, setIsAtRest] = useState(true);
  const animationFrameRef = useRef<number | null>(null);
  const configRef = useRef({ ...defaultConfig, ...config });
  const targetRef = useRef(target);
  const onRestRef = useRef(config.onRest);

  // Update config and callbacks when props change
  useEffect(() => {
    configRef.current = { ...defaultConfig, ...config };
    onRestRef.current = config.onRest;
    targetRef.current = target;
  }, [config, target]);

  const animate = useCallback(() => {
    if (prefersReducedMotion) {
      // Skip animation for reduced motion preference
      setState(prev => ({
        ...prev,
        value: targetRef.current,
        velocity: 0,
      }));
      setIsAnimating(false);
      setIsAtRest(true);
      onRestRef.current?.();
      return;
    }

    const now = performance.now();
    const deltaTime = Math.min((now - state.lastTime) / 1000, 0.064); // Cap at 64ms
    const { stiffness, damping, mass, precision } = configRef.current;

    // Spring physics calculation
    const displacement = state.value - targetRef.current;
    const springForce = -stiffness * displacement;
    const dampingForce = -damping * state.velocity;
    const acceleration = (springForce + dampingForce) / mass;

    const newVelocity = state.velocity + acceleration * deltaTime;
    const newValue = state.value + newVelocity * deltaTime;

    // Check if spring has settled
    const hasSettled =
      Math.abs(newVelocity) < precision &&
      Math.abs(displacement) < precision;

    if (hasSettled) {
      setState({
        value: targetRef.current,
        velocity: 0,
        lastTime: now,
      });
      setIsAnimating(false);
      setIsAtRest(true);
      onRestRef.current?.();
      return;
    }

    setState({
      value: newValue,
      velocity: newVelocity,
      lastTime: now,
    });

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [state, prefersReducedMotion]);

  useEffect(() => {
    if (state.value !== target || !isAtRest) {
      setIsAnimating(true);
      setIsAtRest(false);
      setState(prev => ({ ...prev, lastTime: performance.now() }));
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [target, animate, state.value, isAtRest]);

  return {
    value: state.value,
    isAnimating,
    isAtRest,
    velocity: state.velocity,
  };
}

/**
 * Hook for spring animation with array of values
 *
 * @example
 * ```tsx
 * const { values, isAnimating } = useSpringArray([0, 100, 200]);
 * ```
 */
export function useSpringArray(
  targets: number[],
  config: SpringConfig = {}
): SpringValue<number[]> {
  const prefersReducedMotion = useReducedMotion();
  const [values, setValues] = useState<number[]>(targets.map(() => 0));
  const [isAnimating, setIsAnimating] = useState(false);
  const [isAtRest, setIsAtRest] = useState(true);
  const animationFrameRef = useRef<number | null>(null);
  const velocitiesRef = useRef<number[]>(targets.map(() => 0));

  useEffect(() => {
    if (prefersReducedMotion) {
      setValues([...targets]);
      setIsAnimating(false);
      setIsAtRest(true);
      config.onRest?.();
      return;
    }

    const { stiffness, damping, mass, precision } = { ...defaultConfig, ...config };

    const animate = () => {
      let allSettled = true;

      setValues(prevValues => {
        return prevValues.map((value, i): number => {
          const target = targets[i] ?? 0;
          const displacement = value - target;
          const velocity = velocitiesRef.current[i] ?? 0;

          const springForce = -stiffness * displacement;
          const dampingForce = -damping * velocity;
          const acceleration = (springForce + dampingForce) / mass;

          const newVelocity = velocity + acceleration * 0.016;
          const newValue = value + newVelocity * 0.016;

          velocitiesRef.current[i] = newVelocity;

          const settled =
            Math.abs(newVelocity) < precision &&
            Math.abs(displacement) < precision;

          if (!settled) allSettled = false;

          return settled ? target : newValue;
        });
      });

      if (allSettled) {
        setIsAnimating(false);
        setIsAtRest(true);
        config.onRest?.();
      } else {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    setIsAnimating(true);
    setIsAtRest(false);
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targets, config, prefersReducedMotion]);

  return {
    value: values,
    isAnimating,
    isAtRest,
    velocity: velocitiesRef.current[0] || 0,
  };
}

/**
 * Hook for spring-based transform values
 *
 * @example
 * ```tsx
 * const transform = useSpringTransform({ x: 100, y: 50, scale: 1.2 });
 * return <div style={{ transform }} />;
 * ```
 */
export function useSpringTransform(
  targets: { x?: number; y?: number; scale?: number; rotate?: number },
  config: SpringConfig = {}
): string {
  const { x = 0, y = 0, scale = 1, rotate = 0 } = targets;

  const springX = useSpring(x, config);
  const springY = useSpring(y, config);
  const springScale = useSpring(scale, config);
  const springRotate = useSpring(rotate, config);

  const transforms: string[] = [];

  if (x !== 0 || y !== 0) {
    transforms.push(`translate(${springX.value}px, ${springY.value}px)`);
  }
  if (scale !== 1) {
    transforms.push(`scale(${springScale.value})`);
  }
  if (rotate !== 0) {
    transforms.push(`rotate(${springRotate.value}deg)`);
  }

  return transforms.join(' ');
}

export default useSpring;
