# F.3 单元导学：RoleAgent —— 角色生命周期与状态机

## 核心问题

F.2 讲了 launcher 如何按 `entryType` 分发到不同的启动器。当 `entryType = 'role-agent'` 时，系统进入 RoleAgent 路径。RoleAgent 和普通 Agent 有什么不同？

普通 Agent（`agentType = 'assistant'`）只有一套静态的 system prompt，会话结束后状态就丢了。RoleAgent 则要求：

1. **角色身份持久化**：Agent 有自己的工作目录（`data/agents/{id}/`），里面有 `Agent.md`、`Role.md`、`Tool.md`、`Taste.md`、`Memory.md`、`Knowledge.md`、`Patterns.md`。
2. **状态机驱动行为**：`Role.md` 定义了多个阶段（phase），Agent 在不同阶段有不同的行为特征。
3. **技能动态管理**：`.skills/` 目录中是已安装技能的软链接，Agent 启动时扫描，运行中可以安装/移除。
4. **记忆自动维护**：`Memory.md` 定期落盘，Dream 每 20 turn 自动整理，Memory Block 支持三元记忆。
5. **7 层 System Prompt**：Layer 1（身份）→ Layer 2（状态与记忆）→ Layer 3（思维循环）→ Layer 4（工具箱）→ Layer 5（风格）→ Layer 6（权限）→ Layer 7（安全）。

## 本单元结构

| 课 | 主题 | 核心文件 |
|---|---|---|
| F32 | RoleAgent 总览与认知地图 | — |
| F33 | `role-context.ts`：角色上下文加载 | `role-agent/role-context.ts` |
| F34 | `skill-resolver.ts`：技能扫描与解析 | `role-agent/skill-resolver.ts` |
| F35 | `state-machine.ts`：状态机解析与阶段推进 | `role-agent/state-machine.ts` |
| F36 | `system-prompt.ts`（上）：7 层 prompt 架构与 Layer 1-3 | `role-agent/system-prompt.ts` |
| F37 | `system-prompt.ts`（下）：Layer 4-7 与 prompt 组装 | `role-agent/system-prompt.ts` |
| F38 | `memory-tracker.ts`：JSONL 历史与 Memory Block | `role-agent/memory-tracker.ts` |
| F39 | `dream.ts`：两阶段自动记忆维护 | `role-agent/dream.ts` |
| F40 | `consolidator.ts`：Token 预算触发式压缩 | `role-agent/consolidator.ts` |
| F41 | `index.ts`：模块导出与公共 API | `role-agent/index.ts` |
| F42 | RoleAgent 与 Launcher 的集成 | `launcher/role-agent.ts`（回顾） |
| F43 | RoleAgent 测试策略 | `__tests__/*` |
| F44 | RoleAgent 边界与扩展点 | — |
| F45 | F.3 单元小结 Workshop | — |

## 阅读建议

- **前置要求**：必须先读完 F.2，理解 launcher 分发机制和 `LaunchContext`/`LaunchResult` 合同。
- **关键概念**：`RoleContext`、`StateMachine`、`MemoryTracker`、`Dream`、`MemoryBlock`。
- **测试覆盖**：`__tests__/index.test.ts`（barrel 导出）、`__tests__/memory-tracker.test.ts`（JSONL + cursor）、`__tests__/dream.test.ts`（ADD/REMOVE/UPDATE/SKILL）、`__tests__/consolidator.test.ts`（token 阈值）。
- **边界说明**：
  - `role-agent` 内部不直接调用 `persistent-agent-manager`，它只被 `RoleAgentLauncher` 调用。
  - Memory Core 的底层实现（`modules/memory-core`）属于 Part H，本单元只讲 `role-agent` 如何使用它。
  - `dream-compat.ts` 的 `parseDreamInstructions` / `applyDreamInstructions` 属于 Memory Core，本单元只讲调用合同。

## 与后续单元的衔接

- **F.4 ProjectAgent**：ProjectAgent 也使用类似的 7 层 prompt 架构，但数据来源不同（项目目录而非 Agent 目录）。
- **F.5 Cognitive**：RoleAgent 的 `turn_end` 钩子是 cognitive 系统的触发点之一。
- **F.6 Memory Core**：Memory Block 和 Dream 最终委托给 Memory Core 持久化。
