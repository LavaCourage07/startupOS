# J55：单元六总结

## 回顾：本单元回答的四个总问题

### 问题一：Web 包的基础设施层如何支撑上层业务？

Web 包的基础设施分四层：

```
┌─────────────────────────────────────────────────────┐
│  组件层（components/）                                │
│  聊天组件、UI 基础组件、OS 桌面组件                      │
├─────────────────────────────────────────────────────┤
│  Hook 层（hooks/）                                    │
│  窗口管理、Agent 查询、桌面网格、右键菜单、快捷键           │
├─────────────────────────────────────────────────────┤
│  Store 层（store/）                                   │
│  sandboxStore、settingsStore、agentRegistry 等         │
├─────────────────────────────────────────────────────┤
│  服务 / 工具 / 配置层                                  │
│  ViewReconcilerAdapter、normalizeMarkdownTables、     │
│  lib/utils.ts、config/system-apps.ts、globals.css     │
└─────────────────────────────────────────────────────┘
```

每层只依赖下层，不反向依赖。Store 不引用组件，Hook 不引用 Store 的内部实现（只通过选择器订阅），服务层不引用 Hook 或组件。

### 问题二：共享聊天组件如何处理消息渲染？

消息渲染管线：

```
Agent 回复文本
  │
  ├─ sanitizeAgentDisplayContent()  ← Core 层安全过滤
  │
  ├─ parseAskUserQuestion()  ← 正则提取 YAML 问题卡片
  │   └─ removeYamlBlock()  ← 从显示内容中移除 YAML
  │
  ├─ normalizeMarkdownTables()  ← 修复全角管道符、分隔符、空行
  │
  └─ MarkdownContent 组件
      ├─ isStreaming && length >= 4000 → 纯文本降级
      └─ ReactMarkdown + remarkGfm + rehypeHighlight
          ├─ 行内代码 → <code> + 背景色
          ├─ 代码块 → rehype-highlight 语法高亮
          ├─ mermaid 代码块 → MermaidDiagram 组件
          └─ 其他 → 标准 Markdown 渲染
```

### 问题三：ViewReconcilerAdapter 的视图生命周期？

```
initModules()
  ├─ 动态导入 @neural-nexus/view-manager
  ├─ 动态导入 @neural-nexus/neural-channel
  └─ 模块不可用 → 标记 fallback

createView()
  ├─ 类型过滤：view/iframe/microapp/qiankun
  ├─ 模块可用 → viewManager.openPage()
  └─ 模块不可用 → createFallbackView()（iframe）

startView() / pauseView() / resumeView() / stopView()
  ├─ page.onXxx()（view-manager 管理）
  └─ callbacks.onXxx()（用户回调）

destroyView()
  ├─ viewManager.closePage()
  ├─ 移除 fallback iframe
  └─ 清理 pages/reconcilers/callbacks Map
  └─ ⚠️ onDestroy 回调因 delete 在前而永远不会触发
```

### 问题四：Web 包如何通过 re-export 体现 monorepo 单向依赖？

```
packages/web/src/
  ├─ lib/features/ontology-data-store/store.ts → @originos/core/...
  ├─ lib/features/culture/services/*.ts → @originos/core/...
  ├─ lib/storage/json-store.ts → @originos/core/...
  ├─ modules/collaboration-runtime/facade.ts → @originos/core/...
  └─ modules/{neural-channel,view-manager,view-reconciler}/src/index.ts → 空桩
```

Web 包不实现任何 Core 已有的逻辑，只做 re-export 桥接。三个空桩模块（`neural-channel`、`view-manager`、`view-reconciler`）对应尚未实现的外部包，`ViewReconcilerAdapter` 通过动态导入 + `.catch(() => null)` 优雅降级。

---

## 源码台账

