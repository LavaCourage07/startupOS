/**
 * User Registry — 用户自定义 Agent 和 Skill 的发现与解析
 *
 * 从 data/agents/ 和 data/skills/ 目录扫描，解析 Agent.md / SKILL.md frontmatter。
 */

import { existsSync, readdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { getDataRoot } from '../../paths';

// ============================================================================
// Types
// ============================================================================

export interface UserAgent {
  id: string;
  name: string;
  description: string;
  agentType: 'assistant' | 'role-agent' | 'unknown';
  role?: string;
  domain?: string;
  version?: string;
  dirPath: string;
  hasSkillMd: boolean;
}

export interface UserSkill {
  id: string;
  name: string;
  code: string;
  description: string;
  type?: string;
  tags?: string[];
  dirPath: string;
}

// ============================================================================
// Frontmatter Parser
// ============================================================================

function parseFrontmatter(content: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) return {};

  const result: Record<string, string> = {};
  for (const line of (match[1] || '').split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function extractFirstParagraph(content: string): string {
  const bodyMatch = /^---\n[\s\S]*?\n---\n([\s\S]*)$/.exec(content);
  if (!bodyMatch) return '';
  const body = (bodyMatch[1] || '').trim();
  return body.split('\n').find((line) => line.trim() && !line.startsWith('#')) || '';
}

function isTruthyFrontmatterValue(value: string | undefined): boolean {
  return value === 'true' || value === 'yes' || value === '1';
}

// ============================================================================
// User Agents
// ============================================================================

export function listUserAgents(): UserAgent[] {
  const agentsDir = join(getDataRoot(), 'agents');
  const agents: UserAgent[] = [];

  if (!existsSync(agentsDir)) return agents;

  const entries = readdirSync(agentsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

    const dirPath = join(agentsDir, entry.name);
    const agentMdPath = join(dirPath, 'Agent.md');
    const skillMdPath = join(dirPath, 'SKILL.md');

    if (!existsSync(agentMdPath)) continue;

    try {
      const content = readFileSync(agentMdPath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      agents.push({
        id: entry.name,
        name: frontmatter['name'] || entry.name,
        description: extractFirstParagraph(content) || `User-created agent: ${frontmatter['name'] || entry.name}`,
        agentType: (frontmatter['agentType'] as UserAgent['agentType']) || 'unknown',
        role: frontmatter['role'],
        domain: frontmatter['domain'],
        version: frontmatter['version'],
        dirPath,
        hasSkillMd: existsSync(skillMdPath),
      });
    } catch (err) {
      console.error(`Failed to parse Agent.md in ${entry.name}:`, err);
    }
  }

  return agents;
}

export function getUserAgent(id: string): UserAgent | null {
  const agents = listUserAgents();
  return agents.find((a) => a.id === id) || null;
}

export function deleteUserAgent(id: string): boolean {
  const agentDir = join(getDataRoot(), 'agents', id);
  if (!existsSync(agentDir)) return false;
  rmSync(agentDir, { recursive: true, force: true });
  return true;
}

// ============================================================================
// User Skills
// ============================================================================

export function listUserSkills(): UserSkill[] {
  const skillsDir = join(getDataRoot(), 'skills');
  const skills: UserSkill[] = [];

  if (!existsSync(skillsDir)) return skills;

  const entries = readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

    const dirPath = join(skillsDir, entry.name);
    const skillMdPath = join(dirPath, 'SKILL.md');

    if (!existsSync(skillMdPath)) continue;

    try {
      const content = readFileSync(skillMdPath, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      if (isTruthyFrontmatterValue(frontmatter['originos-system'])) {
        continue;
      }
      const tags = frontmatter['tags'];

      skills.push({
        id: entry.name,
        name: frontmatter['name'] || entry.name,
        code: frontmatter['code'] || entry.name,
        description: frontmatter['description'] || `User-created skill: ${entry.name}`,
        type: frontmatter['type'],
        tags: tags ? tags.split(',').map((t) => t.trim()) : undefined,
        dirPath,
      });
    } catch (err) {
      console.error(`Failed to parse SKILL.md in ${entry.name}:`, err);
    }
  }

  return skills;
}

export function getUserSkill(id: string): UserSkill | null {
  const skills = listUserSkills();
  return skills.find((s) => s.id === id) || null;
}

export function deleteUserSkill(id: string): boolean {
  const skillDir = join(getDataRoot(), 'skills', id);
  if (!existsSync(skillDir)) return false;
  rmSync(skillDir, { recursive: true, force: true });
  return true;
}
