# Part H：协作与其他 Core Modules — 写作计划

> 本计划按 [`03-sample-unit-writing-sop.md`](../../03-sample-unit-writing-sop.md) 标准制定。Part H 的课程总目标是：让读者理解 OriginOS 中跨模块协调与事件流的实现方式，能够从一个多 Agent 协作请求出发，追踪它经过的类型合同、事件存储、执行引擎、协议层、沙箱、Memory Core 以及其他 Core Modules 的完整路径，并能在出现故障时按证据定位责任层。

---

## 1. 覆盖的代码文件范围统计

### 1.1 范围边界

Part H 覆盖 `packages/core/src/modules/` 下的以下模块：

| 模块 | 目录 | 计划覆盖文件数 | 课程总表对应轨道 |
| --- | --- | --- | --- |
| Collaboration Runtime | `packages/core/src/modules/collaboration-runtime/**` | ~81 | T05、T06（非认知部分）、T07 |
| Memory Core | `packages/core/src/modules/memory-core/**` | ~26 | T06（memory 实现层） |
| Scheduler | `packages/core/src/modules/scheduler/**` | ~6 | T07 |
| Neural Channel | `packages/core/src/modules/neural-channel/**` | ~12 | T07 |
| View Manager | `packages/core/src/modules/view-manager/**` | ~8 | T07 |
| View Reconciler | `packages/core/src/modules/view-reconciler/**` | ~12 | T07 |
| MCP in Browser | `packages/core/src/modules/mcp-in-browser/**` | ~12 | T07 |
| **合计** | — | **~157** | — |

> 注：`course-overview.md` 中 Part H 标注为 131 个文件。实际 `git ls-files` 口径下，模块内包含 `.jsx` 编译产物、`.map`、`.gitignore`、`package.json`、`tsconfig.json` 等文件，因此总数高于 131。本计划按“源代码 + 测试 + 配置/文档”全口径覆盖，对 `.jsx` 等编译产物只说明其来源，不独立成课。

### 1.2 不纳入 Part H 的边界

- `packages/core/src/modules/memory-core/adapter.ts` 以及 `session/memory-provider.ts`、`session/enhanced-pattern-provider.ts` 中直接服务于 RoleAgent/Project Agent 认知 prompt 注入的部分，已在 **Part F** 中覆盖其调用侧；Part H 只从 Memory Core 内部实现层讲解其数据结构、持久化和工具接口。
- `packages/core/src/modules/collaboration-runtime/ui/` 的 React 组件在 Part H 中只讲其与 core 模块的边界（store、SSE、事件订阅），不展开 Web 渲染细节（Web 渲染属于 **Part J**）。
- 各模块的 `package.json`、`tsconfig.json`、`.gitignore` 只做包边界说明，不独立成章。

---

## 2. 参考文档

写作时必须并行阅读以下设计文档，确保教材与源码、Story 一致：

| 文档 | 作用 |
| --- | --- |
| `docs/design/multi-agent-runtime.md` | Collaboration Runtime 架构总览 |
| `docs/design/multi-agent-runtime-architecture-review-2026-05-20.md` | 架构评审与关键决策 |
| `docs/design/memory-core.md` | Memory Core 设计 |
| `docs/design/pattern-on-memory-core.md` | Memory Core 与 Pattern 的关系 |
| `docs/specs/epic-9/PRD-collaboration-product.md` | Epic 9 产品需求 |
| `docs/specs/epic-9/story-9.*/` | Epic 9 各 Story 的验收条件与测试 case |
| `docs/specs/epic-M/` | Memory Core Story |

---

## 3. 单元拆分与大纲

Part H 计划拆分为 **7 个小单元**，共 **47 节正式课**。每个单元都有独立的单元导读（`00-xx-...-guide.md`）和单元小结课（最后一节）。编号从 `H01` 到 `H47`，连续无跳号。

### Unit 1：Collaboration Runtime 入口与依赖边界（H01-H06）

**单元总问题**：一个多 Agent 协作请求进入 OriginOS 后，首先被包装成什么对象？模块如何保证自己不违反“不依赖 `src/lib/` 和 `src/components/`”的架构规约？

