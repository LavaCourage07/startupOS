# J48：单元五总结——项目、访谈与工作区

## 本单元回顾

单元五覆盖了 OriginOS Web 层的两大 UI 表面：

1. **项目创建与访谈界面**：从 `ProjectCreationWizard` 的父子分拆，到 `InterviewWindow` 的左右分栏实时预览，再到旧版 `ProjectInterview` 的六状态状态机。
2. **工作区界面**：从 `WorkspaceWindow` 的路径解析与文件监听，到 `DirectoryTree` 的递归渲染，再到 `MarkdownEditor` / `MarkdownViewer` 的文件查看。

九节课的源码阅读，我们看到了三种访谈实现并存、力导向图的手写物理模拟、monorepo 下的 re-export 模式。这些不是"最佳实践"展示，而是一个快速迭代的 MVP 项目如何在约束下做取舍的真实记录。

## 源码覆盖台账

下表列出单元五讲过的所有源文件，按组件分组：

### 项目创建与访谈

| 文件 | 课程 | 核心职责 |
| --- | --- | --- |
| `ProjectCreationWizard.tsx` | J40 | 项目创建向导，父子分拆，父组件管会话，子组件管展示 |
| `InterviewWindow.tsx` | J41 | 新版访谈主窗口，左右分栏，`usePersistentAgent`，`businessModelToOntology` |
| `CUIDialogPanel.tsx` | J42 | 左侧对话面板，文件上传，工具执行可见性管理 |
| `ArtifactDisplayPanel.tsx` | J42 | 右侧产物面板，四种显示模式，图谱/实体/关系/规则四个标签页 |
| `ResizableLayout.tsx` | J42 | 可拖拽调整大小的布局容器 |
| `interviewStore.ts` | J43 | 旧版访谈 Zustand store，六状态管理 |
| `ProjectInterview.tsx` | J43 | 旧版访谈主组件，状态机驱动，mock 降级 |
| `SkillInterview.tsx` | J43 | 轻量 skill 访谈，直接调用 agent-session |
| `useProjectInitialization.ts` | J43 | 项目初始化 Hook，动态导入 skill，打开 Agent 窗口 |
| `WelcomeScreen.tsx` | J44 | 欢迎弹窗，价值主张 + 问题预告 |
| `QuestionInput.tsx` | J44 | 问题输入面板，进度指示，抖动验证 |
| `GeneratingState.tsx` | J44 | 生成中加载状态，进度动画，错误重试 |
| `OntologyPreview.tsx` | J44 | 本体预览，递归 `OntologyNodeItem` |
| `OntologyEditor.tsx` | J44 | 本体编辑，递归增删改 |
| `OntologyGraph.tsx` | J45 | Canvas 力导向图，物理模拟，鼠标交互 |

### 工作区与文件管理

| 文件 | 课程 | 核心职责 |
| --- | --- | --- |
| `WorkspaceWindow.tsx` | J46 | 工作区主窗口，路径解析，文件监听，沙箱检测 |
| `ProjectWorkspace.tsx` | J46 | 项目工作区，三个标签页（数据/本体/方案） |
| `ProjectSidebar.tsx` | J46 | 项目列表侧边栏，当前未被使用 |
| `project-identity.ts` | J46 | 项目 ID 规范化，处理多种前缀 |
| `use-projects.ts` | J46 | 项目元数据 CRUD，导入导出，分页轮询 |
| `useLocalFS.ts` | J46 | 本地文件系统 Hook，Electron only |
| `DirectoryTree.tsx` | J47 | 目录树，`normalizeFilesForTree` 补全文件夹，沙箱按钮 |
| `FileList.tsx` | J47 | 表格文件列表，当前未被使用 |
| `CreateFileDialog.tsx` | J47 | 新建文件弹窗，文件名校验 |
| `DeleteConfirmDialog.tsx` | J47 | 删除确认弹窗 |
| `use-workspace.ts` | J47 | re-export Core 的 `useWorkspace` |

### 文件查看与编辑

| 文件 | 课程 | 核心职责 |
| --- | --- | --- |
| `MarkdownEditor.tsx` | J48 | Markdown 编辑器，textarea + 预览 |
| `MarkdownViewer.tsx` | J48 | Markdown 查看器，`react-markdown` 渲染 |
| `ImageViewer.tsx` | J48 | 图片查看器，缩放控制 |
| `DataTabView.tsx` | J48 | 数据标签页，JSON 查看 |
| `OntologyTabView.tsx` | J48 | 本体标签页，集成 `OntologyGraph` |

## 关键概念总结

### 1. 三种访谈实现并存

项目里同时存在三套访谈实现，反映了功能的演化路径：

- **旧版 `ProjectInterview`**：表单驱动，六状态状态机，依赖 `interviewStore`，问题固定为三个。适合快速验证，但扩展性差。
- **过渡版 `SkillInterview`**：基于 agent-session，手写消息列表，硬编码 system prompt。是向新版过渡的临时方案。
- **新版 `InterviewWindow`**：左右分栏，实时预览，`usePersistentAgent` 驱动，支持工具执行和产物版本刷新。是当前主推方案。

> 读代码时要注意每个组件使用的底层 API 不同，不要混用。

### 2. 力导向图的手写实现

`OntologyGraph` 不用 d3 等可视化库，而是纯手写 Canvas 力导向布局。物理模拟包含三种力：

