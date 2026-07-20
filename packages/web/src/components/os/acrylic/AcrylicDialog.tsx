/**
 * OS.5: AcrylicDialog Component
 * OS.6: Integrated Fluent Animation System
 *
 * 支持两种模式：
 * - modal: 模态窗口，有全屏遮罩层
 * - nonModal: 非模态窗口，无遮罩层，支持多窗口同时打开
 *
 * 使用 CSS 变量和动画关键帧来自 acrylic.css 和 fluent-animations.css
 *
 * ARIA Support:
 * - role="dialog" for accessibility
 * - aria-modal for modal mode
 * - aria-labelledby for title association
 * - aria-describedby for content description
 */

import React, { useEffect, useState, useRef, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AcrylicDialogProps } from '@originos/core/types';
import AcrylicPanel from './AcrylicPanel';
import { useAcrylic } from '@/hooks/useAcrylic';
import { useReducedMotion, useTransition } from '@originos/core/lib/features/animations';

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export default function AcrylicDialog({
  isOpen,
  onClose,
  title,
  children,
  actions,
  variant = 'standard',
  size = 'md',
  closeOnEsc = true,
  closeOnOverlay = true,
  mode = 'nonModal',
}: AcrylicDialogProps) {
  // Feature detection - must be called before using prefersReducedMotion
  const { prefersReducedMotion } = useAcrylic();
  const prefersReduced = useReducedMotion();

  // Animation state
  const [shouldRender, setShouldRender] = useState(false);

  // Use transition hook for animation state management
  const transitionStatus = useTransition(isOpen, {
    duration: prefersReducedMotion || prefersReduced ? 0 : 200,
  });
  const isVisible = transitionStatus === 'entering' || transitionStatus === 'entered';

  // Accessibility
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const contentId = useId();
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle open/close with animations
  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element to restore later
      previousActiveElement.current = document.activeElement as HTMLElement;
      setShouldRender(true);
      // Focus the dialog for accessibility
      if (mode === 'modal' && dialogRef.current) {
        // Small delay to trigger enter animation
        requestAnimationFrame(() => {
          dialogRef.current?.focus();
        });
      }
    } else if (transitionStatus === 'exited') {
      setShouldRender(false);
      // Restore focus
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen, transitionStatus, mode]);

  // ESC key handler
  useEffect(() => {
    if (!isVisible || !closeOnEsc) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isVisible, closeOnEsc, onClose]);

  // Trap focus in modal mode
  useEffect(() => {
    if (mode !== 'modal' || !isVisible) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [mode, isVisible]);

  // Prevent body scroll in modal mode
  useEffect(() => {
    if (mode !== 'modal' || !isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mode, isOpen]);

  // Animation classes (respect reduced motion) - must be before early return
  const animationClasses = useMemo(() => {
    if (prefersReduced || prefersReducedMotion) {
      return {
        dialog: '',
        overlay: '',
      };
    }
    return {
      dialog: isVisible ? 'fluent-enter' : 'fluent-exit',
      overlay: isVisible ? 'fluent-enter-fade' : 'fluent-exit-fade',
    };
  }, [isVisible, prefersReduced, prefersReducedMotion]);

  // Common ARIA attributes
  const ariaProps = useMemo(() => ({
    role: 'dialog' as const,
    'aria-modal': mode === 'modal' ? true : undefined,
    'aria-labelledby': title ? titleId : undefined,
    'aria-describedby': contentId,
  }), [mode, title, titleId, contentId]);

  // Don't render if not needed
  if (!shouldRender) return null;

  // Non-modal window: no overlay, supports multiple windows
  if (mode === 'nonModal') {
    return createPortal(
      <AcrylicPanel
        ref={dialogRef}
        variant={variant}
        className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${sizeStyles[size]} w-full mx-4 p-6 z-[var(--acrylic-z-dialog)] ${animationClasses.dialog}`}
        tabIndex={-1}
        {...ariaProps}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 id={titleId} className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 fluent-transition-colors"
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>
        )}
        <div id={contentId} className="text-gray-700 dark:text-gray-300">{children}</div>
        {actions && <div className="flex justify-end gap-2 mt-6">{actions}</div>}
      </AcrylicPanel>,
      document.body
    );
  }

  // Modal window: with overlay
  return createPortal(
    <div
      className={`acrylic-overlay flex items-center justify-center ${animationClasses.overlay}`}
      onClick={closeOnOverlay ? onClose : undefined}
      aria-hidden="true"
    >
      <AcrylicPanel
        ref={dialogRef}
        variant={variant}
        className={`${sizeStyles[size]} w-full mx-4 p-6 z-[var(--acrylic-z-dialog)] ${animationClasses.dialog}`}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        tabIndex={-1}
        {...ariaProps}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 id={titleId} className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 fluent-transition-colors"
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>
        )}
        <div id={contentId} className="text-gray-700 dark:text-gray-300">{children}</div>
        {actions && <div className="flex justify-end gap-2 mt-6">{actions}</div>}
      </AcrylicPanel>
    </div>,
    document.body
  );
}
