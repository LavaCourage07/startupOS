/**
 * OS.5: AcrylicPanel Component
 * OS.6: Integrated Fluent Animation System
 *
 * Uses CSS variables from acrylic.css and fluent-animations.css for maintainability
 *
 * Supports:
 * - Three variants: standard, subtle, strong
 * - Elevated shadow option
 * - Forward ref for accessibility
 * - Fluent hover animations
 */

import React, { forwardRef, type ComponentPropsWithoutRef, useMemo } from 'react';
import { AcrylicPanelProps } from '@originos/core/types';
import { useReducedMotion } from '@originos/core/lib/features/animations';

const variantClasses = {
  standard: 'acrylic-panel',
  subtle: 'acrylic-panel acrylic-panel--subtle',
  strong: 'acrylic-panel acrylic-panel--strong',
};

export interface AcrylicPanelComponentProps extends AcrylicPanelProps, Omit<ComponentPropsWithoutRef<'div'>, keyof AcrylicPanelProps> {
  /** Whether to apply elevated shadow */
  elevated?: boolean;
  /** Whether to enable hover lift animation */
  hoverLift?: boolean;
  /** Whether to enable hover scale animation */
  hoverScale?: boolean;
  /** Whether to enable active press animation */
  activePress?: boolean;
  /** Whether the panel is interactive (adds cursor-pointer) */
  interactive?: boolean;
  /** Whether the panel is being dragged (enhances frosted glass effect) */
  dragging?: boolean;
}

const AcrylicPanel = forwardRef<HTMLDivElement, AcrylicPanelComponentProps>(
  function AcrylicPanel(
    {
      children,
      variant = 'standard',
      className = '',
      elevated = false,
      hoverLift = false,
      hoverScale = false,
      activePress = false,
      interactive = false,
      dragging = false,
      ...props
    },
    ref
  ) {
    const prefersReducedMotion = useReducedMotion();

    // Build animation classes (respect reduced motion preference)
    const animationClasses = useMemo(() => {
      if (prefersReducedMotion) return '';

      const classes: string[] = [];

      if (hoverLift) classes.push('fluent-hover-lift');
      if (hoverScale) classes.push('fluent-hover-scale');
      if (activePress) classes.push('fluent-active-scale');
      if (interactive) classes.push('cursor-pointer');

      return classes.join(' ');
    }, [prefersReducedMotion, hoverLift, hoverScale, activePress, interactive]);

    const classes = [
      variantClasses[variant],
      elevated ? 'acrylic-panel--elevated' : '',
      dragging ? 'acrylic-panel--dragging' : '',
      animationClasses,
      'fluent-transition-transform', // Always include smooth transform transition
      className,
    ].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  }
);

AcrylicPanel.displayName = 'AcrylicPanel';

export default AcrylicPanel;