| 课号 | 课题 | 核心源码责任 | 关键能力目标 |
| --- | --- | --- | --- |
| H01 | 从单 Agent 会话到多 Agent 协作：为什么需要 Collaboration Runtime | `docs/design/multi-agent-runtime.md`、`packages/core/src/modules/collaboration-runtime/index.ts` | 理解协作运行时解决什么问题、与 Pi Agent 基础运行时的边界 |
| H02 | `CollaborationRuntimeDeps`：依赖注入与模块边界规约 | `config.ts` | 理解模块不直接 import `src/lib/` 的原因，掌握 deps 中每个接口的职责 |
| H03 | 会话类型合同：`RuntimeEvent`、`CollaborationSession`、`SessionStatus` | `session/types.ts` | 能解释事件模型、会话状态、全局目标、配置字段的边界 |
| H04 | Blackboard 共享状态：entry、provenance 与 append-only correction | `session/blackboard.ts`、`session/types.ts` | 理解“谁写了什么、基于什么证据、如何修正”的状态模型 |
| H05 | ACL 消息原语：定向、广播与 performative | `session/types.ts` 中 `ACLMessage`、`Performative` | 区分 inform/request/propose/delegate 等语义 |
| **H06** | **单元小结课：协作运行时的基础对象地图** | 复习 H01-H05 的源码台账 | 能画出入口 → deps → 会话 → 黑板 → 消息的层次图 |

### Unit 2：事件流、持久化与黑板（H07-H13）

**单元总问题**：多 Agent 运行时产生的事件如何被保存、索引和回放？黑板上的数据如何在进程重启后恢复？

| 课号 | 课题 | 核心源码责任 | 关键能力目标 |
| --- | --- | --- | --- |
| H07 | `EventStore` 与 `FsEventStore` 的 append-only 语义 | `session/event-store.ts`、`session/fs-event-store.ts` | 理解事件存储接口、文件事件存储实现、seq 与 correlationId |
| H08 | Blackboard 写入、锁定与上游结果管理 | `session/blackboard.ts`、`session/upstream-results.ts` | 能解释 sharedData、locks、artifacts、tasks 的读写边界 |
| H09 | 结构化 Memory Keys 与共享内存约定 | `session/memory-keys.ts` | 理解 Ruflo-style key、prefix、category、role 归属过滤 |
| H10 | `AgentTaskSnapshot` 与会话状态恢复 | `session/agent-task-snapshot.ts` | 理解任务快照的数据结构和恢复语义 |
| H11 | `OrphanReconciler` 与孤儿会话回收 | `session/orphan-reconciler.ts` | 理解 hostPid、孤儿检测、终止策略 |
| H12 | Facade 层：session-store / event-bus / dag-runner / hitl-dispatcher | `facade/index.ts`、`facade/session-store.ts`、`facade/event-bus.ts`、`facade/dag-runner.ts`、`facade/hitl-dispatcher.ts` | 理解 API 路由看到的公共接口如何组装 |
| **H13** | **单元小结课：事件流与状态持久化排查** | 复习 H07-H12 源码台账 | 能从“事件丢失/状态未恢复”症状反推到事件存储、黑板或 facade 层 |

### Unit 3：拓扑解析、DAG 执行与 Supervisor 协调（H14-H21）

**单元总问题**：给定一个由多个 Agent 组成的协作拓扑，系统如何决定是走 workflow DAG 还是 system 黑板模式？Supervisor 如何分解任务、分配 Worker、处理失败？

| 课号 | 课题 | 核心源码责任 | 关键能力目标 |
| --- | --- | --- | --- |
| H14 | 拓扑解析器：从 manifest 到 `AgentNode`/`CollaborationEdge` | `engine/topology-parser.ts` | 理解 `trigger`/`notify`/`depend` 三种边、入口/出口点、模式判定 |
| H15 | 模式路由器：`workflow` vs `system` | `engine/mode-router.ts` | 能根据边类型判定执行模式 |
| H16 | DAG 执行器：线性、并行、汇总 | `engine/dag-executor.ts` | 理解 DAG 执行、节点状态、结果汇总 |
| H17 | Supervisor 核心：任务分解与 Worker 分配 | `engine/supervisor.ts` | 理解 SubTask、AgentCapability、分配与重分配 |
| H18 | Supervisor-DAG 集成与 HITL 收敛 | `engine/supervisor-dag.ts` | 理解 supervisor DAG 执行、HITL 中断与恢复 |
| H19 | Supervisor 心跳与依赖检查 | `engine/supervisor-heartbeat.ts`、`engine/dependency-checker.ts` | 理解心跳机制与依赖前置条件验证 |
| H20 | CapabilityMatcher 与能力匹配 | `engine/capability-matcher.ts` | 理解 Agent 能力评分、Ontology 操作匹配 |
| **H21** | **单元小结课：多 Agent 执行模式选择** | 复习 H14-H20 源码台账 | 能根据拓扑结构选择 workflow/system/supervisor 模式并说明原因 |

