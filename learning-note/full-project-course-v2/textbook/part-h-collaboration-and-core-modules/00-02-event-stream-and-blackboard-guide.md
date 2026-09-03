# 单元导读二：事件流、持久化与黑板

## 单元总问题

多 Agent 运行时产生的事件如何被保存、索引和回放？黑板上的数据如何在进程重启后恢复？

## 为什么现在学这个单元

Unit 1 已经建立了协作运行时的对象地图：session、blackboard、ACL 消息。但这些对象如果只是内存中的数据结构，一旦进程崩溃或用户刷新页面，整个协作状态就会丢失。更重要的是，多个 Agent  concurrent 读写黑板时，系统必须能回答三个问题：

1. 谁、在什么时候、基于什么证据写了这个数据？
2. 事件发生的顺序是什么？
3. 进程重启后，如何恢复到崩溃前的状态？

本单元回答这些问题。它讲解事件存储的 append-only 语义、黑板的写入/锁定/上游结果管理、结构化 memory keys、任务快照，以及孤儿会话回收。到本单元结束，你应该能解释一次协作会话从创建到持久化再到恢复的完整链路。

## 主线案例在本单元的推进

小林的旅行协作会话启动后：

1. `TravelPlanner` Supervisor 发送第一条分解任务的事件，被 `FsEventStore` 按 seq 追加写入文件。
2. `HotelResearcher` 查询酒店 API，把结果写入 Blackboard 的 `sharedData`，并附带 `provenance`。
3. `ItineraryBuilder` 读取上游结果，构建行程草案，写入 `artifacts`。
4. 如果此时应用进程崩溃，重启后 `AgentTaskSnapshot` 和 `FsEventStore` 共同恢复会话状态。
5. 如果会话的宿主进程已经不存在，`OrphanReconciler` 会标记并清理该会话。

到本单元结束时，你应该能追踪：事件从产生 → 存储 → 回放 → 恢复 的完整数据流，并能从“事件丢失 / 状态未恢复 / 数据冲突”等症状反推到责任层。

## 范围边界

### 本单元讲什么

- `packages/core/src/modules/collaboration-runtime/session/event-store.ts`：事件存储接口。
- `packages/core/src/modules/collaboration-runtime/session/fs-event-store.ts`：基于文件系统的 append-only 事件存储实现。
- `packages/core/src/modules/collaboration-runtime/session/blackboard.ts`：黑板状态与操作。
- `packages/core/src/modules/collaboration-runtime/session/upstream-results.ts`：上游结果管理。
- `packages/core/src/modules/collaboration-runtime/session/memory-keys.ts`：结构化 memory key 约定。
- `packages/core/src/modules/collaboration-runtime/session/agent-task-snapshot.ts`：任务快照与恢复。
- `packages/core/src/modules/collaboration-runtime/session/orphan-reconciler.ts`：孤儿会话回收。
- `packages/core/src/modules/collaboration-runtime/facade/*.ts`：对外暴露的公共 API 组装层。

### 本单元不讲什么

- 拓扑解析与执行策略（Unit 3）。
- ACL / ContractNet / Subscribe-Notify 协议实现（Unit 4）。
- 沙箱与进程隔离（Unit 5）。
- `collaboration-runtime/ui/` 的 React 组件渲染（Part J）。
- Web API Route 如何调用 facade（Part I）。

## 单元课程表

| 课号 | 课题 | 核心源码 | 学习目标 |
| --- | --- | --- | --- |
| H07 | `EventStore` 与 `FsEventStore` 的 append-only 语义 | `session/event-store.ts`、`session/fs-event-store.ts` | 理解事件存储接口、seq、correlationId、文件持久化 |
| H08 | Blackboard 写入、锁定与上游结果管理 | `session/blackboard.ts`、`session/upstream-results.ts` | 理解 sharedData、locks、artifacts、tasks 读写边界 |
| H09 | 结构化 Memory Keys 与共享内存约定 | `session/memory-keys.ts` | 理解 Ruflo-style key、prefix、category、role 归属过滤 |
| H10 | `AgentTaskSnapshot` 与会话状态恢复 | `session/agent-task-snapshot.ts` | 理解任务快照数据结构与恢复语义 |
| H11 | `OrphanReconciler` 与孤儿会话回收 | `session/orphan-reconciler.ts` | 理解 hostPid、孤儿检测、终止策略 |
| H12 | Facade 层：session-store / event-bus / dag-runner / hitl-dispatcher | `facade/index.ts`、`facade/session-store.ts`、`facade/event-bus.ts`、`facade/dag-runner.ts`、`facade/hitl-dispatcher.ts` | 理解 API 路由看到的公共接口如何组装 |
| H13 | 单元小结课：事件流与状态持久化排查 | 复习 H07-H12 | 能从症状反推到事件存储、黑板或 facade 层 |

## 源码覆盖台账

