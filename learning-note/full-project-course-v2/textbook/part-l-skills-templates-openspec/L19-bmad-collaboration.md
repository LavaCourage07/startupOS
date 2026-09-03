# L19：BMAD Skill 的协同工作模式

> 本课问题：BMAD 框架的 14 个 Skill 如何协同工作？它们之间的调用关系是什么？

## 小林的场景

小林已经了解了单个 BMAD Skill 的功能。现在她想创建一个完整的项目——从创意发起到最终交付，涉及多个 Skill 的协作。

她想知道：

- BMAD Skill 之间是怎么协作的？
- 一个 Skill 怎么调用另一个 Skill？
- 协同工作的流程是什么样的？

## 概念阶梯：协同不是“串联”，而是“编排”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “协同就是 A 做完 B 做” | 协同是**有条件的、可并行的编排** | 不是简单的串联，而是复杂的流程控制 |
| “Skill 之间直接调用” | Skill 之间通过**Registry 和 Service 层**间接调用 | 不是直接的函数调用，而是通过系统层调度 |
| “协同是自动的” | 协同需要**明确的触发条件和路由规则** | 不是自动的，而是需要配置的 |

## 第一段源码：BMAD Skill 的依赖关系

```typescript
// [templates/skills/bmad-module-builder/SKILL.md 第 15—20 行](../../../../templates/skills/bmad-module-builder/SKILL.md#L15)
dependencies:
  - bmad-agent-builder
  - bmad-workflow-builder
```

```typescript
// [templates/skills/bmad-workflow-builder/SKILL.md 第 15—20 行](../../../../templates/skills/bmad-workflow-builder/SKILL.md#L15)
dependencies: []
```

**依赖关系**：

| Skill | 依赖的 Skill | 说明 |
| --- | --- | --- |
| `bmad-module-builder` | `bmad-agent-builder`、`bmad-workflow-builder` | 模块构建需要 Agent 和工作流构建器 |
| `bmad-agent-builder` | 无 | 独立构建 |
| `bmad-workflow-builder` | 无 | 独立构建 |
| `bmad-brainstorming` | 无 | 独立运行 |
| `bmad-distillator` | 无 | 独立运行 |

## 第二段源码：Skill 的调用方式

```typescript
// [packages/core/src/lib/features/skills/service.ts 第 561—696 行](../../../../packages/core/src/lib/features/skills/service.ts#L561)
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

**调用方式**：

1. **通过 Registry 查找**：`findSkill(skillName)`
2. **加载 Handler**：`loadSkillHandler(skillName)`
3. **创建 Context**：`SkillContext`
4. **调用 Handler**：`loadedSkill.handler(skillContext)`
5. **返回结果**：`SkillResult`

**关键判断**：Skill 之间**不直接调用**，而是通过**系统层**（Registry + Service）间接调用。

## 第三段源码：典型的协同工作流

```
用户请求 "Create a project"
  → project-initialization 激活
    → Phase 1: 访谈（对话收集需求）
      → Phase 2: 生成本体
        → 调用 ontology-editor（内置 Skill）
          → 生成领域、概念、实例
        → Phase 3: 创建 Agent
          → 调用 bmad-agent-builder
            → 生成 Agent 定义
          → 调用 bmad-workflow-builder
            → 生成工作流定义
          → 调用 bmad-module-builder
            → 生成模块定义
        → Phase 4: 质量审查
          → 调用 bmad-editorial-review-prose
          → 调用 bmad-editorial-review-structure
          → 调用 bmad-review-adversarial-general
          → 调用 bmad-review-edge-case-hunter
        → Phase 5: 交付
          → 输出到指定目录
