/**
 * OS.6: Fluent Animation System
 * Microsoft Fluent Design inspired animations with natural motion
 */

// Easing functions
export { easings, type EasingFunction } from './easings';

// Duration constants
export { durations, type AnimationDuration } from './durations';

// Animation hooks
export {
  useAnimation,
  useAnimationRef,
  type AnimationConfig,
  type AnimationControls,
  type AnimationKeyframes,
} from './useAnimation';

export {
  useSpring,
  useSpringArray,
  useSpringTransform,
  type SpringConfig,
  type SpringValue,
} from './useSpring';

export { useTransition, type TransitionStatus } from './useTransition';
export { useReducedMotion } from './useReducedMotion';
