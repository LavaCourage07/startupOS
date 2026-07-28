import AdmZip from 'adm-zip';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcHandle, showItemInFolder } = vi.hoisted(() => ({
  ipcHandle: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: { handle: ipcHandle },
  shell: { showItemInFolder },
}));

import { IPC_CHANNELS } from '../../ipc-protocol';
import {
  EntryExportService,
  exportEntryDirectory,
  handleEntryExport,
} from '../entry-export-service';

describe('entry export service', () => {
  let dataRoot: string;

  beforeEach(async () => {
    dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'originos-entry-export-'));
    ipcHandle.mockReset();
    showItemInFolder.mockReset();
  });

  afterEach(async () => {
    await fs.rm(dataRoot, { recursive: true, force: true });
  });

  async function createSkillFixture(): Promise<string> {
    const sourceDirectory = path.join(dataRoot, 'skills', 'candidate-evaluator');
    await fs.mkdir(path.join(sourceDirectory, 'output', 'empty'), { recursive: true });
    await fs.writeFile(path.join(sourceDirectory, 'SKILL.md'), '# Candidate evaluator');
    await fs.writeFile(path.join(sourceDirectory, 'output', '候选人报告.md'), 'report body');
    return sourceDirectory;
  }

  it('creates a ZIP with nested files, unicode names, and empty directories', async () => {
    const sourceDirectory = await createSkillFixture();
    const revealItem = vi.fn();

    const result = await exportEntryDirectory(
      { entryType: 'skill', entryId: 'candidate-evaluator' },
      { dataRoot, revealItem },
    );

    expect(result.zipPath).toBe(`${sourceDirectory}.zip`);
    expect(revealItem).toHaveBeenCalledWith(result.zipPath);

    const zip = new AdmZip(result.zipPath);
    const entries = zip.getEntries();
    expect(entries.map((entry) => entry.entryName)).toEqual(expect.arrayContaining([
      'SKILL.md',
      'output/候选人报告.md',
      'output/empty/',
    ]));
    expect(zip.readAsText('output/候选人报告.md')).toBe('report body');
    expect(entries.some((entry) => entry.entryName.includes('.tmp'))).toBe(false);
  });

  it('replaces an existing ZIP and leaves no temporary files', async () => {
    const sourceDirectory = await createSkillFixture();
    const targetPath = `${sourceDirectory}.zip`;
    await fs.writeFile(targetPath, 'old archive');

    await exportEntryDirectory(
      { entryType: 'skill', entryId: 'candidate-evaluator' },
      { dataRoot, revealItem: vi.fn() },
    );

    expect(new AdmZip(targetPath).readAsText('SKILL.md')).toBe('# Candidate evaluator');
    const siblingNames = await fs.readdir(path.dirname(sourceDirectory));
    expect(siblingNames.filter((name) => name.includes('.tmp') || name.includes('.bak'))).toEqual([]);
  });

  it('preserves the previous ZIP and cleans temporary files when compression fails', async () => {
    const sourceDirectory = await createSkillFixture();
    const targetPath = `${sourceDirectory}.zip`;
    await fs.writeFile(targetPath, 'previous archive');

    await expect(exportEntryDirectory(
      { entryType: 'skill', entryId: 'candidate-evaluator' },
      {
        dataRoot,
        revealItem: vi.fn(),
        archiveEntry: async (_source, tempPath) => {
          await fs.writeFile(tempPath, 'partial archive');
          throw new Error('compression failed');
        },
      },
    )).rejects.toMatchObject({ code: 'EXPORT_FAILED' });

    expect(await fs.readFile(targetPath, 'utf8')).toBe('previous archive');
    const siblingNames = await fs.readdir(path.dirname(sourceDirectory));
    expect(siblingNames.filter((name) => name.includes('.tmp') || name.includes('.bak'))).toEqual([]);
  });

  it('returns stable error codes for invalid and missing entries', async () => {
    await expect(exportEntryDirectory(
      { entryType: 'skill', entryId: '../escape' },
      { dataRoot },
    )).rejects.toMatchObject({ code: 'INVALID_ENTRY_ID' });

    await expect(exportEntryDirectory(
      { entryType: 'agent', entryId: 'missing' },
      { dataRoot },
    )).rejects.toMatchObject({ code: 'ENTRY_NOT_FOUND' });
  });

  it('refuses to export a built-in skill identified by SKILL.md metadata', async () => {
    const sourceDirectory = path.join(dataRoot, 'skills', 'system-skill');
    await fs.mkdir(sourceDirectory, { recursive: true });
    await fs.writeFile(
      path.join(sourceDirectory, 'SKILL.md'),
      ['---', 'name: system-skill', 'originos-system: true', '---', '# System skill'].join('\n'),
    );

    await expect(exportEntryDirectory(
      { entryType: 'skill', entryId: 'system-skill' },
      { dataRoot, revealItem: vi.fn() },
    )).rejects.toMatchObject({
      code: 'EXPORT_NOT_ALLOWED',
      message: 'Built-in skills cannot be exported',
    });
    await expect(fs.stat(`${sourceDirectory}.zip`)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('returns a distinct reveal error after the ZIP was created', async () => {
    const sourceDirectory = await createSkillFixture();
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await handleEntryExport(
      { entryType: 'skill', entryId: 'candidate-evaluator' },
      {
        dataRoot,
        revealItem: () => {
          throw new Error('shell unavailable');
        },
      },
    );

    expect(response).toMatchObject({
      success: false,
      error: {
        code: 'REVEAL_FAILED',
        details: { zipPath: `${sourceDirectory}.zip` },
      },
    });
    await expect(fs.stat(`${sourceDirectory}.zip`)).resolves.toBeDefined();
    expect(errorLog).toHaveBeenCalled();
  });

  it('returns a structured success response and reveals the exported ZIP', async () => {
    const sourceDirectory = await createSkillFixture();
    const revealItem = vi.fn();

    const response = await handleEntryExport(
      { entryType: 'skill', entryId: 'candidate-evaluator' },
      { dataRoot, revealItem },
    );

    expect(response).toMatchObject({
      success: true,
      data: { zipPath: `${sourceDirectory}.zip` },
    });
    expect(revealItem).toHaveBeenCalledWith(`${sourceDirectory}.zip`);
  });

  it('registers the IPC handler and returns a structured error response', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    new EntryExportService();

    expect(ipcHandle).toHaveBeenCalledWith(IPC_CHANNELS.ENTRY_EXPORT, expect.any(Function));
    const handler = ipcHandle.mock.calls[0]?.[1] as (
      event: unknown,
      request: { entryType: 'skill'; entryId: string },
    ) => Promise<unknown>;

    const response = await handler(
      {},
      { entryType: 'skill', entryId: '../invalid' },
    );

    expect(response).toMatchObject({
      success: false,
      error: { code: 'INVALID_ENTRY_ID' },
    });
    expect(errorLog).toHaveBeenCalled();
  });
});
