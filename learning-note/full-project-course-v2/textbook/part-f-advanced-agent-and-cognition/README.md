# Part F：RoleAgent、ProjectAgent 与认知系统

> 共 80 节。Part F 讲解 Agent 如何从“一次会话”变成“长期运行、能自我进化的智能体”：RoleAgent 如何加载角色定义并按状态机推进；ProjectAgent 如何在项目上下文中协作；认知系统如何记录实践、提取知识、沉淀模式；以及这些能力如何与 Memory Core 桥接。

---

## 1. 本部分在全书中的位置

Part E 已经把“一个 Agent 会话怎样被创建、接收消息、调用工具、流式返回、保存和恢复”讲完了。但 OriginOS 里的 Agent 不止于一次会话：

- 用户可以安装一个 **RoleAgent**，让它带着固定角色长期服务；
- 可以把 Agent 绑定到 **项目**，让它在项目上下文中协作；
- 系统还可以在运行中积累 **记忆、知识和模式**，让 Agent 越用越顺手。

Part F 就是解决这三件事：持久化、角色化、项目化、认知化。它衔接 Part E 的基础运行时，又为 Part G 的业务功能、Part H 的 Memory Core  deeper 实现、Part K 的 Agent Adapter 提供上下文。

## 2. 真实主线

> 用户在首页看到一个 Agent 或 Skill 入口，点击后发生了什么？

这条调用链会穿过多个层级：

1. **功能层**：`features/agent` 和 `features/skills` 提供面向 Web/Desktop 的公共 API，负责会话、Agent 注册、Skill 发现与执行。
2. **启动层**：`features/services/launcher` 根据 Agent 类型（`assistant` / `role-agent` / `project` / `skill`）选择启动路径，准备 workspace 和 prompt。
3. **持久运行时层**：`persistent-agent` 让 Agent 长期存活，`persistent-agent-manager` 管理实例生命周期。
4. **角色化层**：`role-agent` 加载角色定义、状态机、技能、记忆，构建 7 层 System Prompt。
5. **项目化层**：`project-agent` 加载项目上下文、业务模型、协作 prompt，构建项目化 Agent。
6. **认知层**：`cognitive` 在每轮和会话结束时记录实践日志、提取知识、沉淀模式。
7. **记忆桥接层**：`memory-core` 的认知相关接口为 cognitive 提供长期存储和检索能力。

Part F 的每一节课只解开这条链路中的一环，但始终让读者知道自己在主线的哪个位置。

## 3. 覆盖范围

按 `learning-note/full-project-course-v2/course-overview.md` 的划分，Part F 覆盖：

- `packages/core/src/lib/features/agent/**`
- `packages/core/src/lib/features/skills/**`（不含 `bundled/*` handlers，那些归 Part G）
- `packages/core/src/lib/features/services/launcher/**`
- `packages/core/src/lib/integrations/pi-agent/persistent-agent*`、`use-persistent-agent*`、`goal-extension.ts`、`runtime-working-summary.ts`、`memory-consumption.ts`、`recent-trace-compression.ts`
- `packages/core/src/lib/integrations/pi-agent/role-agent/**`
- `packages/core/src/lib/integrations/pi-agent/project-agent/**`
- `packages/core/src/lib/integrations/pi-agent/cognitive/**`（含 `cognitive/pattern/*`）
- `packages/core/src/lib/shared/agent/**`、`packages/core/src/lib/shared/cognitive/**`
- `packages/core/src/modules/memory-core/` 的认知桥接部分

## 4. 单元地图

| 单元 | 节数 | 核心问题 |
|---|---|---|
| **F.1 Agent 与 Skill 的功能层** | 17 | 用户入口如何落到 `features/agent` 和 `features/skills` 的公共 API？ |
| **F.2 启动器与持久化 Agent 运行时** | 14 | launcher 如何按 Agent 类型分发？持久化 Agent 怎样长期存活？ |
| **F.3 RoleAgent：角色生命周期与状态机** | 14 | Agent 如何被赋予角色并按状态机推进、维护记忆？ |
| **F.4 ProjectAgent：项目化协作 Agent** | 10 | Agent 如何在项目上下文中协作？ |
| **F.5 认知系统：记忆、知识、实践与模式** | 16 | Agent 如何在运行中记录实践、提取知识、沉淀模式？ |
| **F.6 Memory Core 认知桥接与端到端集成** | 9 | cognitive 如何与 memory-core 协同？整条链路如何串起来？ |

## 5. 阅读建议

