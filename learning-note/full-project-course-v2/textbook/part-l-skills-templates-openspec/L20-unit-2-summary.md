# L20：单元小结——BMAD Skill 家族

> 本课是 Unit 2（BMAD Skill 家族）的总结课。我们将回顾本单元的核心概念，建立完整的 BMAD 认知框架。

## 本单元学习路线回顾

```
L11: bmad-agent-builder — Agent 构建框架
L12: bmad-workflow-builder — 工作流构建
L13: bmad-module-builder — 模块构建
L14: bmad-brainstorming — 创意发散
L15: bmad-distillator — 信息蒸馏
L16: bmad-bmb-setup — 环境初始化
L17: bmad-editorial-review-* — 质量审查
L18: bmad-help / bmad-index-docs / bmad-party-mode / bmad-shard-doc — 辅助 Skill
L19: BMAD Skill 协同工作模式
L20: 单元小结（本课）
```

## 核心概念地图

### 1. BMAD 框架的四大角色

| 角色 | Skill | 职责 | 输出 |
| --- | --- | --- | --- |
| **Builder** | `bmad-agent-builder` | 构建 Agent | SKILL.md + sanctum |
| **Maker** | `bmad-workflow-builder` | 构建工作流 | workflow 定义 |
| **Analyzer** | `bmad-distillator` | 分析、蒸馏信息 | Distillation Report |
| **Discoverer** | `bmad-brainstorming` | 发现、发散创意 | 行动计划 |

### 2. 14 个 BMAD Skill 的分类

| 类别 | Skill | 数量 | 说明 |
| --- | --- | --- | --- |
| **核心 Builder** | `bmad-agent-builder`、`bmad-workflow-builder`、`bmad-module-builder` | 3 | 构建 Agent、工作流、模块 |
| **创意工具** | `bmad-brainstorming`、`bmad-distillator` | 2 | 发散创意、蒸馏信息 |
| **环境配置** | `bmad-bmb-setup` | 1 | 初始化 BMAD 环境 |
| **质量审查** | `bmad-editorial-review-prose`、`bmad-editorial-review-structure`、`bmad-review-adversarial-general`、`bmad-review-edge-case-hunter` | 4 | 散文、结构、对抗、边界 |
| **辅助工具** | `bmad-help`、`bmad-index-docs`、`bmad-party-mode`、`bmad-shard-doc` | 4 | 帮助、索引、多 Agent、分片 |

### 3. Agent 的三种类型

| 类型 | 特征 | 文件结构 | 适用场景 |
| --- | --- | --- | --- |
| **Stateless** | 无记忆，无 First Breath | 只有 `SKILL.md` | 单次会话的专家 |
| **Memory** | 有记忆，有 First Breath | `SKILL.md` + sanctum (6 文件) | 长期对话的助手 |
| **Autonomous** | 有记忆 + PULSE | Memory agent + `PULSE.md` | 自主运行的 Agent |

### 4. 构建流程

```
创意发散（Brainstorming）
  ↓
信息蒸馏（Distillator）
  ↓
Agent/工作流/模块构建（Builder）
  ↓
质量审查（Review）
  ↓
部署运行
```

### 5. 协同工作模式

```
用户请求
  → Intent 识别（Router）
    → 匹配到 Skill A
      → Skill A 执行
        → 需要 Skill B
          → 通过 Registry 查找
            → 加载 Handler
              → 执行
                → 返回结果
              → Skill A 继续
            → Skill A 完成
```

## 关键源码回顾

### 源码 1：Agent 类型定义

```typescript
// templates/skills/bmad-agent-builder/SKILL.md
- **Stateless agent** — everything in SKILL.md, no memory, no First Breath.
- **Memory agent** — lean bootloader SKILL.md + sanctum (6 standard files + First Breath).
- **Autonomous agent** — memory agent + PULSE.
```

### 源码 2：配置层级

