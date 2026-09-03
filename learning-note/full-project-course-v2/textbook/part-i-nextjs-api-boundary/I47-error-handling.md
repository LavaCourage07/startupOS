# I47：错误处理：API 的健壮性保障

上一节课看了 API 工具函数。这节课看错误处理如何实现。

## 1. 文件用途

错误处理保障了 OriginOS API 的健壮性，包括：

- 异常捕获
- 错误响应
- 日志记录

## 2. 核心实现

打开 `app/api/utils.ts`：

```ts
export function createErrorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status });
}
```

## 3. 核心逻辑

### 3.1 异常捕获

```ts
try {
  // 业务逻辑
} catch (error) {
  return createErrorResponse(error.message, 500);
}
```

- `try...catch`：捕获异常。
- `createErrorResponse`：返回错误响应。

### 3.2 错误响应

```ts
return new Response(JSON.stringify({ error: message }), { status });
```

- `error`：错误信息。
- `status`：HTTP 状态码。

## 4. 失败路径

### 4.1 异常未捕获

如果异常未捕获，可能导致进程崩溃。

### 4.2 错误信息泄露

如果错误信息泄露，可能导致安全问题。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 所有错误场景 |
| 代码阅读 | 逻辑清晰 | 所有边界条件 |

## 6. 小实验

不运行项目，回答：

1. 错误处理如何保障 API 健壮性？
2. `try...catch` 的作用是什么？
3. 如果异常未捕获，会发生什么？

参考答案：

1. 通过捕获异常、返回错误响应。
2. 捕获异常。
3. 可能导致进程崩溃。

## 7. 章节收束

本节课看了错误处理的实现：异常捕获、错误响应、日志记录。错误处理是 OriginOS API 健壮性的保障。

下一节课会看请求验证如何实现。
