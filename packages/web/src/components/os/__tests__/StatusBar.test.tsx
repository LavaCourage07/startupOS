/**
 * StatusBar Component Tests
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StatusBar from '../StatusBar';

// Mock subcomponents
vi.mock('../StatusBar/Clock', () => ({
  default: () => <span data-testid="clock">Clock</span>,
}));

vi.mock('../StatusBar/NetworkStatus', () => ({
  default: () => <span data-testid="network">Network</span>,
}));

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders status bar with title', () => {
    render(<StatusBar />);
    expect(screen.getByText('OriginOS')).toBeInTheDocument();
  });

  it('renders network status by default', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('network')).toBeInTheDocument();
  });

  it('renders clock', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('clock')).toBeInTheDocument();
  });

  it('does not render network status when showNetwork is false', () => {
    render(<StatusBar showNetwork={false} />);
    expect(screen.queryByTestId('network')).not.toBeInTheDocument();
  });

  it('has fixed positioning', () => {
    const { container } = render(<StatusBar />);
    const statusBar = container.firstChild as HTMLElement;
    expect(statusBar).toHaveClass('fixed', 'top-0', 'left-0', 'right-0');
  });

  it('has height of 8 units', () => {
    const { container } = render(<StatusBar />);
    const statusBar = container.firstChild as HTMLElement;
    expect(statusBar).toHaveClass('h-8');
  });
});
