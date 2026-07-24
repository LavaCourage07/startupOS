import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { getMonorepoRoot, setMonorepoRoot } from '../../../../paths';
import { SkillLauncher } from '../skill';

class TestSkillLauncher extends SkillLauncher {
  protected override async createOrRestoreSession(): Promise<{ sessionId: string; isNew: boolean }> {
    return { sessionId: 'test-session', isNew: true };
  }

  protected override async registerAgent(): Promise<string[]> {
    return [];
  }
}

describe('SkillLauncher', () => {
  it('falls back across bundled skill roots when an earlier root is present but incomplete', async () => {
    const originalRoot = getMonorepoRoot();
    const originalDataRoot = process.env.DATA_ROOT;
    const originalBundledDir = process.env.ORIGINOS_BUNDLED_SKILLS_DIR;
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'originos-skill-launcher-'));
    const emptyBundledRoot = path.join(tempRoot, 'empty-bundled-skills');
    const monorepoRoot = path.join(tempRoot, 'repo');
    const dataRoot = path.join(tempRoot, 'data');
    const bundledSkillDir = path.join(monorepoRoot, 'templates', 'skills', 'skill-creator-app');
    mkdirSync(emptyBundledRoot, { recursive: true });
    mkdirSync(bundledSkillDir, { recursive: true });
    writeFileSync(
      path.join(bundledSkillDir, 'SKILL.md'),
      [
        '---',
        'name: skill-creator-app',
        'description: Bundled fallback skill',
        '---',
        '',
        'Create a skill.',
      ].join('\n'),
      'utf8',
    );

    try {
      setMonorepoRoot(monorepoRoot);
      process.env.DATA_ROOT = dataRoot;
      process.env.ORIGINOS_BUNDLED_SKILLS_DIR = emptyBundledRoot;

      const launcher = new TestSkillLauncher();
      const result = await launcher.launch({
        entryId: 'skill-creator-app',
        entryType: 'skill',
      });

      expect(result.success).toBe(true);
      expect(result.systemPrompt).toContain(`Skill source directory: ${bundledSkillDir}`);
      expect(result.systemPrompt).toContain('Create a skill.');
    } finally {
      setMonorepoRoot(originalRoot);
      if (originalDataRoot === undefined) {
        delete process.env.DATA_ROOT;
      } else {
        process.env.DATA_ROOT = originalDataRoot;
      }
      if (originalBundledDir === undefined) {
        delete process.env.ORIGINOS_BUNDLED_SKILLS_DIR;
      } else {
        process.env.ORIGINOS_BUNDLED_SKILLS_DIR = originalBundledDir;
      }
    }
  });

  it('loads bundled template skills without copying definitions into data skills', async () => {
    const originalRoot = getMonorepoRoot();
    const originalDataRoot = process.env.DATA_ROOT;
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'originos-skill-launcher-'));
    const monorepoRoot = path.join(tempRoot, 'repo');
    const dataRoot = path.join(tempRoot, 'data');
    const bundledSkillDir = path.join(monorepoRoot, 'templates', 'skills', 'windows-skill');
    mkdirSync(bundledSkillDir, { recursive: true });
    writeFileSync(
      path.join(bundledSkillDir, 'SKILL.md'),
      [
        '---',
        'name: windows-skill',
        'description: Windows path skill',
        '---',
        '',
        'Write artifacts to ${OUTPUT_DIR}.',
      ].join('\n'),
      'utf8',
    );

    try {
      setMonorepoRoot(monorepoRoot);
      process.env.DATA_ROOT = dataRoot;

      const launcher = new TestSkillLauncher();
      const result = await launcher.launch({
        entryId: 'windows-skill',
        entryType: 'skill',
      });
      const expectedWorkingDir = path.join(dataRoot, 'skills', 'windows-skill');

      expect(result.success).toBe(true);
      expect(result.baseDir).toBe(expectedWorkingDir);
      expect(result.systemPrompt).toContain(`Skill source directory: ${bundledSkillDir}`);
      expect(result.systemPrompt).toContain(`Write artifacts to ${expectedWorkingDir}.`);
      expect(result.systemPrompt).not.toContain('${OUTPUT_DIR}');
      expect(result.systemPrompt).not.toContain('/workspace');
      expect(existsSync(path.join(expectedWorkingDir, 'SKILL.md'))).toBe(false);
    } finally {
      setMonorepoRoot(originalRoot);
      if (originalDataRoot === undefined) {
        delete process.env.DATA_ROOT;
      } else {
        process.env.DATA_ROOT = originalDataRoot;
      }
    }
  });

  it('never injects MSYS-style paths (/workspace, /c/) into the system prompt', async () => {
    const originalRoot = getMonorepoRoot();
    const originalDataRoot = process.env.DATA_ROOT;
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'originos-skill-launcher-'));
    const monorepoRoot = path.join(tempRoot, 'repo');
    const dataRoot = path.join(tempRoot, 'data');
    const bundledSkillDir = path.join(monorepoRoot, 'templates', 'skills', 'windows-skill');
    mkdirSync(bundledSkillDir, { recursive: true });
    writeFileSync(
      path.join(bundledSkillDir, 'SKILL.md'),
      [
        '---',
        'name: windows-skill',
        'description: Windows path skill',
        'outputDir: data/',
        '---',
        '',
        'Write artifacts to ${OUTPUT_DIR}.',
      ].join('\n'),
      'utf8',
    );

    try {
      setMonorepoRoot(monorepoRoot);
      process.env.DATA_ROOT = dataRoot;

      const launcher = new TestSkillLauncher();
      const result = await launcher.launch({
        entryId: 'windows-skill',
        entryType: 'skill',
      });
      const expectedWorkingDir = path.join(dataRoot, 'skills', 'windows-skill');

      expect(result.success).toBe(true);
      // baseDir 指向 data/skills/{code}，而非 MSYS 根 /workspace
      expect(result.baseDir).toBe(expectedWorkingDir);
      expect(result.baseDir).not.toContain('/workspace');
      // ${OUTPUT_DIR} 必须被替换为真实路径，不能留空（曾导致 Agent 报"输出目录未设置"）
      expect(result.systemPrompt).not.toContain('${OUTPUT_DIR}');
      // outputDir 未声明 frontmatter 时默认等于 workingDir，此处 frontmatter
      // 是 data/ → resolveOutputDirFromFrontmatter('data/') = getDataRoot()
      expect(result.systemPrompt).toContain(dataRoot);
      // 黑名单：system prompt 不得含 MSYS 风格路径
      expect(result.systemPrompt).not.toContain('/workspace');
      expect(result.systemPrompt).not.toMatch(/\/c\//);
      expect(result.systemPrompt).not.toContain('MSYS');
    } finally {
      setMonorepoRoot(originalRoot);
      if (originalDataRoot === undefined) {
        delete process.env.DATA_ROOT;
      } else {
        process.env.DATA_ROOT = originalDataRoot;
      }
    }
  });
});
