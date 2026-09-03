# L02：`.codex/skills/` 与 `templates/skills/`：两种 Skill 目录的职责边界

> 本课问题：OriginOS 里有两处存放 Skill 的地方——`.codex/skills/` 和 `templates/skills/`。它们有什么区别？Skill 加载时会优先用哪个？

## 小林的场景

小林在 L01 里看了 `templates/skills/info-query/SKILL.md`，发现它有个 `originos-system: true` 的标记。她又发现 `.codex/skills/` 下也有几个 `SKILL.md`，但它们的 `license` 是 `MIT`，还有 `compatibility` 字段。

她想知道：
- 这两个目录的 Skill 有什么区别？
- 系统加载时会优先用哪个？
- 她自己写的 Skill 应该放在哪里？

## 概念阶梯：两种目录，四种容易混淆的判断

| 判断 | 正确理解 | 常见误解 |
| --- | --- | --- |
| `.codex/skills/` 是系统级 Skill | 是。它是 OriginOS 内置的、不可由用户修改的 Skill | 不是“高级 Skill”，只是用途不同 |
| `templates/skills/` 是业务级 Skill | 是。它是 OriginOS 提供的模板，用户可修改、可扩展 | 不是“低级 Skill”，只是更贴近业务 |
| 系统级 Skill 不能自定义 | 对。`.codex/skills/` 是只读的，用户不能修改 | 但用户可以在 `templates/skills/` 下创建同名 Skill 覆盖 |
| 业务级 Skill 会被运行时直接读取 | 错。运行时读取的是 `packages/core/src/lib/features/skills/bundled/` 下的副本（L07 展开） | `templates/skills/` 是模板源，不是运行时直接读取的位置 |

## 第一段源码：`.codex/skills/` 下的系统级 Skill

`.codex/skills/` 下共有 5 个 Skill：

```typescript
// [.codex/skills/openspec-propose/SKILL.md 第 1—9 行](../../../../.codex/skills/openspec-propose/SKILL.md#L1)
---
name: openspec-propose
description: Propose a new change with all artifacts generated in one step. ...
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---
```

```typescript
// [.codex/skills/openspec-apply-change/SKILL.md 第 1—9 行](../../../../.codex/skills/openspec-apply-change/SKILL.md#L1)
---
name: openspec-apply-change
description: Implement tasks from an OpenSpec change. ...
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---
```

```typescript
// [.codex/skills/openspec-archive-change/SKILL.md 第 1—9 行](../../../../.codex/skills/openspec-archive-change/SKILL.md#L1)
---
name: openspec-archive-change
description: Archive a completed change in the experimental workflow. ...
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---
```

```typescript
// [.codex/skills/openspec-explore/SKILL.md 第 1—9 行](../../../../.codex/skills/openspec-explore/SKILL.md#L1)
---
name: openspec-explore
description: Enter explore mode - a thinking partner for exploring ideas, ...
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---
```

```typescript
// [.codex/skills/openspec-sync-specs/SKILL.md 第 1—9 行](../../../../.codex/skills/openspec-sync-specs/SKILL.md#L1)
---
name: openspec-sync-specs
description: Sync delta specs from a change to main specs. ...
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---
```

**系统级 Skill 的共同特征**：

| 特征 | 说明 |
| --- | --- |
| `license: MIT` | 开源协议，表明是系统内置 |
| `compatibility: Requires openspec CLI` | 声明依赖的系统能力 |
| `metadata.author: openspec` | 作者是 openspec 项目，不是 OriginOS 用户 |
| `metadata.generatedBy` | 记录生成工具的版本 |
| Body 简短 | 通常只描述输入、输出、步骤，不展开角色定义 |
| 无 `originos-system` 字段 | 不需要，因为它们本身就是系统的一部分 |

## 第二段源码：`templates/skills/` 下的业务级 Skill

以 `info-query` 和 `project-initialization` 为例：

```typescript
// [templates/skills/info-query/SKILL.md 第 1—5 行](../../../../templates/skills/info-query/SKILL.md#L1)
---
name: info-query
description: 信息查询技能，帮助用户通过对话式界面查询项目相关信息
originos-system: true
version: 1.0.0
type: SIMPLE
author: OriginOS
---
```

