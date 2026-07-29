## Context

现有 Session persistence 已支持 list/get/create/update，Desktop IPC 和 Web API
也已有 Session Get 边界。缺口位于 renderer lifecycle：窗体选择历史条目后只改
`activeSessionId`，`AgentDialogContent` 会被 `isInitialized` 提前返回，
`usePiAgent.initialize()` 则无条件 `setMessages([])`。此外，stream subscription
没有围绕一次 Session 切换建立完整的 abort、epoch 和迟到事件隔离。

本变更跨 Core integration、Desktop IPC 和两个 Web 窗体。canonical 历史仍由
现有 Agent Session persistence 持有；renderer 只保存当前展示投影。

## Goals / Non-Goals

**Goals:**

- 让 Skill、Agent、RoleAgent 历史条目触发真实 Session restore。
- 原子恢复可见消息、project context、Agent 类型、CWD、outputDir 和 LLM config。
- 在目标 Session 上恢复或创建正确的 AgentManager runtime binding。
- 防止快速切换、旧 stream 和迟到 restore 覆盖当前 Session。
- 恢复失败时保留当前可用 Session，并给用户明确反馈。
- 复用统一 contract，避免三类窗体各自实现恢复逻辑。

**Non-Goals:**

- 不恢复未持久化的进程内 tool promise。
- 不改写历史 Session 文件或增加第二份 canonical state。
- 不改变 Chat Completion Guard、Goal/Task Runtime 或 Multi-Agent。
- 不重做历史列表样式或增加远程历史同步。

## Decisions

### 1. 复用 Session Get，新增客户端 restore action

`getAgentSession(sessionId, projectId)` 已能跨 Electron IPC 和 Web API 返回
StoredSession。`usePiAgent` 新增 `restoreSession()`，负责：

1. 校验 response 与 ownership；
2. abort 当前 stream 并使旧 subscription 失效；
3. 调用 Session create/ensure 路径重绑目标 runtime，或者由服务端提供等价 restore；
4. 一次性提交目标 `sessionId`、messages、project context 和 initialized 状态；
5. 重新订阅目标 Session 的事件。

不把“历史恢复”继续隐式塞进 `initialize()`。`initialize()` 仍表示新建/确保
Session，`restoreSession()` 表示加载既有 canonical state，语义清晰且便于测试。

**替代方案：** 在每个 Dialog 中先 `getAgentSession()` 再调用 `initialize()`。
拒绝，因为会继续复制 mapping、竞态和错误处理，而且 `initialize()` 当前会清空
消息。

### 2. 服务端事实源优先，renderer 原子替换

restore 返回的消息和上下文以持久化 StoredSession 为事实源。renderer 不从现有
UI 消息拼接历史，也不将旧/新 Session 的消息合并。目标快照验证成功后才一次性
替换当前状态，切换期间保留旧画面并禁用输入。

内部 system、thinking 和 recovery-only 内容由统一 display mapper 过滤。

**替代方案：** 先清空 UI 再逐条加载。拒绝，因为会产生空白闪烁、O(n²) state
更新，并在失败时破坏当前可用状态。

### 3. epoch 与 Session identity 双重隔离

每次 restore 递增 `restoreEpoch`。异步结果只有同时满足以下条件才可提交：

- epoch 等于最新值；
- target Session 等于最新 target；
- project/entry ownership 匹配；
- hook 未 destroy。

stream event 也必须绑定订阅时的 Session ID；切换后旧 Session 的 delta/end
事件直接丢弃。切换开始时 abort 当前生成，但 abort 的迟到事件仍由 identity
guard 兜底。

**替代方案：** 只使用 AbortController。拒绝，因为 IPC/已完成 Promise 不一定
支持真正取消，仍需逻辑 epoch 防止迟到提交。

### 4. ownership 在服务边界校验

restore request 携带 `sessionId` 与 `projectId`，必要时携带 entry scope。
服务端在返回消息正文前校验目标 Session 属于当前 Skill/Agent/RoleAgent。
不存在、归属不符、损坏和 runtime 恢复失败使用稳定错误码。