| 文件 | 行号 | 主讲课 | 关键发现 |
| --- | --- | --- | --- |
| `store/sandboxStore.ts` | 71 | J49 | 日志截断：1000→保留 500 |
| `store/settingsStore.ts` | 308 | J49 | 凭证规范化：JSON/数组/Bearer |
| `hooks/useContextMenu.ts` | 112 | J49 | `setTimeout(0)` 防右键冒泡 |
| `hooks/useDesktopGrid.ts` | 129 | J49 | Map 网格 + 行优先空位查找 |
| `hooks/useResponsive.ts` | 67 | J49 | `typeof window` SSR 保护 |
| `hooks/useGlobalShortcut.ts` | 76 | J49 | capture vs bubble 两种模式 |
| `hooks/useViewReconciler.ts` | 275 | J50 | 自动创建 + 类型过滤 |
| `hooks/useLocalAgent.ts` | 50 | J50 | Electron-only 薄封装 |
| `hooks/agent.ts` | 201 | J50 | 注册表查询 + 搜索封装 |
| `hooks/index.ts` | 33 | J50 | 分组导出 |
| `components/ui/button.tsx` | 56 | J51 | cva 6×4 变体 + asChild/Slot |
| `components/ui/card.tsx` | 79 | J51 | 6 子组件 + forwardRef |
| `components/ui/textarea.tsx` | 24 | J51 | 原生封装 |
| `components/ui/progress.tsx` | 26 | J51 | Radix + translateX |
| `components/ui/close-button.tsx` | 53 | J51 | 对象映射变体 |
| `components/ui/MermaidDiagram.tsx` | 73 | J51 | 模块级初始化 + 随机 ID |
| `components/ui/icon-registry.tsx` | 72 | J51 | emoji→SVG + 回退 emoji 文本 |
| `components/ui/pixel-icons.tsx` | 508 | J51 | 内联 SVG 路径 + px() 辅助 |
| `components/ui/progress-dots.tsx` | 143 | J51 | 三状态 + aria-current |
| `components/ui/chat-input-bar.tsx` | 176 | J52 | 附件芯片 + 停止按钮 + lightBg |
| `components/ui/chat-message.tsx` | 400 | J52 | YAML 解析 + 4000 字降级 + AskUserQuestion |
| `components/ui/chat/ChatMessageList.tsx` | 287 | J52 | rAF 节流 + 底部阈值 + 工具帧 |
| `components/molecules/ChatInput.tsx` | 257 | J52 | 受控/非受控 + 自动调整高度 |
| `components/molecules/MessageList.tsx` | 363 | J52 | 简单 scrollIntoView |
| `services/ViewReconcilerAdapter.ts` | 366 | J53 | 动态导入 + fallback iframe + onDestroy bug |
| `services/normalize-markdown-tables.ts` | 142 | J53 | 全角管道符 + 分隔符规范化 + 空行隔离 |
| `lib/utils.ts` | 5 | J54 | 只有 clsx，缺少 tailwind-merge |
| `lib/hooks/use-file-upload.ts` | 176 | J54 | 隐藏 input + base64 分块 |
| `lib/hooks/use-projects.ts` | 305 | J54 | CRUD + 分页 + 30s 轮询 |
| `lib/features/*/` | 3 文件 | J54 | Core re-export |
| `lib/storage/json-store.ts` | 1 | J54 | Core re-export |
| `config/system-apps.ts` | 31 | J54 | 7 个系统应用 |
| `styles/globals.css` | 181 | J54 | HSL 主题变量 + Electron 适配 |
| `ambient.d.ts` | 8 | J54 | SVG 导入声明 |
| `svg.d.ts` | 1 | J54 | 命名混乱，实际是 Vitest 引用 |
| `vitest.d.ts` | 1 | J54 | Vitest 全局类型 |
| `test-setup.ts` | 3 | J54 | jest-dom + React 全局 |
| `modules/collaboration-runtime/facade.ts` | 1 | J54 | Core re-export |
| `modules/{neural-channel,view-manager,view-reconciler}/src/index.ts` | 各 2 行 | J54 | 空桩 |

**本单元精读文件：40 个，总行数约 5000 行。**

---

## 七个代码问题

| # | 问题 | 文件 | 影响 |
| --- | --- | --- | --- |
| 1 | `cn()` 缺少 `tailwind-merge` | `lib/utils.ts` | 类名冲突时不去重 |
| 2 | `destroyView` 的 `onDestroy` 回调永远不触发 | `ViewReconcilerAdapter.ts:248` | `delete` 在调用之前 |
| 3 | `svg.d.ts` 文件名与内容不符 | `svg.d.ts` | 维护困惑 |
| 4 | `updateProject` 只更新 `name` 和 `description` | `use-projects.ts:152` | 其他字段变化丢失 |
| 5 | `memoizedBaseQuery` 用 `JSON.stringify` 深比较 | `use-projects.ts:73` | 函数/循环引用会出错 |
| 6 | `ChatInputBar` 的 `onRemoveFile?.(-1)` 清除错误 | `chat-input-bar.tsx:97` | 用 `-1` 作为特殊索引，语义不清 |
| 7 | 三个空桩模块没有类型导出 | `modules/*/src/index.ts` | 动态导入时类型推断为 `any` |

---

## 五条关键概念

