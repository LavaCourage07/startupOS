# L03：SKILL.md 的 frontmatter——名字、描述、元数据与兼容性声明

> 本课问题：SKILL.md 头部的 YAML 里，每个字段到底代表什么？哪些必填、哪些可选？填错会有什么后果？

## 小林的场景

小林看了 `info-query` 和 `project-initialization` 的 frontmatter，发现字段不一样多。她想搞清楚：
- `name` 和 `displayName` 有什么区别？
- `type: SIMPLE` 和 `type: COMPOSITE` 有什么不同？
- `reads` 和 `writes` 是做什么的？
- `priority` 是路由优先级吗？
- 如果我把 `version` 写成 `1.0` 而不是 `1.0.0`，会出问题吗？

## 概念阶梯：Frontmatter 不是“配置”，而是“合同”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “Frontmatter 是 Skill 的配置” | Frontmatter 是 Skill 的**元数据合同** | 不是运行时配置，而是声明性描述；运行时可能不验证所有字段 |
| “填了就行，不重要” | 每个字段都有明确的**类型约束** | 字段缺失或格式错误可能导致 Skill 无法被加载 |
| “所有字段都必须填” | 字段分为**必填**和**可选** | 必填字段缺失会导致解析失败；可选字段缺失会使用默认值 |

## 第一段源码：`SkillMetadata` 的类型定义

`packages/core/src/types/skill.ts` 定义了 `SkillMetadata` 接口：

```typescript
// [packages/core/src/types/skill.ts 第 24—51 行](../../../../packages/core/src/types/skill.ts#L24)
export interface SkillMetadata {
  /** Unique skill identifier */
  name: string;
  /** Display name */
  displayName?: string;
  /** Human-readable description */
  description: string;
  /** Skill type */
  type: SkillType;
  /** Version */
  version: string;
  /** Priority level for routing */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /** Other skills this skill depends on */
  dependencies?: string[];
  /** Ontology types this skill reads (legacy, use inputContract) */
  reads?: string[];
  /** Ontology types this skill writes (legacy, use outputContract) */
  writes?: string[];
  /** Input contract — what ontology data this skill expects */
  inputContract?: SkillInputContract;
  /** Output contract — what ontology data this skill produces */
  outputContract?: SkillOutputContract;
  /** Precondition checks */
  preconditions?: string[];
  /** Postcondition guarantees */
  postconditions?: string[];
}
```

**字段分类表**：

| 字段 | 类型 | 必填 | 作用 | 填错后果 |
| --- | --- | --- | --- | --- |
| `name` | `string` | **是** | 唯一标识符，用于路由和引用 | 无法被 Registry 识别 |
| `displayName` | `string` | 否 | 显示名称，用于 UI 展示 | 无，但 UI 可能显示 `name` 代替 |
| `description` | `string` | **是** | 人类可读描述，Agent 选择 Skill 的依据 | Agent 无法理解 Skill 用途 |
| `type` | `SkillType` | **是** | `SIMPLE` 或 `COMPOSITE` | 类型不匹配可能导致执行错误 |
| `version` | `string` | **是** | 语义化版本号 | 版本管理混乱 |
| `priority` | `'low' \| 'medium' \| 'high' \| 'critical'` | 否 | 路由优先级 | 无，但可能影响路由顺序 |
| `dependencies` | `string[]` | 否 | 依赖的其他 Skill | 依赖缺失时执行失败 |
| `reads` | `string[]` | 否 | 读取的 Ontology 类型（legacy） | 数据访问权限不明确 |
| `writes` | `string[]` | 否 | 写入的 Ontology 类型（legacy） | 数据修改权限不明确 |
| `inputContract` | `SkillInputContract` | 否 | 输入合同 | 输入验证缺失 |
| `outputContract` | `SkillOutputContract` | 否 | 输出合同 | 输出验证缺失 |
| `preconditions` | `string[]` | 否 | 前置条件 | 前置检查缺失 |
| `postconditions` | `string[]` | 否 | 后置条件 | 后置检查缺失 |

