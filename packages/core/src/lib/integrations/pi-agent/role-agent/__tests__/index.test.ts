import { describe, expect, it } from 'vitest';
import * as roleAgentExports from '../index';

describe('role-agent barrel exports', () => {
  it('does not expose Dream on the default runtime surface', () => {
    expect('Dream' in roleAgentExports).toBe(false);
    expect('DREAM_PHASE1_PROMPT' in roleAgentExports).toBe(false);
  });
});
