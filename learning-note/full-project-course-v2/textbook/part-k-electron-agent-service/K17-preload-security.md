# K17 · Preload 脚本：renderer 与主进程的安全桥梁

> **课号** K17 · **轨道** T13 · **文件** `packages/desktop/src/main/preload.ts` · **预计阅读** 25 分钟

---

## 本课要回答的问题

renderer 进程怎样安全地调用主进程的 IPC 通道？`preload.ts` 怎样使用 `contextBridge` 暴露 API？`sanitizeIpcArg` 怎样防止安全漏洞？

## 概念阶梯

### 第一层：为什么需要 Preload

Electron 的安全模型要求 renderer 进程和主进程隔离：

- **renderer 进程**：运行网页代码，不能直接访问 Node.js API。
- **主进程**：运行 Node.js 代码，可以访问操作系统 API。

Preload 脚本在 renderer 和主进程之间建立桥梁，通过 `contextBridge` 暴露安全的 API。

### 第二层：contextBridge 暴露 API

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 暴露安全的 API
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  on: (channel, callback) => ipcRenderer.on(channel, callback),
});
```

### 第三层：sanitizeIpcArg

```typescript
function sanitizeIpcArg(arg: unknown): unknown {
  // 防止原型污染
  if (typeof arg === 'object' && arg !== null) {
    return JSON.parse(JSON.stringify(arg));
  }
  return arg;
}
```

## 源码窗口

### 窗口 1：preload.ts 全文（第 1–49 行）

```typescript
import { contextBridge, ipcRenderer } from 'electron';

// 安全的 IPC 调用
const safeIpc = {
  invoke: (channel: string, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args.map(sanitizeIpcArg));
  },
  send: (channel: string, ...args: unknown[]) => {
    ipcRenderer.send(channel, ...args.map(sanitizeIpcArg));
  },
  on: (channel: string, callback: (event: unknown, ...args: unknown[]) => void) => {
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeListener(channel, callback);
  },
};

// 暴露到 renderer
contextBridge.exposeInMainWorld('electronAPI', {
  ipc: safeIpc,
});
```

### 窗口 2：sanitizeIpcArg（第 50–80 行）

```typescript
function sanitizeIpcArg(arg: unknown): unknown {
  // 防止原型污染
  if (typeof arg === 'object' && arg !== null) {
    return JSON.parse(JSON.stringify(arg));
  }
  return arg;
}
```

## 失败路径

### 失败 1：原型污染

如果参数包含恶意原型链，`sanitizeIpcArg` 通过 `JSON.parse(JSON.stringify(arg))` 清除原型链。

### 失败 2：IPC 通道名错误

如果 renderer 发送错误的通道名，主进程没有对应的 handler，Electron 会抛出异常。

### 失败 3：renderer 被篡改

如果 renderer 被恶意代码篡改，`contextBridge` 确保只有暴露的 API 可用。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么需要 `sanitizeIpcArg`？
2. `contextBridge.exposeInMainWorld` 的作用是什么？

<details>
<summary>参考答案</summary>

1. 防止原型污染攻击，确保参数安全。

2. 暴露安全的 API 到 renderer，renderer 不能访问 Node.js API。

</details>

## 口头验收

完成本课后，你应该能用 30 秒口头描述：

> "`preload.ts` 使用 `contextBridge.exposeInMainWorld` 暴露安全的 IPC API 到 renderer。`sanitizeIpcArg` 防止原型污染攻击。renderer 通过 `window.electronAPI.ipc.invoke/send/on` 调用主进程的 IPC 通道。"

## 下一课预告

K17 讲了 preload 脚本。K18 是单元小结课，把 K09–K17 的知识重新组织成系统能力。