## 第二段源码：`SkillType` 枚举

```typescript
// [packages/core/src/types/skill.ts 第 11—14 行](../../../../packages/core/src/types/skill.ts#L11)
export enum SkillType {
  SIMPLE = 'simple',       // Single-purpose skill
  COMPOSITE = 'composite', // Skill that orchestrates other skills
}
```

**两种类型的区别**：

| 维度 | `SIMPLE` | `COMPOSITE` |
| --- | --- | --- |
| 定义 | 单一用途的 Skill | 编排其他 Skill 的 Skill |
| 典型例子 | `info-query`（查询信息） | `project-initialization`（引导访谈） |
| 是否调用其他 Skill | 否 | 是 |
| Body 复杂度 | 低（功能列表、使用示例） | 高（阶段定义、流程编排） |
| 输出 | 直接回复 | 可能产生多个中间产物 |

**关键判断**：`info-query` 是 `SIMPLE`，因为它只回答查询；`project-initialization` 是 `COMPOSITE`，因为它需要引导用户完成多阶段访谈。

## 第三段源码：实际 frontmatter 对比

### `info-query` 的 frontmatter：

```typescript
// [templates/skills/info-query/SKILL.md 第 1—19 行](../../../../templates/skills/info-query/SKILL.md#L1)
---
name: info-query
description: 信息查询技能，帮助用户通过对话式界面查询项目相关信息
originos-system: true
version: 1.0.0
type: SIMPLE
author: OriginOS
tags:
  - query
  - search
  - information
reads:
  - ontology
  - project
  - task
writes: []
prerequisites: []
dependencies: []
---
```

### `project-initialization` 的 frontmatter：

```typescript
// [templates/skills/project-initialization/SKILL.md 第 1—5 行](../../../../templates/skills/project-initialization/SKILL.md#L1)
---
name: project-initialization
description: OriginOS 项目访谈 Skill - 通过对话式引导完成项目业务建模。采用"领域发现"和"业务精炼"两阶段模式，从模糊想法到严谨的业务模型。
originos-system: true
---
```

**对比分析**：

| 字段 | `info-query` | `project-initialization` | 原因 |
| --- | --- | --- | --- |
| `version` | `1.0.0` | 无 | `info-query` 有版本管理需求 |
| `type` | `SIMPLE` | 无 | `project-initialization` 的 type 在代码中推断 |
| `author` | `OriginOS` | 无 | `project-initialization` 是系统内置，不需要 author |
| `tags` | 有 | 无 | `info-query` 需要被搜索发现 |
| `reads` | 有 | 无 | `info-query` 声明数据访问权限 |
| `writes` | `[]` | 无 | `info-query` 只读不写 |

**关键判断**：`project-initialization` 的 frontmatter 更简洁，因为它的元数据在代码中有其他方式获取（如硬编码在 routing rule 中）。`info-query` 的 frontmatter 更完整，因为它需要被动态发现和加载。

## 第四段源码：`openspec-propose` 的 frontmatter

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

**系统级 Skill 的额外字段**：

| 字段 | 类型 | 作用 |
| --- | --- | --- |
| `license` | `string` | 开源协议（如 `MIT`） |
| `compatibility` | `string` | 依赖的系统能力 |
| `metadata` | `object` | 扩展元数据（author、version、generatedBy） |

**关键判断**：这些字段不在 `SkillMetadata` 接口中定义，说明系统级 Skill 的 frontmatter 是**扩展格式**，由 OpenSpec CLI 解析，而不是由 OriginOS 的 Skill Loader 解析。

## 调用链：Frontmatter 从文件到内存

```text
SKILL.md 文件
  → 被 Skill Loader 读取
    → 按 `---` 分割 frontmatter 和 body
      → frontmatter 用 YAML 解析器解析 → SkillMetadata 对象
      → body 保留为原始 Markdown 字符串
    → 注册到 Registry
      → Agent 根据 SkillMetadata 选择 Skill
        → 将 body 注入 System Prompt
```

