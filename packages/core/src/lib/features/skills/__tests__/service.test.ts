import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { getSkillContent } from '../service';
import { getMonorepoRoot, setMonorepoRoot } from '../../../paths';

describe('Skill feature service', () => {
  it('materializes bundled skill content from Electron resources before returning content', () => {
    const originalRoot = getMonorepoRoot();
    const originalDataRoot = process.env.DATA_ROOT;
    const originalMonorepoRoot = process.env.MONOREPO_ROOT;
    const originalBundledDir = process.env.ORIGINOS_BUNDLED_SKILLS_DIR;
    const originalResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'originos-skill-service-'));
    const resourcesRoot = path.join(tempRoot, 'resources');
    const dataRoot = path.join(tempRoot, 'data');
    const skillDir = path.join(resourcesRoot, 'templates', 'skills', 'skill-creator-app');
    const workingDir = path.join(dataRoot, 'skills', 'skill-creator-app');

    mkdirSync(skillDir, { recursive: true });
    mkdirSync(workingDir, { recursive: true });
    writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: skill-creator-app',
        'code: skill-creator-app',
        'description: Skill creator bundled from resources',
        'originos-system: true',
        '---',
        '',
        'Packaged skill content.',
      ].join('\n'),
      'utf8',
    );

    try {
      setMonorepoRoot(path.join(tempRoot, 'missing-repo'));
      process.env.DATA_ROOT = dataRoot;
      delete process.env.MONOREPO_ROOT;
      delete process.env.ORIGINOS_BUNDLED_SKILLS_DIR;
      Object.defineProperty(process, 'resourcesPath', {
        value: resourcesRoot,
        configurable: true,
      });

      const result = getSkillContent({ name: 'skill-creator-app', includeFrontmatter: true });

      expect(result.content).toContain('Packaged skill content.');
      expect(result.baseDir).toBe(workingDir);
      expect(result.workingDir).toBe(workingDir);
      expect(result.frontmatter?.description).toBe('Skill creator bundled from resources');
      expect(result.frontmatter?.['originos-system']).toBe('true');
      expect(existsSync(path.join(workingDir, 'SKILL.md'))).toBe(true);
    } finally {
      setMonorepoRoot(originalRoot);
      if (originalDataRoot === undefined) {
        delete process.env.DATA_ROOT;
      } else {
        process.env.DATA_ROOT = originalDataRoot;
      }
      if (originalMonorepoRoot === undefined) {
        delete process.env.MONOREPO_ROOT;
      } else {
        process.env.MONOREPO_ROOT = originalMonorepoRoot;
      }
      if (originalBundledDir === undefined) {
        delete process.env.ORIGINOS_BUNDLED_SKILLS_DIR;
      } else {
        process.env.ORIGINOS_BUNDLED_SKILLS_DIR = originalBundledDir;
      }
      if (originalResourcesPath === undefined) {
        delete (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
      } else {
        Object.defineProperty(process, 'resourcesPath', {
          value: originalResourcesPath,
          configurable: true,
        });
      }
    }
  });
});
