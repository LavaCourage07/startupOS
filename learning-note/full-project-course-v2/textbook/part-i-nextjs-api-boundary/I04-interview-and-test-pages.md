# I04：Interview 与测试页面：全页流程 vs 窗口组件

项目访谈是 OriginOS 创建项目的核心流程。它既可以是主页弹出的 `InterviewWindow` 组件，也可以是直接访问 `/interview` 的全页流程，还有专门用于开发的 `/test-interview` 页面。这节课解决的问题是：这三种形态有什么关系？为什么需要分离？

## 1. 访谈的两种呈现形态

项目访谈在代码中有两种主要形态：

| 形态 | 文件/组件 | 入口方式 | 使用场景 |
| --- | --- | --- | --- |
| 全页流程 | `app/interview/page.tsx` | 直接导航到 `/interview` | Epic 1 入口、旧版流程 |
| 窗口组件 | `InterviewWindow`（被主页挂载） | 主页点击“创建项目” | 当前主桌面流程 |
| 测试入口 | `app/test-interview/page.tsx` | 直接访问 `/test-interview` | 开发调试 |

注意 `app/interview/page.tsx` 和 `app/test-interview/page.tsx` 都是页面入口，但它们挂载的是不同组件：`ProjectInterview`  vs `InterviewWindow`。

## 2. 全页访谈入口

`app/interview/page.tsx` 非常简单：

```tsx
import { ProjectInterview } from '@/components/interview/ProjectInterview';

/**
 * 项目访谈页面
 *
 * 这是 Epic 1 的入口页面，由 OS 主页面的"创建项目"按钮导航到此处。
 * 包含完整的访谈流程：欢迎屏幕 → 问题收集 → 本体生成 → 预览编辑 → 完成
 */
export default function InterviewPage() {
  return (
    <div className="min-h-screen bg-background">
      <ProjectInterview />
    </div>
  );
}
```

这个页面的价值在于：

1. **独立的 URL 入口**：用户可以直接从书签或外部链接进入访谈流程。
2. **完整流程容器**：`ProjectInterview` 组件内部管理从欢迎到完成的全部状态。
3. **不依赖主页状态**：它不需要主页的 `AppWindowManager` 或 Dock。

但它与主页弹出的访谈窗口不是同一组件。主页使用的是 `InterviewWindow`，而这里使用的是 `ProjectInterview`。这是阅读时要区分的边界。

## 3. 测试访谈入口

`app/test-interview/page.tsx` 是一个开发调试页面：

```tsx
'use client';

import { useState } from 'react';
import { InterviewWindow } from '@/components/interview';

export default function TestInterviewPage() {
  const [showInterview, setShowInterview] = useState(true);

  const handleComplete = (result: any) => {
    console.log('Interview completed:', result);
    alert('访谈完成！查看控制台获取结果。');
  };

  const handleClose = () => {
    setShowInterview(false);
    alert('访谈已关闭');
  };

  return (
    <div className="h-screen w-screen bg-background">
      {showInterview ? (
        <InterviewWindow
          projectId="test-project-001"
          onClose={handleClose}
          onComplete={handleComplete}
        />
      ) : (
        <div className="flex items-center justify-center h-full">...重新打开...</div>
      )}
    </div>
  );
}
```

这个页面的特点：

1. **硬编码 `projectId`**：`test-project-001`。
2. **使用 `InterviewWindow` 而非 `ProjectInterview`**：测试的是主页内弹窗形态的组件。
3. **有重新打开按钮**：方便反复测试组件的挂载和卸载。

它是开发者工具，不是用户流程。如果把它与 `app/interview/page.tsx` 混为一谈，会误解访谈的真实入口。

## 4. 测试窗口入口

`app/test-window/page.tsx` 与访谈无关，它专门测试窗口系统：

```tsx
export default function TestWindowPage() {
  const { openWindow, closeAllWindows, getOpenWindows, focusWindow } = useAppWindowManager();
  // ...
}
```

这个页面：

- 使用 `useAppWindowManager` hook 直接操作窗口。
- 提供多种测试内容组件（简单内容、表单、列表、iframe、设置）。
- 有完整的打开/关闭/聚焦操作按钮。

它的存在说明 `AppWindowManager` 有一套独立的 API，不依赖主页的 `OSHomePage`。开发这个页面是为了在隔离环境中验证窗口拖拽、缩放、焦点等行为。

## 5. 三种入口的职责对比

```mermaid
flowchart TD
    A[访谈需求] --> B[全页入口 /interview]
    A --> C[主页弹窗 InterviewWindow]
    B --> D[ProjectInterview]
    C --> E[InterviewWindow]
    F[窗口系统调试] --> G[/test-window]
    G --> H[useAppWindowManager]
```

| 维度 | `/interview` | 主页弹窗 InterviewWindow | `/test-interview` | `/test-window` |
| --- | --- | --- | --- | --- |
| 是否生产入口 | 是 | 是 | 否 | 否 |
| 组件 | `ProjectInterview` | `InterviewWindow` | `InterviewWindow` | 测试组件 |
| 是否有真实 projectId | 由组件内部管理 | 由主页传入 | 硬编码 test-project-001 | 无 |
| 是否依赖 AppWindowManager | 否 | 是 | 否 | 是 |
| 主要目的 | 完整访谈流程 | 主页内创建项目 | 调试 InterviewWindow | 调试窗口系统 |

## 6. 失败路径

### 6.1 `/interview` 与主页弹窗行为不一致

由于它们挂载的是不同组件，行为不一致是预期的。排查时不要假设“全页访谈应该和弹窗一样”。

### 6.2 `/test-interview` 的硬编码 projectId 导致数据污染

如果在生产环境访问 `/test-interview`，它会尝试用 `test-project-001` 运行访谈流程，可能覆盖或污染真实数据。

### 6.3 测试页依赖未初始化的全局状态

`/test-window` 直接使用 `useAppWindowManager`，但如果全局 store 或 CSS 变量没有正确初始化，窗口可能显示异常。

## 7. 测试证据

| 验证动作 | 能证明 | 不能证明 |
| --- | --- | --- |
| 访问 `/interview` | `ProjectInterview` 能全页渲染 | 主页弹窗形态同样工作 |
| 访问 `/test-interview` | `InterviewWindow` 能独立挂载 | 真实项目数据能正确加载 |
| 访问 `/test-window` | 窗口系统基本交互可用 | 主页内窗口行为完全一致 |

## 8. 小实验

不运行项目，回答：

1. 主页点击“创建项目”打开的窗口，最终挂载的是 `ProjectInterview` 还是 `InterviewWindow`？
2. `/test-interview` 和 `/interview` 分别适合什么场景？
3. 如果 `/interview` 需要在主页弹窗中使用，需要做什么改动？

参考答案：

1. `InterviewWindow`。主页的 `handleCreateProject` 调用 `AppWindowManager.openComponentWindow(..., InterviewWindow, ...)`。
2. `/interview` 是生产全页入口；`/test-interview` 是开发调试入口，用于单独验证 `InterviewWindow` 组件。
3. 需要把 `ProjectInterview` 包装成可在窗口内使用的组件，或者让主页直接使用 `ProjectInterview` 而不是 `InterviewWindow`。

## 9. 章节收束

本节课区分了访谈流程的三种形态：全页生产入口、主页弹窗组件、开发测试入口。它们挂载的组件不同、依赖的状态不同、使用场景也不同。

下一节课会看 `/window` 页面，它是 OriginOS 多窗口架构中最灵活的入口：通过 query 参数可以渲染 Skill、Workspace、Agent、Solution、Collaboration、Sandbox 等多种内容。