```typescript
// [templates/skills/project-initialization/SKILL.md 第 1—5 行](../../../../templates/skills/project-initialization/SKILL.md#L1)
---
name: project-initialization
description: OriginOS 项目访谈 Skill - 通过对话式引导完成项目业务建模。...
originos-system: true
---
```

**业务级 Skill 的共同特征**：

| 特征 | 说明 |
| --- | --- |
| `originos-system: true` | 标记为系统内置的业务级 Skill |
| `version` | 语义化版本号 |
| `type` | Skill 类型（如 `SIMPLE`） |
| `author: OriginOS` | 作者是 OriginOS 团队 |
| Body 详细 | 有完整的角色定义、执行流程、输出格式 |
| 无 `license` 字段 | 不需要，因为是 OriginOS 自有 |

## 第三段源码：Skill Registry 的加载逻辑

Skill 的加载和路由由 `packages/core/src/lib/features/skills/registry.ts` 管理：

```typescript
// [packages/core/src/lib/features/skills/registry.ts 第 1—30 行](../../../../packages/core/src/lib/features/skills/registry.ts#L1)
/**
 * Skill Registry and Router
 *
 * Manages loading, registration, and routing of skills in the pi-agent-core system.
 */

import type {
  LoadedSkill,
  SkillRegistry,
  SkillRouter,
  SkillRoutingRequest,
  SkillRoutingRule,
} from '../../../types/skill';

// ============================================================================
// Skill Registry
// ============================================================================

class DefaultSkillRegistry implements SkillRegistry {
  private skills = new Map<string, LoadedSkill>();

  register(skill: LoadedSkill): void {
    this.skills.set(skill.metadata.name, skill);
  }

  unregister(skillName: string): void {
    this.skills.delete(skillName);
  }

  get(skillName: string): LoadedSkill | undefined {
    return this.skills.get(skillName);
  }

  list(): LoadedSkill[] {
    return Array.from(this.skills.values());
  }

  has(skillName: string): boolean {
    return this.skills.has(skillName);
  }
}
```

**Registry 的核心职责**：

1. `register(skill)`：将 Skill 注册到内存中的 Map
2. `get(skillName)`：按名字获取已注册的 Skill
3. `list()`：列出所有已注册的 Skill
4. `has(skillName)`：检查某个 Skill 是否已注册

**关键判断**：Registry 本身不决定从哪里加载 Skill，它只是“ Skill 的容器”。加载逻辑在 `loader.ts` 和 `service.ts` 中（L07–L08 展开）。

## 第四段源码：Skill Router 的路由规则

```typescript
// [packages/core/src/lib/features/skills/registry.ts 第 70—120 行](../../../../packages/core/src/lib/features/skills/registry.ts#L70)
// Initialize with default routing rules
skillRouter.registerRule({
  condition: (request: SkillRoutingRequest) => {
    // Route project-initialization to the project-initialization skill
    return !!(request.agentType === 'project-initialization' ||
           request.message?.toLowerCase().includes('create project') ||
           request.message?.toLowerCase().includes('new project'));
  },
  skillName: 'project-initialization',
  priority: 10,
});

skillRouter.registerRule({
  condition: (request: SkillRoutingRequest) => {
    // Route ontology-related requests to ontology skill
    return !!(request.agentType === 'ontology' ||
           request.message?.toLowerCase().includes('ontology') ||
           request.message?.toLowerCase().includes('entity'));
  },
  skillName: 'ontology',
  priority: 5,
});

skillRouter.registerRule({
  condition: (_request: SkillRoutingRequest) => {
    // Default to generic agent if no specific skill matches
    return true;
  },
  skillName: 'generic',
  priority: 0,
});
```

**路由规则的核心逻辑**：

1. **优先级排序**：`priority` 越高越先匹配（10 > 5 > 0）
2. **条件匹配**：`condition` 函数检查 `agentType` 或 `message` 是否包含关键词
3. **默认兜底**：`generic` Skill 的 `priority: 0` 且 `condition: true`，确保任何请求都能被处理

**关键判断**：路由规则是**硬编码在代码里的**，不是动态配置的。这意味着：
- 新增 Skill 需要修改 `registry.ts` 才能被路由到
- 用户自定义的 Skill 如果没有对应的 routing rule，只能走 `generic` 路径
- 这是当前实现的一个限制（L08 会讨论如何改进）

## 调用链：两种 Skill 的加载路径