```typescript
// templates/skills/bmad-bmb-setup/SKILL.md
1. System defaults (lowest priority)
2. Project config (config.yaml)
3. User config (config.user.yaml)
4. Legacy config (bmb/config.yaml)
```

### 源码 3：协同调用

```typescript
// packages/core/src/lib/features/skills/service.ts
const skill = findSkill(skillName);
const loadedSkill = loadSkillHandler(skillName);
const result = await loadedSkill.handler(skillContext);
```

## 失败路径总结

| 问题 | 现象 | 解决方案 |
| --- | --- | --- |
| Agent 类型选择错误 | 行为不符合预期 | 重新进行 Phase 1 发现 |
| 工作流步骤循环依赖 | 无法执行 | 重新设计步骤依赖 |
| 模块边界模糊 | 难以维护 | 按职责、复用性、依赖关系划分 |
| 创意发散方向混乱 | 产出无效 | 加强 Phase 1 问题定义 |
| 蒸馏结果表面化 | 洞察不深 | 请求 "Deeper" 分析 |
| 配置冲突 | 行为异常 | 检查配置层级和覆盖关系 |
| 审查标准不一致 | 结论矛盾 | 统一审查标准 |
| 循环依赖 | 无限循环 | 检查 Skill 依赖关系 |

## 测试证据总结

| 测试项 | 命令 | 状态 |
| --- | --- | --- |
| 检查 BMAD Skill 数量 | `ls templates/skills/ | grep bmad | wc -l` | ✅ 14 个 |
| 检查 Agent Builder 文件数 | `ls templates/skills/bmad-agent-builder/ | wc -l` | ✅ ~52 |
| 检查 Workflow Builder 文件数 | `ls templates/skills/bmad-workflow-builder/ | wc -l` | ✅ ~31 |
| 检查配置层级 | `cat templates/skills/bmad-bmb-setup/SKILL.md` | ✅ 4 层 |
| 检查审查 Skill | `ls templates/skills/bmad-review-*` | ✅ 4 个 |

## 小实验：综合练习

**实验 1：设计一个完整的 BMAD 工作流**

假设用户说："I want to build a customer support agent"

1. 首先激活哪个 Skill？
2. 经过哪些阶段？
3. 会调用哪些其他 Skill？
4. 最终的输出是什么？

**实验 2：分析 BMAD 框架的优缺点**

| 优点 | 缺点 |
| --- | --- |
| | |

## 口头验收

1. **BMAD 框架包含多少个 Skill？** 能说出 14 个吗？
2. **Agent 有哪三种类型？** 能说出 Stateless、Memory、Autonomous 吗？
3. **BMAD 的四大角色是什么？** 能说出 Builder、Maker、Analyzer、Discoverer 吗？
4. **配置有几层？优先级是什么？** 能说出 4 层，用户 > 项目 > 系统吗？
5. **Skill 之间是怎么协同的？** 能说出通过 Registry 和 Service 层间接调用吗？

## 本单元结论

本单元建立了 BMAD Skill 家族的完整认知：

- **14 个 BMAD Skill**：核心 Builder（3）、创意工具（2）、环境配置（1）、质量审查（4）、辅助工具（4）
- **Agent 三种类型**：Stateless、Memory、Autonomous
- **构建流程**：创意发散 → 信息蒸馏 → 构建 → 审查 → 部署
- **配置分层**：系统默认、项目配置、用户配置、旧版配置
- **协同模式**：通过 Registry 和 Service 层间接调用

## 下一单元预告

**Unit 3：Meta-skills & Ecosystem**

我们将深入了解：

- `agent-creator`：Agent 创建
- `role-agent-creator`：角色 Agent 创建
- `skill-creator-app`：Skill 创建
- `project-skill-creator`：项目 Skill 创建
- `search-and-install-skill`：搜索安装 Skill

这些 Meta-skill 让 OriginOS 能够自我进化。
