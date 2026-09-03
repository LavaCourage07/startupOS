# I46：API 工具函数：请求的封装与复用

上一节课看了中间件。这节课看 API 工具函数如何封装。

## 1. 文件用途

`app/api/utils.ts` 定义了 OriginOS 的 API 工具函数，包括：

- 响应封装
- 错误处理
- 请求验证

## 2. 核心实现

打开 `app/api/utils.ts`：

```ts
export function createResponse(data: unknown) {
  return Response.json(data);
}
```

## 3. 核心逻辑

### 3.1 响应封装

```ts
export function createResponse(data: unknown) {
  return Response.json(data);
}
```

- `createResponse`：封装响应。
- `Response.json()`：返回 JSON 响应。

### 3.2 错误处理

```ts
export function createErrorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status });
}
```

- `createErrorResponse`：封装错误响应。
- `status`：HTTP 状态码。

## 4. 失败路径

### 4.1 封装错误

如果封装逻辑错误，响应可能不正确。

### 4.2 状态码错误

如果状态码错误，客户端可能无法正确处理。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 所有边界条件 |
| 代码阅读 | 逻辑清晰 | 所有错误场景 |

## 6. 小实验

不运行项目，回答：

1. API 工具函数如何封装响应？
2. `createErrorResponse` 的作用是什么？
3. 如果状态码错误，会发生什么？

参考答案：

1. 通过 `createResponse` 函数封装。
2. 封装错误响应。
3. 客户端可能无法正确处理。

## 7. 章节收束

本节课看了 API 工具函数的实现：响应封装、错误处理、请求验证。API 工具函数是 OriginOS 请求复用的基础。

下一节课会看错误处理如何实现。
