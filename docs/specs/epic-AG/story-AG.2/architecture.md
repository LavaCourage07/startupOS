# 架构设计 - Story AG.2

**Story:** 模块边界修复 — DI 接口扩展 + UI 解耦 + shared 层
**Epic:** AG — 架构治理与围栏对齐
**最后更新:** 2026-07-17

---

## 概述

本 Story 修复 `src/modules/**` 中所有越界 import（共 11 处），通过依赖注入和 shared 层使模块成为真正可独立装拔的业务单元。涉及 `collaboration-runtime`（5 处）、`memory-core`（4 处），并新建 `src/lib/shared/` 层。

---

## A. `collaboration-runtime` 模块越界修复（5 处）

- [ ] **A-1**（已存在 DI 但未走通）
  - 文件：`src/modules/collaboration-runtime/engine/supervisor-dag.ts:30`
  - 当前：`import { createAutoModel } from "@/lib/integrations/pi-agent/server-config"`
  - 处理：在 `CollaborationRuntimeDeps` 中扩展 `modelFactory: { createAutoModel(): Model }` 接口，supervisor-dag 通过 deps 注入获取；外部 API route 在组装 deps 时传入实现。
- [ ] **A-2**（facade 层穿透到 lib/）
  - 文件：`src/modules/collaboration-runtime/facade/session-store.ts:25`
  - 当前：`import { ... } from "@/lib/integrations/pi-agent/persistent-agent"`
  - 处理：将所需类型抽取到 `src/lib/shared/agent/` 下（仅类型，无实现）；facade 改 import shared；persistent-agent 实际实现保持原位置但 implements shared。
- [ ] **A-3**（agent-context-writer 死路径，AG.1 已删；本 Story 验证残余）
  - 文件：`src/modules/collaboration-runtime/engine/agent-context-writer.ts`
  - 处理：确认 AG.1 已修复，跑 grep 二次确认。
- [ ] **A-4**（UI 直接 import `@/components/ui/*`）
  - 文件：`src/modules/collaboration-runtime/ui/CollaborationViewer.tsx:20`、`MultiAgentLauncher.tsx:6,7`
  - 当前：`import { ... } from "@/components/ui/chat-message"` / `chat-input-bar`
  - 处理（默认 ALT-D-保守版）：
    - 把这些 UI 视为「OriginOS 共享视觉组件库」，保留外部位置
    - 通过 deps 注入：`CollaborationRuntimeUiDeps = { ChatMessage, ChatInputBar, MarkdownContent }` 由调用方（外部 page）注入
    - 在 `src/modules/collaboration-runtime/ui/` 内仅持有渲染编排逻辑，不直接 import shadcn 组件
  - 备选 ALT-D-合并：将 UI 整体迁回 `src/components/os/multi-agent/`（影响范围大，留 AG.4 / 后续 Epic 决议）
- [ ] **A-5**（UI 引用 `@/lib/hooks`）
  - 文件：`src/modules/collaboration-runtime/ui/MultiAgentLauncher.tsx:8`
  - 当前：`import { useFileUpload, type UploadedFile } from "@/lib/hooks/use-file-upload"`
  - 处理：与 A-4 同策略，hook 通过 props 或 ui-deps 注入；或将 `useFileUpload` 提到 shared 层供两边共享（hook 实现位置不动）。

---

## B. `memory-core` 模块越界修复（4 处）

- [ ] **B-1**
  - 文件：`src/modules/memory-core/core/consolidator.ts:11`
  - 当前：`import { createAutoModel } from '@/lib/integrations/pi-agent/server-config'`
  - 处理：与 A-1 复用，定义 `MemoryCoreDeps.modelFactory`；consolidator 通过 deps 注入。
- [ ] **B-2 / B-3 / B-4**
  - 文件：`src/modules/memory-core/adapter.ts:9`、`session/enhanced-pattern-provider.ts:11`、`session/memory-provider.ts:8`
  - 当前：均 `import { CognitiveProvider, TurnCognitiveData, MemoryBlock } from '@/lib/integrations/pi-agent/cognitive/types'`
  - 处理：将这些纯类型搬到 `src/lib/shared/cognitive/types.ts`；`@/lib/integrations/pi-agent/cognitive/types` 改为从 shared 重导出；module 改 import shared。