- **斥力**：所有节点两两互斥，力与距离平方成反比；
- **弹簧力**：连接的节点互相吸引，力与距离偏离目标长度成正比；
- **中心引力**：防止节点飞散。

节点位置在 `ontology` 变化时保留已有位置，避免重新布局导致视觉跳变。鼠标交互用 `useRef` 存储悬停状态，避免频繁触发 React 重新渲染。

### 3. Monorepo 下的 re-export 模式

Web 包的 `use-workspace.ts` 只有一行：

```ts
export { useWorkspace } from '@originos/core/lib/hooks/use-workspace';
```

这种 re-export 模式在 monorepo 里很常见：Web 包的组件用 `@/hooks/use-workspace` 导入，实际用的是 Core 的实现。好处是 Web 包可以后续加一层封装或替换实现，而不影响组件代码。

### 4. 路径规范化与 ID 映射

`project-identity.ts` 处理多种项目 ID 前缀：

- `normalizeProjectEntryId`：去掉 `project-` 前缀；
- `normalizeOntologyId`：处理 `ontology_` / `ontology-project-` 前缀。

`DirectoryTree.normalizeFilesForTree` 从文件路径推导文件夹节点，避免后端存储冗余的文件夹记录。路径规范化包括反斜杠转正斜杠、去重复斜杠、去首尾斜杠。

### 5. 降级策略与容错

多处代码展示了"尽力而为"的降级策略：

- `ProjectInterview.handleStart`：后端 `createInterview` 失败时用本地生成的 ID 继续；
- `ProjectInterview.handleFinishInterview`：`generateOntology` 失败时用用户答案拼一个 mock 本体；
- `WorkspaceWindow`：Electron 环境不可用时跳过文件监听。

这种策略在 MVP 阶段很常见，确保用户即使离线或后端出错，也能继续体验。

## 代码问题与改进建议

单元五的阅读中，我们识别了多个真实代码问题：

### 1. `businessModelToOntology` 的节点 ID 重新生成

每次调用 `businessModelToOntology` 都会用 `Date.now()` 生成新的节点 ID，可能导致选中状态丢失。应该用稳定的 ID（如名称的 hash）。

### 2. `OntologyGraph` 的硬编码映射

`commonEntityNames` 把中文实体名硬编码映射到英文，长远看应该用配置或数据库驱动。

### 3. `ProjectInterview` 的前端进度动画

生成阶段的进度条是前端 `setTimeout` 模拟的，不反映真实后端阶段。应该让进度反映真实的后端调用阶段。

### 4. `SkillInterview` 的硬编码 system prompt

`SkillInterview` 的 system prompt 是硬编码字符串，没有从 skill 内容加载。应该接入完整的 skill 内容加载流程。

### 5. `ProjectSidebar` 未被使用

`ProjectSidebar` 定义了但未被 `WorkspaceWindow` 使用，可能是历史遗留或备选方案。应该清理或明确用途。

### 6. `CreateFileDialog` 的校验不完整

只校验了文件名非空和不含路径分隔符，没有校验特殊字符（如 `:`、`*`、`?`）和文件名是否已存在。

## 小黑的单元五笔记

![小黑的单元五笔记](assets/j48-xiaohei-unit5.png)

小黑在本单元五的笔记里画了三个重点：

1. **三种访谈并存**：小黑用箭头画了演化路径——旧版表单访谈 → 过渡版 SkillInterview → 新版 InterviewWindow。旁边标注："读代码时注意底层 API 不同，别混用！"

2. **力导向图的三种力**：小黑画了几个小球，用不同颜色的箭头表示斥力（红色）、弹簧力（蓝色）、中心引力（绿色）。旁边标注："damping=0.9，每帧速度衰减 10%。"

3. **re-export 模式**：小黑画了一个 Web 包的盒子，里面只有一行代码，箭头指向 Core 包。旁边标注："好处是 Web 包可以后续加封装，不影响组件。"

小黑的笔记本上还贴了一张便签："降级策略很重要——后端失败时用 mock 兜底，保证界面不卡死。"

## 质量检查清单

按 `03-sample-unit-writing-sop.md` 的质量检查项：

- [x] **单元导读**（J40）：列出本单元要读的源文件、要回答的问题、要画的概念图。
- [x] **正式课程**（J41–J47）：每节课围绕一段或几段源码，讲清楚"是什么、为什么、怎么做"。
- [x] **源码覆盖台账**：上表列出了所有讲过的源文件，按组件分组。
- [x] **关键概念总结**：总结了五种关键概念（三种访谈、力导向图、re-export、路径规范化、降级策略）。
- [x] **代码问题与改进建议**：识别了六个真实代码问题，给出了改进建议。
- [x] **小黑插图**：至少一个小黑插图，展示本单元的学习重点。
- [x] **概念图**：J40 里画了单元五的概念图（项目创建 → 访谈 → 工作区的用户旅程）。

## 下一步

单元五完成了项目创建、访谈、工作区三大 UI 表面的源码阅读。下一单元（单元六）将覆盖 Web 层的剩余部分：

- **Dock 与 Spotlight**：`Dock.tsx`、`Spotlight.tsx`，快速启动与全局搜索。
- **Agent 会话 UI**：`AgentDialog.tsx`、`AgentDialogContent.tsx`，Agent 调用的窗口化界面。
- **Web 状态层**：剩余的 Zustand store 和 Hook。

单元六完成后，Part J 就结束了，我们将进入 Part K：桌面版（Electron）的源码阅读。
