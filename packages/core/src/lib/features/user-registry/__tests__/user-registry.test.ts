import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { listUserSkills } from '../index';

describe('user registry skills', () => {
  it('filters materialized system skills from user skill list', () => {
    const originalDataRoot = process.env.DATA_ROOT;
    const dataRoot = mkdtempSync(path.join(tmpdir(), 'originos-user-registry-'));
    const skillsDir = path.join(dataRoot, 'skills');
    const systemSkillDir = path.join(skillsDir, 'skill-creator-app');
    const userSkillDir = path.join(skillsDir, 'my-skill');

    mkdirSync(systemSkillDir, { recursive: true });
    mkdirSync(userSkillDir, { recursive: true });
    writeFileSync(
      path.join(systemSkillDir, 'skill.md'),
      [
        '---',
        'name: skill-creator-app',
        'description: Built-in skill',
        'originos-system: TRUE',
        '---',
        '',
      ].join('\r\n'),
      'utf8',
    );
    writeFileSync(
      path.join(userSkillDir, 'SKILL.md'),
      [
        '---',
        'name: my-skill',
        'description: User skill',
        '---',
        '',
      ].join('\n'),
      'utf8',
    );

    try {
      process.env.DATA_ROOT = dataRoot;

      const skills = listUserSkills();

      expect(skills.map((skill) => skill.id)).toEqual(['my-skill']);
    } finally {
      if (originalDataRoot === undefined) {
        delete process.env.DATA_ROOT;
      } else {
        process.env.DATA_ROOT = originalDataRoot;
      }
    }
  });

  it('filters skills whose directory or code belongs to bundled templates', () => {
    const originalDataRoot = process.env.DATA_ROOT;
    const originalBundledSkillsDir = process.env.ORIGINOS_BUNDLED_SKILLS_DIR;
    const dataRoot = mkdtempSync(path.join(tmpdir(), 'originos-user-registry-'));
    const bundledRoot = mkdtempSync(path.join(tmpdir(), 'originos-bundled-skills-'));
    const skillsDir = path.join(dataRoot, 'skills');
    const bundledSkillDir = path.join(bundledRoot, 'legacy-template');
    const materializedSkillDir = path.join(skillsDir, 'legacy-template');
    const userSkillDir = path.join(skillsDir, 'real-user-skill');

    mkdirSync(bundledSkillDir, { recursive: true });
    mkdirSync(materializedSkillDir, { recursive: true });
    mkdirSync(userSkillDir, { recursive: true });

    writeFileSync(
      path.join(bundledSkillDir, 'SKILL.md'),
      [
        '---',
        'name: legacy-template',
        'description: Bundled template skill',
        '---',
        '',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      path.join(materializedSkillDir, 'SKILL.md'),
      [
        '---',
        'name: legacy-template',
        'description: Old materialized copy without system marker',
        '---',
        '',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      path.join(userSkillDir, 'SKILL.md'),
      [
        '---',
        'name: real-user-skill',
        'description: Real user skill',
        '---',
        '',
      ].join('\n'),
      'utf8',
    );

    try {
      process.env.DATA_ROOT = dataRoot;
      process.env.ORIGINOS_BUNDLED_SKILLS_DIR = bundledRoot;

      const skills = listUserSkills();

      expect(skills.map((skill) => skill.id)).toEqual(['real-user-skill']);
    } finally {
      if (originalDataRoot === undefined) {
        delete process.env.DATA_ROOT;
      } else {
        process.env.DATA_ROOT = originalDataRoot;
      }
      if (originalBundledSkillsDir === undefined) {
        delete process.env.ORIGINOS_BUNDLED_SKILLS_DIR;
      } else {
        process.env.ORIGINOS_BUNDLED_SKILLS_DIR = originalBundledSkillsDir;
      }
      rmSync(dataRoot, { recursive: true, force: true });
      rmSync(bundledRoot, { recursive: true, force: true });
    }
  });
});
