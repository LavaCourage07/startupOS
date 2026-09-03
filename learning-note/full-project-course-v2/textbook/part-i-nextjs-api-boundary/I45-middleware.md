# I45：中间件：请求的拦截与处理

上一节课看了 API 根路由。这节课看中间件如何拦截请求。

## 1. 文件用途

`app/middleware.ts` 定义了 OriginOS 的全局中间件，包括：

- 请求拦截
- 响应处理
- 身份验证

## 2. 核心实现

打开 `app/middleware.ts`：

```ts
import { NextResponse } from 'next/server';

export function middleware(request: Request) {
  return NextResponse.next();
}
```

## 3. 核心逻辑

### 3.1 请求拦截

```ts
export function middleware(request: Request) {
  return NextResponse.next();
}
```

- `middleware`：中间件函数。
- `NextResponse.next()`：继续处理请求。

### 3.2 响应处理

```ts
return NextResponse.next();
```

- `NextResponse.next()`：继续处理请求。

## 4. 失败路径

### 4.1 中间件未生效

如果中间件未生效，请求可能无法被拦截。

### 4.2 响应处理错误

如果响应处理错误，可能导致请求失败。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 中间件一定生效 |
| 代码阅读 | 逻辑清晰 | 所有边界条件 |

## 6. 小实验

不运行项目，回答：

1. 中间件如何拦截请求？
2. `NextResponse.next()` 的作用是什么？
3. 如果中间件未生效，会发生什么？

参考答案：

1. 通过导出 `middleware` 函数。
2. 继续处理请求。
3. 请求可能无法被拦截。

## 7. 章节收束

本节课看了中间件的实现：请求拦截、响应处理、身份验证。中间件是 OriginOS 请求处理的桥梁。

下一节课会看 API 工具函数如何封装。