- **前置要求**：必须先读完 Part E，理解 `OriginOSAgent`、`AgentManager`、工具调用、流式消息、Skill 加载的基本机制。
- **每一节课的结构**：开篇场景 → 核心问题 → 概念阶梯 → 图解 → 源码精读 → 调用链 → 类型与数据 → 失败路径 → 测试证据 → 练习验收 → 章节收束。
- **单元小结课**：每单元最后一节是 workshop，会用一张“小黑图”复盘，并给出一条可运行的综合实验。

## 6. 边界说明

- **Memory Core 边界**：Part F 只讲 cognitive 系统直接调用的 memory-core 桥接文件，底层实现（embedding、HNSW、tokenizer、consolidator、dream-compat）归入 **Part H**。
- **Skill handlers 边界**：`features/skills/bundled/*` 的内置 Skill handlers 归入 **Part G**，Part F 只讲 Skill 框架层。
- **测试策略**：`features/agent/*`、`features/skills` 部分文件、`persistent-agent*`、`launcher` 多数文件当前无直接单元测试。教材采用“关键路径同步补最小集成测试 + 其余缺口明确标注运行验证”的策略。

## 7. 文件清单

### F.1 Agent 与 Skill 的功能层

| 文件 | 标题 |
|---|---|
| `F01-overview.md` | Part F 总览与认知地图 |
| `F02-agent-store.md` | `agent-store`：Agent 的持久化注册表 |
| `F03-agent-types-and-config.md` | Agent 类型与配置模型 |
| `F04-agent-session-service.md` | `agent-session-service`：会话生命周期服务 |
| `F05-agent-manager-integration.md` | 与 `AgentManager` 的桥接 |
| `F06-agent-api-router.md` | `agent-api-router`：HTTP 路由层 |
| `F07-agent-validation-and-error-handling.md` | 校验与错误处理 |
| `F08-agent-testing-strategy.md` | Agent 功能层测试策略 |
| `F09-skill-registry.md` | `skill-registry`：Skill 发现与元数据 |
| `F10-skill-loader.md` | `skill-loader`：Skill 内容加载 |
| `F11-skill-executor.md` | `skill-executor`：Skill 执行 |
| `F12-skill-materialization.md` | bundled Skill 物化 |
| `F13-skill-types-and-contracts.md` | Skill 类型与合同 |
| `F14-skill-api-and-permissions.md` | Skill API 与权限 |
| `F15-shared-agent-types.md` | `shared/agent` 类型 |
| `F16-shared-cognitive-types.md` | `shared/cognitive` 类型 |
| `F17-unit-1-workshop-agent-and-skill.md` | F.1 单元小结 Workshop |

### F.2 启动器与持久化 Agent 运行时

| 文件 | 标题 |
|---|---|
| `00-02-launcher-and-persistent-runtime-guide.md` | F.2 单元导学 |
| `F18-launcher-base-and-registry-contracts.md` | Launcher 基类与注册表合同 |
| `F19-launcher-agent.md` | `AgentLauncher`：普通 Agent 启动器 |
| `F20-launcher-project.md` | `ProjectLauncher`：项目入口启动器 |
| `F21-launcher-role-agent.md` | `RoleAgentLauncher`：角色 Agent 启动器 |
| `F22-launcher-skill.md` | `SkillLauncher`：Skill 启动器 |
| `F23-launcher-testing-and-validation.md` | Launcher 层测试与验证 |
| `F24-persistent-agent-workspace-and-initialization.md` | `PersistentAgent`：workspace 加载与初始化 |
| `F25-persistent-agent-events-and-cognitive-hooks.md` | `PersistentAgent`：事件与认知钩子 |
| `F26-persistent-agent-manager-lifecycle.md` | `PersistentAgentManager`：项目 Agent 生命周期管理 |
| `F27-use-persistent-agent-hook.md` | `usePersistentAgent`：React Hook 与流式状态管理 |
| `F28-memory-consumption-working-summary-and-trace-compression.md` | Prompt 记忆、工作摘要与 Trace 压缩 |
| `F29-goal-extension.md` | Goal Extension：Pi Agent Adapter 的扩展边界 |
| `F30-launcher-and-persistent-runtime-integration.md` | Launcher 与持久化运行时的集成关系 |
| `F31-unit-2-workshop-launcher-and-persistent-runtime.md` | F.2 单元小结 Workshop |

### F.3 RoleAgent：角色生命周期与状态机

