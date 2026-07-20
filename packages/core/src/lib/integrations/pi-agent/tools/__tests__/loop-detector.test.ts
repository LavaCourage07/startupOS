import { describe, expect, it } from 'vitest';
import { LoopDetector } from '../loop-detector';

describe('LoopDetector', () => {
  it('returns ok before warning threshold', () => {
    const detector = new LoopDetector();

    let result = detector.record('read_file', { path: 'a.md' });
    expect(result.type).toBe('ok');

    for (let i = 0; i < 6; i++) {
      result = detector.record('read_file', { path: 'a.md' });
    }

    expect(result.type).toBe('ok');
  });

  it('returns warning after repeated identical tool calls', () => {
    const detector = new LoopDetector();

    let result = detector.record('read_file', { path: 'a.md' });
    for (let i = 0; i < 7; i++) {
      result = detector.record('read_file', { path: 'a.md' });
    }

    expect(result.type).toBe('warning');
    if (result.type !== 'warning') {
      throw new Error('expected warning');
    }
    expect(result.toolName).toBe('read_file');
    expect(result.count).toBe(8);
  });

  it('returns circuit breaker after excessive identical tool calls', () => {
    const detector = new LoopDetector();

    let result = detector.record('read_file', { path: 'a.md' });
    for (let i = 0; i < 19; i++) {
      result = detector.record('read_file', { path: 'a.md' });
    }

    expect(result.type).toBe('circuit_breaker');
    if (result.type !== 'circuit_breaker') {
      throw new Error('expected circuit breaker');
    }
    expect(result.count).toBe(20);
  });
});
