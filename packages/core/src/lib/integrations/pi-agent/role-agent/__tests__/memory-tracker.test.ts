/**
 * MemoryTracker JSONL 历史存储 + Dream cursor — 单元测试
 */

import { MemoryTracker } from '../memory-tracker';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

let testDir: string;

beforeEach(() => {
  testDir = path.join(os.tmpdir(), `memory-tracker-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('JSONL 历史存储', () => {
  it('创建 memory/ 目录', () => {
    new MemoryTracker(testDir);
    expect(existsSync(path.join(testDir, 'memory'))).toBe(true);
  });

  it('recordTurn 追加 JSONL 条目', () => {
    const tracker = new MemoryTracker(testDir);
    tracker.recordTurn('用户问了第一个问题', 1);
    tracker.recordTurn('用户问了第二个问题', 2);

    const historyPath = path.join(testDir, 'memory', 'history.jsonl');
    expect(existsSync(historyPath)).toBe(true);

    const content = readFileSync(historyPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);

    const entry1 = JSON.parse(lines[0]!);
    expect(entry1.summary).toBe('用户问了第一个问题');
    expect(entry1.turnNumber).toBe(1);
  });

  it('readRecentHistory 读取增量数据', () => {
    const tracker = new MemoryTracker(testDir);
    tracker.recordTurn('第一条', 1);
    tracker.recordTurn('第二条', 2);
    tracker.recordTurn('第三条', 3);

    // 从第 2 条开始读取（cursor=2 表示前 2 条已处理）
    const recent = tracker.readRecentHistory(2);
    expect(recent).toContain('第三条');
    expect(recent).not.toContain('第一条');
    expect(recent).not.toContain('第二条');
  });

  it('cursor 超出范围时返回空', () => {
    const tracker = new MemoryTracker(testDir);
    tracker.recordTurn('唯一一条', 1);

    const recent = tracker.readRecentHistory(1);
    expect(recent).toBe('');
  });

  it('无历史文件时返回空字符串', () => {
    const tracker = new MemoryTracker(testDir);
    expect(tracker.readRecentHistory(0)).toBe('');
  });
});

describe('Dream cursor', () => {
  it('初始 cursor 为 0', () => {
    const tracker = new MemoryTracker(testDir);
    expect(tracker.getDreamCursor()).toBe(0);
  });

  it('setCursor / getCursor 持久化', () => {
    const tracker = new MemoryTracker(testDir);
    tracker.setDreamCursor(42);
    expect(tracker.getDreamCursor()).toBe(42);
  });

  it('cursor 在实例重建后仍保留', () => {
    const tracker1 = new MemoryTracker(testDir);
    tracker1.setDreamCursor(99);

    const tracker2 = new MemoryTracker(testDir);
    expect(tracker2.getDreamCursor()).toBe(99);
  });
});

describe('现有功能兼容性', () => {
  it('flushMemory 不再追加 turn 摘要，但会确保 Memory.md 存在', async () => {
    const tracker = new MemoryTracker(testDir, 2);
    tracker.recordTurn('第一条', 1);
    tracker.recordTurn('第二条', 2);

    expect(tracker.shouldFlush()).toBe(true);

    await tracker.flushMemory('现有内容\n');
    const memoryContent = readFileSync(path.join(testDir, 'Memory.md'), 'utf-8');
    expect(memoryContent).toContain('# Memory');
    expect(memoryContent).toContain('## human');
    expect(memoryContent).not.toContain('## 更新记忆');
    expect(tracker.getState().entries).toHaveLength(0);
    expect(tracker.getState().turnCount).toBe(0);
  });

  it('forceFlush 仍正常工作', async () => {
    const tracker = new MemoryTracker(testDir);
    tracker.recordTurn('测试', 1);

    await tracker.forceFlush(null);
    const memoryContent = readFileSync(path.join(testDir, 'Memory.md'), 'utf-8');
    expect(memoryContent).toContain('# Memory');
    expect(memoryContent).toContain('## human');
  });

  it('getState 返回正确状态', () => {
    const tracker = new MemoryTracker(testDir, 10);
    tracker.recordTurn('测试', 1);

    const state = tracker.getState();
    expect(state.turnCount).toBe(1);
    expect(state.flushThreshold).toBe(10);
    expect(state.entries).toHaveLength(1);
  });
});
