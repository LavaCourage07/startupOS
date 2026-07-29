## 追溯信息

- **epic-id：** OS
- **story-id：** OS.20
- **task-id：** OS.20-A01
- **owner：** Agent Runtime / Desktop UX
- **来源 Story：**
  - `docs/specs/epic-OS/story-OS.20/README.md`
  - `docs/specs/epic-OS/story-OS.20/requirements.md`
  - `docs/specs/epic-OS/story-OS.20/interaction.md`
  - `docs/specs/epic-OS/story-OS.20/architecture.md`
  - `docs/specs/epic-OS/story-OS.20/testing.md`

## Why

Skill、Agent 与 RoleAgent 窗体当前只更新本地 `activeSessionId`，没有形成可靠的
runtime 重绑；已有初始化路径还会清空 renderer 消息，导致所有历史会话条目点击
后无效或显示空白。用户无法继续历史任务，且后续消息存在写入错误 Session 的风险。

## What Changes

- 定义统一的历史 Session restore contract，原子返回目标 Session 的可见消息、
  project context、Agent 类型、CWD、outputDir、LLM config 和公开 runtime
  恢复状态。
- 在 Core Pi integration 中实现 ownership 校验、Session 恢复、展示消息映射和
  结构化错误，不解析 Pi Runtime 私有 Session 格式。
- 扩展 Desktop IPC 与客户端 `usePiAgent` action，使历史切换不再复用“初始化后
  清空消息”的语义。
- 让 `SkillDialog` 与 `AgentDialogContent` 的 Agent/RoleAgent 历史入口调用同一
  restore action。
- 增加 request epoch、stream abort 和 Session ID 事件隔离，防止快速切换和迟到
  流事件覆盖当前会话。
- 增加历史恢复、跨 Session 串写、失败保留、新建/删除回归和长历史性能测试。

## Capabilities

### New Capabilities

- `window-session-history-restore`：定义窗体历史会话选择、消息与执行上下文恢复、
  ownership、并发切换、错误反馈及跨窗体一致性契约。

### Modified Capabilities

无。

## 非目标

- 不迁移或重写现有 Session 文件。
- 不恢复进程内尚未持久化的 tool promise。
- 不修改 Chat Completion Guard、Goal/Task Runtime 或 Multi-Agent 行为。
- 不重做会话历史列表视觉设计。
- 不增加数据库、远程同步或跨设备历史。

## Impact

- **Core：** `packages/core/src/lib/integrations/pi-agent/` 的 restore contract、
  Session runtime 绑定、客户端 hook 和相邻测试。
- **Desktop：** `packages/desktop/src/main/services/agent-session-service.ts`、
  IPC protocol/service adapter 和测试。
- **Web：** `SkillDialog.tsx`、`AgentDialogContent.tsx` 及组件测试。
- **Public API：** 新增内部版本化 `restoreSession` request/result/error contract。
- **Persistence：** 不新增 canonical store；继续读取现有 Agent Session
  persistence。
- **IPC：** 新增或扩展一个 Session restore channel，参数包含 Session 与
  ownership scope。
- **Dependencies：** 不新增第三方依赖。
- **Platform：** Web development 与 Electron Windows/macOS 使用同一 contract；
  本变更不涉及签名、发布或安装包元数据。

## 依赖

- Pi Runtime 和 `AgentSessionService` 现有 Session list/get/reload 能力。
- Story OS.20 已提交的测试与验收定义。
- 所有源码修改必须在 Proposal 对应的隔离 Git task worktree 中完成。

## 上线方案

1. 先提交 Core restore contract 与确定性竞态测试。
2. 接入 Desktop IPC 和 `usePiAgent.restoreSession()`。
3. 依次接入 Skill、Agent、RoleAgent 窗体。
4. 运行单元、集成、组件、Desktop smoke、类型与架构检查。
5. 合并到 `dev` 后由用户在 `desktop:dev` 验证真实历史会话。

## 回滚方案

回滚 Proposal merge commit，恢复三个窗体原有初始化路径和 IPC contract。由于
本变更不迁移或改写历史数据，回滚不需要数据修复；已有 Session 文件保持可用。
