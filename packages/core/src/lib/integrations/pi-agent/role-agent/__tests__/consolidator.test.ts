/**
 * Consolidator token 预算触发式压缩 — 单元测试
 */

import { Consolidator, CONSOLIDATOR_ARCHIVE_PROMPT } from '../consolidator';

describe('Consolidator 初始化', () => {
  it('使用默认配置创建实例', () => {
    const c = new Consolidator();
    expect(c).toBeDefined();
  });

  it('使用自定义配置创建实例', () => {
    const c = new Consolidator({
      contextWindowTokens: 200_000,
      safetyBuffer: 20_000,
    });
    expect(c).toBeDefined();
  });
});

describe('Consolidator.shouldConsolidate', () => {
  it('低于阈值时返回 false', () => {
    const c = new Consolidator({
      contextWindowTokens: 128_000,
      safetyBuffer: 10_000,
    });
    // 阈值 = 128000 - 10000 = 118000
    expect(c.shouldConsolidate(50_000)).toBe(false);
    expect(c.shouldConsolidate(100_000)).toBe(false);
    expect(c.shouldConsolidate(118_000)).toBe(false);
  });

  it('超过阈值时返回 true', () => {
    const c = new Consolidator({
      contextWindowTokens: 128_000,
      safetyBuffer: 10_000,
    });
    expect(c.shouldConsolidate(118_001)).toBe(true);
    expect(c.shouldConsolidate(128_000)).toBe(true);
    expect(c.shouldConsolidate(200_000)).toBe(true);
  });

  it('恰好等于阈值时返回 false', () => {
    const c = new Consolidator({
      contextWindowTokens: 100_000,
      safetyBuffer: 5_000,
    });
    // 阈值 = 95000
    expect(c.shouldConsolidate(95_000)).toBe(false);
    expect(c.shouldConsolidate(95_001)).toBe(true);
  });
});

describe('CONSOLIDATOR_ARCHIVE_PROMPT', () => {
  it('导出 archive prompt 模板', () => {
    expect(CONSOLIDATOR_ARCHIVE_PROMPT).toContain('压缩为简洁摘要');
    expect(CONSOLIDATOR_ARCHIVE_PROMPT).toContain('保留');
    expect(CONSOLIDATOR_ARCHIVE_PROMPT).toContain('省略');
  });
});