### Unit 4：协议层、冲突检测与可观测性（H22-H28）

**单元总问题**：多个 Agent 并发读写共享状态时，系统用什么协议协调？如何发现冲突、记录日志、控制成本？

| 课号 | 课题 | 核心源码责任 | 关键能力目标 |
| --- | --- | --- | --- |
| H22 | ACL 协议：定向消息、广播与 performative | `protocol/acl.ts` | 理解 ACL 消息发送、接收、广播语义 |
| H23 | ContractNet 招标-投标 | `protocol/contract-net.ts` | 理解 CFP、bid、award、结果反馈 |
| H24 | Subscribe-Notify 订阅-通知 | `protocol/subscribe-notify.ts` | 理解订阅组、通知路由 |
| H25 | ConflictDetector：资源/数据/目标/死锁 | `engine/conflict-detector.ts` | 理解四种冲突类型与消解策略 |
| H26 | 可观测性：Logging、Metrics、Tracing、CostController | `observability/logging.ts`、`metrics.ts`、`tracing.ts`、`cost-controller.ts` | 理解事件日志、指标、追踪、成本配额 |
| H27 | UI 查看器边界：store、SSE、时间线与黑板视图 | `ui/store.ts`、`ui/use-sse.ts`、`ui/EventTimeline.tsx`、`ui/BlackboardViewer.tsx` | 理解 UI 层如何订阅 core 事件流 |
| **H28** | **单元小结课：协议、冲突与观测排错** | 复习 H22-H27 源码台账 | 能从“消息未到达/冲突未消解/成本超限”症状定位责任协议或观测层 |

### Unit 5：沙箱与进程隔离（H29-H34）

**单元总问题**：Agent 子进程如何被创建、执行、监控和销毁？沙箱真正限制了什么？未限制什么？

| 课号 | 课题 | 核心源码责任 | 关键能力目标 |
| --- | --- | --- | --- |
| H29 | AgentSpawner 与进程模型 | `sandbox/agent-spawner.ts`、`sandbox/index.ts` | 理解 Agent 进程创建、stdio 通信、生命周期 |
| H30 | NodeSandboxExecutor 与权限边界 | `sandbox/node-executor.ts` | 理解沙箱配置、违规检测、timeout |
| H31 | Worker 进度上报与认知会话结束 | `sandbox/worker-progress-reporter.ts`、`sandbox/cognitive-session-end.ts` | 理解子进程如何向运行时报告进度与结束 |
| H32 | AgentRegistry 与 PI Agent Bridge | `integrations/agent-registry.ts` | 理解 Agent 定义解析、registry 与 bridge 边界 |
| H33 | 沙箱测试与违规边界 | `sandbox/__tests__/*.test.ts` | 能说明沙箱测试证明了什么、未证明什么 |
| **H34** | **单元小结课：沙箱安全边界** | 复习 H29-H33 源码台账 | 能区分“目录限制”“进程隔离”“命令策略”“操作系统权限”四层边界 |

### Unit 6：Memory Core 记忆系统（H35-H41）

**单元总问题**：Memory Core 如何为 Agent 提供短期 block 记忆、长期 recall 记忆和归档 archival 记忆？不同记忆层如何选择？

| 课号 | 课题 | 核心源码责任 | 关键能力目标 |
| --- | --- | --- | --- |
| H35 | Memory Core 全景：Block 与 Memory 对象 | `memory-core/index.ts`、`core/block.ts` | 理解 Block、Memory、MemoryCore 的关系 |
| H36 | Block CRUD、compile/render 与持久化 | `core/memory.ts` | 能理解 markdown/xml 编译、Memory.md/blocks.json 持久化、版本快照 |
| H37 | RecallMemory 与 HistoryStore | `recall/recall-memory.ts`、`recall/history-store.ts` | 理解按 turn 的记录与召回 |
| H38 | ArchivalMemory、embedding 与 HNSWIndex | `archival/archival-memory.ts`、`archival/embedding.ts`、`archival/hnsw-index.ts`、`archival/wordpiece-tokenizer.ts` | 理解归档存储、向量嵌入、近似最近邻索引 |
| H39 | CoreMemoryTools 与 ArchivalMemoryTools | `tools/core-memory-tools.ts`、`tools/archival-memory-tools.ts` | 理解 Agent 可调用的记忆工具接口 |
| H40 | Adapter 与 Provider：MemoryAdapter、MemoryProvider、EnhancedPatternProvider | `adapter.ts`、`session/memory-provider.ts`、`session/enhanced-pattern-provider.ts` | 理解 Memory Core 如何被外部消费 |
| **H41** | **单元小结课：记忆系统的层次选择** | 复习 H35-H40 源码台账 | 能根据“实时性/容量/持久性/计算成本”选择 block/recall/archival |

