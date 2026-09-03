# F51：`project-skill-provisioning.ts` —— 技能幂等补齐

## 开篇场景

ProjectAgent 启动时，需要确保项目的 `skills/` 目录下有必要的内置技能（如 `domain-discovery`、`business-refinement`、`model-review`）。这些技能来自 bundled skills，但需要复制到项目目录。`provisionProjectSkill` 就是做这个的——幂等补齐，已存在的文件不会被覆盖。

## 核心问题

**为什么需要幂等补齐？`copyMissingTree` 如何保证不覆盖用户修改？**

## 概念阶梯

**PROJECT_DEFAULT_SKILLS**：默认需要补齐的技能列表。

**ProjectSkillProvisionResult**：补齐结果，包含技能名、状态、复制文件数。

**provisionProjectSkill**：单个技能的幂等补齐。

**provisionProjectSkills**：批量补齐多个技能。

## 源码精读

### 1. PROJECT_DEFAULT_SKILLS

[packages/core/src/lib/integrations/pi-agent/project-agent/project-skill-provisioning.ts 第 7—14 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-skill-provisioning.ts#L7)

```typescript
export const PROJECT_DEFAULT_SKILLS = [
  'domain-discovery',
  'business-refinement',
  'model-review',
  'solution-design',
  'project-skill-creator',
  'agent-creator',
] as const;
```

### 2. provisionProjectSkill

[packages/core/src/lib/integrations/pi-agent/project-agent/project-skill-provisioning.ts 第 73—92 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-skill-provisioning.ts#L73)

```typescript
export async function provisionProjectSkill(
  projectDir: string,
  skillName: string,
): Promise<ProjectSkillProvisionResult> {
  const sourceDir = findBundledSkillDir(skillName);
  if (!sourceDir) {
    return { skillName, status: 'missing', copiedFiles: 0 };
  }

  const targetDir = path.join(projectDir, 'skills', skillName);
  const targetSkillPath = path.join(targetDir, 'SKILL.md');
  const existedBefore = await pathExists(targetSkillPath);
  const copiedFiles = await copyMissingTree(sourceDir, targetDir);

  return {
    skillName,
    status: copiedFiles === 0 ? 'existing' : existedBefore ? 'updated' : 'created',
    copiedFiles,
  };
}
```

### 3. copyMissingTree

[packages/core/src/lib/integrations/pi-agent/project-agent/project-skill-provisioning.ts 第 28—67 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-skill-provisioning.ts#L28)

```typescript
async function copyMissingTree(sourceDir: string, targetDir: string): Promise<number> {
  try {
    await fs.mkdir(targetDir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return 0;
    throw error;
  }

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  let copiedFiles = 0;

  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === '__pycache__' || entry.name === '.DS_Store' || entry.name.endsWith('.pyc')) continue;

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copiedFiles += await copyMissingTree(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile()) continue;

    try {
      await fs.copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
      copiedFiles += 1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }

  return copiedFiles;
}
```

关键点：

- `COPYFILE_EXCL`：如果目标文件已存在，不覆盖；
- 忽略 `.git`、`.DS_Store`、`__pycache__`、`.pyc`；
- 递归复制子目录。

## 真实调用链

1. `ProjectLauncher.launch()` 调用 `provisionProjectSkills(projectDir)`；
2. 对每个默认技能调用 `provisionProjectSkill`；
3. 返回结果数组。

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| 技能不存在 | `status: 'missing'` | `findBundledSkillDir` 返回 null |
| 文件已存在 | 不覆盖 | `COPYFILE_EXCL` |
| 目录冲突（文件 vs 目录） | 跳过 | `EEXIST` 错误 |

## 测试证据

- `project-skill-provisioning.test.ts` 覆盖：
  - 复制 bundled skill 及其支持文件；
  - 保留用户修改，只补齐缺失的依赖；
  - 文件与目录冲突时不失败。

## 练习与验收

1. **测试幂等性**：多次调用 `provisionProjectSkill`，验证不覆盖用户修改。
2. **测试缺失技能**：调用不存在的技能，验证 `status: 'missing'`。

**验收标准**：能解释幂等补齐的原理。

## 章节收束

`project-skill-provisioning.ts` 是 ProjectAgent 技能管理的基础。下一节课（F52）回顾 ProjectAgent 与 Launcher 的集成。
