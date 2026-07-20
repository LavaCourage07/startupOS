/**
 * 技能扫描器（Story R.3）
 *
 * 扫描角色目录下 `.skills/` 中的已安装技能，
 * 为 system prompt 注入可用技能清单。
 */

import { existsSync, readFileSync, readdirSync, lstatSync } from 'fs';
import path from 'path';

/** 技能基本信息（从 .skills/ 目录扫描得到） */
export interface SkillInfo {
  name: string;
  description: string;
  code: string;
  path: string;
  /** SKILL.md frontmatter 中解析的额外元数据 */
  icon?: string;
  category?: string;
  tags?: string[];
  /** 完整 frontmatter 键值对 */
  frontmatter: Record<string, string>;
}

/** 从技能目录读取 SKILL.md 提取 name/description + frontmatter */
function extractSkillInfo(skillLinkPath: string): SkillInfo | null {
  const skillMdPath = path.join(skillLinkPath, 'SKILL.md');
  if (!existsSync(skillMdPath)) return null;

  try {
    const content = readFileSync(skillMdPath, 'utf-8');
    const frontmatter: Record<string, string> = {};

    // 解析 YAML frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch?.[1]) {
      const lines = fmMatch[1].split('\n');
      for (const line of lines) {
        const kvMatch = line.match(/^(\w[\w-]*):\s*(.+)$/);
        if (kvMatch) {
          frontmatter[kvMatch[1]!.toLowerCase()] = kvMatch[2]!.trim();
        }
      }
    }

    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const descMatch = content.match(/^description:\s*(.+)$/m);

    const name = nameMatch?.[1]?.trim() ?? path.basename(skillLinkPath);
    const description = descMatch?.[1]?.trim() ?? '';
    const icon = frontmatter['icon'] || undefined;
    const category = frontmatter['category'] || undefined;
    const tagsRaw = frontmatter['tags'];
    const tags = tagsRaw
      ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
      : undefined;

    return {
      name,
      description,
      code: path.basename(skillLinkPath),
      path: skillLinkPath,
      icon,
      category,
      tags,
      frontmatter,
    };
  } catch {
    return null;
  }
}

/**
 * 扫描角色目录下 `.skills/` 中的已安装技能。
 * `.skills/` 中为软链接，每个链接指向 `data/skills/{skillCode}/`。
 *
 * @param baseDir 角色工作目录
 * @returns 技能列表，`.skills/` 不存在时返回空数组
 */
export function scanInstalledSkills(baseDir: string): SkillInfo[] {
  const skillsDir = path.join(baseDir, '.skills');
  if (!existsSync(skillsDir)) return [];

  const skills: SkillInfo[] = [];
  try {
    const entries = readdirSync(skillsDir);
    for (const entry of entries) {
      const entryPath = path.join(skillsDir, entry);
      if (!lstatSync(entryPath).isSymbolicLink()) continue;

      const info = extractSkillInfo(entryPath);
      if (info) skills.push(info);
    }
  } catch {
    // 目录读取失败，返回空数组
  }

  return skills;
}
