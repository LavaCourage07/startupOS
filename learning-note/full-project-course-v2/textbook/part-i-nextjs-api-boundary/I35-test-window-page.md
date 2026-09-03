# I35：测试窗口页面

上一节课看了测试 Interview 页面。这节课看测试窗口页面：`GET /test-window`。

## 1. 页面用途

测试窗口页面用于开发测试，模拟窗口系统的行为。

## 2. 页面实现

打开 `app/test-window/page.tsx`：

```tsx
export default function TestWindowPage() {
  return <WindowTest />;
}
```

## 3. 核心逻辑

测试窗口页面直接渲染 `WindowTest` 组件，没有复杂的逻辑。

### 3.1 WindowTest 组件

`WindowTest` 组件属于 Part J，可能的逻辑：

1. 加载窗口系统。
2. 测试窗口的打开、关闭、移动、调整大小。
3. 测试窗口的层级管理。

### 3.2 与 Interview 页面的区别

| 维度 | Interview 页面 | 测试窗口 |
| --- | --- | --- |
| 路径 | `/interview` | `/test-window` |
| 组件 | `ProjectInterview` | `WindowTest` |
| 用途 | 项目访谈 | 窗口系统测试 |
| 数据来源 | 真实项目 | 模拟数据 |

## 4. 失败路径

### 4.1 组件加载失败

如果 `WindowTest` 组件加载失败，页面会显示空白或错误。

### 4.2 窗口系统测试失败

如果窗口系统测试失败，可能暴露窗口系统的 bug。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 组件内部逻辑正确 |
| 代码阅读 | 逻辑清晰 | 窗口系统一定正确 |

## 6. 小实验

不运行项目，回答：

1. 为什么需要测试窗口页面？
2. `WindowTest` 和 `ProjectInterview` 有什么区别？
3. 如果 `WindowTest` 组件加载失败，会发生什么？

参考答案：

1. 为了在开发环境中测试窗口系统，而不影响生产环境。
2. `WindowTest` 测试窗口系统，`ProjectInterview` 进行项目访谈。
3. 页面会显示空白或错误，取决于 Next.js 的错误处理。

## 7. 章节收束

本节课看了测试窗口页面的实现：直接渲染 `WindowTest` 组件。测试窗口页面用于开发测试。

下一节课是 Unit 6 的总结工作坊。
