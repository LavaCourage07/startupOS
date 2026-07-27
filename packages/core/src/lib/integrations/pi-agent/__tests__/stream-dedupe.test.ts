import { describe, expect, it } from 'vitest';
import {
  appendStreamDelta,
  getVisibleStreamDelta,
  reconcileFinalStreamContent,
  trimRepeatingTail,
} from '../stream-dedupe';

describe('stream-dedupe', () => {
  it('drops duplicate full-content deltas', () => {
    expect(appendStreamDelta('hello world', 'hello world')).toBe('hello world');
    expect(getVisibleStreamDelta('hello world', 'hello world')).toEqual({
      content: 'hello world',
      delta: '',
    });
  });

  it('emits only the new suffix when a provider sends accumulated text', () => {
    const current = 'hello world';
    const nextFrame = 'hello world again';

    expect(getVisibleStreamDelta(current, nextFrame)).toEqual({
      content: 'hello world again',
      delta: ' again',
    });
  });

  it('handles long accumulated frames after large tool results', () => {
    const prefix = '项目资料 '.repeat(9000);
    const current = `${prefix}我已经准备好创建Python脚本。`;
    const nextFrame = `${current}现在开始编写脚本。`;

    const merged = getVisibleStreamDelta(current, nextFrame);

    expect(merged.content).toBe(nextFrame);
    expect(merged.delta).toBe('现在开始编写脚本。');
  });

  it('reconciles final content without duplicating streamed prefixes', () => {
    const streamed = '搜索完成，找到以下技能：\n1. xmind';
    const finalContent = `${streamed}\n2. xmindify`;

    expect(reconcileFinalStreamContent(streamed, finalContent)).toBe(finalContent);
  });

  it('trims repeated generated tails while preserving one copy', () => {
    const paragraph = 'Now I understand the workflow. I need to follow the step file before checking existing sessions.\n\n';
    const content = `prefix\n${paragraph.repeat(4)}`;

    const result = trimRepeatingTail(content, { minPatternLength: 40, minRepetitions: 3 });

    expect(result.trimmed).toBe(true);
    expect(result.repetitions).toBe(4);
    expect(result.content).toBe(`prefix\n${paragraph}`);
  });

  it('trims near-duplicate repeated tails with small wording changes', () => {
    const p1 = 'Now I understand the workflow. I need to follow the step file before checking existing sessions and then confirm the output folder.\n\n';
    const p2 = 'Now I understand this workflow. I need to follow the step file before checking existing sessions and then confirm the output folder.\n\n';
    const p3 = 'Now I understand the workflow. I need to follow the step file before checking existing session records and then confirm the output folder.\n\n';
    const content = `prefix\n${p1}${p2}${p3}`;

    const result = trimRepeatingTail(content, { minPatternLength: 80, minRepetitions: 3 });

    expect(result.trimmed).toBe(true);
    expect(result.repetitions).toBe(3);
    expect(result.content).toContain('prefix\nNow I understand the workflow.');
    expect(result.content).toContain('checking existing sessions and then confirm the output folder.');
    expect(result.content).not.toContain('checking existing session records');
  });

  it('does not trim ordinary repeated short words', () => {
    const content = 'ok '.repeat(200);

    const result = trimRepeatingTail(content);

    expect(result.trimmed).toBe(false);
    expect(result.content).toBe(content);
  });

});
