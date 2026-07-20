import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArchivalMemory } from '../archival/archival-memory';
import { EnhancedPatternProvider } from '../session/enhanced-pattern-provider';
import {
  extractPrincipleFromToolResults,
  ingestPatternToArchival,
  ingestReflectionToArchival,
  migratePatternsToArchival,
} from '../index';
import fs from 'node:fs';
import path from 'node:path';

function makeTestDir(): string {
  const dir = path.join('/tmp', `pattern-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe('extractPrincipleFromToolResults', () => {
  it('extracts anti-pattern principle', () => {
    const result = extractPrincipleFromToolResults({
      toolChain: ['read_file', 'write_file', 'bash'],
      successRate: 30,
      avgToolCalls: 6,
      sampleCount: 3,
      lastScene: 'trying to process a file',
      lastThinking: '',
      lastResultSummaries: ['error: file not found'],
    }, true);
    expect(result).toContain('反模式');
    expect(result).toContain('成功率仅 30%');
    expect(result).toContain('工具链过长');
  });

  it('extracts positive pattern principle', () => {
    const result = extractPrincipleFromToolResults({
      toolChain: ['read_file', 'write_file'],
      successRate: 100,
      avgToolCalls: 2,
      sampleCount: 5,
      lastScene: 'creating a config file',
      lastThinking: '',
      lastResultSummaries: ['success: file written'],
    }, false);
    expect(result).toContain('适用场景');
    expect(result).toContain('推荐路径');
    expect(result).toContain('验证 5 次');
  });

  it('handles empty scene', () => {
    const result = extractPrincipleFromToolResults({
      toolChain: ['bash'],
      successRate: 80,
      avgToolCalls: 1,
      sampleCount: 1,
      lastScene: '',
      lastThinking: '',
      lastResultSummaries: [],
    }, false);
    expect(result).not.toContain('适用场景');
    expect(result).toContain('推荐路径');
  });
});

describe('ingestPatternToArchival', () => {
  let dir: string;
  let archival: ArchivalMemory;

  beforeEach(() => {
    dir = makeTestDir();
    archival = new ArchivalMemory(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('ingests a pattern', async () => {
    const id = await ingestPatternToArchival(archival, {
      toolChain: ['read_file', 'write_file'],
      successRate: 100,
      avgToolCalls: 2,
      sampleCount: 3,
      lastScene: 'file manipulation',
      lastThinking: '',
      lastResultSummaries: [],
    }, false);
    expect(id).toMatch(/^arch-/);
    expect(archival.count()).toBe(1);
  });

  it('ingests with correct tags', async () => {
    const id = await ingestPatternToArchival(archival, {
      toolChain: ['bash', 'read_file'],
      successRate: 50,
      avgToolCalls: 3,
      sampleCount: 2,
      lastScene: 'system command',
      lastThinking: '',
      lastResultSummaries: [],
    }, true);
    expect(id).toBeTruthy();
    const entries = archival.getAll();
    expect(entries[0].tags).toContain('anti-pattern');
    expect(entries[0].tags).toContain('bash');
  });
});

describe('ingestReflectionToArchival', () => {
  let dir: string;
  let archival: ArchivalMemory;

  beforeEach(() => {
    dir = makeTestDir();
    archival = new ArchivalMemory(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('ingests a reflection', async () => {
    const id = await ingestReflectionToArchival(archival, {
      scene: 'Failed to connect to database',
      toolChain: ['bash', 'read_file'],
      failureReason: 'Connection timeout',
      lesson: 'Check network before connecting',
      tryNextTime: 'Use connection pooling',
    });
    expect(id).toBeTruthy();
    expect(archival.count()).toBe(1);
    const entries = archival.getAll();
    expect(entries[0].tags).toContain('reflection');
  });
});

describe('migratePatternsToArchival', () => {
  let dir: string;
  let archival: ArchivalMemory;

  beforeEach(() => {
    dir = makeTestDir();
    archival = new ArchivalMemory(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('migrates registry.json patterns', async () => {
    const patternsDir = path.join(dir, 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    fs.writeFileSync(path.join(patternsDir, 'registry.json'), JSON.stringify({
      patterns: [
        {
          id: 'p1',
          toolChain: ['read_file', 'write_file'],
          triggerCondition: 'when editing files',
          effectiveness: { successRate: 90, avgToolCalls: 2, sampleCount: 3 },
          isAntiPattern: false,
        },
        {
          id: 'p2',
          toolChain: ['bash'],
          triggerCondition: 'anti pattern',
          effectiveness: { successRate: 20, avgToolCalls: 5, sampleCount: 2 },
          isAntiPattern: true,
        },
      ],
      lastAnalyzedTurn: 0,
      lastUpdated: Date.now(),
    }));

    const result = await migratePatternsToArchival(archival, dir);
    expect(result.patternsMigrated).toBe(2);
    expect(archival.count()).toBe(2);
  });

  it('migrates episodic-memory reflections', async () => {
    const episodicDir = path.join(dir, 'patterns', 'episodic-memory');
    fs.mkdirSync(episodicDir, { recursive: true });
    fs.writeFileSync(path.join(episodicDir, 'reflection-1.json'), JSON.stringify({
      scene: 'failed test',
      toolChain: ['bash', 'read_file'],
      failureReason: 'assertion failed',
      reflection: {
        lesson: 'Check assertions before running',
        tryNextTime: 'Use mock data',
      },
    }));

    const result = await migratePatternsToArchival(archival, dir);
    expect(result.reflectionsMigrated).toBe(1);
  });

  it('handles missing files gracefully', async () => {
    const result = await migratePatternsToArchival(archival, dir);
    expect(result.patternsMigrated).toBe(0);
    expect(result.reflectionsMigrated).toBe(0);
  });
});

describe('EnhancedPatternProvider', () => {
  let dir: string;
  let archival: ArchivalMemory;
  let provider: EnhancedPatternProvider;

  beforeEach(async () => {
    dir = makeTestDir();
    archival = new ArchivalMemory(dir);
    provider = new EnhancedPatternProvider(dir, archival);

    // Seed some patterns
    await archival.insert('read_file then write_file pattern for config files', ['pattern', 'read_file', 'write_file']);
    await archival.insert('bash command pattern for system ops', ['pattern', 'bash']);
    await archival.insert('Failed to connect to database', ['reflection', 'bash']);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('prefetch returns semantic results', async () => {
    const result = await provider.prefetch('config file');
    expect(result).not.toBeNull();
    expect(result).toContain('config');
  });

  it('searchReflections returns semantic results', async () => {
    const result = await provider.searchReflections('database connection');
    expect(result).not.toBeNull();
    expect(result).toContain('database');
  });

  it('prefetch returns low-score results for unmatched query (TF-IDF fallback)', async () => {
    const result = await provider.prefetch('xyznonexistent123abc');
    // TF-IDF fallback always returns something with low equal scores
    expect(result).not.toBeNull();
    expect(result).toContain('Relevant Patterns');
  });

  it('sync_turn writes to archival', async () => {
    await provider.sync_turn({
      toolChain: ['read_file'],
      successRate: 100,
      avgToolCalls: 1,
      sampleCount: 1,
      lastScene: 'reading a file',
      lastResultSummaries: ['success'],
    });
    expect(archival.count()).toBe(4);
  });

  it('sync_reflection writes to archival', async () => {
    await provider.sync_reflection({
      scene: 'timeout error',
      toolChain: ['bash'],
      failureReason: 'timeout',
      lesson: 'use retry',
      tryNextTime: 'add timeout handling',
    });
    expect(archival.count()).toBe(4);
  });
});
