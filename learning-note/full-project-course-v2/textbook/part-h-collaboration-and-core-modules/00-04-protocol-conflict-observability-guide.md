# 单元导读四：协议层、冲突检测与可观测性

## 单元总问题

多个 Agent 并发读写共享状态时，系统用什么协议协调？如何发现冲突、记录日志、控制成本？

## 为什么现在学这个单元

Unit 3 已经讲解了系统如何根据拓扑执行多 Agent 任务。但只要有多个 Agent 同时运行，就会产生协调问题：

1. 一个 Agent 想通知另一个 Agent 某件事，应该走什么消息协议？
2. 两个 Agent 都想写同一个 Blackboard key，怎么办？
3. 系统如何知道整个协作会话的健康状况？
4. 调用 LLM 的成本如何被监控和限制？

本单元讲解三层机制：**协议层**（ACL、ContractNet、Subscribe-Notify）、**冲突检测层**（ConflictDetector）、**可观测性层**（Logging、Metrics、Tracing、CostController），以及这些事件的 UI 查看器边界。到本单元结束，你应该能解释多 Agent 并发时的协调策略，并能从症状定位到具体协议或观测层。

## 主线案例在本单元的推进

小林的旅行协作进入高峰期：

1. `HotelResearcher` 发现某酒店满房，通过 `ACLMessage` 通知 `ItineraryBuilder`。
2. `ItineraryBuilder` 向 `TravelPlanner` 发起 `ContractNet` 招标，询问是否接受替代方案。
3. `TravelPlanner` 订阅了 `HotelResearcher` 的酒店价格波动事件，收到 `Subscribe-Notify` 通知。
4. 两个 Worker 同时尝试更新 `budget` key，`ConflictDetector` 检测到数据冲突，触发 lock-based 消解。
5. 整个过程中，`StructuredLogger`、`MetricsRegistry`、`Tracer`、`CostController` 记录事件、指标、追踪和成本。
6. Web 端的 `EventTimeline` 和 `BlackboardViewer` 通过 SSE 订阅这些事件。

到本单元结束时，你应该能：区分三种协议的使用场景、解释冲突检测的四种类型、从 UI 症状反推到日志/指标/追踪层。

## 范围边界

### 本单元讲什么

- `packages/core/src/modules/collaboration-runtime/protocol/acl.ts`：ACL 消息协议。
- `packages/core/src/modules/collaboration-runtime/protocol/contract-net.ts`：招标-投标协议。
- `packages/core/src/modules/collaboration-runtime/protocol/subscribe-notify.ts`：订阅-通知协议。
- `packages/core/src/modules/collaboration-runtime/engine/conflict-detector.ts`：冲突检测。
- `packages/core/src/modules/collaboration-runtime/observability/logging.ts`：结构化日志。
- `packages/core/src/modules/collaboration-runtime/observability/metrics.ts`：指标注册。
- `packages/core/src/modules/collaboration-runtime/observability/tracing.ts`：分布式追踪。
- `packages/core/src/modules/collaboration-runtime/observability/cost-controller.ts`：成本配额控制。
- `packages/core/src/modules/collaboration-runtime/ui/store.ts`：UI 状态管理。
- `packages/core/src/modules/collaboration-runtime/ui/use-sse.ts`：SSE Hook。
- `packages/core/src/modules/collaboration-runtime/ui/EventTimeline.tsx`、`BlackboardViewer.tsx`：事件时间线与黑板视图。

### 本单元不讲什么

- 沙箱与进程隔离（Unit 5）。
- Memory Core 内部实现（Unit 6）。
- React 组件渲染细节（Part J）。
- Web API Routes（Part I）。

## 单元课程表

| 课号 | 课题 | 核心源码 | 学习目标 |
| --- | --- | --- | --- |
| H22 | ACL 协议：定向消息、广播与 performative | `protocol/acl.ts` | 理解 ACL 消息发送、接收、广播语义 |
| H23 | ContractNet 招标-投标 | `protocol/contract-net.ts` | 理解 CFP、bid、award、结果反馈 |
| H24 | Subscribe-Notify 订阅-通知 | `protocol/subscribe-notify.ts` | 理解订阅组、通知路由 |
| H25 | ConflictDetector：资源/数据/目标/死锁 | `engine/conflict-detector.ts` | 理解四种冲突类型与消解策略 |
| H26 | 可观测性：Logging、Metrics、Tracing、CostController | `observability/logging.ts`、`metrics.ts`、`tracing.ts`、`cost-controller.ts` | 理解事件日志、指标、追踪、成本配额 |
| H27 | UI 查看器边界：store、SSE、时间线与黑板视图 | `ui/store.ts`、`ui/use-sse.ts`、`ui/EventTimeline.tsx`、`ui/BlackboardViewer.tsx` | 理解 UI 层如何订阅 core 事件流 |
| H28 | 单元小结课：协议、冲突与观测排错 | 复习 H22-H27 | 能从症状定位责任协议或观测层 |

## 源码覆盖台账

