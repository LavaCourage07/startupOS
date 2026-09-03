# F.1 单元导读：Agent 与 Skill 的功能层

## 本单元要回答什么

用户在首页点击一个 Agent 或 Skill 图标后，第一个接住请求的代码在哪里？

不是 `pi-agent/core/agent.ts`，也不是某个具体的 launcher。在 Part E 里我们已经知道，OriginOSAgent 负责一次会话的运行时；但在那之前，Web 或 Desktop 需要先完成几件事：

1. 确定这是一个 Agent 还是 Skill；
2. 找到对应的公共 API；
3. 创建或复用一个会话；
4. 解析工作目录、产物目录、系统 Prompt；
5. 最后才进入 launcher 或 runtime。

这些“之前的事”就是 `features/agent` 和 `features/skills` 的职责。本单元讲的就是这层**功能层**如何封装底层运行时，给上层提供稳定的合同。

## 为什么先讲功能层

Part F 的主线是“Agent 如何长期工作和进化”。如果一上来就讲 `role-agent` 的状态机或 `cognitive` 的知识提取，读者会不知道这些能力是从哪里被调起来的。

功能层的好处是：

- **对 Web/Desktop 隐藏运行时细节**：Web 不需要知道 `OriginOSAgent` 内部怎么流式返回，它只需要调用 `sessionService.createSession` 或 `skillService.startSkillExecution`。
- **统一 Agent 与 Skill 的会话模型**：无论是普通 Agent、RoleAgent、ProjectAgent 还是 Skill，最终都落到 `AgentSession` 上。
- **提供可测试的边界**：功能层有明确的输入输出，可以单独写集成测试，而不用启动完整 Agent。

## 本单元的文件簇

本单元覆盖两个相邻但职责不同的 feature：

| Feature | 主要职责 | 关键文件 |
|---|---|---|
| `features/agent` | Agent 注册表、会话服务、项目 Agent 定义、系统 Prompt 模板 | `session-service.ts`、`project-agent.ts`、`registry.ts`、`prompts/*` |
| `features/skills` | Skill 发现、执行、流式消息、timeline、项目初始化 Skill | `service.ts`、`executor.ts`、`decision.ts`、`registry.ts`、`project-initialization/*` |
| `shared/agent` | Layer 0 解析接口，让 modules 不直接依赖 integrations | `types.ts` |

## 概念阶梯

**Agent**：一个长期运行的智能体身份，可以是 Assistant、RoleAgent 或 ProjectAgent。

**Skill**：一段可被调用的能力，通常以 Markdown + handler 形式存在，有自己的工作目录和产物目录。

**Session**：一次正在进行的对话上下文，包含消息历史、项目上下文、状态等。

**Feature Layer vs Integration Layer**：

- `features/agent` 是“业务功能层”，面向产品能力；
- `integrations/pi-agent` 是“集成层”，面向具体运行时（LLM、流式、工具调用）。

两者通过 `AgentSession`、`AgentMessage` 等共享类型连接，符合 AGENTS.md 的按序依赖原则。

## 本单元 17 节课的结构

1. **F01**：从首页入口到 Agent/Skill 会话的分层调用链（全景课）。
2. **F02**：`shared/agent/types.ts` —— Layer 0 Agent 解析接口，为什么 modules 不能直接 import integrations。
3. **F03–F06**：`features/agent` 公共 API、注册表、会话服务。
4. **F07–F11**：`features/agent/project-agent.ts` 与项目访谈 Prompt —— 项目 Agent 如何初始化并生成本体。
5. **F12–F16**：`features/skills` 框架：注册表、服务、执行器、决策器、项目初始化 Skill。
6. **F17**：单元小结课，从首页 Skill 入口追踪到 `session-service` 的完整链路。

## 读完本单元后，你应该能解释

- 用户点击 Skill 图标后，控制流经过哪些文件？
- `features/agent/session-service.ts` 与 `integrations/pi-agent/session-store.ts` 有什么区别？
- 为什么 `shared/agent/types.ts` 属于 Layer 0，而 `features/agent/registry.ts` 属于 Layer 2？
- `features/skills/service.ts` 如何把一个 Skill 请求转换成一次 Agent 会话？
- 如果 `agentSessionService.createSession` 失败，上层会收到什么错误？

## 本单元留下的问题

功能层只是入口。创建会话之后，系统如何根据 Agent 类型选择启动路径？不同类型的 Agent 需要准备哪些不同的上下文？这就是下一单元 **F.2 启动器与持久化 Agent 运行时** 要解决的问题。
