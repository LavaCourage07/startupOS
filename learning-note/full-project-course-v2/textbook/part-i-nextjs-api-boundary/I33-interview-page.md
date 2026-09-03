# I33：Interview 页面：项目访谈的入口

上一节课看了技能内容查询。这节课看 Interview 页面：`GET /interview`。

## 1. 页面用途

Interview 页面是项目访谈的入口，用于：

- 展示访谈问题
- 收集用户回答
- 生成项目本体

## 2. 页面实现

打开 `app/interview/page.tsx`：

```tsx
export default function InterviewPage() {
  return <ProjectInterview />;
}
```

## 3. 核心逻辑

Interview 页面直接渲染 `ProjectInterview` 组件，没有复杂的逻辑。

### 3.1 ProjectInterview 组件

`ProjectInterview` 组件属于 Part J，可能的逻辑：

1. 加载项目数据。
2. 展示访谈问题。
3. 收集用户回答。
4. 提交回答并生成本体。

### 3.2 与测试 Interview 的区别

| 维度 | Interview 页面 | 测试 Interview |
| --- | --- | --- |
| 路径 | `/interview` | `/test-interview` |
| 组件 | `ProjectInterview` | `InterviewWindow` |
| 用途 | 生产环境 | 开发测试 |
| 数据来源 | 真实项目 | 模拟数据 |

## 4. 失败路径

### 4.1 组件加载失败

如果 `ProjectInterview` 组件加载失败，页面会显示空白或错误。

### 4.2 项目数据加载失败

如果项目数据加载失败，访谈无法进行。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 组件内部逻辑正确 |
| 代码阅读 | 逻辑清晰 | 数据加载一定成功 |

## 6. 小实验

不运行项目，回答：

1. 为什么 Interview 页面直接渲染 `ProjectInterview` 组件？
2. `/interview` 和 `/test-interview` 有什么区别？
3. 如果 `ProjectInterview` 组件加载失败，会发生什么？

参考答案：

1. 为了分离页面入口和组件实现，页面只负责路由匹配，组件负责业务逻辑。
2. `/interview` 是生产入口，`/test-interview` 是测试入口。
3. 页面会显示空白或错误，取决于 Next.js 的错误处理。

## 7. 章节收束

本节课看了 Interview 页面的实现：直接渲染 `ProjectInterview` 组件。Interview 页面是项目访谈的入口。

下一节课会看测试 Interview 页面。
