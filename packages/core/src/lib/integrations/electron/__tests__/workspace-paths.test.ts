import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  assertRealPathWithin,
  assertSafeWorkspaceFileName,
  assertWorkspacePathCanBeCreated,
  isPathWithin,
  resolveWorkspaceBasePath,
  writeWorkspaceUploadFile,
} from '../workspace-paths';

describe('workspace paths', () => {
  const windowsDataRoot = 'C:\\Users\\admin\\AppData\\Roaming\\@originos\\desktop\\data';
  const windowsMonorepoRoot = 'K:\\originos\\OriginOS CE\\resources\\app.asar';

  it('resolves forward-slash data paths against the Windows data root', () => {
    expect(
      resolveWorkspaceBasePath('data/agents/product-manager', {
        dataRoot: windowsDataRoot,
        monorepoRoot: windowsMonorepoRoot,
        pathImplementation: path.win32,
      }),
    ).toBe(`${windowsDataRoot}\\agents\\product-manager`);
  });

  it('resolves backslash data paths against the Windows data root', () => {
    expect(
      resolveWorkspaceBasePath('data\\agents\\product-manager', {
        dataRoot: windowsDataRoot,
        monorepoRoot: windowsMonorepoRoot,
        pathImplementation: path.win32,
      }),
    ).toBe(`${windowsDataRoot}\\agents\\product-manager`);
  });

  it('rejects traversal outside the Windows data root', () => {
    const resolved = resolveWorkspaceBasePath('data/../outside', {
      dataRoot: windowsDataRoot,
      monorepoRoot: windowsMonorepoRoot,
      pathImplementation: path.win32,
    });

    expect(
      isPathWithin(resolved, windowsDataRoot, {
        pathImplementation: path.win32,
        caseInsensitive: true,
      }),
    ).toBe(false);
  });

  it('accepts data roots with a trailing separator', () => {
    expect(
      isPathWithin(
        `${windowsDataRoot}\\agents\\product-manager`,
        `${windowsDataRoot}\\`,
        {
          pathImplementation: path.win32,
        },
      ),
    ).toBe(true);
  });

  it('uses strict case comparison by default', () => {
    expect(
      isPathWithin(
        'c:\\users\\ADMIN\\appdata\\roaming\\@originos\\desktop\\data\\agents\\product-manager',
        windowsDataRoot,
        { pathImplementation: path.win32 },
      ),
    ).toBe(false);
  });

  it.each([
    '',
    '.',
    '..',
    '../secret.txt',
    'nested/file.txt',
    'nested\\file.txt',
    'report.txt:secret',
    'CON',
    'nul.txt',
    'report.txt.',
    'report.txt ',
  ])('rejects unsafe upload file name %j', (fileName) => {
    expect(() => assertSafeWorkspaceFileName(fileName)).toThrow();
  });

  it('accepts a normal upload file name', () => {
    expect(() => assertSafeWorkspaceFileName('需求说明 v2.pdf')).not.toThrow();
  });

  it('rejects a workspace junction or symlink that resolves outside the data root', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'originos-workspace-paths-'));
    const dataRoot = path.join(tempRoot, 'data');
    const outsideRoot = path.join(tempRoot, 'outside');
    const linkedWorkspace = path.join(dataRoot, 'agents', 'linked-agent');
    await fs.mkdir(path.dirname(linkedWorkspace), { recursive: true });
    await fs.mkdir(outsideRoot, { recursive: true });
    await fs.symlink(outsideRoot, linkedWorkspace, process.platform === 'win32' ? 'junction' : 'dir');

    await expect(assertRealPathWithin(linkedWorkspace, [dataRoot])).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('rejects a missing workspace below a junction before creating outside directories', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'originos-workspace-create-'));
    const dataRoot = path.join(tempRoot, 'data');
    const outsideRoot = path.join(tempRoot, 'outside');
    const linkedAgents = path.join(dataRoot, 'agents');
    const requestedWorkspace = path.join(linkedAgents, 'new-agent');
    await fs.mkdir(dataRoot, { recursive: true });
    await fs.mkdir(outsideRoot, { recursive: true });
    await fs.symlink(outsideRoot, linkedAgents, process.platform === 'win32' ? 'junction' : 'dir');

    await expect(
      assertWorkspacePathCanBeCreated(requestedWorkspace, [dataRoot]),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(fs.stat(path.join(outsideRoot, 'new-agent'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('creates a unique upload without following an existing hard link', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'originos-workspace-write-'));
    const workspace = path.join(tempRoot, 'data', 'agents', 'agent-a');
    const outsideFile = path.join(tempRoot, 'outside.txt');
    const linkedFile = path.join(workspace, 'report.txt');
    await fs.mkdir(workspace, { recursive: true });
    await fs.writeFile(outsideFile, 'outside');
    await fs.link(outsideFile, linkedFile);

    const result = await writeWorkspaceUploadFile(
      workspace,
      'report.txt',
      Buffer.from('uploaded'),
    );

    expect(result.fileName).toBe('report (1).txt');
    await expect(fs.readFile(outsideFile, 'utf8')).resolves.toBe('outside');
    await expect(fs.readFile(result.fullPath, 'utf8')).resolves.toBe('uploaded');
    await fs.rm(tempRoot, { recursive: true, force: true });
  });
});