```

## 第四段源码：协同的触发条件

```typescript
// [templates/skills/bmad-agent-builder/SKILL.md 第 55—62 行](../../../../templates/skills/bmad-agent-builder/SKILL.md#L55)
| Intent                      | Trigger Phrases                                       | Route                                    |
| --------------------------- | ----------------------------------------------------- | ---------------------------------------- |
| **Build new**               | "build/create/design a new agent"                     | Load `./references/build-process.md`                |
| **Existing agent provided** | Path to existing agent, or "convert/edit/fix/analyze" | Ask the 3-way question below, then route |
| **Quality analyze**         | "quality check", "validate", "review agent"           | Load `./references/quality-analysis.md`             |
| **Unclear**                 | —                                                     | Present options and ask                  |
```

**触发条件**：

| 触发方式 | 说明 | 示例 |
| --- | --- | --- |
| **关键词匹配** | 用户输入包含特定关键词 | "build a new agent" |
| **路径匹配** | 用户提供了文件路径 | `/path/to/agent` |
| **Intent 识别** | 系统识别用户意图 | "quality check" |
| **显式调用** | 其他 Skill 显式调用 | `startSkillExecution({ skillName: 'bmad-agent-builder' })` |

## 调用链：BMAD 协同工作模式

```
用户请求
  → Intent 识别（Router）
    → 匹配到 Skill A
      → Skill A 执行
        → Skill A 需要 Skill B
          → 调用 startSkillExecution({ skillName: 'Skill B' })
            → Registry 查找 Skill B
              → 加载 Skill B Handler
                → 创建 Skill B Context
                  → 执行 Skill B Handler
                    → 返回 Skill B Result
                  → Skill A 接收结果
                → Skill A 继续执行
              → Skill A 完成
            → 返回最终结果
```

## 失败路径：协同可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 循环依赖 | 无限循环 | Skill A 调用 Skill B，Skill B 调用 Skill A |
| 依赖缺失 | 执行失败 | 依赖的 Skill 未注册 |
| 上下文丢失 | 结果不正确 | Skill 间传递的 Context 不完整 |
| 超时 | 执行失败 | 协同执行时间过长 |
| 结果冲突 | 最终结果不一致 | 多个 Skill 的结果冲突 |

## 测试证据

```bash
# 检查 BMAD Skill 的依赖关系
for skill in bmad-module-builder bmad-workflow-builder bmad-agent-builder; do
  echo "=== $skill dependencies ==="
  grep -A 5 "dependencies:" templates/skills/$skill/SKILL.md
done

# 检查 Registry 中的 Skill
node -e "const {skillRegistry} = require('./packages/core/src/lib/features/skills/registry'); console.log(skillRegistry.list().map(s => s.name));"
```

## 小实验

**实验 1：画出 BMAD Skill 的依赖图**

```
bmad-module-builder
  ├── bmad-agent-builder
  └── bmad-workflow-builder

bmad-agent-builder
  └── (无依赖)

bmad-workflow-builder
  └── (无依赖)
```

**实验 2：设计一个协同工作流**

假设用户说："I want to create a code review system"

1. 哪个 Skill 会被首先激活？
2. 这个 Skill 会调用哪些其他 Skill？
3. 最终的输出是什么？

## 口头验收

1. **BMAD Skill 之间是怎么协作的？** 能说出通过 Registry 和 Service 层间接调用吗？
2. **Skill 之间可以直接调用吗？** 能说出不直接调用，而是通过系统层调度吗？
3. **`bmad-module-builder` 依赖哪些 Skill？** 能说出 `bmad-agent-builder` 和 `bmad-workflow-builder` 吗？
4. **协同工作可能出什么问题？** 能说出循环依赖、依赖缺失、上下文丢失吗？
5. **触发 Skill 的方式有哪些？** 能说出关键词匹配、路径匹配、Intent 识别、显式调用吗？

## 本课结论

本课建立了 BMAD Skill 协同工作模式的完整认知：

- **协同是编排**：不是简单的串联，而是有条件的、可并行的编排
- **Skill 之间不直接调用**：通过 Registry 和 Service 层间接调用
- **依赖关系明确**：`bmad-module-builder` 依赖 `bmad-agent-builder` 和 `bmad-workflow-builder`
- **触发方式多样**：关键词匹配、路径匹配、Intent 识别、显式调用
- **协同有风险**：循环依赖、依赖缺失、上下文丢失、超时、结果冲突

下一课（L20）是 Unit 2 的单元小结。
