# 单元导读六：Web 状态层、共享 UI、服务适配与包基础

> 课号 J49–J55。本单元是 Part J 的收尾，覆盖 Web 包里"看不见但到处在用"的基础设施：剩余 Zustand store、通用 Hook、shadcn UI 组件、聊天组件、服务适配器、配置、类型声明和样式。

---

## 本单元的源码范围

### 覆盖

| 分组 | 文件 | 说明 |
| --- | --- | --- |
| 剩余 Store | `sandboxStore.ts`、`settingsStore.ts` | 沙箱状态、LLM 设置 |
| 通用 Hook | `useContextMenu`、`useDesktopGrid`、`useResponsive`、`useGlobalShortcut`、`useViewReconciler`、`useLocalAgent`、`agent.ts`、`hooks/index.ts` | 右键菜单、桌面网格、响应式、全局快捷键、视图协调、本地 Agent、Agent 注册表查询 |
| 共享 UI 基础 | `button`、`card`、`textarea`、`progress`、`close-button`、`MermaidDiagram`、`icon-registry`、`pixel-icons`、`progress-dots` | shadcn 风格基础组件 + 像素图标 + Mermaid 渲染 |
| 聊天组件 | `chat-input-bar`、`chat-message`、`ChatMessageList`、`ChatInput`（molecules）、`MessageList`（molecules） | 输入栏、消息渲染、消息列表 |
| 服务适配 | `ViewReconcilerAdapter`、`normalize-markdown-tables` | 视图生命周期协调、Markdown 表格规范化 |
| 包基础 | `lib/utils.ts`、`lib/hooks/use-file-upload`、`lib/hooks/use-projects`、`lib/features/*` re-exports、`lib/storage/*` re-exports | 工具函数、文件上传、项目管理、Core re-export |
| 配置 | `config/system-apps.ts` | 系统内置应用定义 |
| 样式 | `styles/globals.css` | 全局 CSS 变量、主题色、滚动条 |
| 类型声明 | `ambient.d.ts`、`svg.d.ts`、`vitest.d.ts`、`test-setup.ts` | SVG 导入、Vitest 全局、测试初始化 |
| 模块桩 | `modules/collaboration-runtime/facade.ts`、`modules/neural-channel/*`、`modules/view-manager/*`、`modules/view-reconciler/*` | Core re-export 和未实现桩 |

### 并行实现

- `ChatInput`（molecules）和 `chat-input-bar`（ui）是两个独立的聊天输入组件，前者更老，后者支持附件。
- `MessageList`（molecules）和 `ChatMessageList`（ui/chat）也是两套消息列表，后者更完整。

### 延后到后续单元

以下子系统文件数量大、领域独立，不在本单元覆盖范围：

- `components/os/data-editor/`（12 个文件，2579 行）：本体数据编辑器
- `components/solution/`（3 个文件，1660 行）：方案设计
- `components/taste/`（4 个文件，1002 行）：文化品味检测
- `components/sandbox/`（5 个文件，409 行）：代码沙箱
- `components/os/settings/`（1 个文件，543 行）：设置对话框
- `components/os/schedules/`（3 个文件，1104 行）：定时任务
- `components/os/ontology-preview/`（3 个文件，1250 行）：本体预览动画
- `components/os/Desktop.tsx`、`DesktopGrid.tsx`、`ContextMenu.tsx`、`AgentInitializer.tsx`、`EntryExportButton.tsx`：OS 桌面组件
- `app/window/page.tsx`、`app/dock/page.tsx`、`app/layout.tsx` 等路由页面

这些子系统将在 Part J 的后续单元（单元七起）覆盖。

---

## 本单元要回答的总问题

1. Web 包的基础设施层（store、hook、UI 组件、服务、配置）如何支撑上层业务？
2. 共享聊天组件（ChatInputBar、ChatMessageList）如何处理消息渲染、工具执行帧、AskUserQuestion？
3. ViewReconcilerAdapter 如何协调视图的创建/启动/暂停/销毁生命周期？
4. 包基础（utils、re-exports、类型声明、样式）如何体现 monorepo 的单向依赖原则？

---

## 课程地图

| 课号 | 标题 | 核心文件 | 核心问题 |
| --- | --- | --- | --- |
| J49 | 剩余 Store 与通用 Hook | `sandboxStore`、`settingsStore`、`useContextMenu`、`useDesktopGrid`、`useResponsive`、`useGlobalShortcut` | 沙箱和设置如何管理状态？通用 Hook 如何封装 DOM 交互？ |
| J50 | 视图协调与 Agent 查询 Hook | `useViewReconciler`、`useLocalAgent`、`agent.ts`、`hooks/index.ts` | 视图生命周期如何协调？Agent 注册表如何查询？ |
| J51 | 共享 UI 基础组件 | `button`、`card`、`textarea`、`progress`、`close-button`、`MermaidDiagram`、`icon-registry`、`pixel-icons`、`progress-dots` | shadcn 组件如何组织？像素图标如何注册？ |
| J52 | 聊天组件 | `chat-input-bar`、`chat-message`、`ChatMessageList`、`ChatInput`（molecules）、`MessageList`（molecules） | 两套聊天组件有何差异？消息渲染如何处理 Markdown/代码高亮/Mermaid？ |
| J53 | 服务适配器 | `ViewReconcilerAdapter`、`normalize-markdown-tables` | 视图协调器如何桥接 Web 与 Core？Markdown 表格如何规范化？ |
| J54 | 包基础：工具、配置、样式与类型 | `lib/utils.ts`、`lib/hooks/*`、`lib/features/*` re-exports、`config/system-apps.ts`、`styles/globals.css`、类型声明、模块桩 | monorepo 的 re-export 模式如何运作？全局样式如何定义主题？ |
| J55 | 单元六总结 | 全部 | 回顾、源码台账、概念图、小黑插图 |

---

## 延后主题

- 数据编辑器（data-editor）：本体实例的表格/表单/图谱编辑。
- 方案设计（solution）：方案版本管理、拓扑图。
- 文化品味检测（taste）：对话式品味检测流程。
- 代码沙箱（sandbox）：iframe 沙箱、控制台、错误面板。
- 设置对话框（settings）：LLM 配置、语言偏好。
- 定时任务（schedules）：CRUD 定时任务、cron 表达式。
- 本体预览动画（ontology-preview）：树形展开动画、项目完成流程。
- OS 桌面组件（Desktop、DesktopGrid、ContextMenu 等）。
- 路由页面（window/page、dock/page 等）。

---

## 学习终点

完成本单元后，你应该能够：

1. 说出 Web 包每个 store 的职责边界；
2. 解释共享聊天组件的消息渲染流程（Markdown → 代码高亮 → Mermaid → AskUserQuestion）；
3. 画出 ViewReconcilerAdapter 的视图生命周期状态机；
4. 列出 Web 包通过 re-export 从 Core 引入的所有模块；
5. 说明全局 CSS 变量的主题切换机制。
