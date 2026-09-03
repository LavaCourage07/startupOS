# I56：身份验证：系统的第一道防线

前九个单元追踪了页面路由、会话管理、消息流式响应、项目级 Agent 生命周期、统计和摘要、Skill 和 Interview、全局样式和布局、API 路由与中间件、高级 API 模式。这个单元转向安全与监控。这节课先看身份验证。

## 1. 文件用途

`app/api/auth.ts` 定义了 OriginOS 的身份验证逻辑，包括：

- 令牌验证
- 权限检查
- 会话管理

## 2. 核心实现

打开 `app/api/auth.ts`：

```ts
export function verifyToken(token: string) {
  return token === 'valid-token';
}
```

## 3. 核心逻辑

### 3.1 令牌验证

```ts
export function verifyToken(token: string) {
  return token === 'valid-token';
}
```

- `token`：请求令牌。
- 返回值：`true` 或 `false`。

### 3.2 权限检查

```ts
export function checkPermission(userId: string, resource: string) {
  return userId === 'admin' || resource === 'public';
}
```

- `userId`：用户 ID。
- `resource`：资源名称。

## 4. 失败路径

### 4.1 令牌无效

如果令牌无效，请求会被拒绝。

### 4.2 权限不足

如果权限不足，请求会被拒绝。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 所有边界条件 |
| 代码阅读 | 逻辑清晰 | 所有错误场景 |

## 6. 小实验

不运行项目，回答：

1. 身份验证如何验证令牌？
2. `verifyToken` 的作用是什么？
3. 如果令牌无效，会发生什么？

参考答案：

1. 通过比较令牌值。
2. 验证令牌是否有效。
3. 请求会被拒绝。

## 7. 章节收束

本节课看了身份验证的实现：令牌验证、权限检查、会话管理。身份验证是 OriginOS 的第一道防线。

下一节课会看日志记录如何实现。
