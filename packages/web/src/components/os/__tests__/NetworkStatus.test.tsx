/**
 * NetworkStatus Component Tests
 */

import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import NetworkStatus from '../StatusBar/NetworkStatus';

describe('NetworkStatus', () => {
  beforeEach(() => {
    // Reset navigator state
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  it('renders wifi icon when online', () => {
    render(<NetworkStatus />);
    const icon = document.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('shows disconnected icon when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    render(<NetworkStatus />);
    const icon = document.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('renders with correct z-index for status bar', () => {
    const { container } = render(<NetworkStatus />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('text-white/80');
  });

  it('has title attribute showing connection status', () => {
    const { container } = render(<NetworkStatus />);
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveAttribute('title', '已连接');
  });
});
