import { describe, expect, it } from 'vitest';

import { normalizeMarkdownTables } from '../normalize-markdown-tables';

describe('normalizeMarkdownTables', () => {
  it('repairs short separators and adds block boundaries', () => {
    expect(normalizeMarkdownTables([
      '评估结果如下：',
      '| 姓名 | 得分 |',
      '| - | :-: |',
      '| 张三 | 90 |',
      '后续建议',
    ].join('\n'))).toBe([
      '评估结果如下：',
      '',
      '| 姓名 | 得分 |',
      '| --- | :---: |',
      '| 张三 | 90 |',
      '',
      '后续建议',
    ].join('\n'));
  });

  it('repairs full-width table pipes', () => {
    expect(normalizeMarkdownTables([
      '｜ 项目 ｜ 结果 ｜',
      '｜ --- ｜ --- ｜',
      '｜ 匹配度 ｜ 高 ｜',
    ].join('\n'))).toBe([
      '| 项目 | 结果 |',
      '| --- | --- |',
      '| 匹配度 | 高 |',
    ].join('\n'));
  });

  it('preserves valid tables and escaped cell pipes', () => {
    const markdown = [
      '| Pattern | Result |',
      '| --- | ---: |',
      '| `a \\| b` | pass |',
    ].join('\n');

    expect(normalizeMarkdownTables(markdown)).toBe(markdown);
  });

  it('does not modify code fences or ordinary pipe text', () => {
    const markdown = [
      'A | B is ordinary prose.',
      '```markdown',
      '｜ A ｜ B ｜',
      '｜ - ｜ - ｜',
      '```',
    ].join('\n');

    expect(normalizeMarkdownTables(markdown)).toBe(markdown);
  });

  it('does not invent a separator row', () => {
    const markdown = [
      '| A | B |',
      '| one | two |',
    ].join('\n');

    expect(normalizeMarkdownTables(markdown)).toBe(markdown);
  });
});
