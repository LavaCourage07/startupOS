# 单元七：技能系统、用户配置与注册表（G61—G72）

> 本单元核心问题：OriginOS 的技能系统是怎么注册、路由、执行技能的？用户配置是怎么持久化的？用户注册表是怎么扫描和解析 Agent/Skill 的？

## 学习目标

完成本单元后，应能：

1. 解释技能系统的注册-路由-执行流程。
2. 理解 `SkillService` 是怎么加载技能、创建会话、执行技能的。
3. 理解 `DefaultSkillRegistry` 和 `DefaultSkillRouter` 是怎么工作的。
4. 理解 `SkillExecutor` 是怎么执行技能并注入工具的。
5. 理解 `AgentDecisionMaker` 是怎么检测意图并选择技能的。
6. 理解用户配置的读写流程。
7. 理解用户注册表是怎么扫描和解析 Agent/Skill 的。

## 前置知识

- Part A 系统基础
- Part B 用户操作链
- Part C 数据层
- Part D 集成层
- Part E 项目本体
- Part F 多 Agent 协作
- Part G Unit 1-6

## 涉及源码

| 文件 | 行数 | 说明 |
|------|------|------|
| `packages/core/src/lib/features/skills/index.ts` | ~20 | 统一导出 |
| `packages/core/src/lib/features/skills/service.ts` | ~1047 | SkillService |
| `packages/core/src/lib/features/skills/registry.ts` | ~136 | DefaultSkillRegistry / DefaultSkillRouter |
| `packages/core/src/lib/features/skills/executor.ts` | ~128 | SkillExecutor |
| `packages/core/src/lib/features/skills/decision.ts` | ~314 | AgentDecisionMaker |
| `packages/core/src/lib/features/user-config/index.ts` | ~211 | 用户配置读写 |
| `packages/core/src/lib/features/user-registry/index.ts` | ~209 | 用户注册表扫描 |
| `packages/core/src/lib/features/skills/bundled/task-manager/handler.ts` | ~382 | 任务管理技能 |
| `packages/core/src/lib/features/skills/bundled/info-query/handler.ts` | ~302 | 信息查询技能 |
| `packages/core/src/lib/features/skills/bundled/ontology-editor/handler.ts` | ~348 | 本体编辑技能 |

## 单元结构

| 课次 | 标题 | 核心源码 |
|------|------|----------|
| G61 | SkillService——技能是怎么被加载和执行的 | `service.ts` |
| G62 | SkillService 执行流程——从加载到完成 | `service.ts` |
| G63 | SkillService 流式执行——SSE 是怎么工作的 | `service.ts` |
| G64 | DefaultSkillRegistry——技能是怎么注册的 | `registry.ts` |
| G65 | DefaultSkillRouter——技能是怎么路由的 | `registry.ts` |
| G66 | SkillExecutor——技能是怎么被执行的 | `executor.ts` |
| G67 | AgentDecisionMaker——意图是怎么被检测的 | `decision.ts` |
| G68 | 单元小结课——画出"注册 → 路由 → 执行"的完整流程 | - |
| G69 | 用户配置——`readUserConfig` 和 `writeUserConfig` | `user-config/index.ts` |
| G70 | 用户配置——LLM 配置和运行时更新 | `user-config/index.ts` |
| G71 | 用户注册表——`listUserAgents` 和 `listUserSkills` | `user-registry/index.ts` |
| G72 | 单元小结课——画出"配置 → 注册表 → 技能系统"的完整调用链 | - |

## 关键概念

### 技能系统

OriginOS 的技能系统由四个核心组件组成：

1. **SkillRegistry**：注册和存储技能。
2. **SkillRouter**：根据请求路由到合适的技能。
3. **SkillExecutor**：执行技能并注入工具。
4. **AgentDecisionMaker**：检测用户意图并选择技能。

### 用户配置

用户配置包括：

- **通用配置**：主题、语言、通知设置。
- **LLM 配置**：Anthropic/OpenAI 的 API Key、模型选择。
- **运行时更新**：支持运行时更新配置。

### 用户注册表

用户注册表负责：

- **扫描目录**：扫描 `data/agents/` 和 `data/skills/` 目录。
- **解析元数据**：解析 `Agent.md` 和 `SKILL.md` 的 frontmatter。
- **CRUD 操作**：列出、获取、删除用户 Agent 和 Skill。

## 单元路线图

```
Skill 系统
├── SkillService (G61-G63)
│   ├── listSkills
│   ├── startSkillExecution
│   ├── completeSkillExecution
│   ├── sendSkillExecutionMessage
│   └── streamSkillExecutionMessage
├── Registry (G64-G65)
│   ├── DefaultSkillRegistry
│   └── DefaultSkillRouter
├── Executor (G66)
│   └── SkillExecutor
└── Decision (G67)
    └── AgentDecisionMaker

用户配置 (G69-G70)
├── readUserConfig
├── writeUserConfig
└── updateUserConfig

用户注册表 (G71)
├── listUserAgents
├── listUserSkills
├── getUserAgent
└── getUserSkill
```

## 下一单元预告

Part G 全部 72 课到此结束。接下来可以进入 Part H（如有）。
