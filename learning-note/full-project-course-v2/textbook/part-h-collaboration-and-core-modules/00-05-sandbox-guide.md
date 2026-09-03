# 单元导读五：沙箱与进程隔离

## 单元总问题

Agent 子进程如何被创建、执行、监控和销毁？沙箱真正限制了什么？未限制什么？

## 为什么现在学这个单元

前四个单元已经讲解了协作运行时的对象模型、事件持久化、执行引擎和协议协调。但这些 Agent 最终要在哪里运行？如果让 Agent 直接在主进程里执行任意代码，一个 Agent 的错误可能拖垮整个应用。OriginOS 使用**子进程沙箱**隔离 Agent 执行环境。

本单元讲解 Agent 子进程的创建（`AgentSpawner`）、执行（`NodeSandboxExecutor`）、进度上报、认知会话结束处理、Agent 注册与桥接，以及沙箱测试。到本单元结束，你应该能解释沙箱的安全边界，并区分“目录限制”“进程隔离”“命令策略”“操作系统权限”四层保护。

## 主线案例在本单元的推进

小林的旅行协作中，`HotelResearcher` 和 `ItineraryBuilder` 作为 Worker 运行：

1. `AgentSpawner` 根据 Agent 配置创建子进程。
2. 子进程通过 `NodeSandboxExecutor` 运行，只能访问指定目录和允许的命令。
3. Worker 通过 `WorkerProgressReporter` 向运行时上报进度。
4. Worker 完成认知会话后，`cognitive-session-end` 处理记忆沉淀。
5. `AgentRegistry` 负责从 Solution Manifest 加载 Agent 定义，建立与 PI Agent 的桥接。
6. 如果子进程超时或违规，`NodeSandboxExecutor` 会终止它并上报 `SandboxViolation`。

到本单元结束时，你应该能：画出主进程 → Runtime → 子进程的隔离模型、解释沙箱配置参数、说明测试覆盖了哪些边界。

## 范围边界

### 本单元讲什么

- `packages/core/src/modules/collaboration-runtime/sandbox/index.ts`：沙箱模块入口。
- `packages/core/src/modules/collaboration-runtime/sandbox/agent-spawner.ts`：Agent 进程创建。
- `packages/core/src/modules/collaboration-runtime/sandbox/node-executor.ts`：Node.js 沙箱执行器。
- `packages/core/src/modules/collaboration-runtime/sandbox/worker-progress-reporter.ts`：Worker 进度上报。
- `packages/core/src/modules/collaboration-runtime/sandbox/cognitive-session-end.ts`：认知会话结束处理。
- `packages/core/src/modules/collaboration-runtime/sandbox/agent-worker.mts`：Worker 脚本。
- `packages/core/src/modules/collaboration-runtime/sandbox/agent-worker-module-specifier.mts`：模块解析。
- `packages/core/src/modules/collaboration-runtime/integrations/agent-registry.ts`：Agent 注册与桥接。
- `packages/core/src/modules/collaboration-runtime/sandbox/__tests__/*.test.ts`：沙箱测试。

### 本单元不讲什么

- Memory Core 内部实现（Unit 6）。
- Scheduler / Neural Channel / View / MCP（Unit 7）。
- PI Agent 基础运行时的实现细节（Part E）。
- 操作系统级 seccomp / namespace 机制（超出源码范围）。

## 单元课程表

| 课号 | 课题 | 核心源码 | 学习目标 |
| --- | --- | --- | --- |
| H29 | AgentSpawner 与进程模型 | `sandbox/agent-spawner.ts`、`sandbox/index.ts` | 理解 Agent 进程创建、stdio 通信、生命周期 |
| H30 | NodeSandboxExecutor 与权限边界 | `sandbox/node-executor.ts` | 理解沙箱配置、违规检测、timeout |
| H31 | Worker 进度上报与认知会话结束 | `sandbox/worker-progress-reporter.ts`、`sandbox/cognitive-session-end.ts` | 理解子进程如何向运行时报告进度与结束 |
| H32 | AgentRegistry 与 PI Agent Bridge | `integrations/agent-registry.ts` | 理解 Agent 定义解析、registry 与 bridge 边界 |
| H33 | 沙箱测试与违规边界 | `sandbox/__tests__/*.test.ts` | 能说明沙箱测试证明了什么、未证明什么 |
| H34 | 单元小结课：沙箱安全边界 | 复习 H29-H33 | 能区分四层安全边界并说明未覆盖风险 |

## 源码覆盖台账

