/**
 * OS.8: System Tests
 */

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ErrorBoundary } from '../../../../lib/features/system/errors/ErrorBoundary';
import { ShortcutRegistry } from '../../../../lib/features/system/shortcuts/ShortcutRegistry';

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render fallback on error', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('出错了')).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('ShortcutRegistry', () => {
  it('should register and handle shortcuts', () => {
    const registry = new ShortcutRegistry();
    const handler = vi.fn();

    registry.register('test', {
      key: 'k',
      meta: true,
      handler,
    });

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
    });

    registry.handle(event);
    expect(handler).toHaveBeenCalled();
  });
});
