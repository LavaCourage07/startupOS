# F.4 单元导学：ProjectAgent —— 项目化协作 Agent

## 核心问题

F.3 讲了 RoleAgent，它面向“角色”——有固定身份、状态机、技能的长期 Agent。ProjectAgent 则面向“项目”——在项目上下文中协作，支持多 Agent 协作、业务模型构建、技能按需加载。

ProjectAgent 和 RoleAgent 的核心区别：

1. **上下文来源不同**：RoleAgent 从 `data/agents/{id}/` 加载；ProjectAgent 从 `data/projects/{id}/` 加载。
2. **Prompt 结构不同**：RoleAgent 7 层；ProjectAgent 6 层（无安全层），且 Layer 3 是动态技能加载。
3. **协作模式不同**：RoleAgent 是单 Agent；ProjectAgent 支持多 Agent 协作（Collaboration Context）。
4. **技能管理不同**：RoleAgent 扫描 `.skills/` 软链接；ProjectAgent 按需从 bundled skills 复制到项目目录。

## 本单元结构

| 课 | 主题 | 核心文件 |
|---|---|---|
| F46 | ProjectAgent 总览与认知地图 | — |
| F47 | `project-context.ts`：项目上下文加载 | `project-agent/project-context.ts` |
| F48 | `project-collaboration-context.ts`：多 Agent 协作上下文 | `project-agent/project-collaboration-context.ts` |
| F49 | `project-prompt.ts`：6 层 Prompt 构建 | `project-agent/project-prompt.ts` |
| F50 | `collaboration-prompt.ts`：协作 Prompt 构建 | `project-agent/collaboration-prompt.ts` |
| F51 | `project-skill-provisioning.ts`：技能幂等补齐 | `project-agent/project-skill-provisioning.ts` |
| F52 | ProjectAgent 与 Launcher 的集成 | `launcher/project.ts`（回顾） |
| F53 | ProjectAgent 测试策略 | `__tests__/*` |
| F54 | ProjectAgent 边界与扩展点 | — |
| F55 | F.4 单元小结 Workshop | — |

## 阅读建议

- **前置要求**：必须先读完 F.3，理解 RoleAgent 的上下文加载和 prompt 构建。
- **关键概念**：`ProjectContext`、`ProjectCollaborationContext`、`ProjectPromptLayers`、`CollaborativePromptLayers`。
- **测试覆盖**：`__tests__/collaboration-prompt.test.ts`（7 层 prompt 构建）、`__tests__/project-skill-provisioning.test.ts`（技能幂等补齐）。
- **边界说明**：
  - ProjectAgent 的 6 层 prompt 和 RoleAgent 的 7 层 prompt 不完全相同；
  - `collaboration-prompt.ts` 是 ProjectAgent 的扩展，用于多 Agent 协作场景。

## 与后续单元的衔接

- **F.5 Cognitive**：ProjectAgent 也接入 cognitive 系统，但触发方式可能不同。
- **F.6 Memory Core**：ProjectAgent 使用相同的 Memory Core 接口。
