# L10：单元小结——Skill 的定义、加载与运行

> 本课是 Unit 1（Skill 定义与加载）的总结课。我们将回顾本单元的核心概念，建立完整的 Skill 认知框架。

## 本单元学习路线回顾

```
L01: Skill 是什么？          → L02: .codex vs templates/skills/
  ↓
L03: Frontmatter 详解         → L04: Body 结构详解
  ↓
L05: Skill 资产               → L06: Skill 评测
  ↓
L07: Skill 加载链路           → L08: Skill 分类
  ↓
L09: 运行时副本               → L10: 单元小结（本课）
```

## 核心概念地图

### 1. Skill 的本质

```
Skill = 定义（SKILL.md）+ 运行时（handler）
```

| 维度 | 内容 | 位置 |
| --- | --- | --- |
| **定义** | Frontmatter + Body | `templates/skills/{name}/SKILL.md` |
| **资产** | References + Assets + Scripts | `templates/skills/{name}/` 子目录 |
| **运行时** | Handler + Registry | `packages/core/src/lib/features/skills/bundled/` |
| **评测** | Evolution.json + 报告 | `templates/skills/{name}/evolution.json` |

### 2. Skill 的两种“家”

| 维度 | `.codex/skills/` | `templates/skills/` |
| --- | --- | --- |
| **用途** | 系统级 Skill（OpenSpec 工作流） | 业务级 Skill（用户可见） |
| **数量** | 5 个 | 30 个 |
| **优先级** | 高（系统内置） | 中（用户可覆盖） |
| **代表** | `openspec-propose-change` | `project-initialization` |

### 3. Frontmatter vs Body

| 维度 | Frontmatter | Body |
| --- | --- | --- |
| **格式** | YAML | Markdown |
| **作用** | 机器可读（路由、权限、依赖） | 人类可读（能力描述、使用说明） |
| **关键字段** | `type`（SIMPLE/COMPOSITE） | `## Overview`、`## Capabilities` |
| **解析时机** | 加载时 | 执行时 |

### 4. Skill 的加载链路

```
templates/skills/{name}/SKILL.md
  → 读取文件
    → 解析 Frontmatter → metadata
    → 解析 Body → 能力描述
      → 构建 LoadedSkill 对象
        → 注册到 skillRegistry
          → 用户请求到达
            → findSkill() 查找
              → loadSkillHandler() 加载
                → 创建 SkillContext
                  → 调用 handler()
                    → 返回 SkillResult
```

### 5. Skill 的分类

| 分类维度 | 类别 | 数量 | 代表 |
| --- | --- | --- | --- |
| **用途** | BMAD 框架技能 | 14 | `bmad-agent-builder` |
| | 业务技能 | 10 | `project-initialization` |
| | 元技能 | 5 | `skill-creator-app` |
| | 系统技能 | 1 | `model-review` |
| **类型** | SIMPLE | 5 | `info-query` |
| | COMPOSITE | 5 | `project-initialization` |
| **生命周期** | 创建期 | 3 | `project-initialization` |
| | 运行期 | 3 | `info-query` |
| | 优化期 | 3 | `bmad-agent-builder` |
| | 协作期 | 2 | `bmad-party-mode` |

### 6. 运行时副本 vs 模板

| 维度 | 模板 | 运行时副本 |
| --- | --- | --- |
| **位置** | `templates/skills/{name}/` | `packages/core/src/lib/features/skills/bundled/{name}/` |
| **内容** | 完整（SKILL.md + assets + scripts） | 精简（SKILL.md + handler.ts） |
| **更新方式** | 手动编辑 | 重新构建 |
| **用途** | 开发和维护 | 运行时加载 |

## 关键源码回顾

### 源码 1：Skill 类型定义

```typescript
// packages/core/src/types/skill.ts 第 11—14 行
export enum SkillType {
  SIMPLE = 'simple',       // Single-purpose skill
  COMPOSITE = 'composite', // Skill that orchestrates other skills
}
```

### 源码 2：Skill 查找优先级

```typescript
// packages/core/src/lib/features/skills/service.ts 第 259—275 行
function findSkillForContent(name: string): Skill | undefined {
  const dataSkill = loadSkillFromDirectory(path.join(getSkillsDataDir(), name), 'user').skill;
  if (dataSkill) {
    return dataSkill;  // 优先：用户自定义
  }

  const skill = findSkill(name);
  if (skill?.systemManaged) {
    return materializeBundledSkill(skill.code ?? skill.name) ?? skill;  // 其次：系统内置
  }
  return skill ?? materializeBundledSkill(name) ?? undefined;  // 最后：运行时副本
}
```

### 源码 3：Skill 执行启动

