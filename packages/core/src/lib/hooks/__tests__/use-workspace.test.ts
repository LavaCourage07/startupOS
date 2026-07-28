import { describe, expect, it } from 'vitest';
import { mapProjectFile } from '../use-workspace';

describe('workspace file mapping', () => {
  it('normalizes Windows paths before computing file tree parent paths', () => {
    const file = mapProjectFile(
      'skill-role-agent-creator',
      'C:\\Users\\admin\\AppData\\Roaming\\@originos\\desktop\\data\\skills\\role-agent-creator',
      'C:\\Users\\admin\\AppData\\Roaming\\@originos\\desktop\\data\\skills\\role-agent-creator\\agents\\atlas-architect\\Agent.md',
      false,
      128,
      '2026-07-25T00:00:00.000Z',
      '2026-07-25T00:00:00.000Z',
    );

    expect(file.path).toBe('agents/atlas-architect/Agent.md');
    expect(file.name).toBe('Agent.md');
    expect(file.parentPath).toBe('agents/atlas-architect');
  });
});
