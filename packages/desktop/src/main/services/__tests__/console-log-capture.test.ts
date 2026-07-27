import { describe, expect, it, vi } from 'vitest';
import {
  captureConsoleCall,
  serializeConsoleArgs,
} from '../console-log-capture';

describe('console log capture', () => {
  it('serializes once and shares the bounded line with both log channels and terminal', () => {
    const serialize = vi.fn(() => '[LLM] bounded line');
    const appendDesktop = vi.fn();
    const appendLlm = vi.fn();
    const writeTerminal = vi.fn();

    captureConsoleCall({
      methodName: 'info',
      args: [{ huge: 'x'.repeat(100_000) }],
      llmEnabled: true,
      shouldWriteLlm: line => line.includes('[LLM]'),
      appendDesktop,
      appendLlm,
      writeTerminal,
      serialize,
    });

    expect(serialize).toHaveBeenCalledTimes(1);
    expect(appendDesktop).toHaveBeenCalledWith('INFO [LLM] bounded line');
    expect(appendLlm).toHaveBeenCalledWith('INFO [LLM] bounded line');
    expect(writeTerminal).toHaveBeenCalledWith('[LLM] bounded line');
  });

  it('does not write unrelated console lines to the LLM channel', () => {
    const appendLlm = vi.fn();

    captureConsoleCall({
      methodName: 'log',
      args: ['ordinary desktop log'],
      llmEnabled: true,
      shouldWriteLlm: line => line.includes('[LLM]'),
      appendDesktop: vi.fn(),
      appendLlm,
      writeTerminal: vi.fn(),
    });

    expect(appendLlm).not.toHaveBeenCalled();
  });

  it('caps a single serialized console line', () => {
    const line = serializeConsoleArgs(['prefix', { body: 'x'.repeat(100_000) }], 512);

    expect(line.length).toBeLessThan(600);
    expect(line).toContain('console line truncated');
    expect(line).not.toContain('x'.repeat(1000));
  });

  it('redacts credentials before writing any channel', () => {
    const line = serializeConsoleArgs([
      'Authorization: Bearer sk-sensitive-credential-value',
    ]);

    expect(line).toContain('[REDACTED]');
    expect(line).not.toContain('sk-sensitive-credential-value');
  });
});
