# F29：Goal Extension —— Pi Agent Adapter 的扩展边界

## 开篇场景

OriginOS 的 Agent 运行时底层依赖 `@originos/pi-agent-adapter`。这个 Adapter 提供了通用的 Agent 能力，但 OriginOS 有一些自己的产品级扩展，比如：

- Goal（目标）管理：让 Agent 在运行中创建、追踪、完成目标；
- Coding Agent 扩展：与代码编辑相关的特殊能力。

`goal-extension.ts` 就是 OriginOS 在 Pi Agent Adapter 边界上注册 Goal 扩展的薄层。它本身几乎没有业务逻辑，只是把一个外部扩展挂到正确的 API 上。

## 核心问题

**为什么需要一个独立的 `goal-extension.ts` 文件？它如何体现“集成边界”的设计原则？**

## 概念阶梯

**Pi Agent Adapter**：OriginOS 与底层 LLM Agent 运行时的适配层，提供 `OriginOSAgent`、工具调用协议、事件流等。

**ExtensionAPI**：Adapter 暴露给上层产品的扩展点，允许注册新的工具、事件处理器或行为。

**Goal Extension**：让 Agent 能够以“目标”为单位组织多轮行动，支持目标分解、追踪和完成。

**边界文件**：不包含业务逻辑，只负责把外部扩展连接到系统边界。

## 图解：Goal Extension 的位置

```mermaid
flowchart TD
    A[OriginOS 业务逻辑] --> B[integrations/pi-agent]
    B --> C[goal-extension.ts]
    C --> D[@originos/pi-agent-adapter/goal]
    D --> E[Adapter 内部 Goal 机制]
```

## 源码精读

### 1. 文件全貌

[packages/core/src/lib/integrations/pi-agent/goal-extension.ts 第 1—11 行](../../../../packages/core/src/lib/integrations/pi-agent/goal-extension.ts#L1)

```typescript
import type { ExtensionAPI } from "@originos/pi-agent-adapter/coding-agent";
import goalExtension from "@originos/pi-agent-adapter/goal";

/**
 * Registers the approved Goal extension at the Pi integration boundary.
 * Product entry points remain disabled until their owning Story enables them.
 */
export function registerGoalExtension(api: ExtensionAPI): void {
	goalExtension(api);
}
```

只有两行有效代码：

1. 导入 Adapter 的 `ExtensionAPI` 类型和 `goal` 扩展实现；
2. 导出一个 `registerGoalExtension` 函数，把 `goalExtension` 注册到传入的 API。

### 2. 为什么独立成一个文件

- **清晰的边界**：所有与 `@originos/pi-agent-adapter` 的直接交互都集中在 `integrations/pi-agent/*`。业务逻辑层不应该直接 import Adapter 的扩展模块。
- **可切换**：如果未来 Goal 扩展的实现方式变化（比如从 Adapter 内置改为 OriginOS 自己实现），只需要改这个文件。
- **权限控制**：注释中提到“Product entry points remain disabled until their owning Story enables them”。这意味着 Goal 扩展虽然注册了，但具体的产品入口（如 UI 按钮、API 路由）需要等对应 Story 完成后才启用。

### 3. 调用方

目前 `registerGoalExtension` 的调用方可能在：

- `packages/core/src/lib/integrations/pi-agent/agent-manager.ts` 或相关初始化代码；
- Adapter 初始化时传入 `ExtensionAPI`。

调用模式类似：

```typescript
import { registerGoalExtension } from './goal-extension';

const api = adapter.getExtensionAPI();
registerGoalExtension(api);
```

## 真实调用链

1. 系统启动或 AgentManager 初始化时，获取 Adapter 的 `ExtensionAPI`。
2. 调用 `registerGoalExtension(api)`。
3. Adapter 内部的 Goal 机制被激活，Agent 可以在运行中使用 Goal 相关能力。
4. 具体 Goal 的创建、分解、完成逻辑由 Adapter 内部实现，OriginOS 通过工具调用或事件间接使用。

## 关键类型与数据示例

### ExtensionAPI 使用示例

```typescript
interface ExtensionAPI {
  registerTool: (tool: AgentTool) => void;
  registerEventHandler: (handler: EventHandler) => void;
  // ...
}
```

`goalExtension(api)` 可能会调用 `api.registerTool` 注册 `create_goal`、`complete_goal` 等工具。

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| `api` 未传入 | 运行时调用 `goalExtension(undefined)` 可能抛错 | 调用方责任 |
| Adapter 版本不兼容 | 类型或运行时错误 | `@originos/pi-agent-adapter` 升级 |
| Goal 扩展被禁用 | 注册后工具不可用 | Story 未启用对应入口 |

**一个关键边界**：这个文件没有任何错误处理。如果 `goalExtension(api)` 抛错，会向上传播。调用方需要决定是否捕获。

## 测试证据

- `goal-extension.ts` 当前无直接测试。
- 由于它是一个纯代理函数，测试价值在于验证它确实调用了 Adapter 的 `goalExtension`。
- 建议补一个最小 mock 测试：

```typescript
it('registers goal extension on adapter api', () => {
  const api = { registerTool: vi.fn() } as unknown as ExtensionAPI;
  registerGoalExtension(api);
  expect(api.registerTool).toHaveBeenCalled();
});
```

## 练习与验收

1. **查找调用方**：在代码库中搜索 `registerGoalExtension`，确认它被谁调用、在什么时候调用。
2. **阅读 Adapter Goal 扩展**：如果 `@originos/pi-agent-adapter/goal` 源码可读，查看它注册了哪些工具。
3. **设计边界测试**：为 `registerGoalExtension` 写一个最小 mock 测试。
4. **讨论禁用策略**：注释说“Product entry points remain disabled until their owning Story enables them”。这种设计有什么好处？

**验收标准**：能解释 `goal-extension.ts` 作为边界文件的作用，能找到它的调用方。

## 章节收束

本节课看了最薄的边界文件 `goal-extension.ts`。下一节课把 launcher 和 persistent agent 放在一起，讲它们的集成关系。