1. **半量截断**：`sandboxStore` 日志超过 1000 条时保留 500 条，避免突然清空的用户体验问题。

2. **流式性能降级**：`MarkdownContent` 在流式输出超过 4000 字符时跳过 Markdown 解析，直接显示纯文本，避免 ReactMarkdown 的重复解析开销。

3. **动态导入降级**：`ViewReconcilerAdapter` 用 `import().catch(() => null)` 加载外部模块，模块不存在时自动降级为简单 iframe。

4. **自动滚动三要素**：`ChatMessageList` 的自动滚动由 `requestAnimationFrame` 帧调度、100ms 节流、80px 底部阈值三个机制协同工作，同时尊重用户手动上滚的意图。

5. **re-export 桥接**：Web 包的 `lib/features/`、`lib/storage/`、`modules/` 通过单行 re-export 保持目录结构完整，实际实现全部在 Core 包。

---

## 小黑笔记

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   🧱 小黑抱着四块砖，从下往上垒：                          │
│                                                         │
│   ┌─────────────────────────┐  ← 组件层                  │
│   │  ChatMessageList        │    （聊天、UI 基础）         │
│   │  MarkdownContent        │                           │
│   │  Button / Card / ...    │                           │
│   ├─────────────────────────┤  ← Hook 层                 │
│   │  useViewReconciler      │    （窗口、Agent、桌面）     │
│   │  useAgentRegistry       │                           │
│   │  useContextMenu / ...   │                           │
│   ├─────────────────────────┤  ← Store 层                │
│   │  sandboxStore           │    （沙箱、设置、Agent）     │
│   │  settingsStore          │                           │
│   ├─────────────────────────┤  ← 服务 / 工具层            │
│   │  ViewReconcilerAdapter  │    （适配器、cn()、CSS）    │
│   │  normalizeMarkdownTables│                           │
│   │  globals.css            │                           │
│   └─────────────────────────┘                           │
│                                                         │
│   小黑在砖堆旁边贴了张纸条：                               │
│   "上层不直接碰 Core —— 中间隔着 re-export 砖墙。"         │
│                                                         │
│   旁边还有一张：                                          │
│   "onDestroy 回调被 delete 杀死了 💀"                     │
│                                                         │
│   第三张：                                               │
│   "4000 字以上不解析 Markdown —— 卡比丑更难看。"            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 纸面实验

### 实验一：追踪一条 Agent 回复的渲染路径

1. Agent 回复包含 YAML 问题卡片 + Mermaid 图表 + 代码块
2. `ChatMessageList` 遍历 `messages`，找到 assistant 消息
3. `sanitizeAgentDisplayContent()` 过滤不安全内容
4. `parseAskUserQuestion()` 匹配 YAML 代码块 → 提取 question/options/multiSelect
5. `removeYamlBlock()` 从显示内容中移除 YAML
6. `MarkdownContent` 接收剩余内容
7. `normalizeMarkdownTables()` 修复表格格式
8. `ReactMarkdown` 解析 Markdown
9. 遇到 `language-mermaid` 代码块 → 渲染 `MermaidDiagram`
10. 遇到普通代码块 → `rehype-highlight` 语法高亮
11. `AskUserQuestionComponent` 渲染问题卡片

### 实验二：模拟 ViewReconcilerAdapter 模块缺失

1. `initModules()` 动态导入 `@neural-nexus/view-manager` → `.catch(() => null)` → `null`
2. `isModulesAvailable()` → `false`
3. `createView()` 走 `createFallbackView()` → 创建 `<iframe>`
4. `startView()` → `pages.get(viewId)` 返回 `undefined` → 只触发 `callbacks.onStart()`
5. `destroyView()` → `viewManager?.closePage()` 跳过 → 移除 iframe → `callbacks?.onDestroy?.()` 不触发（bug）

### 实验三：验证 `cn()` 的类名冲突

```ts
cn("bg-red-500", "bg-blue-500")
// 当前结果："bg-red-500 bg-blue-500"（两个都保留）
// 期望结果："bg-blue-500"（后者覆盖前者）
// 需要 tailwind-merge 才能正确去重
```

---

## 单元六验收结论

| 维度 | 状态 |
| --- | --- |
| 源码覆盖 | 40 个文件精读，无遗漏 |
| 教学深度 | 每个文件解释"为什么这样设计"和"错误后果" |
| 新手可读 | 导读 → 正式课 → 总结，层层递进 |
| 代码问题 | 识别 7 个问题，含 bug 和设计缺陷 |

**单元六完成。Part J 全部六个单元（J01–J55）已完成。**
