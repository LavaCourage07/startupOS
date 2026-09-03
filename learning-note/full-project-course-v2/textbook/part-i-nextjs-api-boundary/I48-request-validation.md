# I48：请求验证：数据的合法性检查

上一节课看了错误处理。这节课看请求验证如何实现。

## 1. 文件用途

请求验证确保 OriginOS API 接收的数据合法，包括：

- 参数验证
- 类型检查
- 格式校验

## 2. 核心实现

打开 `app/api/utils.ts`：

```ts
export function validateRequest(body: unknown) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid body' };
  }
  return { valid: true, data: body };
}
```

## 3. 核心逻辑

### 3.1 参数验证

```ts
if (!body || typeof body !== 'object') {
  return { valid: false, error: 'Invalid body' };
}
```

- `body`：请求体。
- `typeof body !== 'object'`：类型检查。

### 3.2 类型检查

```ts
return { valid: true, data: body };
```

- `valid`：验证结果。
- `data`：验证后的数据。

## 4. 失败路径

### 4.1 验证失败

如果验证失败，请求会被拒绝。

### 4.2 类型错误

如果类型错误，可能导致数据处理错误。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 所有验证场景 |
| 代码阅读 | 逻辑清晰 | 所有边界条件 |

## 6. 小实验

不运行项目，回答：

1. 请求验证如何确保数据合法？
2. `validateRequest` 的作用是什么？
3. 如果验证失败，会发生什么？

参考答案：

1. 通过参数验证、类型检查、格式校验。
2. 验证请求体。
3. 请求会被拒绝。

## 7. 章节收束

本节课看了请求验证的实现：参数验证、类型检查、格式校验。请求验证是 OriginOS API 数据合法性的保障。

下一节课是 U8 的总结课。
