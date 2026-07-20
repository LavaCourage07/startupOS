/**
 * Background Subcomponent Tests
 */

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SolidColor from '../Background/SolidColor';
import ImageBackground from '../Background/Image';
import Particles from '../Background/Particles';

describe('SolidColor', () => {
  it('renders with correct color', () => {
    const { container } = render(<SolidColor color="#FF0000" />);
    const element = container.firstChild as HTMLElement;
    expect(element).toHaveStyle({ backgroundColor: '#FF0000' });
  });

  it('applies custom className', () => {
    const { container } = render(<SolidColor color="#000000" className="test-class" />);
    expect(container.querySelector('.test-class')).toBeInTheDocument();
  });

  it('has transition effect', () => {
    const { container } = render(<SolidColor color="#000000" />);
    const element = container.firstChild as HTMLElement;
    expect(element).toHaveClass('transition-colors');
  });
});

describe('ImageBackground', () => {
  it('does not render when imageUrl is not provided', () => {
    const { container } = render(<ImageBackground />);
    expect(container.firstChild).toBeNull();
  });

  it('renders with correct imageUrl', () => {
    const { container } = render(<ImageBackground imageUrl="/test.jpg" />);
    const element = container.querySelector('[style*="background-image"]') as HTMLElement;
    expect(element).toBeInTheDocument();
    expect(element).toHaveStyle({
      backgroundImage: 'url(/test.jpg)',
    });
  });

  it('applies background-cover class', () => {
    const { container } = render(<ImageBackground imageUrl="/test.jpg" />);
    const element = container.querySelector('.bg-cover') as HTMLElement;
    expect(element).toBeInTheDocument();
  });
});

describe('Particles', () => {
  it('renders canvas element', () => {
    const { container } = render(<Particles />);
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Particles className="test-class" />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toHaveClass('test-class');
  });

  it('canvas is positioned absolutely', () => {
    const { container } = render(<Particles />);
    const canvas = container.querySelector('canvas') as HTMLElement;
    expect(canvas).toHaveClass('absolute', 'inset-0');
  });

  it('canvas has pointer-events-none', () => {
    const { container } = render(<Particles />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toHaveClass('pointer-events-none');
  });
});