| 文件 | 标题 |
|---|---|
| `F32-role-agent-overview.md` | F.3 单元导学：RoleAgent |
| `F33-role-context.md` | `role-context.ts` —— 加载角色上下文 |
| `F34-state-machine.md` | `state-machine.ts` —— 状态机解析与推进 |
| `F35-system-prompt.md` | `system-prompt.ts` —— 7 层 System Prompt 构建 |
| `F36-skill-resolver.md` | `skill-resolver.ts` —— 技能扫描与解析 |
| `F37-memory-tracker.md` | `memory-tracker.ts` —— JSONL 历史与 Memory.md |
| `F38-dream.md` | `dream.ts` —— Dream 自动记忆维护 |
| `F39-consolidator.md` | `consolidator.ts` —— Consolidator 预留接口 |
| `F40-role-agent-index.md` | `index.ts` —— 统一导出 |
| `F41-role-agent-launcher-integration.md` | RoleAgent 与 Launcher 的集成 |
| `F42-role-agent-testing.md` | RoleAgent 测试策略 |
| `F43-role-agent-boundaries.md` | RoleAgent 边界与扩展点 |
| `F44-role-agent-performance.md` | RoleAgent 性能优化 |
| `F45-unit-3-workshop-role-agent.md` | F.3 单元小结 Workshop |

### F.4 ProjectAgent：项目化协作 Agent

| 文件 | 标题 |
|---|---|
| `F46-project-agent-overview.md` | F.4 单元导学：ProjectAgent |
| `F47-project-context.md` | `project-context.ts` —— 加载项目上下文 |
| `F48-project-collaboration-context.md` | `project-collaboration-context.ts` —— 多 Agent 协作上下文 |
| `F49-project-prompt.md` | `project-prompt.ts` —— 6 层 Project Prompt 构建 |
| `F50-collaboration-prompt.md` | `collaboration-prompt.ts` —— 7 层协作 Prompt 构建 |
| `F51-project-skill-provisioning.md` | `project-skill-provisioning.ts` —— 技能幂等补齐 |
| `F52-project-agent-launcher-integration.md` | ProjectAgent 与 Launcher 的集成 |
| `F53-project-agent-testing.md` | ProjectAgent 测试策略 |
| `F54-project-agent-boundaries.md` | ProjectAgent 边界与扩展点 |
| `F55-unit-4-workshop-project-agent.md` | F.4 单元小结 Workshop |

### F.5 认知系统：记忆、知识、实践与模式

| 文件 | 标题 |
|---|---|
| `F56-cognitive-system-overview.md` | F.5 单元导学：认知系统 |
| `F57-cognitive-manager-lifecycle.md` | `CognitiveManager` 生命周期管理 |
| `F58-practice-logger.md` | `PracticeLogger`：实践日志记录 |
| `F59-unified-ontology.md` | `UnifiedOntology`：统一本体模型 |
| `F60-knowledge-provider.md` | `KnowledgeProvider`：知识提取与存储 |
| `F61-pattern-provider-patterns.md` | `PatternProvider`：模式识别与沉淀（上） |
| `F62-pattern-provider-reflexion.md` | `PatternProvider`：失败反思与 Reflexion |
| `F63-rule-engine.md` | `RuleEngine`：混合模式规则引擎 |
| `F64-sleep-compute.md` | `SleepComputeScheduler`：睡眠计算 |
| `F65-knowledge-ingest.md` | `KnowledgeIngest`：业务模型导入 |
| `F66-frozen-snapshot.md` | Frozen Snapshot 模式 |
| `F67-cognitive-roleagent-integration.md` | 认知系统与 RoleAgent 集成 |
| `F68-cognitive-projectagent-integration.md` | 认知系统与 ProjectAgent 集成 |
| `F69-cognitive-testing.md` | 认知系统测试策略 |
| `F70-cognitive-performance.md` | 认知系统性能优化与边界 |
| `F71-unit-5-workshop-cognitive.md` | F.5 单元小结 Workshop |

### F.6 Memory Core 认知桥接与端到端集成

| 文件 | 标题 |
|---|---|
| `F72-memory-core-overview.md` | F.6 单元导学：Memory Core |
| `F73-block.md` | `Block`：记忆基本单元 |
| `F74-memory.md` | `Memory`：Block 集合管理 |
| `F75-archival-memory.md` | `ArchivalMemory`：长期语义记忆 |
| `F76-hnsw-index.md` | `HNSWIndex`：向量索引 |
| `F77-recall-memory.md` | `RecallMemory`：对话历史 |
| `F78-memory-consolidator.md` | `MemoryConsolidator`：主动记忆整理 |
| `F79-memory-core-tools.md` | Memory Core 工具 API |
| `F80-unit-6-workshop-memory-core.md` | F.6 单元小结 Workshop |

## 8. 与后续 Part 的衔接

- **Part G**：`features/skills/bundled/*` 的 handler 业务逻辑、Core 其他业务功能。
- **Part H**：`modules/memory-core` 的完整实现、`modules/collaboration-runtime` 等。
- **Part I / J**：Web 的 API Route 和组件如何调用 `features/agent` 和 `features/skills`。
- **Part K**：`packages/agent` 与 `@originos/pi-agent-adapter` 的 Adapter 实现。
