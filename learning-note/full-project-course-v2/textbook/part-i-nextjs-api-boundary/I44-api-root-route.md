# I44：API 根路由：请求的入口

前七个单元追踪了页面路由、会话管理、消息流式响应、项目级 Agent 生命周期、统计和摘要、Skill 和 Interview、全局样式和布局。这个单元转向 API 路由与中间件。这节课先看 API 根路由。

## 1. 文件用途

`app/api/route.ts` 定义了 OriginOS 的 API 根路由，包括：

- HTTP 方法处理
- 请求响应
- 错误处理

## 2. 核心实现

打开 `app/api/route.ts`：

```ts
export async function GET() {
  return Response.json({ message: 'Hello, World!' });
}
```

## 3. 核心逻辑

### 3.1 HTTP 方法

```ts
export async function GET() {
  return Response.json({ message: 'Hello, World!' });
}
```

- `GET`：HTTP 方法。
- `Response.json()`：返回 JSON 响应。

### 3.2 请求响应

```ts
return Response.json({ message: 'Hello, World!' });
```

- `Response.json()`：返回 JSON 响应。

## 4. 失败路径

### 4.1 方法不存在

如果请求的方法未定义，会返回 405 错误。

### 4.2 响应格式错误

如果响应格式错误，客户端可能无法解析。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 所有方法正确 |
| 代码阅读 | 逻辑清晰 | 所有边界条件 |

## 6. 小实验

不运行项目，回答：

1. API 根路由如何处理请求？
2. `Response.json()` 的作用是什么？
3. 如果请求的方法未定义，会发生什么？

参考答案：

1. 通过导出 HTTP 方法处理函数。
2. 返回 JSON 响应。
3. 返回 405 错误。

## 7. 章节收束

本节课看了 API 根路由的实现：HTTP 方法处理、请求响应、错误处理。API 根路由是 OriginOS 的后端入口。

下一节课会看中间件如何拦截请求。
