# F34：`skill-resolver.ts` —— 技能扫描与解析

## 开篇场景

RoleAgent 的 `.skills/` 目录中存放着已安装技能的软链接。每个软链接指向 `data/skills/{skillCode}/`，其中包含 `SKILL.md`。系统需要扫描这些软链接，提取技能的名称、描述、图标、分类等信息，最终生成 `Installed Skills` 表格注入 system prompt。这节课看 `skill-resolver.ts` 如何实现。

## 核心问题

**`scanInstalledSkills` 如何区分软链接和普通文件？`extractSkillInfo` 如何从 `SKILL.md` 解析 frontmatter？`SkillInfo` 包含哪些字段？**

## 概念阶梯

**SkillInfo**：已安装技能的基本信息，包含名称、描述、代码、路径、图标、分类、标签、frontmatter。

**scanInstalledSkills**：扫描 `.skills/` 目录，过滤出软链接，逐个提取 `SkillInfo`。

**extractSkillInfo**：读取单个技能目录的 `SKILL.md`，解析 YAML frontmatter。

## 源码精读

### 1. SkillInfo 接口

[packages/core/src/lib/integrations/pi-agent/role-agent/skill-resolver.ts 第 12—23 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/skill-resolver.ts#L12)

```typescript
export interface SkillInfo {
  name: string;
  description: string;
  code: string;              // 技能代码（目录名）
  path: string;              // 技能目录完整路径
  icon?: string;
  category?: string;
  tags?: string[];
  frontmatter: Record<string, string>;  // 完整 frontmatter 键值对
}
```

### 2. scanInstalledSkills

[packages/core/src/lib/integrations/pi-agent/role-agent/skill-resolver.ts 第 80—99 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/skill-resolver.ts#L80)

```typescript
export function scanInstalledSkills(baseDir: string): SkillInfo[] {
  const skillsDir = path.join(baseDir, '.skills');
  if (!existsSync(skillsDir)) return [];

  const skills: SkillInfo[] = [];
  try {
    const entries = readdirSync(skillsDir);
    for (const entry of entries) {
      const entryPath = path.join(skillsDir, entry);
      if (!lstatSync(entryPath).isSymbolicLink()) continue;  // 只处理软链接

      const info = extractSkillInfo(entryPath);
      if (info) skills.push(info);
    }
  } catch {
    // 目录读取失败，返回空数组
  }

  return skills;
}
```

关键点：

- 只处理软链接（`isSymbolicLink()`），忽略普通文件和目录。
- `extractSkillInfo` 失败时跳过该技能，不中断扫描。
- 整个扫描是同步的，因为启动时需要立即拿到结果。

### 3. extractSkillInfo

[packages/core/src/lib/integrations/pi-agent/role-agent/skill-resolver.ts 第 26—71 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/skill-resolver.ts#L26)

```typescript
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

    return { name, description, code: path.basename(skillLinkPath),
             path: skillLinkPath, icon, category, tags, frontmatter };
  } catch {
    return null;
  }
}
```

解析逻辑：

1. 读取 `SKILL.md`；
2. 用正则匹配 `---\n...\n---` 提取 frontmatter；
3. 逐行解析 `key: value` 格式；
4. 提取 `name`、`description`、`icon`、`category`、`tags`；
5. 如果 `name` 缺失，使用目录名作为默认值。

## 真实调用链

1. `loadRoleContext` 调用 `scanInstalledSkills(agentDir)`。
2. `scanInstalledSkills` 遍历 `.skills/` 目录，对每个软链接调用 `extractSkillInfo`。
3. 返回的 `SkillInfo[]` 被存入 `RoleContext.installedSkills`。
4. `buildRoleSystemPrompt` 调用 `buildInstalledSkillsSection(ctx)`，生成 Markdown 表格。

## 关键类型与数据示例

### SkillInfo 示例

```typescript
{
  name: 'ESLint Skill',
  description: '自动检测和修复代码中的 ESLint 问题',
  code: 'eslint-skill',
  path: '/.../data/agents/code-reviewer/.skills/eslint-skill',
  icon: '🔍',
  category: 'code-quality',
  tags: ['linting', 'javascript', 'typescript'],
  frontmatter: {
    name: 'ESLint Skill',
    description: '自动检测和修复代码中的 ESLint 问题',
    icon: '🔍',
    category: 'code-quality',
    tags: 'linting, javascript, typescript',
  }
}
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| .skills/ 不存在 | 返回空数组 | 目录不存在 |
| 普通文件（非软链接） | 跳过 | `isSymbolicLink()` 过滤 |
| SKILL.md 不存在 | 跳过该技能 | `extractSkillInfo` 返回 null |
| frontmatter 格式错误 | `frontmatter` 为空对象 | 正则匹配失败 |
| name 缺失 | 使用目录名 | 默认值 |

## 测试证据

- `skill-resolver.ts` 当前无直接单元测试。
- 建议补测试：
  - 扫描包含软链接和普通文件的 `.skills/` 目录；
  - `extractSkillInfo` 正确解析 frontmatter；
  - `name` 缺失时使用目录名。

## 练习与验收

1. **构造 .skills/ 目录**：创建软链接指向真实技能目录，验证 `scanInstalledSkills` 输出。
2. **测试 frontmatter 解析**：构造不同格式的 `SKILL.md`，验证 `extractSkillInfo` 行为。
3. **边界测试**：测试 `.skills/` 不存在、空目录、包含普通文件的场景。

**验收标准**：能独立构造 `.skills/` 目录并验证扫描结果。

## 章节收束

`skill-resolver.ts` 是 RoleAgent 技能管理的基石。下一节课（F35）看 `state-machine.ts`，理解状态机如何解析和推进。