| 文件路径 | 文件类型 | 本单元状态 | 主讲章节 | 代码窗口 | 教学责任 | 配对验证 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/core/src/modules/collaboration-runtime/sandbox/index.ts` | source | 精读 | H29 | re-export、`AgentProcessConfig` | 沙箱模块入口 | 间接测试 | 入口 |
| `packages/core/src/modules/collaboration-runtime/sandbox/agent-spawner.ts` | source | 精读 | H29 | `AgentSpawner`、spawn、stdio 通信 | 进程创建 | `agent-spawner.test.ts` | 核心 |
| `packages/core/src/modules/collaboration-runtime/sandbox/node-executor.ts` | source | 精读 | H30 | `NodeSandboxExecutor`、`SandboxConfig`、`SandboxViolation`、`SandboxHandle` | 沙箱执行器 | `node-executor.test.ts` | 安全关键 |
| `packages/core/src/modules/collaboration-runtime/sandbox/worker-progress-reporter.ts` | source | 精读 | H31 | 进度上报协议 | Worker → Runtime 进度 | 对应测试 | 子进程通信 |
| `packages/core/src/modules/collaboration-runtime/sandbox/cognitive-session-end.ts` | source | 精读 | H31 | 认知会话结束钩子 | 记忆沉淀触发 | `cognitive-session-end.test.ts` | 认知集成 |
| `packages/core/src/modules/collaboration-runtime/sandbox/agent-worker.mts` | source | 背景引用 | H29-H30 | Worker 入口脚本 | 子进程执行体 | 间接测试 | 执行脚本 |
| `packages/core/src/modules/collaboration-runtime/sandbox/agent-worker-module-specifier.mts` | source | 背景引用 | H30 | 模块 specifier 解析 | ESM 模块加载 | `agent-worker-module-specifier.test.ts` | 加载细节 |
| `packages/core/src/modules/collaboration-runtime/sandbox/agent-worker.d.mts` | source | 暂不纳入 | — | 类型声明 | 类型支持 | — | 不独立成课 |
| `packages/core/src/modules/collaboration-runtime/sandbox/agent-worker.d.mts.map` | source | 暂不纳入 | — | source map | 构建产物 | — | 不独立成课 |
| `packages/core/src/modules/collaboration-runtime/integrations/agent-registry.ts` | source | 精读 | H32 | `AgentRegistry`、PI Agent Bridge | Agent 注册与桥接 | 间接测试 | 桥接层 |
| `packages/core/src/modules/collaboration-runtime/sandbox/__tests__/agent-spawner.test.ts` | test | 精读 | H33 | spawn 测试用例 | 进程创建验证 | — | — |
| `packages/core/src/modules/collaboration-runtime/sandbox/__tests__/node-executor.test.ts` | test | 精读 | H33 | 沙箱违规/timeout 测试 | 安全边界验证 | — | — |
| `packages/core/src/modules/collaboration-runtime/sandbox/__tests__/cognitive-session-end.test.ts` | test | 精读 | H33 | 会话结束测试 | 记忆沉淀验证 | — | — |
| `packages/core/src/modules/collaboration-runtime/sandbox/__tests__/agent-worker-module-specifier.test.ts` | test | 背景引用 | H33 | 模块 specifier 测试 | 加载验证 | — | — |

## 关键概念预告

| 概念 | 通俗直觉 | 准确含义 | 不能误认为 |
| --- | --- | --- | --- |
| `AgentSpawner` | 子进程工厂 | 根据配置创建并管理 Agent 子进程 | 容器编排器 |
| `NodeSandboxExecutor` | 沙箱执行器 | 在受限环境中执行 Node.js 代码 | 操作系统级沙箱 |
| `SandboxViolation` | 违规报告 | 子进程违反沙箱策略时被记录 | 普通异常 |
| `SandboxConfig` | 沙箱规则 | 允许的路径、命令、超时等 | 全局安全策略 |
| `WorkerProgressReporter` | 进度条 | 子进程向运行时上报进度事件 | 日志 |
| `AgentRegistry` | Agent 人才库 | 从 manifest 加载 Agent 定义并桥接到 PI Agent | Agent 本身 |

## 单元小结课目标（H34）

读完 H34 后，读者应能不看源码回答：

1. 主进程、Runtime、Agent 子进程三者的关系是什么？
2. `NodeSandboxExecutor` 能限制什么？不能限制什么？
3. 沙箱的 timeout 策略如何防止子进程挂死？
4. Worker 如何向运行时上报进度？
5. 认知会话结束时，沙箱层触发什么后续动作？
6. `AgentRegistry` 与 PI Agent 的桥接点在哪里？
7. 沙箱测试证明了哪些边界？还有哪些风险未被测试覆盖？

## 相邻单元衔接

Unit 5 解决了 Agent 执行隔离。接下来自然的问题是：Agent 在长期工作中如何记忆和召回信息？这就是 Unit 6 Memory Core 的内容。
