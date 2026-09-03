# 单元导读一：Collaboration Runtime 入口与依赖边界

## 单元总问题

一个多 Agent 协作请求进入 OriginOS 后，首先被包装成什么对象？模块如何保证自己不违反“不依赖 `src/lib/` 和 `src/components/`”的架构规约？

## 为什么现在学这个单元

读完 Part E 后，你已经理解了一个 Pi Agent 会话如何被创建、接收消息、调用工具、流式返回。但 OriginOS 的下一阶段能力是让多个 Agent 同时参与同一个目标：有的 Agent 负责分解任务，有的负责调研酒店，有的负责构建行程。为了让这些 Agent 不互相踩脚，系统需要一个新的运行时层——**Collaboration Runtime**。

本单元不讨论这个运行时内部如何执行 DAG 或协议（那是 Unit 3 和 Unit 4 的内容），只回答最前置的问题：协作请求进入系统时，被转换成哪些对象？这些对象之间有什么责任边界？模块本身如何遵守架构规约，不直接依赖 `src/lib/` 或 `src/components/`？

## 主线案例在本单元的推进

小林在 Web 界面点击“启动旅行规划协作”，系统不会直接启动 Agent，而是先经历以下转换：

1. 浏览器把请求发到 Web API（属于 Part I，本单元只提边界）。
2. API 调用 `CollaborationRuntime` 的入口，注入一组外部依赖（`CollaborationRuntimeDeps`）。
3. 运行时会创建一个 `CollaborationSession`，里面包含 `globalGoal`、`status`、`config`。
4. 同时创建 `Blackboard`，作为所有 Agent 共享的状态容器。
5. Agent 之间通信使用 `ACLMessage`，其 `performative` 字段区分 inform/request/propose/delegate 等语义。

到本单元结束时，你应该能画出：`请求 → 入口 → deps → session → blackboard → ACL 消息` 这一层对象地图，并解释每个对象负责什么、不负责什么。

## 范围边界

### 本单元讲什么

- `packages/core/src/modules/collaboration-runtime/index.ts`：模块公共导出。
- `packages/core/src/modules/collaboration-runtime/config.ts`：`CollaborationRuntimeDeps` 与依赖注入设计。
- `packages/core/src/modules/collaboration-runtime/session/types.ts`：核心类型合同，包括 `RuntimeEvent`、`CollaborationSession`、`Blackboard`、`ACLMessage`、`Performative`、`Conflict`、`CollaborationTopology`。
- `packages/core/src/modules/collaboration-runtime/session/blackboard.ts`：黑板状态结构（本单元只建立概念，详细读写逻辑在 Unit 2）。

### 本单元不讲什么

- 事件存储与持久化（Unit 2）。
- DAG / Supervisor / 拓扑解析（Unit 3）。
- ACL / ContractNet / Subscribe-Notify 协议实现（Unit 4）。
- 沙箱与进程隔离（Unit 5）。
- `collaboration-runtime/ui/` 的 React 组件渲染细节（Part J）。
- Web API Routes 如何把 HTTP 请求翻译成 `CollaborationSession`（Part I）。

## 单元课程表

| 课号 | 课题 | 核心源码 | 学习目标 |
| --- | --- | --- | --- |
| H01 | 从单 Agent 会话到多 Agent 协作：为什么需要 Collaboration Runtime | `index.ts`、`docs/design/multi-agent-runtime.md` | 理解协作运行时与 Pi Agent 基础运行时的边界 |
| H02 | `CollaborationRuntimeDeps`：依赖注入与模块边界规约 | `config.ts` | 理解模块为什么不直接 import `src/lib/`，掌握每个 deps 接口职责 |
| H03 | 会话类型合同：`RuntimeEvent`、`CollaborationSession`、`SessionStatus` | `session/types.ts` | 能解释事件模型、会话状态、全局目标、配置字段边界 |
| H04 | Blackboard 共享状态：entry、provenance 与 append-only correction | `session/blackboard.ts`、`session/types.ts` | 理解“谁写了什么、基于什么证据、如何修正” |
| H05 | ACL 消息原语：定向、广播与 performative | `session/types.ts` | 区分 inform/request/propose/delegate 等语义 |
| H06 | 单元小结课：协作运行时的基础对象地图 | 复习 H01-H05 | 能独立画出对象层次图并口头解释 |

