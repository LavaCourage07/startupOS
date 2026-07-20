import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PatternProvider } from '../pattern-provider';
import type { TurnCognitiveData } from '../types';

function tmpDir(): string {
  return path.join(process.cwd(), '.test-tmp', `pattern-provider-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
}

function cleanup(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

function makeTurnData(overrides: Partial<TurnCognitiveData> = {}): TurnCognitiveData {
  return {
    turnNumber: 1,
    userMessage: 'analyze the data',
    assistantMessage: 'done',
    assistantThinking: 'let me think',
    toolCalls: [],
    outcome: { resolved: true, toolChainLength: 0 },
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('PatternProvider', () => {
  let agentDir: string;
  let provider: PatternProvider;

  beforeEach(() => {
    agentDir = tmpDir();
    fs.mkdirSync(agentDir, { recursive: true });
    provider = new PatternProvider(agentDir);
  });

  afterEach(() => {
    cleanup(agentDir);
  });

  describe('sync_turn - success', () => {
    it('records a successful short tool chain as a candidate pattern', async () => {
      await provider.sync_turn(makeTurnData({
        turnNumber: 1,
        toolCalls: [
          { name: 'read_file', params: { path: 'data.csv' }, result: 'ok', success: true },
          { name: 'write_file', params: { path: 'out.csv' }, result: 'ok', success: true },
        ],
        outcome: { resolved: true, toolChainLength: 2 },
      }));

      const registryContent = fs.readFileSync(path.join(agentDir, 'patterns', 'registry.json'), 'utf-8');
      const registry = JSON.parse(registryContent);
      expect(registry.patterns.length).toBe(1);
      expect(registry.patterns[0].isAntiPattern).toBe(false);
      expect(registry.patterns[0].toolChain).toEqual(['read_file', 'write_file']);
    });

    it('does not record long tool chains as patterns (too noisy)', async () => {
      await provider.sync_turn(makeTurnData({
        turnNumber: 1,
        toolCalls: Array.from({ length: 5 }, (_, i) => ({
          name: `tool_${i}`, params: {}, result: 'ok', success: true,
        })),
        outcome: { resolved: true, toolChainLength: 5 },
      }));

      const registryContent = fs.readFileSync(path.join(agentDir, 'patterns', 'registry.json'), 'utf-8');
      const registry = JSON.parse(registryContent);
      // Only recorded by session_end batch analysis, not sync_turn
      expect(registry.patterns.length).toBe(0);
    });
  });

  describe('on_failure - reflexion', () => {
    it('generates a reflection on unresolved task', async () => {
      await provider.sync_turn(makeTurnData({
        turnNumber: 42,
        userMessage: 'process large CSV dataset',
        toolCalls: [
          { name: 'read_file', params: {}, result: 'ok', success: true },
          { name: 'python_execute', params: {}, result: 'timeout', success: false },
        ],
        outcome: { resolved: false, toolChainLength: 2 },
      }));

      // Check reflection file exists
      const memDir = path.join(agentDir, 'patterns', 'episodic-memory');
      expect(fs.existsSync(memDir)).toBe(true);

      const reflectionFile = path.join(memDir, 'reflection-42.json');
      expect(fs.existsSync(reflectionFile)).toBe(true);

      const reflection = JSON.parse(fs.readFileSync(reflectionFile, 'utf-8'));
      expect(reflection.reflection.whatWentWrong).toContain('python_execute');
      expect(reflection.tags).toContain('python_execute');
      expect(reflection.turnId).toBe('turn-42');
    });

    it('generates a reflection on tool error', async () => {
      await provider.sync_turn(makeTurnData({
        turnNumber: 10,
        userMessage: 'create report',
        toolCalls: [
          { name: 'write_file', params: { path: '/bad/path' }, result: 'EACCES', success: false },
        ],
        outcome: { resolved: false, toolChainLength: 1 },
      }));

      const memDir = path.join(agentDir, 'patterns', 'episodic-memory');
      const reflectionFile = path.join(memDir, 'reflection-10.json');
      expect(fs.existsSync(reflectionFile)).toBe(true);
    });
  });

  describe('searchReflections', () => {
    it('returns null when no reflections exist', async () => {
      const result = await provider.searchReflections('python');
      expect(result).toBeNull();
    });

    it('returns relevant reflections after failures', async () => {
      // First, create some failures
      await provider.sync_turn(makeTurnData({
        turnNumber: 1,
        userMessage: 'process data with python',
        toolCalls: [{ name: 'python_execute', params: {}, result: 'OOM', success: false }],
        outcome: { resolved: false, toolChainLength: 1 },
      }));

      await provider.sync_turn(makeTurnData({
        turnNumber: 2,
        userMessage: 'read large file',
        toolCalls: [{ name: 'read_file', params: {}, result: 'timeout', success: false }],
        outcome: { resolved: false, toolChainLength: 1 },
      }));

      const result = await provider.searchReflections('python data');
      expect(result).not.toBeNull();
      expect(result!).toContain('历史失败反思');
      expect(result!).toContain('python_execute');
    });

    it('includes lesson and tryNextTime in output', async () => {
      await provider.sync_turn(makeTurnData({
        turnNumber: 3,
        userMessage: 'analyze memory usage',
        toolCalls: [
          { name: 'read_file', params: {}, result: 'ok', success: true },
          { name: 'python_execute', params: {}, result: 'OOM', success: false },
        ],
        outcome: { resolved: false, toolChainLength: 2 },
      }));

      const result = await provider.searchReflections('python memory');
      expect(result).not.toBeNull();
      expect(result!).toContain('**教训:**');
      expect(result!).toContain('**下次尝试:**');
    });
  });

  describe('deduplication', () => {
    it('does not create duplicate reflections for similar failures', async () => {
      // Two failures with same tool chain
      await provider.sync_turn(makeTurnData({
        turnNumber: 1,
        userMessage: 'process data',
        toolCalls: [{ name: 'python_execute', params: {}, result: 'error1', success: false }],
        outcome: { resolved: false, toolChainLength: 1 },
      }));

      await provider.sync_turn(makeTurnData({
        turnNumber: 2,
        userMessage: 'process data again',
        toolCalls: [{ name: 'python_execute', params: {}, result: 'error2', success: false }],
        outcome: { resolved: false, toolChainLength: 1 },
      }));

      const memDir = path.join(agentDir, 'patterns', 'episodic-memory');
      const files = fs.readdirSync(memDir).filter(f => f.endsWith('.json') && f.startsWith('reflection-'));
      // Should have 1 reflection file (turn-1) + index file = only 1 reflection-*.json
      expect(files.length).toBe(1);
    });
  });

  describe('pruneExpiredReflections', () => {
    it('removes expired reflections from the in-memory index', () => {
      const memDir = path.join(agentDir, 'patterns', 'episodic-memory');
      const expiredId = 'reflection-expired';
      const entry = {
        id: expiredId,
        turnId: 'turn-999',
        timestamp: new Date(Date.now() - 60 * 86400000).toISOString(),
        scene: 'old',
        toolChain: ['old_tool'],
        failureReason: 'old error',
        reflection: { whatWentWrong: 'x', tryNextTime: 'y', lesson: 'z' },
        tags: ['old'],
        ttl: new Date(Date.now() - 1000).toISOString(),
        usedCount: 0,
      };
      fs.writeFileSync(path.join(memDir, `${expiredId}.json`), JSON.stringify(entry));

      const indexPath = path.join(memDir, 'reflection-index.jsonl');
      fs.writeFileSync(indexPath, JSON.stringify(entry) + '\n');

      provider = new PatternProvider(agentDir);
      (provider as any).pruneExpiredReflections();

      // Check the in-memory index no longer contains the expired entry
      const index = (provider as any).reflectionIndex as Array<{ id: string }>;
      expect(index.some(e => e.id === 'reflection-expired')).toBe(false);
    });
  });

  describe('prefetch - combined patterns + reflections', () => {
    it('returns both patterns and reflections when both exist', async () => {
      // Success → pattern
      await provider.sync_turn(makeTurnData({
        turnNumber: 1,
        toolCalls: [
          { name: 'read_file', params: {}, result: 'ok', success: true },
          { name: 'write_file', params: {}, result: 'ok', success: true },
        ],
        outcome: { resolved: true, toolChainLength: 2 },
      }));

      // Failure → reflection
      await provider.sync_turn(makeTurnData({
        turnNumber: 2,
        userMessage: 'run python analysis',
        toolCalls: [{ name: 'python_execute', params: {}, result: 'error', success: false }],
        outcome: { resolved: false, toolChainLength: 1 },
      }));

      const result = await provider.prefetch('read write');
      expect(result).not.toBeNull();
      expect(result!).toContain('Relevant Patterns');
      expect(result!).toContain('read_file');
      // 新格式：显示原则而非统计数据
      expect(result!).not.toMatch(/成功率/);
    });
  });
});
