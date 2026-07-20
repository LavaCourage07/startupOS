/**
 * Background Component Tests
 */

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Background from '../Background';
import type { BackgroundConfig } from '@originos/core/types';

describe('Background', () => {
  it('renders solid color background', () => {
    const config: BackgroundConfig = {
      type: 'solid',
      color: '#0A0A0A',
    };

    render(<Background config={config} />);
    const bg = document.querySelector('[style*="background-color"]');
    expect(bg).toBeInTheDocument();
    expect(bg).toHaveStyle({ backgroundColor: '#0A0A0A' });
  });

  it('renders image background when imageUrl is provided', () => {
    const config: BackgroundConfig = {
      type: 'image',
      imageUrl: '/test-image.jpg',
    };

    render(<Background config={config} />);
    // Should render ImageBackground component
    expect(document.querySelector('[style*="background-image"]')).toBeInTheDocument();
  });

  it('renders particles background', () => {
    const config: BackgroundConfig = {
      type: 'particles',
    };

    render(<Background config={config} />);
    // Should render Particles component with canvas
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const config: BackgroundConfig = {
      type: 'solid',
      color: '#000000',
    };

    const { container } = render(<Background config={config} className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('renders both image and particles when particlesEnabled is true', () => {
    const config: BackgroundConfig = {
      type: 'image',
      imageUrl: '/test-image.jpg',
      particlesEnabled: true,
    };

    render(<Background config={config} />);
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });
});
