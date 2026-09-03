# K18 · IPC 协议与桌面服务层综合工作坊

> **课号** K18 · **轨道** T13 · **类型** 单元小结课（workshop） · **预计阅读** 35 分钟

---

## 本课要回答的问题

K09–K17 分别讲了 IPC 协议、Agent 会话生命周期、流式消息、StreamEventBatcher、SkillService、ProjectService、WorkspaceService、CollaborationService 和 Preload 脚本。但这些知识是分散的。当用户报告"Agent 回复卡住了"或"文件上传失败"时，怎样从整体视角定位问题？IPC 通信的完整链路是怎样的？

## 主线复盘

### 从用户点击到 Agent 回复的完整链路

```text
用户点击技能卡片
  │
  ├─ K09: renderer 通过 IPC 发送 AGENT_SESSION_CREATE
  │   └─ ipc-protocol.ts 定义 148 个通道
  │
  ├─ K10: 主进程收到请求，AgentSessionService 处理会话创建
  │   ├─ 参数校验
  │   ├─ 持久化 LLM 配置
  │   ├─ 检查已有会话
  │   └─ 创建会话
  │
  ├─ K11: 用户发送消息，AGENT_SESSION_MESSAGE_STREAM 触发流式回复
  │   ├─ 非流式：等待完整回复
  │   └─ 流式：实时推送 text_delta
  │
  ├─ K12: 流式事件通过 IPC 返回 renderer，StreamEventBatcher 合并文本
  │   ├─ 首次立即刷新
  │   ├─ 32ms / 16KB 刷新
  │   └─ flush() 清空缓冲区
  │
  ├─ K13: SkillService 处理技能列表和执行
  │   ├─ skill:list 获取技能
  │   ├─ skill:execution:start 执行技能
  │   └─ skill:execution:start:stream 流式执行
  │
  ├─ K14: ProjectService 处理项目 CRUD 和初始化
  │   ├─ project:create 创建项目
  │   ├─ project:init 初始化项目结构
  │   └─ project:sync-ontology 同步本体
  │
  ├─ K15: WorkspaceService 处理文件读写和上传
  │   ├─ workspace:file:read 读取文件
  │   ├─ workspace:file:write 写入文件
  │   └─ workspace:file:upload 上传文件（500MB 限制）
  │
  ├─ K16: CollaborationService 处理多 Agent 协作
  │   ├─ collaboration:session:create 创建会话
  │   ├─ collaboration:topology:get 获取拓扑
  │   └─ collaboration:blackboard:get/update 操作黑板
  │
  └─ K17: Preload 脚本建立安全桥梁
      ├─ contextBridge.exposeInMainWorld 暴露 API
      └─ sanitizeIpcArg 防止原型污染
```

## 系统能力地图

### 能力一：IPC 通信

| 能力 | 关键文件 | 核心机制 |
| --- | --- | --- |
| 通道定义 | `ipc-protocol.ts` | 148 个通道，按领域分组 |
| 安全通信 | `preload.ts` | `contextBridge`、`sanitizeIpcArg` |
| 流式消息 | `agent-session-service.ts` | `AGENT_SESSION_MESSAGE_STREAM` |
| 事件合并 | `stream-event-batcher.ts` | 32ms / 16KB 刷新 |

### 能力二：桌面服务

| 能力 | 关键文件 | 核心机制 |
| --- | --- | --- |
| Agent 会话 | `agent-session-service.ts` | 创建、获取、更新、删除、消息、流式消息 |
| 技能执行 | `skill-service.ts` | 列表、执行、流式执行 |
| 项目管理 | `project-service.ts` | CRUD、初始化、本体同步 |
| 文件管理 | `workspace-service.ts`、`local-fs.ts` | 读写、上传、路径白名单 |
| 多 Agent 协作 | `collaboration-service.ts` | 会话、拓扑、黑板 |

## 排查地图

### 故障 1：Agent 回复卡住

**可能原因：**

1. **事件循环卡顿**：主线程被阻塞，`lagMs >= 500ms`。
2. **渲染进程无响应**：`unresponsive` 事件触发。
3. **流式批处理延迟**：`StreamEventBatcher` 的 32ms 定时器未触发。
4. **Agent Worker 子进程崩溃**：`render-process-gone` 事件触发。

**排查步骤：**

