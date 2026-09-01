# E62：健康、通知和上传记录让运行时状态可见

## 1. 这一节解决什么问题

稳定系统不能只在报错时才有信息。小林使用旅行 Agent 时，系统还要知道：Agent 是否运行中、是否正在处理、处理了多少消息、最近心跳是否超时、是否有待审批通知、上传过哪些文件。

这些都属于可观测性。可观测性不是日志越多越好，而是关键状态能被查询、被展示、被追溯。

## 2. 健康监控源码

核心源码是 [packages/core/src/lib/integrations/pi-agent/health.ts 第 1 行](../../../../packages/core/src/lib/integrations/pi-agent/health.ts#L1)。

`AgentHealthStatus` 包含：

| 字段 | 含义 |
| --- | --- |
| `status` | healthy、unhealthy、initializing |
| `uptime` | 运行时长 |
| `memoryUsage` | 内存使用 |
| `messagesProcessed` | 已处理消息数 |
| `lastHeartbeat` | 最后心跳 |
| `sessionId` | 对应会话 |
| `isProcessing` | 是否正在处理 |
| `error` | 不健康原因 |

`HealthMonitor` 通过 `markAsRunning`、`markAsStopped`、`recordMessageHandled`、`recordError` 等方法更新这些状态。

## 3. 健康状态怎样计算

`getHealthStatus()` 先根据 AgentStatus 映射健康状态：

| AgentStatus | HealthStatus |
| --- | --- |
| RUNNING | healthy |
| INITIALIZING | initializing |
| IDLE / ERROR | unhealthy |

然后它检查心跳时间。如果 healthy 但超过 30 秒无心跳，也会转成 unhealthy，并记录 `Heartbeat timeout`。

```mermaid
flowchart TD
    A[HealthMonitor 状态] --> B{AgentStatus}
    B -->|RUNNING| C[healthy]
    B -->|INITIALIZING| D[initializing]
    B -->|IDLE/ERROR| E[unhealthy]
    C --> F{lastHeartbeat 超过 30 秒}
    F -->|是| G[unhealthy + Heartbeat timeout]
    F -->|否| H[返回健康状态]
    D --> H
    E --> H
```

这张图说明：健康不是一个手工标签，而是由运行状态和心跳共同决定。

## 4. 通知系统：把需要用户处理的状态落盘

通知源码在 [packages/core/src/lib/integrations/pi-agent/notification-system.ts 第 1 行](../../../../packages/core/src/lib/integrations/pi-agent/notification-system.ts#L1)。

它定义了通知类型和状态：

| 类型 | 用途 |
| --- | --- |
| `ONTOLOGY_CHANGE` | 本体变更审批 |
| `SYSTEM_ALERT` | 系统警告 |
| `TASK_COMPLETION` | 任务完成 |
| `SYSTEM_MESSAGE` | 系统消息 |

| 状态 | 含义 |
| --- | --- |
| `PENDING` | 等待处理 |
| `APPROVED` | 已批准 |
| `REJECTED` | 已拒绝 |
| `DISMISSED` | 已忽略 |
| `READ` | 已读 |

`NotificationManager` 会把每条通知保存成 `notifications/{id}.json`。这意味着通知不是一闪而过的 toast，而是可以查询和过滤的运行时记录。

## 5. 上传记录：文件进入会话也要留下痕迹

上传记录源码在 [packages/core/src/lib/integrations/pi-agent/upload-tracker.ts 第 1 行](../../../../packages/core/src/lib/integrations/pi-agent/upload-tracker.ts#L1)。

`recordUploads(agentDir, files)` 会把文件名、路径、大小、上传时间追加到 `MEMORY.md` 的 `Uploaded Files` 区块。这样后续 Agent 启动或恢复时，可以知道小林上传过哪些旅行材料。

这不是文件内容索引，也不是完整权限系统。它记录的是“用户上传过这些文件，路径在这里”。真正读取内容仍要走文件工具或文档工具。

## 6. 三者的关系

```mermaid
flowchart LR
    A[健康监控] --> D[系统是否正常运行]
    B[通知系统] --> E[哪些状态需要用户处理]
    C[上传记录] --> F[哪些材料进入过会话]
    D --> G[可观测性]
    E --> G
    F --> G
```

小林的场景里：

- Agent 卡住时，看健康状态和心跳；
- Agent 修改本体需要确认时，看通知；
- Agent 说找不到预算文件时，看上传记录和工作目录。

## 7. 测试证据与缺口

[packages/core/src/lib/integrations/pi-agent/__tests__/health.test.ts 第 1 行](../../../../packages/core/src/lib/integrations/pi-agent/__tests__/health.test.ts#L1) 覆盖：

- 初始状态 unhealthy；
- running 映射 healthy；
- initializing 映射 initializing；
- error 映射 unhealthy；
- 消息计数和 heartbeat 更新；
- 30 秒心跳超时；
- 健康检查性能小于 50ms。

通知和上传记录当前更偏基础文件存储逻辑，仍需要更完整的端到端测试来证明前端通知面板、审批动作、上传 UI 和 Agent 记忆加载之间完全打通。

## 8. 源码链路补强：HealthMonitor 是状态机，不是一次性检查函数

`HealthMonitor` 内部保存 `status`、`startTime`、`messagesProcessed`、`lastHeartbeat`、`lastError`、`isProcessing` 和 agent 引用。每一次状态变化都会更新这些字段。

例如 `markAsRunning()` 会把状态设为 RUNNING，记录启动时间，刷新心跳并清空错误；`recordError(error)` 会把状态设为 ERROR，保存错误并刷新心跳；`markAsStopped()` 会回到 IDLE，清空 startTime 和 processing。

| 方法 | 改变的状态 |
| --- | --- |
| `markAsRunning` | RUNNING、startTime、heartbeat、清空 error |
| `markAsStopped` | IDLE、startTime=null、processing=false |
| `recordMessageHandled` | messagesProcessed + 1、heartbeat |
| `markProcessingStart/End` | isProcessing true/false |
| `recordError` | ERROR、lastError、heartbeat |
| `reset` | 回到初始状态 |

```mermaid
stateDiagram-v2
    [*] --> IDLE
    IDLE --> RUNNING: markAsRunning
    RUNNING --> ERROR: recordError
    RUNNING --> IDLE: markAsStopped
    ERROR --> RUNNING: markAsRunning
    IDLE --> INITIALIZING: setStatus
    INITIALIZING --> RUNNING: markAsRunning
```

这张状态图帮助读者理解：健康检查返回值不是凭空计算出来的，它来自一系列状态更新。

## 9. 通知为什么要落盘

`NotificationManager` 构造时会把通知目录设为 `baseDir/notifications`，并确保目录存在。创建通知时，它生成 uuid、设置 `PENDING`、写入 createdAt/updatedAt，再保存成 JSON 文件。列通知时，它读取所有 `.json` 文件，按 status、type、sessionId、projectId 过滤，最后按 createdAt 倒序返回。

这说明通知系统提供的是可追溯记录，而不是临时 UI 消息。小林没有立即处理“本体变更审批”，下次打开仍应能看到 pending 通知。

| 操作 | 源码行为 |
| --- | --- |
| 创建通知 | 生成 id，状态 PENDING，写入文件 |
| 读取通知 | 按 id 读取 JSON |
| 更新状态 | 改 status 和 updatedAt，再写回 |
| 列通知 | 读目录、过滤、倒序排序 |

## 10. 上传记录为什么写入 MEMORY.md

`recordUploads` 把上传文件追加到 `MEMORY.md`，而不是写到临时变量。这样 Agent 恢复时能在状态记忆里看到上传材料。每条记录包含文件名、路径、大小和上传时间。

但这里有边界：上传记录不是文件索引系统。文件是否还存在、是否可读、内容是什么，都需要后续工具验证。小林上传过 `budget.xlsx`，只说明曾经上传，不保证文件现在还在原路径。

## 11. 三种可观测性的边界

| 机制 | 看得见什么 | 看不见什么 |
| --- | --- | --- |
| 健康监控 | Agent 是否运行、心跳、错误、消息数 | 具体业务内容是否正确 |
| 通知系统 | 待处理事项和审批状态 | 用户是否理解通知含义 |
| 上传记录 | 文件进入会话的痕迹 | 文件内容是否有效 |

本节还必须讲清边界。否则读者会误以为“有 health 就能知道任务成功”“有上传记录就能读取文件”。可观测性提供证据，不替代业务判断。

## 12. 源码链接补充：前端通知如何承接

本节核心在 core，但通知最终要给用户看。前端相关入口包括 [packages/web/src/components/os/notification/NotificationBell.tsx 第 1 行](../../../../packages/web/src/components/os/notification/NotificationBell.tsx#L1)、[packages/web/src/components/os/notification/NotificationPanel.tsx 第 1 行](../../../../packages/web/src/components/os/notification/NotificationPanel.tsx#L1) 和 [packages/web/src/store/notificationStore.ts 第 1 行](../../../../packages/web/src/store/notificationStore.ts#L1)。

这说明通知链路至少有两段：core 负责生成和持久化通知，web 负责展示和交互状态。教材在 Part E 只讲 Pi Agent 基础运行时，因此不展开通知 UI 的全部实现，但必须让读者知道：可观测状态最终要进入用户界面，否则只存在文件里，用户仍然看不见。

## 13. 小林案例：一次完整可观测排查

小林说“我上传了预算表，为什么 Agent 还说找不到？”排查不应该只看聊天文本。

| 排查问题 | 应看证据 |
| --- | --- |
| 文件是否上传过 | `MEMORY.md` 的 Uploaded Files |
| Agent 是否仍在运行 | `HealthMonitor.getHealthStatus()` |
| 最近是否报错 | health error 或 ErrorHandler |
| 是否有待处理通知 | notification list |
| 文件路径是否仍有效 | 文件/文档工具读取 |

这条链路说明：可观测性是多个证据源的组合。上传记录说“曾经上传”，健康状态说“Agent 当前怎样”，工具读取说“现在能否访问文件”。

## 14. 健康检查的性能要求

[packages/core/src/lib/integrations/pi-agent/__tests__/health.test.ts 第 1 行](../../../../packages/core/src/lib/integrations/pi-agent/__tests__/health.test.ts#L1) 里检查健康状态需要小于 50ms。这是合理的，因为健康检查可能被频繁调用。如果健康检查本身很慢，就会变成新的性能问题。

健康检查只读取内存状态、时间和内存使用估算，不应做重 IO、不应调用模型、不应扫描大目录。这也是为什么通知列表和上传文件内容不应该塞进 health：它们是不同的观测入口。

## 15. 本节验收清单

读者学完本节，要能用下面清单审查一个运行时状态问题：

1. Agent 是否处于 running、initializing、idle 或 error。
2. 健康状态是否因心跳超时变成 unhealthy。
3. `messagesProcessed` 是否随消息处理增加。
4. `isProcessing` 是否能表示当前是否在处理。
5. 通知是否有 id、type、status、createdAt、updatedAt。
6. 通知是否可以按 status、type、sessionId、projectId 过滤。
7. 上传记录是否包含文件名、路径、大小、上传时间。
8. 上传记录是否被误当成文件内容本身。

这张清单让可观测性从概念落到检查项。小林遇到问题时，系统要能回答“现在状态如何、发生过什么、还缺什么证据”。

## 16. 纸面推演 / 口头验收

纸面推演：Agent 状态是 RUNNING，但 31 秒没有更新 heartbeat。健康状态应是什么？

合格答案：应返回 unhealthy，并记录 `Heartbeat timeout`。

口头验收：读者应能解释健康、通知、上传记录分别观察不同层面，不能互相替代。

## 17. 本节小结

可观测性要覆盖运行状态、用户待处理事项和输入材料痕迹。下一节把 E56-E62 串成一次完整稳定性验收。