---

## C. 新增 `src/lib/shared/` 层

- [ ] **C-1** 新建目录：`src/lib/shared/`
  - 子目录初始：`agent/`（A-2 类型）、`cognitive/`（B-2/3/4 类型）、`model/`（A-1/B-1 modelFactory 接口）
  - 规则（写入 CLAUDE.md，AG.4 配合）：
    - 仅 `.ts` 类型与接口定义，禁止实现 / 类与函数体
    - 不依赖任何上层（lib/features、components、services、app、modules）
    - 可被 `lib/integrations/`、`lib/features/`、`src/modules/`、`src/components/`、`src/app/` 共享
- [ ] **C-2** 在 `src/lib/shared/index.ts` 暴露 barrel；按需导出，避免大爆炸式 re-export
- [ ] **C-3** 在 CLAUDE.md §依赖层级定义新增 Layer 0：`lib/shared/` 位于最底层，所有层均可依赖（具体文案在 AG.4 落地）

---

## D. 扩展 `CollaborationRuntimeDeps` 接口

- [ ] **D-1** 在 `src/modules/collaboration-runtime/config.ts` 中扩展接口（不改默认实现签名）：
  ```typescript
  export interface CollaborationRuntimeDeps {
    // 既有字段保持不变
    agentEngine: AgentEngine;
    toolExecutor: ToolExecutor;
    ontologyStore: OntologyStore;
    fileOps: FileOps;
    eventEmitter: EventEmitter;
    // 新增
    modelFactory: { createAutoModel: () => Model };  // 替代 supervisor-dag 直接 import
    persistentAgentFactory?: PersistentAgentFactory; // 替代 facade/session-store 直接 import
  }
  ```
- [ ] **D-2** 同步更新 `src/app/api/collaboration/sessions/**` 路由层，组装 deps 时传入新增字段（实现仍在 `src/lib/integrations/pi-agent/`）

---

## E. 验证

- [ ] **E-1** `grep -rn "from ['\"]@/lib" src/modules/` 输出 `0`
- [ ] **E-2** `grep -rn "from ['\"]@/components" src/modules/` 输出 `0`
- [ ] **E-3** `npx tsc --noEmit` 0 error
- [ ] **E-4** 协作运行时既有 4 个 e2e（HITL / DAG / Supervisor / 用户消息路由）全部通过

---

## 技术细节

### `src/lib/shared/` 目录建议结构

```
src/lib/shared/
├── agent/
│   ├── persistent-agent.ts      # PersistentAgent 公共接口与类型
│   └── index.ts
├── cognitive/
│   ├── types.ts                 # CognitiveProvider, TurnCognitiveData, MemoryBlock
│   └── index.ts
├── model/
│   ├── factory.ts               # ModelFactory 接口
│   └── index.ts
└── index.ts                     # barrel
```

### 重定向链路（避免一次性大改）

为降低风险，采用渐进策略：

1. **第 1 步：搬类型** — 把类型定义复制到 shared，旧位置改为 re-export
2. **第 2 步：跑测试** — 类型层面零改动，运行时无影响
3. **第 3 步：替换 import** — 按目录分批 PR，从 `src/modules/**` 开始改 shared import
4. **第 4 步：删除旧位置类型导出** — 等所有 import 替换完成后再删除旧导出

### 依赖注入实现示例

```typescript
// modules/collaboration-runtime/config.ts
export interface CollaborationRuntimeDeps {
  modelFactory: { createAutoModel: () => Model };
  // ...
}

// app/api/collaboration/sessions/[id]/execute/route.ts
import { createAutoModel } from "@/lib/integrations/pi-agent/server-config";
import { createCollaborationRuntime } from "@/modules/collaboration-runtime";

const runtime = createCollaborationRuntime({
  modelFactory: { createAutoModel },
  // ... 其他 deps
});
```
