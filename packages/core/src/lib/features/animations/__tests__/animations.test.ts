/**
 * OS.6: Fluent Animation System Tests
 */

import { describe, it, expect } from 'vitest';
import { easings, durations } from '../../../../lib/features/animations';

describe('Easings', () => {
  it('should export all easing functions', () => {
    expect(easings.standard).toBe('cubic-bezier(0.4, 0.0, 0.2, 1)');
    expect(easings.decelerate).toBe('cubic-bezier(0.0, 0.0, 0.2, 1)');
    expect(easings.accelerate).toBe('cubic-bezier(0.4, 0.0, 1, 1)');
    expect(easings.sharp).toBe('cubic-bezier(0.4, 0.0, 0.6, 1)');
  });
});

describe('Durations', () => {
  it('should export all duration constants', () => {
    expect(durations.instant).toBe(100);
    expect(durations.fast).toBe(200);
    expect(durations.normal).toBe(300);
    expect(durations.slow).toBe(500);
    expect(durations.enter).toBe(250);
    expect(durations.exit).toBe(200);
    expect(durations.complex).toBe(400);
  });
});
