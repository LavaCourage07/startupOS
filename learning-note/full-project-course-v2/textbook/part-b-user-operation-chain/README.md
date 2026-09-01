# Part B：从用户操作看完整链路

> 共 12 节。在读者已经会用架构罗盘之后，用一条真实用户动作把 Web 入口、窗口、API、Core、Agent 运行时、文件产物串起来。

主线案例：**用户在首页点击「头脑风暴」卡片**。

| 课号 | 课题 | 学完后能做什么 | 文件 |
| --- | --- | --- | --- |
| B01 | 首页入口为什么分成 skill 和 action | 解释 `HOME_APPS` 中 `type` 与 `skillName` 如何决定入口身份 | `B01-home-entry-is-just-config.md` |
| B02 | 点击后谁决定打开哪个窗口 | 追踪 `HOME_APPS.map` → `onClick` → `handleSkillLaunch` → 窗口配置 | `B02-click-to-window.md` |
| B03 | 窗口管理器不只管视觉 | 说明 `AppWindowManager` 如何统一 Web / 原生窗口并注入生命周期回调 | `B03-window-manager-is-lifecycle-boundary.md` |
| B04 | SkillDialog 拿到入口身份后做什么 | 理解 `SkillDialog` 的 props、state、稳定 session id、技能列表与历史加载 | `B04-skill-dialog-prepares-session.md` |
| B05 | 技能内容从磁盘到前端有多远 | 追踪技能列表与内容请求经适配层、API route、service 到磁盘的完整路径 | `B05-skill-content-from-disk-to-ui.md` |
| B06 | SkillDialog 如何把 SKILL.md 变成系统提示词 | 解释 `buildSkillSystemPrompt` 的目录边界、正文、规则、变量替换 | `B06-skill-md-to-system-prompt.md` |
| B07 | 创建 Agent 会话时跨越了哪条 HTTP 边界 | 追踪 `usePiAgent.initialize` → `createAgentSession` → API → `agentSessionService` | `B07-session-initialization-boundary.md` |
| B08 | 发送消息不是直接调用模型 | 理解消息 API 的所有权校验、运行时恢复、消息持久化 | `B08-message-ownership-and-runtime-restore.md` |
| B09 | 流式回复怎样一段一段出现在窗口 | 解释 SSE / IPC 事件流、去重、调度渲染与 abort 后的状态丢弃 | `B09-streaming-response-piece-by-piece.md` |
| B10 | 窗口关闭不等于会话删除 | 说明关闭窗口时 `destroyAgentSession` 与 `consolidateMemory` 的生命周期语义 | `B10-close-window-vs-delete-session.md` |
| B11 | 产物和会话在哪里留下痕迹 | 追踪 `outputDir` / `workingDir` 进入工具上下文，产物与会话 JSON 的落盘位置 | `B11-artifacts-and-session-storage.md` |
| B12 | Part B 复盘：完整链路认知地图与故障排查 | 把 B01–B11 串成一张从首页到文件的地图，能按层定位常见故障 | `B12-user-operation-chain-review.md` |

Part B 不深入 Pi Agent runtime 内部（那是 Part E），而是让读者看清「一次点击到哪里去、经过哪些边界、数据怎样变形」。
