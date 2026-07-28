import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveExportableEntryDirectory,
} from '../entry-paths';

describe('resolveExportableEntryDirectory', () => {
  const dataRoot = path.resolve('test-data');

  it.each([
    ['skill', 'example', path.join(dataRoot, 'skills', 'example')],
    ['agent', 'example', path.join(dataRoot, 'agents', 'example')],
    ['role-agent', 'example', path.join(dataRoot, 'agents', 'example')],
  ] as const)('maps %s entries to the expected data collection', (entryType, entryId, expected) => {
    expect(resolveExportableEntryDirectory(entryType, entryId, dataRoot)).toBe(expected);
  });

  it.each([
    ['', 'example'],
    ['project', 'example'],
    ['skill', ''],
    ['skill', ' example'],
    ['skill', '.'],
    ['skill', '..'],
    ['skill', '../example'],
    ['skill', 'nested/example'],
    ['skill', 'nested\\example'],
    ['skill', '/absolute'],
  ])('rejects unsafe request type=%s id=%s', (entryType, entryId) => {
    expect(() => resolveExportableEntryDirectory(entryType, entryId, dataRoot)).toThrow();
  });
});