**替代方案：** 仅在 renderer 根据列表过滤。拒绝，因为 renderer 数据不能成为
授权边界。

### 5. Agent runtime 使用现有公开 AgentManager 路径

服务端发送下一条消息时本就通过 StoredSession 配置调用
`agentManager.getOrCreateAgent()`。恢复路径必须确保目标 Agent 实例使用目标
Session 保存的 system prompt、Agent 类型、CWD、outputDir 和 LLM config。
不得读取 Pi Runtime 私有 Session 文件；若公开 runtime 无法恢复某项，结果必须
返回 `resumable=false` 或 warning，不能伪造。

### 6. 组件只维护交互状态

`SkillDialog` 和 `AgentDialogContent` 只维护 history popover、target loading
和错误展示，并调用同一个 `restoreSession()`。Agent/RoleAgent 共用
`AgentDialogContent` 路径。点击当前 Session 幂等，删除按钮继续
`stopPropagation()`。

### 7. Subagent 与 worktree 边界

| 工作包 | 独占写入范围 |
|---|---|
| Core/client restore | `packages/core/src/lib/integrations/pi-agent/` 及相邻测试 |
| Desktop/Web 接线 | `packages/desktop/src/main/services/`、两个 Dialog 和相邻测试 |
| 集成验证 | Proposal worktree，仅合并、文档、测试和状态更新 |

工作包使用独立 Git task branch/worktree，不能直接复制目录。若 Core contract
和 UI 接线需要同一类型，先合并 Core 工作包，再让 UI 工作包 rebase/merge 该
公开 contract，避免重复定义。

## Data Ownership / API Contract

canonical state 仍为 StoredSession。建议的客户端 API：

```typescript
interface RestoreAgentSessionRequest {
  sessionId: string;
  projectId: string;
  entryType?: 'skill' | 'agent' | 'role-agent';
  entryId?: string;
}

interface RestoreAgentSessionResult {
  sessionId: string;
  projectContext: ProjectContext;
  messages: DisplayMessage[];
  agentType?: string;
  llmConfig?: RuntimeLLMConfig;
  runtime: {
    restored: boolean;
    resumable: boolean;
    warning?: string;
  };
}
```

若现有 Session Get 已能满足数据面，IPC 不新增重复 channel；restore runtime
动作可以复用 create/ensure。最终实现以最小公共边界为准。

## Risks / Trade-offs

- **历史 runtime 只持久化了部分 Pi 状态** → 明确区分消息/context 已恢复与
  runtime resumable，缺失能力返回 warning，并增加回归测试。
- **切换时旧模型仍产生事件** → abort 加 Session identity/epoch 双 guard。
- **超长历史导致窗体卡顿** → 一次性 state commit、稳定 key、复用现有有界
  stream renderer；1,000 条历史加入性能验收。
- **跨 project Session 泄漏** → 服务端 ownership 校验先于消息正文返回。
- **新旧初始化语义混用** → `initialize` 与 `restoreSession` 分离，组件不得用
  `setActiveSessionId` 代替 restore。
- **三个窗体行为再次分叉** → contract/hook 单元测试加 Skill、Agent、RoleAgent
  集成矩阵。

## Migration Plan

1. 先增加 restore contract、mapper、epoch guard 和测试，不修改 UI。
2. 接入 Desktop/Web service adapter。
3. 接入 SkillDialog，再接入 AgentDialogContent 覆盖 Agent/RoleAgent。
4. 运行现有 Session、stream、Chat Guard 和 desktop smoke 回归。
5. 不迁移历史数据；旧 Session 缺字段时按兼容规则返回 warning。

回滚时撤销 Proposal merge commit。没有 persistence schema 写入或数据迁移，
因此无需数据回滚。

## Open Questions

无阻断问题。实施时需通过测试确认现有 `AgentSessionService.getSession()` 返回的
StoredSession 是否已包含全部 display messages 和目标配置；若缺少字段，只能在
Core 公共 DTO 中补齐，不得从 renderer 解析 runtime 私有 state。

