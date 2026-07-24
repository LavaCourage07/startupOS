import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
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
      path.join(systemSkillDir, 'SKILL.md'),
      [
        '---',
        'name: skill-creator-app',
        'description: Built-in skill',
        'originos-system: true',
        '---',
        '',
      ].join('\n'),
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
});
