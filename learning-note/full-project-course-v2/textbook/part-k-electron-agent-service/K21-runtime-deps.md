# K21 · agent-worker-runtime-deps.ts：运行时依赖打包

> **课号** K21 · **轨道** T13 · **文件** `packages/desktop/src/main/agent-worker-runtime-deps.ts` · **预计阅读** 20 分钟

---

## 本课要回答的问题

为什么需要 `agent-worker-runtime-deps.ts`？它怎样确保 Core 模块被正确打包到桌面版中？动态导入和静态导入有什么区别？

## 概念阶梯

### 第一层：Electron 打包问题

Electron 打包时，TypeScript/electron-builder 只能发现静态导入的模块。如果 Agent Worker 通过动态导入加载模块，这些模块不会被包含在打包结果中。

```textn静态导入
  → TypeScript/electron-builder 可以发现
  → 包含在打包结果中

动态导入
  → TypeScript/electron-builder 无法发现
  → 不包含在打包结果中
  → 运行时找不到模块
```

### 第二层：解决方案

`agent-worker-runtime-deps.ts` 通过静态导入所有需要的模块，确保它们被包含在打包结果中：

```typescript
import '../../../core/src/lib/integrations/pi-agent/cognitive/knowledge-provider';
import '../../../core/src/lib/integrations/pi-agent/cognitive/manager';
// ... 更多导入
```

### 第三层：动态导入

Agent Worker 通过动态导入加载这些模块：

```typescript
const module = await import('/absolute/path/to/module');
```

由于 `agent-worker-runtime-deps.ts` 已经静态导入了这些模块，动态导入可以找到它们。

## 源码窗口

### 窗口 1：agent-worker-runtime-deps.ts 全文（第 1–30 行）

```typescript
/**
 * Compile anchor for packaged multi-agent worker runtime dependencies.
 *
 * The agent worker loads these modules via dynamic absolute imports at runtime,
 * so TypeScript/electron-builder cannot discover them from the normal static
 * desktop entry graph. Keeping this file in the desktop tsconfig include set
 * forces the required core modules to be emitted into dist-electron/core/src.
 */

import '../../../core/src/lib/integrations/pi-agent/cognitive/knowledge-provider';
import '../../../core/src/lib/integrations/pi-agent/cognitive/manager';
import '../../../core/src/lib/integrations/pi-agent/cognitive/pattern/index';
import '../../../core/src/lib/integrations/pi-agent/cognitive/practice-logger';
import '../../../core/src/lib/integrations/pi-agent/cognitive/sleep-compute';
import '../../../core/src/lib/integrations/pi-agent/core/agent';
import '../../../core/src/lib/integrations/pi-agent/persistent-agent';
import '../../../core/src/lib/integrations/pi-agent/project-agent/collaboration-prompt';
import '../../../core/src/lib/integrations/pi-agent/project-agent/project-collaboration-context';
import '../../../core/src/lib/integrations/pi-agent/project-agent/project-context';
import '../../../core/src/lib/integrations/pi-agent/project-agent/project-prompt';
import '../../../core/src/lib/integrations/pi-agent/server-config';
import '../../../core/src/lib/integrations/pi-agent/tools/index';
import '../../../core/src/lib/integrations/pi-agent/tools/context';
import '../../../core/src/lib/integrations/pi-agent/tools/archival-memory-tools';
import '../../../core/src/lib/integrations/pi-agent/tools/core-memory-tools';
import '../../../core/src/modules/collaboration-runtime/engine/agent-context-writer';
import '../../../core/src/modules/collaboration-runtime/session/blackboard';
import '../../../core/src/modules/memory-core/index';
import '../../../core/src/modules/memory-core/session/memory-provider';
```

## 失败路径

### 失败 1：模块未导入

如果某个模块未在 `agent-worker-runtime-deps.ts` 中导入，动态导入时会找不到模块。

### 失败 2：路径错误

如果导入路径错误，TypeScript 编译失败。

### 失败 3：循环依赖

如果模块之间存在循环依赖，可能导致运行时错误。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么需要 `agent-worker-runtime-deps.ts`？
2. 动态导入和静态导入有什么区别？

<details>
<summary>参考答案</summary>

1. 确保 Core 模块被正确打包到桌面版中，供 Agent Worker 动态导入。

2. 静态导入在编译时确定，动态导入在运行时确定。

</details>

## 口头验收

完成本课后，你应该能用 30 秒口头描述：

> "`agent-worker-runtime-deps.ts` 通过静态导入所有需要的 Core 模块，确保它们被包含在 Electron 打包结果中。Agent Worker 通过动态导入加载这些模块。"

## 下一课预告

K21 讲了运行时依赖。K22 会看 Agent 会话怎样创建和初始化。
