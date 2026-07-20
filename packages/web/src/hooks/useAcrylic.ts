/**
 * OS.5: useAcrylic Hook
 *
 * Feature detection hook for acrylic/glass-morphism effects
 * Provides fallback information for browsers without backdrop-filter support
 */

import { useState, useEffect, useMemo } from 'react';

export interface AcrylicSupport {
  /** Whether backdrop-filter is supported */
  hasBackdropFilter: boolean;
  /** Whether -webkit-backdrop-filter is supported */
  hasWebkitBackdropFilter: boolean;
  /** Whether to use fallback styles */
  useFallback: boolean;
  /** Whether reduced motion is preferred */
  prefersReducedMotion: boolean;
}

/**
 * Hook to detect acrylic/glass-morphism feature support
 *
 * @returns AcrylicSupport object with feature detection results
 *
 * @example
 * ```tsx
 * const { hasBackdropFilter, useFallback, prefersReducedMotion } = useAcrylic();
 *
 * if (useFallback) {
 *   return <div className="solid-fallback">...</div>;
 * }
 * ```
 */
export function useAcrylic(): AcrylicSupport {
  // Memoized check for SSR safety
  const initialSupport = useMemo(() => ({
    hasBackdropFilter: false,
    hasWebkitBackdropFilter: false,
    useFallback: true,
    prefersReducedMotion: false,
  }), []);

  const [support, setSupport] = useState<AcrylicSupport>(initialSupport);

  useEffect(() => {
    // Check for backdrop-filter support (with fallback for test environments)
    const hasBackdropFilter = typeof CSS !== 'undefined' && CSS.supports
      ? CSS.supports('backdrop-filter', 'blur(1px)')
      : false;
    const hasWebkitBackdropFilter = typeof CSS !== 'undefined' && CSS.supports
      ? CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
      : false;

    // Check for reduced motion preference
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

    // Listen for reduced motion changes
    const mediaQuery = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

    const handleChange = (e: MediaQueryListEvent) => {
      setSupport(prev => ({
        ...prev,
        prefersReducedMotion: e.matches,
      }));
    };

    mediaQuery?.addEventListener('change', handleChange);

    setSupport({
      hasBackdropFilter,
      hasWebkitBackdropFilter,
      useFallback: !hasBackdropFilter && !hasWebkitBackdropFilter,
      prefersReducedMotion,
    });

    return () => {
      mediaQuery?.removeEventListener('change', handleChange);
    };
  }, []);

  return support;
}

/**
 * Simple check for backdrop-filter support (for SSR/initial render)
 */
export function useSupportsBackdropFilter(): boolean {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    return CSS.supports('backdrop-filter', 'blur(20px)') ||
           CSS.supports('-webkit-backdrop-filter', 'blur(20px)');
  }, []);
}

export default useAcrylic;
