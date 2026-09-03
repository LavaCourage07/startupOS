# F.2 单元导读：启动器与持久化 Agent 运行时

## 本单元要回答什么

上一单元（F.1）讲了用户在首页点击 Agent/Skill 入口后，请求如何落到 `features/agent` 和 `features/skills` 的功能层。功能层把请求转换成一次 `AgentSession`，但**创建会话并不等于启动运行**。

本单元要回答的是：创建会话之后，系统如何根据入口类型准备不同的上下文、构建不同的 system prompt、选择不同的运行时，让 Agent 真正“活”起来？

具体来说，有两条主线：

1. **启动器主线**：`features/services/launcher/*` 按 `entryType` 分发到四种启动器（`agent`、`role-agent`、`project`、`skill`），完成“读文件 → 拼 prompt → 创建/恢复会话 → 注册 Agent”四步。
2. **持久化运行时主线**：`integrations/pi-agent/persistent-agent*` 让 Agent 在项目维度长期存活，支持热重载、认知钩子和 Memory Core 工具注入。

## 为什么 Launcher 与 Persistent Agent 要放在一起讲

- **Launcher 决定“怎么启动”**：它屏蔽了不同入口类型的差异，给上层一个统一的 `LaunchContext / LaunchResult` 合同。
- **Persistent Agent 决定“启动后怎么活”**：普通 Agent 可能随窗口关闭而销毁，但项目 Agent 需要跟随项目生命周期，持续积累记忆和知识。
- **两者共享同一套数据目录**：`data/agents/{id}/`、`data/projects/{id}/`、`data/skills/{code}/`，只是读取和拼接 prompt 的策略不同。

## 本单元的文件簇

| 文件/模块 | 主要职责 | 关键类型 |
|---|---|---|
| `features/services/launcher/base.ts` | 启动器基类、启动合同、`buildAgentSystemPrompt` | `EntryType`, `LaunchContext`, `LaunchResult`, `Launcher` |
| `features/services/launcher/registry.ts` | 启动器注册表，按类型路由 | `LauncherRegistry`, `launcherRegistry`, `launch` |
| `features/services/launcher/agent.ts` | 普通 Agent 启动器（`agentType='assistant'`） | `AgentLauncher` |
| `features/services/launcher/project.ts` | 项目入口启动器（`agentType='project'`） | `ProjectLauncher` |
| `features/services/launcher/role-agent.ts` | RoleAgent 启动器（`agentType='role-agent'`） | `RoleAgentLauncher` |
| `features/services/launcher/skill.ts` | Skill 启动器（`agentType='skill'`） | `SkillLauncher` |
| `integrations/pi-agent/persistent-agent.ts` | 持久化 Agent 实例、workspace 文件加载、初始化/热重载/关闭 | `PersistentAgent`, `loadWorkspaceFiles` |
| `integrations/pi-agent/persistent-agent-manager.ts` | 项目 Agent 单例管理器、认知 Providers 注册、Memory Core 工具注入 | `PersistentAgentManager`, `persistentAgentManager` |
| `integrations/pi-agent/use-persistent-agent.ts` | Web/Desktop 复用的 React Hook | `usePersistentAgent` |
| `integrations/pi-agent/memory-consumption.ts` | prompt 记忆段落构建 | `buildPromptMemorySections` |
| `integrations/pi-agent/runtime-working-summary.ts` | 运行时工作摘要 | `buildRuntimeWorkingSummary` |
| `integrations/pi-agent/recent-trace-compression.ts` | 近期工具调用 trace 压缩 | `compressRecentTrace` |
| `integrations/pi-agent/goal-extension.ts` | Pi Agent Adapter Goal 扩展注册 | `registerGoalExtension` |

## 概念阶梯

**Launcher**：启动器，负责把一次入口调用转换成可运行的 Agent 会话。

**EntryType**：入口类型，包含 `project`、`agent`、`role-agent`、`skill`。

**LaunchContext / LaunchResult**：启动合同的输入和输出。输入告诉启动器“启动谁”，输出返回“会话 ID、system prompt、agent 类型、工作目录、可用工具”。

**PersistentAgent**：长期运行的 Agent 实例，与项目绑定，支持热重载和认知钩子。

**PersistentAgentManager**：管理多个 `PersistentAgent` 实例的单例，提供 `startAgent / stopAgent / getAgent / reloadAgent`。

**CognitiveManager**：认知系统入口，在 `turn_end` 和 `session_end` 时触发实践日志、知识提取、模式沉淀。

**Memory Core Tools**：`core_memory_append / replace / read`、`archival_memory_insert / search` 等工具，让 Agent 在运行时读写长期记忆。

## 本单元 14 节课的结构

1. **F18**：`launcher/base.ts` + `registry.ts` —— 启动器合同与路由。
2. **F19**：`launcher/agent.ts` —— 普通 Agent 启动器。
3. **F20**：`launcher/project.ts` —— 项目入口启动器。
4. **F21**：`launcher/role-agent.ts` —— RoleAgent 启动器与状态机/记忆钩子。
5. **F22**：`launcher/skill.ts` —— Skill 启动器与依赖/产物目录解析。
6. **F23**：启动器测试与验证 —— `skill-launcher.test.ts` 与边界场景。
7. **F24**：`persistent-agent.ts` —— 工作空间文件加载与初始化流程。
8. **F25**：`persistent-agent.ts` 事件订阅与认知钩子。
9. **F26**：`persistent-agent-manager.ts` —— 项目 Agent 生命周期与认知 Providers。
10. **F27**：`use-persistent-agent.ts` —— React Hook 与流式状态管理。
11. **F28**：`memory-consumption` / `runtime-working-summary` / `recent-trace-compression` —— prompt 记忆与 trace 压缩。
12. **F29**：`goal-extension.ts` —— Goal 扩展注册边界。
13. **F30**：启动器与持久化运行时的集成关系 —— 什么时候用 launcher，什么时候用 persistent agent。
14. **F31**：单元小结 Workshop。

## 读完本单元后，你应该能解释

- 为什么需要 `LauncherRegistry`，而不是在 Web/Desktop 里直接判断入口类型？
- `AgentLauncher` 和 `ProjectLauncher` 构建 system prompt 的方式有什么不同？
- `RoleAgentLauncher` 如何在启动时加载状态机和记忆追踪器？
- `SkillLauncher` 如何解析 `SKILL.md` frontmatter、处理 `outputDir`、物化 bundled Skill？
- `PersistentAgent` 与普通 `OriginOSAgent` 有什么不同？它为什么需要 `PersistentAgentManager`？
- `PersistentAgent` 的 `turn_end` 钩子如何驱动认知系统？
- `usePersistentAgent` 如何处理 StrictMode 双挂载、流式增量、工具执行帧和中止？
- `compressRecentTrace` 为什么要保留完整的 tool call/result 组？

## 本单元留下的问题

启动器和持久化运行时只是让 Agent “能启动、能长期跑”。Agent 跑起来后，如何按角色状态机推进、如何维护角色记忆、如何做梦和整理记忆，这是 **F.3 RoleAgent** 要解决的问题；Agent 如何在项目上下文中读取业务模型、进行项目访谈，这是 **F.4 ProjectAgent** 要解决的问题；认知系统的完整实现则在 **F.5 / F.6**。
