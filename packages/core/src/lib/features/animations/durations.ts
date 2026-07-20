/**
 * OS.6: 动画时长常量
 */

export const durations = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  enter: 250,
  exit: 200,
  complex: 400,
} as const;

export type AnimationDuration = keyof typeof durations;