## 失败路径：Frontmatter 可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| `name` 包含空格 | 无法被引用 | `name` 应该是 kebab-case（如 `travel-planner`） |
| `type` 写成 `Simple`（大小写错误） | 类型不匹配 | `SkillType` 枚举值是小写的 `simple` |
| `version` 格式不标准 | 版本比较失败 | 应使用语义化版本（如 `1.0.0`） |
| `reads` 声明了不存在的 Ontology 类型 | 运行时查询失败 | 声明与实际数据模型不一致 |
| `dependencies` 包含未安装的 Skill | 执行时找不到依赖 | 依赖管理缺失 |
| `priority` 写成数字而非字符串 | 类型错误 | 应该是 `'low' \| 'medium' \| 'high' \| 'critical'` |
| YAML 语法错误（如缩进不一致） | 整个 frontmatter 解析失败 | YAML 对缩进敏感 |

## 测试证据

```bash
# 验证 YAML frontmatter 是否合法
node -e "
const fs = require('fs');
const yaml = require('yaml');
const content = fs.readFileSync('templates/skills/info-query/SKILL.md', 'utf8');
const parts = content.split('---');
if (parts.length < 3) {
  console.log('FAIL: 缺少 frontmatter 分隔符');
  process.exit(1);
}
try {
  const frontmatter = yaml.parse(parts[1]);
  console.log('Frontmatter keys:', Object.keys(frontmatter));
  console.log('YAML OK');
} catch (e) {
  console.log('FAIL:', e.message);
}
"
```

**测试缺口**：
- 没有自动化测试验证 frontmatter 字段的完整性
- 没有测试验证 `name` 的唯一性
- 没有测试验证 `type` 的有效性
- 没有测试验证 `version` 的语义化格式

## 小实验

**实验 1：创建一个 frontmatter 有错误的 Skill**

在 `templates/skills/` 下新建 `bad-skill/SKILL.md`：

```markdown
---
name: Bad Skill
version: 1.0
type: COMPOSITE
---

# Bad Skill
```

**观察**：
- `name` 包含空格，是否符合规范？
- `type` 是大写的 `COMPOSITE`，是否符合 `SkillType` 枚举？
- `version` 是 `1.0` 而不是 `1.0.0`，是否标准？

**实验 2：对比三个 Skill 的 frontmatter**

| 字段 | `info-query` | `project-initialization` | `openspec-propose` |
| --- | --- | --- | --- |
| `name` | | | |
| `description` | | | |
| `version` | | | |
| `type` | | | |
| `author` | | | |
| `license` | | | |
| `compatibility` | | | |
| `metadata` | | | |
| `tags` | | | |
| `reads` | | | |
| `writes` | | | |

**思考**：为什么不同 Skill 的 frontmatter 字段数量差异这么大？

## 口头验收

1. **`name` 和 `displayName` 有什么区别？** 能说出 `name` 是机器标识、`displayName` 是人类展示吗？
2. **`SIMPLE` 和 `COMPOSITE` 类型的 Skill 有什么区别？** 能说出前者单一用途、后者编排其他 Skill 吗？
3. **`reads` 和 `writes` 是做什么的？** 能说出它们声明了 Skill 的数据访问权限吗？
4. **`priority` 字段的值有哪些？** 能说出 `'low' \| 'medium' \| 'high' \| 'critical'` 吗？
5. **如果 `version` 写成 `1.0` 而不是 `1.0.0`，会出问题吗？** 能说出语义化版本的规范吗？

## 本课结论

本课建立了 frontmatter 的完整认知：

- **Frontmatter 是“合同”**，不是“配置”
- **必填字段**：`name`、`description`、`type`、`version`
- **可选字段**：`displayName`、`priority`、`dependencies`、`reads`、`writes`、`inputContract`、`outputContract`、`preconditions`、`postconditions`
- **系统级 Skill 有扩展字段**：`license`、`compatibility`、`metadata`
- **字段缺失或格式错误可能导致 Skill 无法被加载**

下一课（L04）将深入 body 的结构化约定，回答“SKILL.md 的 body 里每个 Section 代表什么”这个问题。
