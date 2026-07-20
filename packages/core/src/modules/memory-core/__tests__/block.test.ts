import { describe, it, expect } from 'vitest';
import {
  createBlock,
  validateBlock,
  toLegacyBlock,
  fromLegacyBlock,
  serializeBlock,
  deserializeBlock,
  DEFAULT_BLOCKS,
  type Block,
} from '../core/block';

describe('Block', () => {
  describe('createBlock', () => {
    it('creates a block from definition', () => {
      const block = createBlock(DEFAULT_BLOCKS[0]);
      expect(block.label).toBe('human');
      expect(block.value).toBe('');
      expect(block.limit).toBe(2000);
      expect(block.readOnly).toBe(false);
      expect(block.namespace).toBe('system');
      expect(block.version).toBe(1);
      expect(block.tags).toEqual([]);
      expect(block.createdAt).toBeGreaterThan(0);
      expect(block.id).toMatch(/^block-/);
    });

    it('creates with initial value', () => {
      const block = createBlock(DEFAULT_BLOCKS[0], 'test content');
      expect(block.value).toBe('test content');
    });

    it('creates readOnly block when specified', () => {
      const block = createBlock(DEFAULT_BLOCKS[4]); // temporal
      expect(block.readOnly).toBe(true);
    });
  });

  describe('validateBlock', () => {
    it('returns null for valid block', () => {
      const block = createBlock(DEFAULT_BLOCKS[0], 'valid content');
      expect(validateBlock(block)).toBeNull();
    });

    it('rejects empty label', () => {
      const block = createBlock(DEFAULT_BLOCKS[0], 'content');
      block.label = '';
      expect(validateBlock(block)).toBe('Block label must not be empty');
    });

    it('rejects value exceeding limit', () => {
      const block = createBlock(DEFAULT_BLOCKS[0], 'x'.repeat(2001));
      expect(validateBlock(block)).toContain('exceeds limit');
    });

    it('rejects non-positive limit', () => {
      const block = createBlock(DEFAULT_BLOCKS[0]); // empty value
      block.limit = 0;
      expect(validateBlock(block)).toBe('Block limit must be positive');
    });
  });

  describe('toLegacyBlock', () => {
    it('converts new Block to legacy format', () => {
      const block = createBlock(DEFAULT_BLOCKS[0], 'content');
      const legacy = toLegacyBlock(block);
      expect(legacy.label).toBe('human');
      expect(legacy.value).toBe('content');
      expect(legacy.limit).toBe(2000);
      expect(legacy.readOnly).toBe(false);
      // Legacy does not have id, tags, namespace, version, timestamps
      expect(legacy).not.toHaveProperty('id');
      expect(legacy).not.toHaveProperty('tags');
      expect(legacy).not.toHaveProperty('namespace');
      expect(legacy).not.toHaveProperty('version');
    });
  });

  describe('fromLegacyBlock', () => {
    it('converts legacy Block to new format', () => {
      const legacy = {
        label: 'test',
        value: 'content',
        limit: 1000,
        description: 'test block',
        metadata: {},
        readOnly: false,
      };
      const block = fromLegacyBlock(legacy);
      expect(block.label).toBe('test');
      expect(block.value).toBe('content');
      expect(block.limit).toBe(1000);
      expect(block.tags).toEqual([]);
      expect(block.version).toBe(1);
      expect(block.createdAt).toBeGreaterThan(0);
    });

    it('applies overrides', () => {
      const legacy = {
        label: 'test',
        value: 'content',
        limit: 1000,
        description: 'test block',
        metadata: {},
        readOnly: false,
      };
      const block = fromLegacyBlock(legacy, {
        tags: ['system'],
        namespace: 'system',
        version: 3,
      });
      expect(block.tags).toEqual(['system']);
      expect(block.namespace).toBe('system');
      expect(block.version).toBe(3);
    });
  });

  describe('serialize / deserialize', () => {
    it('roundtrips a block through serialization', () => {
      const original = createBlock(DEFAULT_BLOCKS[0], 'persisted content');
      const serialized = serializeBlock(original);
      const restored = deserializeBlock(serialized);

      expect(restored.id).toBe(original.id);
      expect(restored.label).toBe(original.label);
      expect(restored.value).toBe(original.value);
      expect(restored.limit).toBe(original.limit);
      expect(restored.tags).toEqual(original.tags);
      expect(restored.namespace).toBe(original.namespace);
      expect(restored.version).toBe(original.version);
      expect(restored.readOnly).toBe(original.readOnly);
    });
  });

  describe('DEFAULT_BLOCKS', () => {
    it('has exactly 5 default blocks', () => {
      expect(DEFAULT_BLOCKS).toHaveLength(5);
    });

    it('has the expected labels', () => {
      const labels = DEFAULT_BLOCKS.map((b) => b.label);
      expect(labels).toContain('human');
      expect(labels).toContain('persona');
      expect(labels).toContain('project');
      expect(labels).toContain('scratchpad');
      expect(labels).toContain('temporal');
    });

    it('temporal block is read-only', () => {
      const temporal = DEFAULT_BLOCKS.find((b) => b.label === 'temporal');
      expect(temporal?.readOnly).toBe(true);
    });

    it('all blocks have namespace', () => {
      DEFAULT_BLOCKS.forEach((b) => {
        expect(b.namespace).toBe('system');
      });
    });
  });
});
