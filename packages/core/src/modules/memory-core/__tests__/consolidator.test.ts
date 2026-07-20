import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryConsolidator } from '../core/consolidator';
import { HistoryStore } from '../recall/history-store';

let testDir: string;
let completeResponse = '- [UPDATE:human] 用户以后都偏好简洁回答';

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-consolidator-test-'));
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function createModelFactory() {
  return {
    createAutoModel() {
      return { id: 'mock-model', provider: 'mock' };
    },
  };
}

vi.mock('@mariozechner/pi-ai', () => ({
  complete: vi.fn(async () => ({
    content: [{ type: 'text', text: completeResponse }],
  })),
}));

describe('MemoryConsolidator', () => {
  it('extracts stable memory from explicit preference turns', async () => {
    completeResponse = '- [UPDATE:human] 用户以后都偏好简洁回答';
    const history = new HistoryStore(path.join(testDir, 'memory', 'history'), 'default');
    history.append({
      turnNumber: 1,
      summary: '用户以后都偏好简洁回答',
      userMessage: '以后都请用简洁回答，默认不要展开太多。',
      assistantMessage: '好的，我会保持简洁。',
      toolCalls: [],
      timestamp: Date.now(),
    });
    history.append({
      turnNumber: 2,
      summary: '确认偏好',
      userMessage: '这个偏好长期有效。',
      assistantMessage: '已记录。',
      toolCalls: [],
      timestamp: Date.now() + 1,
    });

    const consolidator = new MemoryConsolidator(testDir, 'default', createModelFactory());
    const result = await consolidator.consolidate();

    expect(result.consolidated).toBe(true);
    expect(result.stableMemory.some((item) => item.includes('以后都请用简洁回答'))).toBe(true);
    expect(result.patterns).toHaveLength(0);
  });

  it('ingests failed tool turns as reflections', async () => {
    completeResponse = '[SKIP]';
    const history = new HistoryStore(path.join(testDir, 'memory', 'history'), 'default');
    history.append({
      turnNumber: 1,
      summary: '用户要求读取报价文件',
      userMessage: '读取报价文件并总结错误原因',
      assistantMessage: '开始处理。',
      toolCalls: [
        {
          name: 'read_file',
          params: { path: 'quote.md' },
          result: 'Error: file not found',
          success: false,
        },
      ],
      timestamp: Date.now(),
    });
    history.append({
      turnNumber: 2,
      summary: '补充确认',
      userMessage: '如果文件不存在就先告诉我。',
      assistantMessage: '明白。',
      toolCalls: [],
      timestamp: Date.now() + 1,
    });

    const consolidator = new MemoryConsolidator(testDir, 'default', createModelFactory());
    const result = await consolidator.consolidate();

    expect(result.consolidated).toBe(true);
    expect(result.patterns.some((item) => item.startsWith('[REFLECTION]'))).toBe(true);

    const archivalPath = path.join(testDir, 'archival', 'entries.jsonl');
    expect(fs.existsSync(archivalPath)).toBe(true);
    const archivalContent = fs.readFileSync(archivalPath, 'utf-8');
    expect(archivalContent).toContain('失败原因');
    expect(archivalContent).toContain('read_file');
  });

  it('extracts knowledge candidates from entities and successful tool results', async () => {
    completeResponse = '[SKIP]';
    const history = new HistoryStore(path.join(testDir, 'memory', 'history'), 'default');
    history.append({
      turnNumber: 1,
      summary: '讨论 Tesla Factory',
      userMessage: '请记录 Tesla Factory 的产线约束。',
      assistantMessage: '我会整理 Tesla Factory 的产线约束。',
      toolCalls: [
        {
          name: 'read_file',
          params: { path: 'factory.md' },
          result: 'Tesla Factory uses a three-shift schedule and requires badge access.',
          success: true,
        },
      ],
      timestamp: Date.now(),
    });
    history.append({
      turnNumber: 2,
      summary: '确认知识',
      userMessage: '这些信息后面还会用到。',
      assistantMessage: '已记下。',
      toolCalls: [],
      timestamp: Date.now() + 1,
    });

    const consolidator = new MemoryConsolidator(testDir, 'default', createModelFactory());
    const result = await consolidator.consolidate();

    expect(result.knowledgeCandidates.length).toBeGreaterThan(0);
    expect(result.knowledgeCandidates[0]?.entities.some((entity) => entity.name === 'Tesla Factory')).toBe(true);
    expect(result.knowledgeCandidates[0]?.facts.some((fact) => fact.includes('three-shift schedule'))).toBe(true);
  });
});
