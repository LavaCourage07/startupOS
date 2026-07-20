import { describe, expect, it } from 'vitest';

import {
  applyDreamInstructions,
  parseDreamInstructions,
} from '../core/dream-compat';

describe('dream-compat', () => {
  it('parses legacy dream instructions', () => {
    const instructions = parseDreamInstructions(
      '- [ADD] 用户喜欢简洁回复\n[REMOVE] 旧计划已经失效\n- [SKILL] review: 自动审查流程',
    );

    expect(instructions).toEqual([
      { type: 'ADD', content: '用户喜欢简洁回复' },
      { type: 'REMOVE', content: '旧计划已经失效' },
      { type: 'SKILL', content: 'review: 自动审查流程' },
    ]);
  });

  it('applies add update remove while preserving legacy Memory.md section semantics', () => {
    const memory = `# Memory.md

## 更新记忆

- 用户偏好中文交流
- 旧计划已经失效
`;

    const updated = applyDreamInstructions(memory, [
      { type: 'UPDATE', content: '用户偏好中文交流，回答要更简洁' },
      { type: 'REMOVE', content: '旧计划已经失效' },
      { type: 'ADD', content: '用户使用 VS Code' },
      { type: 'SKILL', content: 'ignored: 不应修改 Memory.md' },
    ]);

    expect(updated).toContain('用户偏好中文交流，回答要更简洁');
    expect(updated).toContain('用户使用 VS Code');
    expect(updated).not.toContain('旧计划已经失效');
    expect(updated).not.toContain('ignored: 不应修改 Memory.md');
  });
});
