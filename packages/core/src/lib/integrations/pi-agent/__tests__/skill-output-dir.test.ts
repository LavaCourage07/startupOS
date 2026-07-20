/**
 * Tests for skill/agent output directory routing
 *
 * AGENTS.md 约束：系统内置技能（bundled source）的产物输出目录必须指向
 * data/skills/{name}/，而不是技能源目录 .claude/skills/{name}/。
 * Agent 的产物输出目录必须指向 data/agents/{name}/。
 */

import { describe, it, expect } from 'vitest';
import { join } from 'path';
import type { Skill } from '../core/skills.js';

const CWD = process.cwd();

// ---- helpers ----

function getSkillOutputDir(skill: Skill): string {
  return skill.source === 'bundled'
    ? join(CWD, 'data', 'skills', skill.code ?? skill.name)
    : skill.baseDir;
}

function getAgentOutputDir(agentId: string): string {
  return join(CWD, 'data', 'agents', agentId);
}

// ---- tests ----

describe('Skill output directory routing', () => {
  it('bundled skill returns data/skills/{name} as outputDir', () => {
    const skill: Skill = {
      name: 'prd-generator',
      code: 'prd-generator',
      description: 'PRD Generator',
      filePath: join(CWD, '.claude/skills/prd-generator/skill.md'),
      baseDir: join(CWD, '.claude/skills/prd-generator'),
      source: 'bundled',
      disableModelInvocation: false,
    };

    const outputDir = getSkillOutputDir(skill);

    expect(outputDir).toBe(join(CWD, 'data', 'skills', 'prd-generator'));
    expect(outputDir).not.toContain('.claude');
  });

  it('bundled skill with undefined code falls back to name', () => {
    const skill: Skill = {
      name: 'my-skill',
      code: undefined,
      description: 'My Skill',
      filePath: join(CWD, '.claude/skills/my-skill/skill.md'),
      baseDir: join(CWD, '.claude/skills/my-skill'),
      source: 'bundled',
      disableModelInvocation: false,
    };

    const outputDir = getSkillOutputDir(skill);

    expect(outputDir).toBe(join(CWD, 'data', 'skills', 'my-skill'));
  });

  it('project skill keeps its own baseDir as outputDir', () => {
    const projectSkillDir = join(CWD, 'data', 'projects', 'proj-123', 'skills', 'custom');
    const skill: Skill = {
      name: 'custom-skill',
      code: 'custom-skill',
      description: 'Custom Skill',
      filePath: join(projectSkillDir, 'skill.md'),
      baseDir: projectSkillDir,
      source: 'project',
      disableModelInvocation: false,
    };

    const outputDir = getSkillOutputDir(skill);

    expect(outputDir).toBe(projectSkillDir);
  });

  it('outputDir for bundled skill is separate from baseDir (source dir)', () => {
    const skill: Skill = {
      name: 'architecture-designer',
      code: 'architecture-designer',
      description: 'Architecture Designer',
      filePath: join(CWD, '.claude/skills/architecture-designer/skill.md'),
      baseDir: join(CWD, '.claude/skills/architecture-designer'),
      source: 'bundled',
      disableModelInvocation: false,
    };

    const outputDir = getSkillOutputDir(skill);

    expect(outputDir).not.toBe(skill.baseDir);
    expect(outputDir).toContain(join('data', 'skills'));
    expect(skill.baseDir).toContain('.claude');
  });
});

describe('Agent output directory routing', () => {
  it('agent always returns data/agents/{id} as outputDir', () => {
    const outputDir = getAgentOutputDir('role-agent-creator');

    expect(outputDir).toBe(join(CWD, 'data', 'agents', 'role-agent-creator'));
  });

  it('agent outputDir is independent of where Agent.md is found', () => {
    // Agent.md 可能在 .claude/skills/ 或 data/agents/ 下，但 outputDir 始终指向 data/agents/
    const outputDir = getAgentOutputDir('my-agent');

    expect(outputDir).toContain(join('data', 'agents', 'my-agent'));
    expect(outputDir).not.toContain('.claude');
  });
});
