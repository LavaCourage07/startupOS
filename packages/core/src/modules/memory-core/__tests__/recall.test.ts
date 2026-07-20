import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RecallMemory } from '../recall/recall-memory';
import fs from 'node:fs';
import path from 'node:path';

function makeTestDir(): string {
  const dir = path.join('/tmp', `recall-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe('RecallMemory', () => {
  let dir: string;
  let recall: RecallMemory;

  beforeEach(() => {
    dir = makeTestDir();
    recall = new RecallMemory(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('recordTurn', () => {
    it('records a turn', () => {
      recall.recordTurn({
        turnNumber: 1,
        userMessage: 'How do I write a for loop in Python?',
        assistantMessage: 'Use the "for" keyword...',
      });
      const entries = (recall as any).entries;
      expect(entries).toHaveLength(1);
      expect(entries[0].turnNumber).toBe(1);
    });

    it('appends to history.jsonl', () => {
      recall.recordTurn({
        turnNumber: 1,
        userMessage: 'test message',
      });
      const historyPath = path.join(dir, 'memory', 'history', 'default.jsonl');
      expect(fs.existsSync(historyPath)).toBe(true);
      const content = fs.readFileSync(historyPath, 'utf-8');
      expect(content).toContain('test message');
    });
  });

  describe('searchKeyword', () => {
    it('returns ranked keyword matches', () => {
      recall.recordTurn({
        turnNumber: 1,
        userMessage: 'How to create a database connection in Python?',
      });
      recall.recordTurn({
        turnNumber: 2,
        userMessage: 'What is the weather today?',
      });
      recall.recordTurn({
        turnNumber: 3,
        userMessage: 'Python database connection pooling best practices',
      });

      const results = recall.searchKeyword('Python database', 2);
      expect(results).toHaveLength(2);
      expect(results[0].turnNumber).toBe(1);
    });
  });

  describe('Dream cursor', () => {
    it('get/set dream cursor', () => {
      expect(recall.getDreamCursor()).toBe(0);
      recall.setDreamCursor(42);
      expect(recall.getDreamCursor()).toBe(42);
    });

    it('cursor persists to disk', () => {
      recall.setDreamCursor(100);
      const recall2 = new RecallMemory(dir);
      expect(recall2.getDreamCursor()).toBe(100);
    });

    it('readRecentHistory returns entries since cursor', () => {
      recall.recordTurn({ turnNumber: 1, userMessage: 'first' });
      recall.recordTurn({ turnNumber: 2, userMessage: 'second' });
      recall.recordTurn({ turnNumber: 3, userMessage: 'third' });
      recall.setDreamCursor(2);

      const history = recall.readRecentHistory(2);
      expect(history).toContain('second');
      expect(history).toContain('third');
      expect(history).not.toContain('first');
    });
  });
});
