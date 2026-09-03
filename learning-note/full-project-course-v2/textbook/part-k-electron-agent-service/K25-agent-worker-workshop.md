# K25 · Agent Worker 与运行时适配综合工作坊

> **课号** K25 · **轨道** T13 · **类型** 单元小结课（workshop） · **预计阅读** 35 分钟

---

## 本课要回答的问题

K19–K24 分别讲了 LocalAgentBridge、Agent Worker 通信、运行时依赖、会话创建、消息处理和中止销毁。但这些知识是分散的。当用户报告"Agent 没反应"或"Agent 进程崩溃"时，怎样从整体视角定位问题？

## 主线复盘

### Agent Worker 完整生命周期

```text
用户点击技能卡片
  │
  ├─ K19: LocalAgentBridge 启动 Agent Worker 子进程
  │   ├─ startAgent()
  │   ├─ spawn() 启动子进程
  │   ├─ 监听 stdout/stderr/exit
  │   └─ 发送 initialize 命令
  │
  ├─ K20: Agent Worker 通过 stdio 通信
  │   ├─ JSON Lines 协议
  │   ├─ 缓冲区管理
  │   └─ 事件分发
  │
  ├─ K21: 运行时依赖打包
  │   └─ agent-worker-runtime-deps.ts 静态导入 Core 模块
  │
  ├─ K22: 会话创建
  │   ├─ AGENT_SESSION_CREATE
  │   ├─ 参数校验
  │   ├─ 检查已有会话
  │   └─ 创建 agentBaseDir
  │
  ├─ K23: 消息发送
  │   ├─ AGENT_SESSION_MESSAGE（非流式）
  │   ├─ AGENT_SESSION_MESSAGE_STREAM（流式）
  │   └─ StreamEventBatcher 合并事件
  │
  └─ K24: 中止和销毁
      ├─ AGENT_SESSION_ABORT（中止）
      └─ AGENT_SESSION_DESTROY（三级回退销毁）
```

## 系统能力地图

### 能力一：Agent Worker 生命周期

| 阶段 | 关键文件 | 核心机制 |
| --- | --- | --- |
| 启动 | `local-agent-bridge.ts` | `spawn()`、`startAgent()` |
| 通信 | `local-agent-bridge.ts` | JSON Lines、缓冲区管理 |
| 依赖 | `agent-worker-runtime-deps.ts` | 静态导入 Core 模块 |
| 创建 | `agent-session-service.ts` | `AGENT_SESSION_CREATE` |
| 消息 | `agent-session-service.ts` | `AGENT_SESSION_MESSAGE` / `AGENT_SESSION_MESSAGE_STREAM` |
| 中止 | `agent-session-service.ts` | `AGENT_SESSION_ABORT` |
| 销毁 | `agent-session-service.ts` | `AGENT_SESSION_DESTROY`（三级回退） |

### 能力二：进程管理

| 能力 | 关键文件 | 核心机制 |
| --- | --- | --- |
| 子进程启动 | `local-agent-bridge.ts` | `spawn()`、`stdio: ['pipe', 'pipe', 'pipe']` |
| 子进程停止 | `local-agent-bridge.ts` | `sendCommand('shutdown')`、`SIGKILL` |
| 子进程中止 | `local-agent-bridge.ts` | `sendCommand('abort')` |
| 进程监控 | `process-health-monitor.ts` | `setAgentActivity()`、`clearAgentActivity()` |

## 排查地图

### 故障 1：Agent 没反应

**可能原因：**

1. **子进程未启动**：`spawn()` 失败。
2. **初始化失败**：`initialize` 命令未发送或失败。
3. **消息未发送**：`sendCommand()` 失败。

**排查步骤：**

1. 检查 `LocalAgentBridge` 的 `agents` Map，确认 Agent 是否已启动。
2. 检查子进程的 `stdout` 和 `stderr` 日志。
3. 检查 `AGENT_SESSION_CREATE` 和 `AGENT_SESSION_MESSAGE` 的返回值。

### 故障 2：Agent 进程崩溃

**可能原因：**

1. **运行时依赖缺失**：`agent-worker-runtime-deps.ts` 未导入需要的模块。
2. **内存溢出**：Agent 占用内存过大。
3. **未捕获异常**：Agent 代码抛出未捕获的异常。

**排查步骤：**

1. 检查 `agent-worker-runtime-deps.ts` 是否包含所有需要的模块。
2. 检查系统内存使用情况。
3. 检查子进程的 `stderr` 日志。

### 故障 3：消息丢失

**可能原因：**

1. **缓冲区溢出**：`handleWorkerOutput()` 的缓冲区未正确处理。
2. **JSON 解析失败**：子进程输出非 JSON 格式。
3. **Renderer 已销毁**：窗口已关闭，`notifyRenderer()` 失败。

**排查步骤：**

1. 检查 `handleWorkerOutput()` 的缓冲区管理逻辑。
2. 检查子进程的 `stdout` 输出是否为有效 JSON。
3. 检查 `BrowserWindow.getAllWindows()` 是否返回有效窗口。

## 综合练习

### 练习 1：场景分析

用户报告："我发送消息后，Agent 没有回复。"

根据排查地图，列出可能的原因和排查步骤。

<details>
<summary>参考答案</summary>

**可能原因：**

1. 子进程未启动。
2. 初始化失败。
3. 消息未发送。

**排查步骤：**

1. 检查 `LocalAgentBridge` 的 `agents` Map。
2. 检查子进程的 `stdout` 和 `stderr` 日志。
3. 检查 `AGENT_SESSION_CREATE` 和 `AGENT_SESSION_MESSAGE` 的返回值。

</details>

### 练习 2：设计决策

回答以下问题：

1. 为什么 Agent Worker 要通过子进程运行？
2. 为什么 `agent-worker-runtime-deps.ts` 需要显式导入所有模块？
3. 为什么 `AGENT_SESSION_DESTROY` 需要三级回退？

<details>
<summary>参考答案</summary>

1. 子进程可以隔离计算，防止阻塞主线程，保证 UI 响应性。

2. Electron 打包时只能发现静态导入的模块，动态导入的模块需要显式导入才能被包含在打包结果中。

3. 三级回退确保在各种情况下都能清理资源，即使 sessionId 或 projectId 信息不完整。

</details>

## 口头验收

完成本课后，你应该能用 90 秒口头描述整个 Agent Worker 生命周期：

> "用户点击技能卡片后，`LocalAgentBridge` 的 `startAgent()` 启动 Agent Worker 子进程。子进程通过 stdio 和主进程通信，使用 JSON Lines 协议。`agent-worker-runtime-deps.ts` 确保 Core 模块被正确打包。`AGENT_SESSION_CREATE` 创建会话，`AGENT_SESSION_MESSAGE` 发送非流式消息，`AGENT_SESSION_MESSAGE_STREAM` 发送流式消息，`StreamEventBatcher` 合并连续事件。`AGENT_SESSION_ABORT` 中止 Agent，`AGENT_SESSION_DESTROY` 采用三级回退销毁 Agent。"

## 单元三完成

恭喜完成单元三的学习。你已经掌握了 Agent Worker 和运行时适配的完整知识，包括：

- LocalAgentBridge：启动、停止、消息、中止、子进程通信
- JSON Lines 协议：缓冲区管理、事件分发
- 运行时依赖：静态导入、动态导入、打包
- Agent 会话：创建、消息、中止、销毁
- 三级回退策略：直接移除、间接移除、遍历移除

下一步是单元四：Pi-Tasks 运行时合同。你会看到 Pi-Tasks 怎样定义和运行任务。
