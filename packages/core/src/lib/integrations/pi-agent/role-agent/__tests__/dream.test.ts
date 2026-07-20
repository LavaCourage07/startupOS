/**
 * Dream 两阶段自动记忆维护 — 单元测试
 */

import { Dream, type DreamResult, DREAM_PHASE1_PROMPT } from '../dream';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import { tmpdir } from 'os';

let testDir: string;

beforeEach(() => {
  testDir = path.join(tmpdir(), `dream-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('Dream Phase 1', () => {
  it('导出 DREAM_PHASE1_PROMPT 模板', () => {
    expect(DREAM_PHASE1_PROMPT).toContain('[ADD]');
    expect(DREAM_PHASE1_PROMPT).toContain('[UPDATE]');
    expect(DREAM_PHASE1_PROMPT).toContain('[REMOVE]');
    expect(DREAM_PHASE1_PROMPT).toContain('[SKILL]');
    expect(DREAM_PHASE1_PROMPT).toContain('[SKIP]');
  });

  it('prompt 包含 existingMemoryMd 和 recentHistory 占位符', () => {
    expect(DREAM_PHASE1_PROMPT).toContain('{existingMemoryMd}');
    expect(DREAM_PHASE1_PROMPT).toContain('{recentHistory}');
  });
});

describe('Dream 初始化', () => {
  it('使用默认配置创建实例', () => {
    const dream = new Dream(testDir);
    expect(dream.turnInterval).toBe(20);
  });

  it('使用自定义配置创建实例', () => {
    const dream = new Dream(testDir, {
      turnInterval: 10,
      staleThresholdDays: 7,
    });
    expect(dream.turnInterval).toBe(10);
  });
});

describe('Dream.run — Phase 2 指令解析与执行', () => {
  it('[ADD] 追加新记忆条目到 "## 更新记忆" section', async () => {
    const memoryContent = `# Memory.md\n\n## 更新记忆\n\n- 用户偏好中文交流\n`;
    writeFileSync(path.join(testDir, 'Memory.md'), memoryContent, 'utf-8');

    const dream = new Dream(testDir);
    const result = await dream.run('- [ADD] 用户有一个名为 Luna 的猫\n- [ADD] 用户喜欢简洁的回答');

    expect(result.skipped).toBe(false);
    expect(result.changes).toHaveLength(2);

    const updated = readFileSync(path.join(testDir, 'Memory.md'), 'utf-8');
    expect(updated).toContain('用户有一个名为 Luna 的猫');
    expect(updated).toContain('用户喜欢简洁的回答');
  });

  it('[ADD] 在没有 "## 更新记忆" section 时创建新 section', async () => {
    const memoryContent = `# Memory.md\n\n这是初始内容\n`;
    writeFileSync(path.join(testDir, 'Memory.md'), memoryContent, 'utf-8');

    const dream = new Dream(testDir);
    const result = await dream.run('- [ADD] 新的记忆条目');

    expect(result.skipped).toBe(false);

    const updated = readFileSync(path.join(testDir, 'Memory.md'), 'utf-8');
    expect(updated).toContain('## 更新记忆');
    expect(updated).toContain('新的记忆条目');
  });

  it('[REMOVE] 删除匹配的记忆行', async () => {
    const memoryContent = `# Memory.md\n\n## 更新记忆\n\n- 用户偏好中文交流\n- 用户使用 macOS 系统\n- 用户喜欢简洁的回答\n`;
    writeFileSync(path.join(testDir, 'Memory.md'), memoryContent, 'utf-8');

    const dream = new Dream(testDir);
    const result = await dream.run('- [REMOVE] 用户使用 macOS 系统');

    expect(result.skipped).toBe(false);
    expect(result.changes).toHaveLength(1);

    const updated = readFileSync(path.join(testDir, 'Memory.md'), 'utf-8');
    expect(updated).toContain('用户偏好中文交流');
    expect(updated).toContain('用户喜欢简洁的回答');
    expect(updated).not.toContain('用户使用 macOS 系统');
  });

  it('[UPDATE] 查找并替换匹配行', async () => {
    const memoryContent = `# Memory.md\n\n## 更新记忆\n\n- 用户偏好中文交流\n- 用户使用 Windows 系统\n`;
    writeFileSync(path.join(testDir, 'Memory.md'), memoryContent, 'utf-8');

    const dream = new Dream(testDir);
    // 实际 LLM 输出的 UPDATE 行会包含与旧行相同的前缀
    const result = await dream.run('- [UPDATE] 用户偏好中文交流，回答要详细且有示例');

    expect(result.skipped).toBe(false);

    const updated = readFileSync(path.join(testDir, 'Memory.md'), 'utf-8');
    expect(updated).toContain('用户偏好中文交流，回答要详细且有示例');
    expect(updated).not.toContain('用户偏好中文交流\n');
    // 未匹配的行不应被修改
    expect(updated).toContain('用户使用 Windows 系统');
  });

  it('[UPDATE] 找不到匹配行时降级为 ADD', async () => {
    const memoryContent = `# Memory.md\n\n## 更新记忆\n\n- 用户偏好中文交流\n`;
    writeFileSync(path.join(testDir, 'Memory.md'), memoryContent, 'utf-8');

    const dream = new Dream(testDir);
    const result = await dream.run('- [UPDATE] 全新的不存在的记忆');

    expect(result.skipped).toBe(false);

    const updated = readFileSync(path.join(testDir, 'Memory.md'), 'utf-8');
    expect(updated).toContain('全新的不存在的记忆');
  });

  it('[SKILL] 被跳过，不修改文件', async () => {
    const memoryContent = `# Memory.md\n\n## 更新记忆\n\n- 用户偏好中文交流\n`;
    const originalContent = memoryContent;
    writeFileSync(path.join(testDir, 'Memory.md'), memoryContent, 'utf-8');

    const dream = new Dream(testDir);
    const result = await dream.run('- [SKILL] auto-review: 自动审查 PR 流程');

    expect(result.skipped).toBe(false);
    expect(result.changes).toHaveLength(1);

    const updated = readFileSync(path.join(testDir, 'Memory.md'), 'utf-8');
    expect(updated).toBe(originalContent);
  });

  it('[SKIP] 时跳过更新，文件不变', async () => {
    const memoryContent = `# Memory.md\n\n## 更新记忆\n\n- 用户偏好中文交流\n`;
    writeFileSync(path.join(testDir, 'Memory.md'), memoryContent, 'utf-8');

    const dream = new Dream(testDir);
    const result = await dream.run('[SKIP]');

    expect(result.skipped).toBe(true);
    expect(result.changes).toHaveLength(0);

    const updated = readFileSync(path.join(testDir, 'Memory.md'), 'utf-8');
    expect(updated).toBe(memoryContent);
  });

  it('空输入时跳过更新', async () => {
    const memoryContent = `# Memory.md\n`;
    writeFileSync(path.join(testDir, 'Memory.md'), memoryContent, 'utf-8');

    const dream = new Dream(testDir);
    const result = await dream.run('');

    expect(result.skipped).toBe(true);
    expect(result.changes).toHaveLength(0);
  });

  it('混合指令同时执行 ADD + REMOVE + UPDATE', async () => {
    const memoryContent = `# Memory.md\n\n## 更新记忆\n\n- 用户偏好中文交流\n- 旧的项目方案已被取代\n- 用户使用 macOS 系统\n`;
    writeFileSync(path.join(testDir, 'Memory.md'), memoryContent, 'utf-8');

    const dream = new Dream(testDir);
    const result = await dream.run(
      `- [ADD] 用户新安装了 VS Code\n- [UPDATE] 用户偏好中文交流，回答要简洁\n- [REMOVE] 旧的项目方案已被取代\n- [SKILL] test-workflow: 测试驱动开发流程\n`,
    );

    expect(result.skipped).toBe(false);
    expect(result.changes).toHaveLength(4);

    const updated = readFileSync(path.join(testDir, 'Memory.md'), 'utf-8');
    expect(updated).toContain('用户新安装了 VS Code');
    expect(updated).toContain('用户偏好中文交流，回答要简洁');
    expect(updated).toContain('用户使用 macOS 系统');
    expect(updated).not.toContain('旧的项目方案已被取代');
  });

  it('Memory.md 不存在时创建并写入', async () => {
    const dream = new Dream(testDir);
    const result = await dream.run('- [ADD] 第一条记忆');

    expect(result.skipped).toBe(false);
    expect(existsSync(path.join(testDir, 'Memory.md'))).toBe(true);

    const content = readFileSync(path.join(testDir, 'Memory.md'), 'utf-8');
    expect(content).toContain('第一条记忆');
  });

  it('处理带有前缀格式不规范的指令行', async () => {
    const memoryContent = `# Memory.md\n\n## 更新记忆\n`;
    writeFileSync(path.join(testDir, 'Memory.md'), memoryContent, 'utf-8');

    const dream = new Dream(testDir);
    // 测试不同缩进和空格的指令
    const result = await dream.run(
      `  - [ADD] 带缩进的条目\n[ADD] 无前缀横杠的条目\n`,
    );

    expect(result.skipped).toBe(false);
  });
});

describe('DreamResult 格式', () => {
  it('changes 数组包含可读的变更描述', async () => {
    writeFileSync(path.join(testDir, 'Memory.md'), '# Memory.md\n', 'utf-8');
    const dream = new Dream(testDir);
    const result = await dream.run('- [ADD] 这是一个很长的测试记忆条目用于截断');

    expect(result.changes[0]).toContain('[ADD]');
  });

  it('skipped 为 true 时表示无变更', async () => {
    writeFileSync(path.join(testDir, 'Memory.md'), '# Memory.md\n', 'utf-8');
    const dream = new Dream(testDir);
    const result = await dream.run('[SKIP]');

    expect(result.skipped).toBe(true);
    expect(result.changes).toHaveLength(0);
  });
});
