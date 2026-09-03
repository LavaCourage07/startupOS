# L09：Skill 的“运行时拷贝”——模板与运行时副本的关系

> 本课问题：`templates/skills/` 下的 Skill 和 `packages/core/src/lib/features/skills/bundled/` 下的 Skill 是什么关系？运行时副本是怎么生成的？

## 小林的场景

小林发现 `templates/skills/info-query/` 下有 3 个文件，但 `packages/core/src/lib/features/skills/bundled/info-query/` 下只有 2 个文件。她想知道：

- 运行时副本是怎么生成的？
- 为什么文件数量不一样？
- 修改模板后，运行时副本会自动更新吗？

## 概念阶梯：模板和副本不是“复制粘贴”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “副本就是复制一份” | 副本是**编译产物**，可能经过转换 | 不是简单的文件复制，而是有选择性的提取 |
| “修改模板后副本自动更新” | 副本需要**重新构建**才能更新 | 不是自动同步的，需要手动或自动构建 |
| “副本和模板内容一样” | 副本可能**缺少部分文件**（如 references、scripts） | 不是完整复制，而是提取核心文件 |

## 第一段源码：运行时副本的结构

```typescript
// [packages/core/src/lib/features/skills/bundled/ 目录结构](../../../../packages/core/src/lib/features/skills/bundled/)

bundled/
  info-query/
    SKILL.md     // 从 templates/skills/info-query/SKILL.md 复制
    handler.ts   // 运行时 handler，手写
  ontology-editor/
    SKILL.md     // 从 templates/skills/ontology-editor/SKILL.md 复制
    handler.ts   // 运行时 handler，手写
  project-initialization/
    SKILL.md     // 从 templates/skills/project-initialization/SKILL.md 复制
    // 无 handler.ts，因为 handler 在 loader.ts 中定义
  task-manager/
    SKILL.md     // 从 templates/skills/task-manager/SKILL.md 复制
    handler.ts   // 运行时 handler，手写
```

**运行时副本的特征**：

| 特征 | 说明 |
| --- | --- |
| `SKILL.md` | 从模板复制，内容相同 |
| `handler.ts` | 手写，定义 Skill 的执行逻辑 |
| 无 `references/` | 参考文档不复制 |
| 无 `assets/` | 模板资产不复制 |
| 无 `scripts/` | 脚本工具不复制 |
| 无 `evolution.json` | 运行记录不复制 |

**关键判断**：运行时副本是**精简版**，只包含核心文件（`SKILL.md` + `handler.ts`）。

## 第二段源码：`handler.ts` 的作用

```typescript
// [packages/core/src/lib/features/skills/bundled/info-query/handler.ts 第 1—30 行](../../../../packages/core/src/lib/features/skills/bundled/info-query/handler.ts#L1)
import type { SkillContext, SkillResult } from '../../../types/skill';

/**
 * Handle info-query skill execution
 */
export async function handle(context: SkillContext): Promise<SkillResult> {
  const { input, tools } = context;

  // Extract query from user input
  const query = input.message || '';

  // Use ontology tools to query entities
  const entities = await tools.queryEntities?.('Project', { name: query });

  return {
    success: true,
    message: `Found ${entities?.length || 0} projects matching "${query}"`,
    data: { entities },
  };
}
```

**`handler.ts` 的职责**：

1. **接收 `SkillContext`**：包含 session、input、tools、config
2. **处理用户输入**：从 `input.message` 提取查询
3. **调用工具**：使用 `tools.queryEntities` 查询数据
4. **返回 `SkillResult`**：包含 success、message、data

**关键判断**：`handler.ts` 是**运行时逻辑**，不是模板的一部分。它定义了 Skill 如何与系统交互。

## 第三段源码：模板和副本的对比

| 维度 | `templates/skills/info-query/` | `packages/core/src/lib/features/skills/bundled/info-query/` |
| --- | --- | --- |
| `SKILL.md` | 有 | 有（内容相同） |
| `handler.ts` | 无 | 有（运行时逻辑） |
| `references/` | 无 | 无 |
| `assets/` | 无 | 无 |
| `scripts/` | 无 | 无 |
| `evolution.json` | 无 | 无 |
| 文件总数 | 3 | 2 |

| 维度 | `templates/skills/project-initialization/` | `packages/core/src/lib/features/skills/bundled/project-initialization/` |
| --- | --- | --- |
| `SKILL.md` | 有 | 有（内容相同） |
| `handler.ts` | 无 | 无（handler 在 `loader.ts` 中） |
| `references/` | 无 | 无 |
| `assets/` | 无 | 无 |
| 文件总数 | 4 | 1 |

