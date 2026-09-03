# Part H：协作与其他 Core Modules

> 共 47 节。Part H 讲 OriginOS 中跨模块协调与事件流：一个多 Agent 协作请求如何经过类型合同、事件存储、执行引擎、协议层、沙箱、Memory Core 以及其他 Core Modules，最终被用户看到和验证。

## 课程分段

> 每个大板块都先阅读对应的“单元导读”。导读不替代正式课；它先建立问题、词汇和学习终点，避免在源码细节中失去方向。

Part H 的源码范围、并行实现、延后主题和复审状态统一记录在 [Part H 写作计划](PLAN.md)。正文负责教学，计划负责防止生产路径、测试证据和未接入实现被静默遗漏。

| 范围 | 课号 | 单元总问题 | 单元导读 |
| --- | --- | --- | --- |
| Collaboration Runtime 入口与依赖边界 | H01-H06 | 一个多 Agent 协作请求进入 OriginOS 后，首先被包装成什么对象？模块如何保证自己不违反“不依赖 `src/lib/` 和 `src/components/`”的架构规约？ | [单元导读一](00-01-collaboration-runtime-entry-guide.md) |
| 事件流、持久化与黑板 | H07-H13 | 多 Agent 运行时产生的事件如何被保存、索引和回放？黑板上的数据如何在进程重启后恢复？ | [单元导读二](00-02-event-stream-and-blackboard-guide.md) |
| 拓扑解析、DAG 执行与 Supervisor 协调 | H14-H21 | 给定一个由多个 Agent 组成的协作拓扑，系统如何决定是走 workflow DAG 还是 system 黑板模式？Supervisor 如何分解任务、分配 Worker、处理失败？ | [单元导读三](00-03-topology-dag-supervisor-guide.md) |
| 协议层、冲突检测与可观测性 | H22-H28 | 多个 Agent 并发读写共享状态时，系统用什么协议协调？如何发现冲突、记录日志、控制成本？ | [单元导读四](00-04-protocol-conflict-observability-guide.md) |
| 沙箱与进程隔离 | H29-H34 | Agent 子进程如何被创建、执行、监控和销毁？沙箱真正限制了什么？未限制什么？ | [单元导读五](00-05-sandbox-guide.md) |
| Memory Core 记忆系统 | H35-H41 | Memory Core 如何为 Agent 提供短期 block 记忆、长期 recall 记忆和归档 archival 记忆？不同记忆层如何选择？ | [单元导读六](00-06-memory-core-guide.md) |
| 其他 Core Modules | H42-H47 | Scheduler、Neural Channel、View Manager、View Reconciler、MCP in Browser 这些模块分别解决什么问题？它们与 Core 业务层和 Web 层的边界在哪里？ | [单元导读七](00-07-other-core-modules-guide.md) |

每一节均以独立文件写入本目录，使用 `H01-...md` 至 `H47-...md` 命名。阅读单节前先用对应单元导读建立整体路径；审查源码覆盖时以全局计划为准，不能用“文件已经列出”代替代码窗口级精读。

## 主线案例

Part H 使用同一条案例贯穿：

> **小林想要策划一次杭州五日毕业旅行，系统启动一个多 Agent 协作会话：`TravelPlanner` Supervisor 负责总体分解，`HotelResearcher` 和 `ItineraryBuilder` 两个 Worker 分别调研酒店和构建行程，最终把结果写入项目黑板。**

每个单元让这条主线推进一个阶段，从会话创建、事件持久化、拓扑执行、冲突协调、沙箱进程、记忆沉淀，一直到与 Web 界面的交互。

## 与相邻 Part 的边界

- **Part E**：已讲 Pi Agent 基础运行时（单 Agent 会话、工具、流式）。Part H 假设读者已理解单 Agent 模型，直接进入多 Agent 协调。
- **Part F**：已讲 RoleAgent/Project Agent 的认知系统，以及 Memory Core 中被认知系统直接调用的桥接文件（`adapter.ts`、`memory-provider.ts`、`enhanced-pattern-provider.ts`、相关 tools）。Part H 只讲 Memory Core 的内部实现层。
- **Part G**：已讲 Core 业务功能（project、ontology、interview 等）。Part H 中的 `CollaborationRuntimeDeps` 会消费这些业务能力，但 Part H 不展开业务规则本身。
- **Part I / Part J**：Web 层的 Next.js API Routes 和 React 组件会调用 Part H 的 facade 与 UI 模块。Part H 只讲到 facade/UI store 边界，HTTP 请求处理和组件渲染细节在 Part I/J 中。
- **Part K**：Desktop Electron 主进程与 IPC 也会复用 Core 能力。Part H 只从 Core 模块视角讲解，Desktop 专属入口在 Part K。