```typescript
// packages/core/src/lib/features/skills/service.ts 第 561—696 行
export async function startSkillExecution(
  request: SkillExecutionStartRequest
): Promise<{ status: number; data: SkillExecutionStartResponse }> {
  const skillName = request.skillName;
  const skill = findSkill(skillName);
  const loadedSkill = loadSkillHandler(skillName);
  
  // 创建 SkillContext
  const skillContext: SkillContext = {
    sessionId,
    session: { /* ... */ },
    input: { /* ... */ },
    tools: createSkillContextTools(),
    config: { /* ... */ },
  };

  // 调用 Skill handler
  const result = await loadedSkill.handler(skillContext);
  // ...
}
```

## 失败路径总结

| 问题 | 现象 | 解决方案 |
| --- | --- | --- |
| Frontmatter 解析失败 | 无法加载 Skill | 检查 YAML 语法 |
| Handler 未定义 | 执行时报错 | 检查 loader.ts |
| Registry 重复注册 | 覆盖已有 Skill | 检查 Skill 名称唯一性 |
| 模板修改后副本未更新 | 运行时行为未变 | 重新构建 |
| 用户自定义 Skill 覆盖系统内置 | 系统行为异常 | 检查查找优先级 |
| `evolution.json` 格式损坏 | 无法读取运行记录 | 修复 JSON 格式 |
| 评测用例不覆盖 | 通过评测但仍有 bug | 补充评测用例 |

## 测试证据总结

| 测试项 | 命令 | 状态 |
| --- | --- | --- |
| 检查 Skill 文件数量 | `git ls-files templates/skills/ | wc -l` | ✅ 231 文件 |
| 检查 bundled skills | `ls packages/core/src/lib/features/skills/bundled/` | ✅ 4 个 |
| 检查运行时副本 | `diff templates/skills/info-query/SKILL.md packages/core/src/lib/features/skills/bundled/info-query/SKILL.md` | ✅ 一致 |
| 检查 evolution.json | `cat templates/skills/role-agent-creator/evolution.json` | ✅ 存在 |
| 检查评测脚本 | `ls templates/skills/skill-creator-app/scripts/` | ✅ 存在 |

## 小实验：综合练习

**实验 1：追踪一个 Skill 的完整生命周期**

选择 `info-query`，回答：

1. 它的 `SKILL.md` 在哪里？
2. 它的 frontmatter 是什么？
3. 它的 handler 在哪里？
4. 它的运行时副本在哪里？
5. 它有 `evolution.json` 吗？

**实验 2：对比 SIMPLE 和 COMPOSITE Skill**

| 维度 | `info-query` (SIMPLE) | `project-initialization` (COMPOSITE) |
| --- | --- | --- |
| Frontmatter 的 `type` | | |
| Body 的结构 | | |
| Handler 的复杂度 | | |
| 是否有 Phase | | |
| 文件数量 | | |

**实验 3：分析 Skill 加载链路**

1. 打开 `packages/core/src/lib/features/skills/service.ts`
2. 找到 `startSkillExecution` 函数
3. 画出从用户请求到 Skill 执行的完整调用链

## 口头验收

1. **Skill 的本质是什么？** 能说出是“定义 + 运行时”吗？
2. **Frontmatter 和 Body 的区别是什么？** 能说出前者机器可读、后者人类可读吗？
3. **Skill 的加载链路是什么？** 能说出读取 → 解析 → 构建对象 → 注册到 Registry 吗？
4. **运行时副本和模板的关系是什么？** 能说出副本是精简版，需要重新构建吗？
5. **Skill 的查找优先级是什么？** 能说出用户自定义 > 系统内置 > 运行时副本吗？

## 本单元结论

本单元建立了 Skill 的完整认知框架：

- **Skill 是“定义 + 运行时”**：`SKILL.md` 定义能力，`handler.ts` 实现执行
- **Frontmatter 机器可读，Body 人类可读**：两者缺一不可
- **Skill 有 30 个，分为 4 类**：BMAD 框架、业务、元、系统
- **加载是解析过程，不是复制**：读取 → 解析 → 构建对象 → 注册到 Registry
- **运行时副本是精简版**：只包含核心文件，需要重新构建才能更新
- **评测追踪运行数据**：`evolution.json` 记录每次运行的指标

## 下一单元预告

**Unit 2：BMAD Skill 家族**

我们将深入 BMAD 框架的 14 个 Skill，了解它们如何协同工作：

- `bmad-agent-builder`：Agent 构建框架
- `bmad-workflow-builder`：工作流构建
- `bmad-module-builder`：模块构建
- `bmad-brainstorming`：创意发散
- `bmad-distillator`：信息蒸馏
- ...

这些 Skill 共同构成了 OriginOS 的“自我构建”能力。
