# 单元导读三：拓扑解析、DAG 执行与 Supervisor 协调

## 单元总问题

给定一个由多个 Agent 组成的协作拓扑，系统如何决定是走 workflow DAG 还是 system 黑板模式？Supervisor 如何分解任务、分配 Worker、处理失败？

## 为什么现在学这个单元

Unit 1 和 Unit 2 已经建立了协作运行时的对象模型和持久化机制。现在问题来了：如果有三个 Agent（Supervisor、HotelResearcher、ItineraryBuilder），系统怎么知道谁先运行、谁后运行、谁可以并行、谁的结果会被汇总？

OriginOS 用**拓扑**描述 Agent 之间的协作关系，用**模式路由器**判断是走 workflow DAG 还是 system 黑板模式，用 **Supervisor** 动态分解和分配任务。本单元讲解这些执行层机制。到本单元结束，你应该能根据一个拓扑描述，判断系统会采用哪种执行模式，并追踪 Supervisor 如何驱动 Worker 完成任务。

## 主线案例在本单元的推进

小林的旅行协作会话启动后，系统读取项目中的协作拓扑：

1. `TravelPlanner` 是 Supervisor，`HotelResearcher` 和 `ItineraryBuilder` 是 Worker。
2. 拓扑边是 `trigger` 类型（从 Supervisor 指向两个 Worker），模式路由器判定为 **workflow** 模式。
3. `TopologyParser` 把拓扑解析成 `AgentNode` 和 `CollaborationEdge`。
4. `DagExecutor` 按 DAG 顺序执行：两个 Worker 可以并行调研酒店和构建行程。
5. 如果某个 Worker 失败或需要人工输入，Supervisor 会重新分配任务或触发 HITL。
6. `CapabilityMatcher` 负责把任务分配给最有能力的 Agent。
7. `DependencyChecker` 在执行前验证依赖条件是否满足。

到本单元结束时，你应该能：根据拓扑边类型判断执行模式、画出 DAG 执行顺序、解释 Supervisor 的任务分解与失败恢复。

## 范围边界

### 本单元讲什么

- `packages/core/src/modules/collaboration-runtime/engine/topology-parser.ts`：拓扑解析。
- `packages/core/src/modules/collaboration-runtime/engine/mode-router.ts`：workflow / system 模式判定。
- `packages/core/src/modules/collaboration-runtime/engine/dag-executor.ts`：DAG 执行器。
- `packages/core/src/modules/collaboration-runtime/engine/supervisor.ts`：Supervisor 核心。
- `packages/core/src/modules/collaboration-runtime/engine/supervisor-dag.ts`：Supervisor-DAG 集成与 HITL。
- `packages/core/src/modules/collaboration-runtime/engine/supervisor-heartbeat.ts`：Supervisor 心跳。
- `packages/core/src/modules/collaboration-runtime/engine/dependency-checker.ts`：依赖检查。
- `packages/core/src/modules/collaboration-runtime/engine/capability-matcher.ts`：能力匹配。
- `packages/core/src/modules/collaboration-runtime/engine/agent-context-writer.ts`：Agent 上下文写入。
- `packages/core/src/modules/collaboration-runtime/engine/task-orchestrator.ts`：任务编排。

### 本单元不讲什么

- ACL / ContractNet / Subscribe-Notify 协议实现（Unit 4）。
- 沙箱与进程隔离（Unit 5）。
- 事件存储细节（Unit 2 已讲）。
- UI 查看器渲染（Part J）。

## 单元课程表

| 课号 | 课题 | 核心源码 | 学习目标 |
| --- | --- | --- | --- |
| H14 | 拓扑解析器：从 manifest 到 `AgentNode`/`CollaborationEdge` | `engine/topology-parser.ts` | 理解 `trigger`/`notify`/`depend` 三种边、入口/出口点、模式判定 |
| H15 | 模式路由器：`workflow` vs `system` | `engine/mode-router.ts` | 能根据边类型判定执行模式 |
| H16 | DAG 执行器：线性、并行、汇总 | `engine/dag-executor.ts` | 理解 DAG 执行、节点状态、结果汇总 |
| H17 | Supervisor 核心：任务分解与 Worker 分配 | `engine/supervisor.ts` | 理解 SubTask、AgentCapability、分配与重分配 |
| H18 | Supervisor-DAG 集成与 HITL 收敛 | `engine/supervisor-dag.ts` | 理解 supervisor DAG 执行、HITL 中断与恢复 |
| H19 | Supervisor 心跳与依赖检查 | `engine/supervisor-heartbeat.ts`、`engine/dependency-checker.ts` | 理解心跳机制与依赖前置条件验证 |
| H20 | CapabilityMatcher 与能力匹配 | `engine/capability-matcher.ts` | 理解 Agent 能力评分、Ontology 操作匹配 |
| H21 | 单元小结课：多 Agent 执行模式选择 | 复习 H14-H20 | 能根据拓扑结构选择 workflow/system/supervisor 模式并说明原因 |