### Unit 7：其他 Core Modules（H42-H47）

**单元总问题**：Scheduler、Neural Channel、View Manager、View Reconciler、MCP in Browser 这些模块分别解决什么问题？它们与 Core 业务层和 Web 层的边界在哪里？

| 课号 | 课题 | 核心源码责任 | 关键能力目标 |
| --- | --- | --- | --- |
| H42 | Scheduler：定时任务与 SystemToolRunner | `scheduler/scheduler-service.ts`、`scheduler/action-runner.ts`、`scheduler/system-tool-runner.ts`、`scheduler/schedule-store.ts`、`scheduler/types.ts` | 理解任务调度、触发器、运行器边界 |
| H43 | Neural Channel：跨帧通信 | `neural-channel/src/master/manager.ts`、`neural-channel/src/client/client.ts`、`neural-channel/src/message/message.ts`、`neural-channel/src/type.ts` | 理解 Manager/Client、广播/多播、握手 |
| H44 | View Manager：视图生命周期管理 | `view-manager/src/manager.ts`、`view-manager/src/view.ts`、`view-manager/src/index.ts` | 理解 View 对象、Manager 注册与生命周期 |
| H45 | View Reconciler：微前端与 iframe 协调 | `view-reconciler/src/base/reconciler.ts`、`view-reconciler/src/iframe/index.ts`、`view-reconciler/src/qiankun/index.ts`、`view-reconciler/src/mirco-app/index.ts` | 理解多种微前端方案的协调边界 |
| H46 | MCP in Browser：浏览器内的模型上下文协议 | `mcp-in-browser/src/server.ts`、`mcp-in-browser/src/client.ts`、`mcp-in-browser/src/transport/TabClientTransport.ts`、`mcp-in-browser/src/transport/TabServerTransport.ts` | 理解浏览器 tab 间 MCP server/client/transport |
| **H47** | **单元小结课：Part H 全局地图与相邻模块** | 复习 H42-H46 及 Part H 全部源码台账 | 能画出 Part H 各模块与 Part E/F/G/I/J 的边界 |

---

## 4. 源码覆盖台账模板

每个单元开写前必须建立如下台账。以下以 Unit 1 示例：

