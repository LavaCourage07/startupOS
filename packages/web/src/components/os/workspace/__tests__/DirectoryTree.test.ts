import { describe, expect, it } from 'vitest';
import type { ProjectFile } from '@originos/core/types';
import { normalizeFilesForTree } from '../DirectoryTree';

describe('DirectoryTree', () => {
  it('synthesizes missing folders from nested file paths', () => {
    const files: ProjectFile[] = [
      {
        id: 'agent-md',
        projectId: 'role-agent-creator',
        path: 'agents\\atlas-architect\\Agent.md',
        name: 'Agent.md',
        size: 128,
        createdAt: 1,
        modifiedAt: 1,
        type: 'file',
        extension: 'md',
      },
    ];

    const treeFiles = normalizeFilesForTree(files);

    expect(treeFiles.map((file) => file.path).sort()).toEqual([
      'agents',
      'agents/atlas-architect',
      'agents/atlas-architect/Agent.md',
    ]);
    expect(treeFiles.find((file) => file.path === 'agents/atlas-architect/Agent.md')?.parentPath)
      .toBe('agents/atlas-architect');
  });
});