## 源码覆盖台账

| 文件路径 | 文件类型 | 本单元状态 | 主讲章节 | 代码窗口 | 教学责任 | 配对验证 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/core/src/modules/collaboration-runtime/index.ts` | source | 精读 | H01 | 全文件 | 模块公共导出 | 无直接测试，需人工检查 | 入口文件 |
| `packages/core/src/modules/collaboration-runtime/config.ts` | source | 精读 | H02 | `AgentEngine`、`AgentInstance`、`ToolExecutor`、`OntologyStore`、`FileOps`、`EventEmitter`、`AgentDefinitionParser`、`CollaborationRuntimeDeps`、`CollaborationRuntime` | 依赖注入与模块边界 | 无直接测试 | 关键架构文件 |
| `packages/core/src/modules/collaboration-runtime/session/types.ts` | source | 精读 | H03-H05 | `EventType`、`RuntimeEvent`、`TaskState`、`TaskItem`、`BlackboardMessage`、`BlackboardArtifact`、`BlackboardLock`、`BlackboardProvenance`、`BlackboardCorrection`、`BlackboardEntry`、`Blackboard`、`Performative`、`ACLMessage`、`Conflict`、`EdgeType`、`AgentNode`、`CollaborationEdge`、`CollaborationTopology`、`SessionStatus`、`CollaborationSession`、`OrphanReport` | 类型合同与责任边界 | 类型检查通过 | 大文件，按类型分段 |
| `packages/core/src/modules/collaboration-runtime/session/blackboard.ts` | source | 背景引用 | H04 | `Blackboard` 结构与关键字段 | 建立黑板概念 | H08 精读 | 本单元只建立概念 |
| `packages/core/src/modules/collaboration-runtime/__tests__/story-9.36.test.ts` | test | 背景引用 | H03 | 测试如何构造 session 与 blackboard | 验收用例参考 | story-9.36 | 本单元只看输入/断言 |

## 关键概念预告

| 概念 | 通俗直觉 | 准确含义 | 不能误认为 |
| --- | --- | --- | --- |
| `CollaborationRuntimeDeps` | 模块的“外接电源插口” | 外部依赖注入接口，模块内部不直接 import `src/lib/` | 一个全局服务定位器 |
| `CollaborationSession` | 一次协作会议的档案 | 包含 projectId、globalGoal、status、config、hostPid 等 | 单个 Agent 的会话 |
| `Blackboard` | 会议室公共白板 | 共享数据、消息、任务、工件、锁的容器，带 provenance | 某个 Agent 的私有内存 |
| `ACLMessage` | Agent 之间的便签 | 包含 performative、sender、receiver、content、conversationId | 任意 JSON 对象 |
| `Performative` | 便签上的动作标签 | inform/request/propose/delegate 等语义 | 普通 HTTP method |

## 单元小结课目标（H06）

读完 H06 后，读者应能不看源码回答：

1. 为什么 Collaboration Runtime 不直接 import `src/lib/` 里的函数？
2. `CollaborationRuntimeDeps` 里 7 个接口分别对应哪些外部能力？
3. `CollaborationSession` 和 Pi Agent 的 session 有什么区别？
4. Blackboard 的 `BlackboardEntry` 为什么同时包含 `value` 和 `provenance`？
5. 如果两个 Agent 都要写同一个 key，ACL 消息和 Blackboard lock 分别解决什么问题？

## 相邻单元衔接

本单元建立的对象地图是后续所有单元的基础。H06 小结课结束后，自然产生下一个问题：这些对象产生的事件如何被保存？持久化失败会怎样？这就是 Unit 2 要解决的问题。