## 源码覆盖台账

| 文件路径 | 文件类型 | 本单元状态 | 主讲章节 | 代码窗口 | 教学责任 | 配对验证 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/core/src/modules/collaboration-runtime/engine/topology-parser.ts` | source | 精读 | H14 | `parseTopology`、循环检测、入口/出口计算 | 拓扑解析 | `topology-parser.test.ts` | DAG 与 system 模式基础 |
| `packages/core/src/modules/collaboration-runtime/engine/mode-router.ts` | source | 精读 | H15 | `routeMode`、workflow/system 判定 | 执行模式路由 | 对应测试 | 关键分支 |
| `packages/core/src/modules/collaboration-runtime/engine/dag-executor.ts` | source | 精读 | H16 | `DagExecutor`、拓扑排序、节点执行、结果汇总 | DAG 执行 | `dag-executor.test.ts` | 核心执行引擎 |
| `packages/core/src/modules/collaboration-runtime/engine/supervisor.ts` | source | 精读 | H17 | `SupervisorMode`、任务分解、`SubTask` 状态机、分配与重分配 | Supervisor 核心 | `supervisor.test.ts` | 核心协调器 |
| `packages/core/src/modules/collaboration-runtime/engine/supervisor-dag.ts` | source | 精读 | H18 | `executeSupervisorDag`、`resumeSupervisorHitl`、`loadProjectTopology` | Supervisor-DAG 集成 | `supervisor-dag-hitl.test.ts` | HITL 关键 |
| `packages/core/src/modules/collaboration-runtime/engine/supervisor-heartbeat.ts` | source | 精读 | H19 | `SupervisorHeartbeat`、状态报告 | Supervisor 心跳 | 对应测试 | 健康监测 |
| `packages/core/src/modules/collaboration-runtime/engine/dependency-checker.ts` | source | 精读 | H19 | `DependencyChecker`、前置条件验证 | 依赖验证 | 对应测试 | 执行前置条件 |
| `packages/core/src/modules/collaboration-runtime/engine/capability-matcher.ts` | source | 精读 | H20 | `CapabilityMatcher`、能力评分、Ontology 操作匹配 | 能力匹配 | `capability-matcher.test.ts` | Worker 选择 |
| `packages/core/src/modules/collaboration-runtime/engine/agent-context-writer.ts` | source | 背景引用 | H17 | `ProjectContextWriter` | Agent 上下文写入 | 无直接测试或后续精读 | 本单元提边界 |
| `packages/core/src/modules/collaboration-runtime/engine/task-orchestrator.ts` | source | 背景引用 | H16-H17 | 任务编排辅助 | 复杂编排逻辑 | 可能后续精读 | 视正文深度决定 |
| `packages/core/src/modules/collaboration-runtime/engine/index.ts` | source | 背景引用 | H14 | re-export 清单 | 引擎层公共 API | 无 | 入口文件 |

## 关键概念预告

| 概念 | 通俗直觉 | 准确含义 | 不能误认为 |
| --- | --- | --- | --- |
| `CollaborationTopology` | 协作流程图 | Agent 节点 + 边的有向图，边类型决定执行模式 | 任意 JSON 配置 |
| `EdgeType` | 边的动作类型 | `trigger`（触发）、`notify`（通知）、`depend`（依赖） | 普通依赖关系 |
| `workflow` 模式 | 流水线 | 所有边都是 `trigger`，按 DAG 单向执行 | 黑板协作 |
| `system` 模式 | 头脑风暴室 | 存在 `notify`/`depend` 边，Agent 通过黑板反复协作 | 严格流水线 |
| `Supervisor` | 项目经理 | 动态分解任务、分配给 Worker、处理失败与 HITL | 普通 Agent |
| `SubTask` | 子任务卡片 | 包含描述、状态、被分配者、依赖、输入/输出 | 普通函数调用 |
| `CapabilityMatcher` | 人才匹配器 | 根据 Agent 能力和任务需求评分 | 简单轮询 |
| `DependencyChecker` | 前置条件检查员 | 验证依赖是否满足，不满足则阻塞 | 运行时调度器 |

## 单元小结课目标（H21）

读完 H21 后，读者应能不看源码回答：

1. 三种边类型 `trigger`/`notify`/`depend` 各自触发什么执行语义？
2. 为什么 `workflow` 模式适合并行 Worker，`system` 模式适合反复协商？
3. `DagExecutor` 如何处理并行节点和结果汇总？
4. Supervisor 在什么情况下会重新分配任务？
5. HITL 中断后，`resumeSupervisorHitl` 如何恢复执行？
6. `CapabilityMatcher` 的评分依据是什么？
7. 如果依赖检查失败，任务会进入什么状态？

## 相邻单元衔接

Unit 3 解决了“如何执行”。接下来自然的问题是：多个 Agent 并发读写共享状态时，系统用什么协议协调？如何发现和处理冲突？这就是 Unit 4 的内容。