| 文件路径 | 文件类型 | 本单元状态 | 主讲章节 | 代码窗口 | 教学责任 | 配对验证 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/core/src/modules/collaboration-runtime/protocol/acl.ts` | source | 精读 | H22 | `AclProtocol`、`send`、`broadcast`、performative 处理 | ACL 协议实现 | `acl.test.ts` | 核心协议 |
| `packages/core/src/modules/collaboration-runtime/protocol/contract-net.ts` | source | 精读 | H23 | `ContractNetProtocol`、CFP、bid、award、状态机 | 招标-投标协议 | `protocol.test.ts` | 协商协议 |
| `packages/core/src/modules/collaboration-runtime/protocol/subscribe-notify.ts` | source | 精读 | H24 | `SubscribeNotifyProtocol`、SubscriptionGroup、Notification | 订阅-通知协议 | `protocol.test.ts` | 事件订阅 |
| `packages/core/src/modules/collaboration-runtime/engine/conflict-detector.ts` | source | 精读 | H25 | `ConflictDetector`、四种冲突类型、resolution 策略 | 冲突检测与消解 | `conflict-detector.test.ts` | 并发协调 |
| `packages/core/src/modules/collaboration-runtime/observability/logging.ts` | source | 精读 | H26 | `StructuredLogger`、`LogEntry`、`LogLevel` | 结构化日志 | `observability.test.ts` | 可观测基础 |
| `packages/core/src/modules/collaboration-runtime/observability/metrics.ts` | source | 精读 | H26 | `MetricsRegistry`、`MetricSample`、`MetricType` | 指标注册 | `observability.test.ts` | 指标 |
| `packages/core/src/modules/collaboration-runtime/observability/tracing.ts` | source | 精读 | H26 | `Tracer`、`Span`、`Trace` | 分布式追踪 | `observability.test.ts` | 追踪 |
| `packages/core/src/modules/collaboration-runtime/observability/cost-controller.ts` | source | 精读 | H26 | `CostController`、quota、usage、report | 成本配额 | `observability.test.ts` | 成本控制 |
| `packages/core/src/modules/collaboration-runtime/ui/store.ts` | source | 精读 | H27 | Zustand store、事件状态 | UI 状态管理 | `MultiAgentLauncher.logic.test.ts` | UI 边界 |
| `packages/core/src/modules/collaboration-runtime/ui/use-sse.ts` | source | 精读 | H27 | SSE 连接、事件处理 | SSE Hook | 间接测试 | 实时推送 |
| `packages/core/src/modules/collaboration-runtime/ui/EventTimeline.tsx` | source | 背景引用 | H27 | 时间线渲染逻辑 | 事件可视化 | Part J 可能精读 | 本单元讲边界 |
| `packages/core/src/modules/collaboration-runtime/ui/BlackboardViewer.tsx` | source | 背景引用 | H27 | 黑板视图渲染逻辑 | 黑板可视化 | Part J 可能精读 | 本单元讲边界 |
| `packages/core/src/modules/collaboration-runtime/ui/BlackboardDetail.tsx` | source | 暂不纳入 | — | 详情视图 | UI 细节 | Part J | 不独立成课 |
| `packages/core/src/modules/collaboration-runtime/ui/CollaborationViewer.tsx` | source | 暂不纳入 | — | 协作总览 | UI 细节 | Part J | 不独立成课 |
| `packages/core/src/modules/collaboration-runtime/ui/MetricsPanel.tsx` | source | 暂不纳入 | — | 指标面板 | UI 细节 | Part J | 不独立成课 |
| `packages/core/src/modules/collaboration-runtime/ui/MultiAgentLauncher.tsx` | source | 暂不纳入 | — | 启动器 UI | UI 细节 | Part J | 不独立成课 |
| `packages/core/src/modules/collaboration-runtime/ui/TopologyGraph.tsx` | source | 暂不纳入 | — | 拓扑图 | UI 细节 | Part J | 不独立成课 |
| `packages/core/src/modules/collaboration-runtime/ui/ui-deps.ts` | source | 背景引用 | H27 | UI 依赖注入 | UI 与 core 边界 | 间接测试 | 边界说明 |

## 关键概念预告

| 概念 | 通俗直觉 | 准确含义 | 不能误认为 |
| --- | --- | --- | --- |
| ACL | 特工之间的标准信封 | 包含 performative、sender、receiver、content 的消息格式 | 任意 JSON |
| ContractNet | 招标-投标 | CFP → bid → award → result 的协商协议 | 普通请求-响应 |
| Subscribe-Notify | 订阅报纸 | Agent 订阅某类事件，发生时收到通知 | 轮询 |
| Conflict | 资源争夺 | 资源/数据/目标/死锁四种冲突 | 普通异常 |
| Resolution | 冲突解决策略 | first-come-first-serve、lock-based、supervisor_decision 等 | 固定规则 |
| StructuredLogger | 结构化日志 | 带 level、source、timestamp、correlationId 的日志 | 普通 console.log |
| CostController | 预算控制器 | 跟踪 Agent 调用 LLM 的成本，检查配额 | 计费系统 |

## 单元小结课目标（H28）

读完 H28 后，读者应能不看源码回答：

1. ACL、ContractNet、Subscribe-Notify 各自适合什么场景？
2. `ConflictDetector` 能检测哪四种冲突？各自的消解策略是什么？
3. `StructuredLogger` 与 `MetricsRegistry` 记录的分别是哪种证据？
4. `CostController` 在什么情况下会阻止 Agent 继续调用模型？
5. UI 查看器通过什么机制实时获取 core 事件？
6. 如果 Web 端看不到事件时间线更新，应该依次检查哪些层？

## 相邻单元衔接

Unit 4 解决了多 Agent 之间的协议协调与观测。接下来自然的问题是：Agent 本身运行在什么地方？子进程如何被隔离和监控？这就是 Unit 5 的内容。
