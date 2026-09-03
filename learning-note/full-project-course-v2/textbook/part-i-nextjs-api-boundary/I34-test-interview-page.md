# I34：测试 Interview 页面

上一节课看了 Interview 页面。这节课看测试 Interview 页面：`GET /test-interview`。

## 1. 页面用途

测试 Interview 页面用于开发测试，模拟 Interview 页面的行为。

## 2. 页面实现

打开 `app/test-interview/page.tsx`：

```tsx
export default function TestInterviewPage() {
  return <InterviewWindow />;
}
```

## 3. 核心逻辑

测试 Interview 页面直接渲染 `InterviewWindow` 组件，没有复杂的逻辑。

### 3.1 InterviewWindow 组件

`InterviewWindow` 组件属于 Part J，可能的逻辑：

1. 加载模拟数据。
2. 展示访谈问题。
3. 收集用户回答。
4. 提交回答并生成本体。

### 3.2 与 Interview 页面的区别

| 维度 | Interview 页面 | 测试 Interview |
| --- | --- | --- |
| 路径 | `/interview` | `/test-interview` |
| 组件 | `ProjectInterview` | `InterviewWindow` |
| 用途 | 生产环境 | 开发测试 |
| 数据来源 | 真实项目 | 模拟数据 |

## 4. 失败路径

### 4.1 组件加载失败

如果 `InterviewWindow` 组件加载失败，页面会显示空白或错误。

### 4.2 模拟数据加载失败

如果模拟数据加载失败，访谈无法进行。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 组件内部逻辑正确 |
| 代码阅读 | 逻辑清晰 | 数据加载一定成功 |

## 6. 小实验

不运行项目，回答：

1. 为什么需要测试 Interview 页面？
2. `InterviewWindow` 和 `ProjectInterview` 有什么区别？
3. 如果 `InterviewWindow` 组件加载失败，会发生什么？

参考答案：

1. 为了在开发环境中测试 Interview 功能，而不影响生产环境。
2. `InterviewWindow` 使用模拟数据，`ProjectInterview` 使用真实项目数据。
3. 页面会显示空白或错误，取决于 Next.js 的错误处理。

## 7. 章节收束

本节课看了测试 Interview 页面的实现：直接渲染 `InterviewWindow` 组件。测试 Interview 页面用于开发测试。

下一节课会看测试窗口页面。