```text
系统启动
  → 加载 bundled skills（packages/core/src/lib/features/skills/bundled/）
    → 这些是从 templates/skills/ 复制过来的运行时副本
  → 注册 routing rules（registry.ts 中的硬编码规则）
    → 用户请求到达
      → Router 按 priority 匹配 rule
        → 匹配成功 → 调用对应 Skill
        → 匹配失败 → 调用 generic Skill
```

**本课的边界**：
- `.codex/skills/` 的 Skill **不经过 Router**，它们是直接由 OpenSpec CLI 调用的
- `templates/skills/` 的 Skill **经过 Router**，由 Agent 根据用户请求选择

## 失败路径：两种 Skill 可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| `.codex/skills/` 下的 Skill 被用户修改 | 系统行为异常 | `.codex/skills/` 应该是只读的，但当前没有文件系统权限保护 |
| `templates/skills/` 下的 Skill 和 `.codex/skills/` 同名 | 加载冲突 | 需要明确的加载优先级规则 |
| Routing rule 未覆盖新 Skill | 新 Skill 无法被触发 | 硬编码的 routing rules 需要手动更新 |
| `generic` Skill 被删除 | 所有未匹配请求失败 | 默认兜底 Skill 必须存在 |
| Skill 版本升级后 routing rule 未更新 | 调用旧版本 Skill | Registry 按 name 查找，不检查版本 |

## 测试证据

```bash
# 检查 .codex/skills/ 下的 Skill 数量
ls .codex/skills/ | wc -l
# 输出: 5

# 检查 templates/skills/ 下的 Skill 数量
ls templates/skills/ | wc -l
# 输出: 30

# 检查 bundled skills（运行时副本）
ls packages/core/src/lib/features/skills/bundled/ | wc -l
# 输出: 4（info-query, ontology-editor, project-initialization, task-manager）
```

**测试缺口**：
- 没有测试验证 `.codex/skills/` 和 `templates/skills/` 的加载优先级
- 没有测试验证同名 Skill 的冲突处理
- 没有测试验证 routing rule 的覆盖范围

## 小实验

**实验 1：对比两种 Skill 的 frontmatter**

创建对比表格：

| 字段 | `.codex/skills/openspec-propose` | `templates/skills/info-query` |
| --- | --- | --- |
| `name` | openspec-propose | info-query |
| `description` | 英文，描述功能 | 中文，描述功能 |
| `license` | MIT | 无 |
| `compatibility` | Requires openspec CLI | 无 |
| `metadata.author` | openspec | 无 |
| `metadata.version` | 1.0 | 无 |
| `originos-system` | 无 | true |
| `version` | 无 | 1.0.0 |
| `type` | 无 | SIMPLE |
| `author` | 无 | OriginOS |

**思考**：为什么系统级 Skill 有 `license` 和 `compatibility`，而业务级 Skill 没有？

**实验 2：检查 routing rules**

打开 `packages/core/src/lib/features/skills/registry.ts`，回答：

- 当前有多少个 routing rule？
- `project-initialization` 的 priority 是多少？
- 如果用户说 "create a new project"，会匹配到哪个 Skill？
- 如果用户说 "show me the ontology"，会匹配到哪个 Skill？

## 口头验收

1. **`.codex/skills/` 和 `templates/skills/` 的职责边界是什么？** 能说出前者是系统级、后者是业务级吗？
2. **系统级 Skill 和业务级 Skill 的 frontmatter 有什么区别？** 能说出 `license`、`compatibility`、`originos-system` 等字段的差异吗？
3. **Skill Router 是怎么工作的？** 能说出 priority、condition、skillName 的作用吗？
4. **如果新增一个 Skill，需要修改哪些地方？** 能说出需要新增 routing rule 吗？
5. **`.codex/skills/` 的 Skill 会被 Router 路由到吗？** 能说出它们是由 OpenSpec CLI 直接调用的吗？

## 本课结论

本课建立了两种 Skill 目录的认知：

- **`.codex/skills/`**：系统级 Skill，由 OpenSpec CLI 直接调用，不可由用户修改
- **`templates/skills/`**：业务级 Skill，由 Agent Router 根据用户请求路由，用户可扩展
- **Registry 是容器**，Router 是调度器，两者分离
- **Routing rules 是硬编码的**，新增 Skill 需要手动更新

下一课（L03）将深入 frontmatter 的每个字段，回答“SKILL.md 的 frontmatter 里每个字段到底代表什么”这个问题。