**关键判断**：不同 Skill 的运行时副本结构不同。有的有 `handler.ts`，有的没有（因为 handler 在 `loader.ts` 中定义）。

## 第四段源码：`materializeBundledSkill` 的实现

```typescript
// [packages/core/src/lib/features/skills/service.ts 第 270—275 行](../../../../packages/core/src/lib/features/skills/service.ts#L270)
function findSkillForContent(name: string): Skill | undefined {
  const dataSkill = loadSkillFromDirectory(path.join(getSkillsDataDir(), name), 'user').skill;
  if (dataSkill) {
    return dataSkill;
  }

  const skill = findSkill(name);
  if (skill?.systemManaged) {
    return materializeBundledSkill(skill.code ?? skill.name) ?? skill;
  }
  return skill ?? materializeBundledSkill(name) ?? undefined;
}
```

**`materializeBundledSkill` 的作用**：

1. **检查用户数据目录**：优先加载用户自定义的 Skill
2. **检查系统内置 Skill**：加载 `bundled/` 下的副本
3. **物化副本**：如果副本不存在，动态生成

**关键判断**：`materializeBundledSkill` 是**按需加载**的，不是启动时全部加载的。

## 调用链：模板到副本

```text
templates/skills/{skill-name}/
  SKILL.md
  references/
  assets/
  scripts/
  evolution.json
    → 构建过程
      → 提取 SKILL.md
      → 生成/复制 handler.ts
        → packages/core/src/lib/features/skills/bundled/{skill-name}/
          SKILL.md
          handler.ts（可选）
```

## 失败路径：模板和副本可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 模板修改后副本未更新 | 运行时行为未变 | 需要重新构建 |
| 副本缺少 `handler.ts` | 执行失败 | 忘记生成或复制 handler |
| 副本和模板内容不一致 | 行为不一致 | 构建过程中发生错误 |
| 用户自定义 Skill 覆盖系统内置 | 系统行为异常 | 查找优先级：用户 > 系统 |
| `materializeBundledSkill` 失败 | 无法加载 Skill | 副本生成失败 |

## 测试证据

```bash
# 检查模板和副本的一致性
for skill in info-query ontology-editor project-initialization task-manager; do
  echo "=== $skill ==="
  diff -q "templates/skills/$skill/SKILL.md" "packages/core/src/lib/features/skills/bundled/$skill/SKILL.md" 2>/dev/null && echo "SKILL.md: SAME" || echo "SKILL.md: DIFFERENT"
done

# 检查副本中的 handler.ts
for skill in info-query ontology-editor task-manager; do
  if [ -f "packages/core/src/lib/features/skills/bundled/$skill/handler.ts" ]; then
    echo "$skill: has handler.ts"
  else
    echo "$skill: no handler.ts"
  fi
done
```

**测试缺口**：
- 没有自动化测试验证模板和副本的一致性
- 没有测试验证 `materializeBundledSkill` 的正确性
- 没有测试验证 handler.ts 的存在性

## 小实验

**实验 1：对比模板和副本**

| Skill | 模板文件数 | 副本文件数 | 差异 |
| --- | --- | --- | --- |
| `info-query` | | | |
| `project-initialization` | | | |
| `bmad-agent-builder` | | | |

**思考**：为什么有的 Skill 有副本，有的没有？

**实验 2：检查 `materializeBundledSkill`**

1. 打开 `packages/core/src/lib/features/skills/service.ts`
2. 找到 `materializeBundledSkill` 的调用点
3. 回答：什么情况下会调用 `materializeBundledSkill`？

## 口头验收

1. **运行时副本是怎么生成的？** 能说出是从模板提取核心文件生成的吗？
2. **为什么副本的文件数量比模板少？** 能说出只复制核心文件（`SKILL.md` + `handler.ts`）吗？
3. **修改模板后，副本会自动更新吗？** 能说出需要重新构建吗？
4. **`handler.ts` 是模板的一部分吗？** 能说出它是运行时逻辑，不是模板的一部分吗？
5. **`materializeBundledSkill` 是什么时候调用的？** 能说出是按需加载，不是启动时全部加载吗？

## 本课结论

本课建立了模板和副本关系的完整认知：

- **运行时副本是精简版**：只包含 `SKILL.md` + `handler.ts`
- **副本不是简单复制**：可能经过转换、裁剪
- **修改模板后需要重新构建**：副本不会自动更新
- **`handler.ts` 是运行时逻辑**：不是模板的一部分
- **`materializeBundledSkill` 是按需加载**：不是启动时全部加载

下一课（L10）是单元小结课，将综合本单元所有内容，进行复盘和验收。
