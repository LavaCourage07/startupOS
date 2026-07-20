/**
 * OS.6: useDockIconAnimation Hook
 * Dock icon animation with Fluent animation system
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { useReducedMotion, durations, easings } from '@originos/core/lib/features/animations';

interface UseDockIconAnimationOptions {
  /** Hover scale factor (default: 1.2) */
  scale?: number;
  /** Press scale factor (default: 0.95) */
  pressScale?: number;
  /** Animation duration in ms (default: 200) */
  duration?: number;
  /** Tooltip show delay in ms (default: 500) */
  tooltipDelay?: number;
  /** Enable spring physics for smoother animation */
  useSpring?: boolean;
}

interface UseDockIconAnimationReturn {
  isHovered: boolean;
  isPressed: boolean;
  tooltipVisible: boolean;
  styles: React.CSSProperties;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMouseDown: () => void;
  onMouseUp: () => void;
}

export function useDockIconAnimation(options: UseDockIconAnimationOptions = {}): UseDockIconAnimationReturn {
  const {
    scale = 1.3,
    pressScale = 0.95,
    duration: animDuration = durations.fast,
    tooltipDelay = 500,
    useSpring = true,
  } = options;

  const prefersReducedMotion = useReducedMotion();

  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);

    // Delay tooltip display
    tooltipTimerRef.current = setTimeout(() => {
      setTooltipVisible(true);
    }, tooltipDelay);
  }, [tooltipDelay]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setIsPressed(false);

    // Hide tooltip
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setTooltipVisible(false);
  }, []);

  const handleMouseDown = useCallback(() => {
    setIsPressed(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
  }, []);

  // Calculate style values with Fluent animation system
  const currentScale = isPressed ? pressScale : isHovered ? scale : 1;

  // Use Fluent easing for natural motion
  const easing = useSpring ? easings.decelerate : easings.standard;

  const styles: React.CSSProperties = useMemo(() => {
    if (prefersReducedMotion) {
      // No animation for reduced motion preference
      return {};
    }

    return {
      transform: `scale(${currentScale})`,
      transition: `transform ${animDuration}ms ${easing}`,
      willChange: 'transform',
    };
  }, [currentScale, animDuration, easing, prefersReducedMotion]);

  return {
    isHovered,
    isPressed,
    tooltipVisible,
    styles,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
  };
}

export default useDockIconAnimation;