| 文件路径 | 文件类型 | 本单元状态 | 主讲章节 | 代码窗口 | 教学责任 | 配对验证 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/core/src/modules/collaboration-runtime/session/event-store.ts` | source | 精读 | H07 | `EventStore` 接口 | 事件存储抽象 | `fs-event-store.test.ts`（如有） | 接口文件 |
| `packages/core/src/modules/collaboration-runtime/session/fs-event-store.ts` | source | 精读 | H07 | `FsEventStore` 实现、append、read、replay | 文件事件存储实现 | 对应测试 | append-only 关键文件 |
| `packages/core/src/modules/collaboration-runtime/session/blackboard.ts` | source | 精读 | H08 | `Blackboard` 初始化、写入、读取、锁定 | 黑板状态操作 | `blackboard-provenance.test.ts` | 核心状态文件 |
| `packages/core/src/modules/collaboration-runtime/session/upstream-results.ts` | source | 精读 | H08 | 上游结果聚合与读取 | Worker 输出如何被下游消费 | 对应测试 | 关键中间层 |
| `packages/core/src/modules/collaboration-runtime/session/memory-keys.ts` | source | 精读 | H09 | `build*Key`、`parseMemoryKey`、`filterKeysBy*` | 结构化 key 约定 | 对应测试 | Ruflo-style |
| `packages/core/src/modules/collaboration-runtime/session/agent-task-snapshot.ts` | source | 精读 | H10 | `AgentTaskSnapshot` 数据结构、save/load | 任务快照与恢复 | 对应测试 | 恢复关键 |
| `packages/core/src/modules/collaboration-runtime/session/orphan-reconciler.ts` | source | 精读 | H11 | `checkProcessAlive`、`OrphanReconciler` | 孤儿检测与回收 | `orphan-reconciler.test.ts` | Story 9.24 |
| `packages/core/src/modules/collaboration-runtime/session/shared-memory-helper.ts` | source | 背景引用 | H09 | `KnowledgeEntry`、`DiscoveryEntry`、`ToolCallCacheEntry` | 共享内存高级 helper | 后续单元可能精读 | 本单元提边界 |
| `packages/core/src/modules/collaboration-runtime/facade/index.ts` | source | 精读 | H12 | `createSession`、re-export 组装 | 对外公共 API 入口 | 间接测试 | 组装层 |
| `packages/core/src/modules/collaboration-runtime/facade/session-store.ts` | source | 精读 | H12 | `CreateSessionInput`、`createSession`、`listSessions`、`getSession` | 会话存储 facade | `session-store.test.ts` | facade 核心 |
| `packages/core/src/modules/collaboration-runtime/facade/event-bus.ts` | source | 精读 | H12 | `subscribeToEvents`、`unsubscribeFromEvents`、`clientDisconnected`、`eventEmitter` | SSE 事件总线 | 间接测试 | SSE 关键 |
| `packages/core/src/modules/collaboration-runtime/facade/dag-runner.ts` | source | 背景引用 | H12 | `executeSession`、`abortSession` | DAG 执行 facade | H16 精读 | 本单元只讲边界 |
| `packages/core/src/modules/collaboration-runtime/facade/hitl-dispatcher.ts` | source | 背景引用 | H12 | `sendMessageToSupervisor`、`respondToHumanReview` | HITL 消息分发 | `hitl-dispatcher.test.ts`、H18 精读 | 本单元只讲边界 |

## 关键概念预告

| 概念 | 通俗直觉 | 准确含义 | 不能误认为 |
| --- | --- | --- | --- |
| `EventStore` | 会议室录音笔 | append-only 事件日志，支持按 seq 回放 | 可变的数据库表 |
| `FsEventStore` | 把录音存到文件 | 基于 JSONL 文件的事件存储实现 | 高并发数据库 |
| `Blackboard` provenance | 白板上的签名 | 记录谁、何时、基于什么证据写入 | 简单的作者字段 |
| `BlackboardCorrection` | 白板上的勘误条 | append-only 修正记录，不删除旧值 | 直接覆盖原值 |
| `Memory Key` | 公共储物柜编号 | 结构化 key，包含 role/category/task 信息 | 任意字符串 |
| `AgentTaskSnapshot` | 任务进度存档点 | 保存任务状态，支持崩溃恢复 | 完整内存镜像 |
| `OrphanReconciler` | 清道夫 | 检测宿主进程已死的会话并回收 | 自动保存数据 |

## 单元小结课目标（H13）

读完 H13 后，读者应能不看源码回答：

1. 为什么事件存储要设计成 append-only？
2. `FsEventStore` 如何保证事件顺序？
3. Blackboard 的 `provenance` 和 `correction` 分别解决什么问题？
4. `upstream-results.ts` 在 DAG 执行中承担什么角色？
5. 如果进程重启后会话状态没有恢复，应该依次检查哪些文件？
6. `OrphanReconciler` 的回收策略可能误删哪些会话？

## 相邻单元衔接

Unit 2 解决了“状态如何保存和恢复”。接下来自然的问题是：给定一个由多个 Agent 组成的协作拓扑，系统如何选择执行策略？Supervisor 如何分解任务？这就是 Unit 3 的内容。
