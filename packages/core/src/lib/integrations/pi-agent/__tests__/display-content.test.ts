import { describe, expect, it } from 'vitest';
import { extractDisplayContent, sanitizeAgentDisplayMessage } from '../display-content';

describe('extractDisplayContent', () => {
  it('returns text blocks when present', () => {
    const result = extractDisplayContent([
      { type: 'thinking', thinking: 'internal note' },
      { type: 'text', text: 'final answer' },
    ], { allowThinkingFallback: true });

    expect(result).toBe('final answer');
  });

  it('falls back to a single thinking block when text is absent', () => {
    const result = extractDisplayContent([
      { type: 'thinking', thinking: '只有思考内容但没有 text block' },
    ], { allowThinkingFallback: true });

    expect(result).toBe('只有思考内容但没有 text block');
  });

  it('does not fall back when thinking fallback is disabled', () => {
    const result = extractDisplayContent([
      { type: 'thinking', thinking: 'internal only' },
    ]);

    expect(result).toBe('');
  });

  it('does not merge multiple thinking blocks into display content', () => {
    const result = extractDisplayContent([
      { type: 'thinking', thinking: 'part 1' },
      { type: 'thinking', thinking: 'part 2' },
    ], { allowThinkingFallback: true });

    expect(result).toBe('');
  });

  it('strips provider thinking tags from visible text', () => {
    const result = extractDisplayContent([
      { type: 'text', text: '<think>internal reasoning</think>\nfinal answer' },
    ]);

    expect(result).toBe('final answer');
  });

  it('removes thinking metadata from display messages', () => {
    const result = sanitizeAgentDisplayMessage({
      role: 'assistant',
      content: '<think>hidden</think>\nfinal answer',
      metadata: {
        thinking: { content: 'hidden', status: 'completed' },
      },
    });

    expect(result.content).toBe('final answer');
    expect('metadata' in result).toBe(false);
  });
});
