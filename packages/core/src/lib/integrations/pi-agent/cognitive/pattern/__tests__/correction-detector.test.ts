import { describe, it, expect } from 'vitest';
import { detectCorrections, maxStrength } from '../correction-detector';

describe('CorrectionDetector', () => {
  describe('强纠正信号', () => {
    const strongCases = [
      '不对，重新来',
      '错了，应该用另一种方式',
      '搞错了',
      'wrong, that is not right',
      'no, that\'s incorrect',
      'redo this please',
    ];
    strongCases.forEach(msg => {
      it(`识别强信号: "${msg.slice(0, 30)}"`, () => {
        const signals = detectCorrections(msg);
        expect(signals.some(s => s.strength === 'strong')).toBe(true);
      });
    });
  });

  describe('中等纠正信号', () => {
    const mediumCases = [
      '不要这么做',
      '应该是另一种格式',
      '漏了一个字段',
      "don't use that approach",
      'you missed the detail',
    ];
    mediumCases.forEach(msg => {
      it(`识别中等信号: "${msg.slice(0, 30)}"`, () => {
        const signals = detectCorrections(msg);
        expect(signals.some(s => s.strength === 'medium')).toBe(true);
      });
    });
  });

  describe('弱信号', () => {
    it('识别疑问信号', () => {
      const signals = detectCorrections('为什么会这样');
      expect(signals.some(s => s.strength === 'weak')).toBe(true);
    });
    it('识别英文疑问信号', () => {
      const signals = detectCorrections('why did you choose this approach');
      expect(signals.some(s => s.strength === 'weak')).toBe(true);
    });
  });

  describe('无纠正信号', () => {
    const normalCases = [
      '好的，谢谢',
      '继续吧',
      'looks good to me',
      '帮我查询一下',
    ];
    normalCases.forEach(msg => {
      it(`无信号: "${msg}"`, () => {
        const signals = detectCorrections(msg);
        expect(signals).toHaveLength(0);
      });
    });
  });

  describe('maxStrength', () => {
    it('返回最高强度', () => {
      const signals = detectCorrections('不对，应该是另一种');
      expect(maxStrength(signals)).toBe('strong');
    });
    it('空信号返回 null', () => {
      expect(maxStrength([])).toBeNull();
    });
  });
});
