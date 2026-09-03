# K09 · IPC 协议：148 个通道怎样组织

> **课号** K09 · **轨道** T13 · **文件** `packages/desktop/src/main/ipc-protocol.ts` · **预计阅读** 15 分钟

---

## 本课要回答的问题

renderer 和主进程之间需要通信，但通信通道怎样命名和组织？`ipc-protocol.ts` 定义了 148 个通道，它们按什么规则分组？为什么用常量对象而不是字符串字面量？

## 概念阶梯

### 第一层：为什么需要 IPC 协议

Electron 的安全模型要求 renderer 进程和主进程隔离：

- **renderer 进程**：运行网页代码，不能直接访问 Node.js API（如 `fs`、`child_process`）。
- **主进程**：运行 Node.js 代码，可以访问操作系统 API。

renderer 需要读取文件时，必须通过 IPC 发送请求给主进程，主进程执行后返回结果。

### 第二层：通道命名规则

通道名采用 `domain:action` 格式：

```typescript
// 窗口管理
WINDOW_CREATE: 'window:create',
WINDOW_CLOSE: 'window:close',

// 文件系统
FS_READ: 'fs:read',
FS_WRITE: 'fs:write',

// Agent 会话
AGENT_SESSION_CREATE: 'agent:session:create',
AGENT_SESSION_MESSAGE: 'agent:session:message',
```

### 第三层：为什么用常量对象

```typescript
export const IPC_CHANNELS = {
  WINDOW_CREATE: 'window:create',
  // ...
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
```

1. **防止拼写错误**：TypeScript 可以检查 `IPC_CHANNELS.WINDOW_CREATE` 的拼写。
2. **自动补全**：IDE 可以提示所有可用的通道名。
3. **重构安全**：重命名通道时，所有引用自动更新。
4. **类型安全**：`IpcChannel` 类型确保只能使用已定义的通道名。

## 源码窗口

### 窗口 1：ipc-protocol.ts 全文（151 行）

```typescript
export const IPC_CHANNELS = {
  WINDOW_CREATE: 'window:create',
  WINDOW_CLOSE: 'window:close',
  WINDOW_FOCUS: 'window:focus',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSED: 'window:closed',
  FS_READ: 'fs:read',
  FS_WRITE: 'fs:write',
  // ... 148 个通道
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
```

**按领域分组：**

| 领域 | 通道数量 | 示例 |
| --- | --- | --- |
| Window | 6 | `window:create`, `window:close` |
| File System | 7 | `fs:read`, `fs:write` |
| Workspace | 6 | `workspace:resolve`, `workspace:file:list` |
| Agent | 24 | `agent:start`, `agent:session:create` |
| Skill | 10 | `skill:list`, `skill:execution:start` |
| Project | 20 | `project:list`, `project:create` |
| Ontology | 20 | `ontology:entity:list`, `ontology:entity:create` |
| User | 6 | `user-agent:list`, `user-skill:list` |
| Interview | 5 | `interview:list`, `interview:create` |
| Notification | 4 | `notification:list`, `notification:show` |
| Update | 5 | `update:status`, `update:check` |
| Collaboration | 8 | `collaboration:topology:get`, `collaboration:session:create` |
| Taste | 4 | `taste:detection:start`, `taste:detection:message` |
| Sandbox | 1 | `sandbox:app:list` |
| Dock | 5 | `dock:show`, `dock:hide` |

## 失败路径

### 失败 1：通道名拼写错误

如果 renderer 发送 `window:creat`（少了一个 e），主进程没有对应的 handler，Electron 会抛出异常。

### 失败 2：通道名冲突

如果两个服务注册了同一个通道名，后注册的服务会覆盖先注册的服务。`ipcMain.handle()` 在同一个 channel 上注册两次会抛异常。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么用 `as const`？如果不用会怎样？
2. `IpcChannel` 类型怎样从 `IPC_CHANNELS` 推导出来？

<details>
<summary>参考答案</summary>

1. `as const` 把对象属性转换为字面量类型，确保 `IPC_CHANNELS.WINDOW_CREATE` 的类型是 `'window:create'` 而不是 `string`。这样 TypeScript 可以在编译时检查通道名的正确性。

2. `typeof IPC_CHANNELS` 获取对象的类型，`keyof typeof IPC_CHANNELS` 获取所有键名，`typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]` 获取所有值的联合类型。

</details>

## 口头验收

完成本课后，你应该能用 30 秒口头描述：

> "`ipc-protocol.ts` 定义了 148 个 IPC 通道，按领域分组，采用 `domain:action` 命名格式。用 `as const` 确保类型安全，`IpcChannel` 类型是值的联合类型。"

## 下一课预告

K09 讲了 IPC 通道的组织。K10 会看 `AgentSessionService` 怎样处理 Agent 会话的生命周期。