| 文件路径 | 文件类型 | 本单元状态 | 主讲章节 | 代码窗口 | 教学责任 | 配对验证 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/core/src/modules/collaboration-runtime/index.ts` | source | 精读 | H01 | 全文件 | 模块公共导出 | 无直接测试，需人工验证导出完整性 | 入口文件 |
| `packages/core/src/modules/collaboration-runtime/config.ts` | source | 精读 | H02 | `CollaborationRuntimeDeps` 接口、`CollaborationRuntime` 类 | 依赖注入与模块边界 | 无直接测试 | 关键架构文件 |
| `packages/core/src/modules/collaboration-runtime/session/types.ts` | source | 精读 | H03-H05 | `RuntimeEvent`、`CollaborationSession`、`Blackboard*`、`ACLMessage`、`Conflict`、`CollaborationTopology` | 类型合同 | 类型检查通过 | 大文件，按类型分段 |
| `packages/core/src/modules/collaboration-runtime/session/blackboard.ts` | source | 背景引用 | H04 | 关键字段 | 黑板状态结构 | H08 精读 | 本单元只建立概念 |

其余单元的台账在单元导读文件中按相同格式建立。

---

## 5. 写作计划

### 5.1 准备阶段（第 1 轮）

1. 创建本目录及 `README.md` 目录页。
2. 为每个单元创建单元导读文件：`00-01-collaboration-runtime-entry-guide.md`、`00-02-event-stream-and-blackboard-guide.md`、`00-03-topology-dag-supervisor-guide.md`、`00-04-protocol-conflict-observability-guide.md`、`00-05-sandbox-guide.md`、`00-06-memory-core-guide.md`、`00-07-other-core-modules-guide.md`。
3. 每个单元导读中填写：单元总问题、主线案例、源码覆盖台账（至少 80% 的文件有状态）、单元小结课目标。

### 5.2 写作阶段（第 2-4 轮）

按单元顺序写作，每完成一个单元必须完成以下动作才能进入下一单元：

1. **源码覆盖验收**：台账中每个相关文件都有状态、代码窗口和教学责任。
2. **教学深度验收**：逐节对照 Part E 的 `E02` 和 `E06` 样板，确保每节都有场景、概念阶梯、源码窗口、调用链、失败路径、测试证据、练习和口头验收。
3. **新手可读验收**：完成一次“术语首次出现检查”“正向输入追踪”“反向故障诊断”“相邻问题迁移”四轮学习者模拟。

### 5.3 复审阶段（第 5 轮）

全部 47 节完成后：

1. 跑 Markdown 结构检查：`git diff --check -- learning-note/full-project-course-v2`。
2. 检查作者侧语言：`rg -n "为了满足要求|我会|我将|接下来我|先建立|不要先|直接开写|交付|正文是面向|提示词" learning-note/full-project-course-v2/textbook/part-h-collaboration-and-core-modules`。
3. 检查源码链接：`rg -n "\]\(|#L[0-9]+" learning-note/full-project-course-v2/textbook/part-h-collaboration-and-core-modules`。
4. 检查绝对路径：`rg -n "/Users/.*/startupOS/packages/" learning-note/full-project-course-v2/textbook/part-h-collaboration-and-core-modules`。
5. 更新 `course-overview.md` 中 Part H 的“已写”状态。

---

## 6. 主线案例设计

Part H 使用同一条主线案例贯穿各单元：

> **“小林想要策划一次杭州五日毕业旅行，系统启动一个多 Agent 协作会话：TravelPlanner Supervisor 负责总体分解，HotelResearcher 和 ItineraryBuilder 两个 Worker 分别调研酒店和构建行程，最终把结果写入项目黑板。”**

每个单元让这条主线推进一个阶段：

- **Unit 1**：协作请求进入运行时，形成会话与黑板对象。
- **Unit 2**：Supervisor 与 Worker 产生的事件被写入事件存储，黑板状态被持久化。
- **Unit 3**：拓扑定义被解析，Supervisor 分解任务并调度 Worker，DAG 或 system 模式执行。
- **Unit 4**：Worker 并发读写酒店数据，触发冲突检测与协议协调，可观测性记录全过程。
- **Unit 5**：Worker 在沙箱子进程中运行，进程结束与进度上报。
- **Unit 6**：Agent 在协作过程中使用 Memory Core 记录旅行偏好、召回历史决策、归档知识。
- **Unit 7**：协作结果通过 Scheduler/Neural Channel/View 等模块与 Web 界面交互。

---

## 7. 关键风险与质量防线

| 风险 | 防线 |
| --- | --- |
| Collaboration Runtime 文件多、概念密，容易漏掉中间层（如 `upstream-results.ts`、`shared-memory-helper.ts`） | 每个单元的源码台账必须反向核对 `find packages/core/src/modules/collaboration-runtime -type f` 输出 |
| 安全术语容易超过源码真实保证（如把目录前缀检查说成“完全隔离”） | 正文必须区分“目录选择 / 路径限制 / 进程沙箱 / 操作系统权限”四层 |
| `.jsx` 编译产物与 `.tsx` 源码并存，容易误导读者 | 教材中说明 `.jsx` 为构建产物，不独立讲解，链接指向 `.tsx` |
| Memory Core 中 adapter/provider 已在 Part F 讲过，容易重复或遗漏 | 明确 Part H 只讲 Memory Core 内部实现，Part F 只讲认知注入调用侧 |
| 其他 Core Modules 文件少但文档质量参差不齐（如 neural-channel README 含 TODO） | 必须以源码为准，README 只作为辅助，不能替代源码分析 |

---

## 8. 验收标准

Part H 完成后必须交付：

1. 47 节正式课程文件，命名格式 `H01-...md` 至 `H47-...md`。
2. 7 个单元导读文件，命名格式 `00-01-...-guide.md` 至 `00-07-...-guide.md`。
3. 1 个 `README.md` 目录页，列明各单元范围、课号、导读链接和单元总问题。
4. 每单元的源码覆盖台账（可在单元导读中）。
5. 复审记录，包含：格式预检、源码覆盖验收、教学深度验收、新手可读验收四项结论。
6. 至少一条从用户入口到最终副作用的正向追踪记录，和一条从症状到责任层的反向诊断记录。

---

*计划版本：1.1（已确认方案 B：47 节课）*  
*更新日期：2026-09-02*  
*下一步：创建目录页 `README.md` 与 7 个单元导读文件。*  
*计划版本：1.1（已确认方案 B：47 节课）*  
*更新日期：2026-09-02*  
*下一步：创建目录页 `README.md` 与 7 个单元导读文件。*