1. 检查 LLM 日志 `llm-{YYYY-MM-DD}.log`，搜索 `[ProcessHealth]` 前缀。
2. 检查是否有 `main-event-loop-lag` 警告。
3. 检查是否有 `renderer-unresponsive` 或 `renderer-gone` 日志。
4. 检查 `agent-active` 日志中的 `phase` 字段，确认 Agent 卡在哪个阶段。

### 故障 2：文件上传失败

**可能原因：**

1. **文件超过 500MB**：`FILE_TOO_LARGE` 错误。
2. **路径不在白名单内**：`PathNotAllowedError`。
3. **磁盘空间不足**：`DISK_FULL` 错误。

**排查步骤：**

1. 检查文件大小是否超过 500MB。
2. 检查请求路径是否在白名单内。
3. 检查磁盘空间。

### 故障 3：IPC 通信失败

**可能原因：**

1. **通道名拼写错误**：`IPC_CHANNELS` 常量拼写错误。
2. **Preload 未加载**：`window.electronAPI` 不存在。
3. **主进程未注册 handler**：`ipcMain.handle()` 未调用。

**排查步骤：**

1. 检查 `IPC_CHANNELS` 常量定义。
2. 检查 `preload.ts` 是否正确加载。
3. 检查主进程是否注册了对应的 handler。

## 综合练习

### 练习 1：场景分析

用户报告："我发送消息后，Agent 没有回复。"

根据排查地图，列出可能的原因和排查步骤。

<details>
<summary>参考答案</summary>

**可能原因：**

1. Agent 会话未创建成功。
2. IPC 通信失败。
3. Agent Worker 子进程崩溃。
4. 流式批处理延迟。

**排查步骤：**

1. 检查 `AGENT_SESSION_CREATE` 是否成功。
2. 检查 `AGENT_SESSION_MESSAGE_STREAM` 是否发送成功。
3. 检查 LLM 日志，搜索 `[ProcessHealth]` 前缀。
4. 检查 `agent-active` 日志中的 `phase` 字段。

</details>

### 练习 2：设计决策

回答以下问题：

1. 为什么 IPC 通道名要按领域分组？
2. 为什么 `StreamEventBatcher` 的首次文本要立即刷新？
3. 为什么 `LocalFileSystem` 要使用路径白名单？

<details>
<summary>参考答案</summary>

1. 按领域分组便于管理和维护，避免命名冲突。

2. 首次文本立即刷新减少感知延迟，用户发送消息后尽快看到第一个字。

3. 路径白名单防止路径遍历攻击，确保只能访问允许的目录。

</details>

## 口头验收

完成本课后，你应该能用 90 秒口头描述整个 IPC 通信链路：

> "用户点击技能卡片后，renderer 通过 `window.electronAPI.ipc.invoke` 发送 `AGENT_SESSION_CREATE` 请求。主进程收到请求后，`AgentSessionService` 创建会话。用户发送消息后，`AGENT_SESSION_MESSAGE_STREAM` 触发流式回复。Agent 产生的 `text_delta` 经过 `StreamEventBatcher` 合并后，通过 IPC 返回 renderer。`StreamEventBatcher` 首次文本立即刷新，后续 32ms 或 16KB 触发刷新。`SkillService` 处理技能执行，`ProjectService` 处理项目 CRUD，`WorkspaceService` 处理文件读写，`CollaborationService` 处理多 Agent 协作。`preload.ts` 使用 `contextBridge` 暴露安全的 IPC API，`sanitizeIpcArg` 防止原型污染。"

## 单元二完成

恭喜完成单元二的学习。你已经掌握了 IPC 协议和桌面服务层的完整知识，包括：

- IPC 协议：148 个通道，按领域分组
- Agent 会话生命周期：创建、获取、更新、删除、消息、流式消息
- 流式消息：非流式和流式两种模式
- StreamEventBatcher：合并连续文本，首次立即刷新
- SkillService：技能列表、执行、流式执行
- ProjectService：项目 CRUD、初始化、本体同步
- WorkspaceService：文件读写、上传、路径白名单
- CollaborationService：多 Agent 协作、拓扑、黑板
- Preload 脚本：安全桥梁、原型污染防护

下一步是单元三：Agent Worker 和适配器。你会看到 Agent 怎样在子进程中运行，怎样和主进程通信。
