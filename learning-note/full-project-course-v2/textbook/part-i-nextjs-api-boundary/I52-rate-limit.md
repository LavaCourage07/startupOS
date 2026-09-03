# I52：限流：系统的保护伞

上一节课看了缓存。这节课看限流如何实现。

## 1. 文件用途

`app/api/rate-limit.ts` 定义了 OriginOS 的限流逻辑，包括：

- 请求计数
- 限流检查
- 请求拒绝

## 2. 核心实现

打开 `app/api/rate-limit.ts`：

```ts
const requests = new Map<string, number>();

export function checkRateLimit(key: string, limit: number) {
  const count = requests.get(key) || 0;
  if (count >= limit) {
    return false;
  }
  requests.set(key, count + 1);
  return true;
}
```

## 3. 核心逻辑

### 3.1 请求计数

```ts
const count = requests.get(key) || 0;
```

- `key`：请求标识。
- `count`：请求次数。

### 3.2 限流检查

```ts
if (count >= limit) {
  return false;
}
```

- `limit`：限制次数。
- `false`：超过限制。

## 4. 失败路径

### 4.1 限流失效

如果限流失效，可能导致系统过载。

### 4.2 误杀正常请求

如果限流过严，可能误杀正常请求。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 限流一定生效 |
| 代码阅读 | 逻辑清晰 | 所有边界条件 |

## 6. 小实验

不运行项目，回答：

1. 限流如何检查请求次数？
2. `checkRateLimit` 的作用是什么？
3. 如果限流失效，会发生什么？

参考答案：

1. 通过 `requests.get(key)`。
2. 检查请求是否超过限制。
3. 可能导致系统过载。

## 7. 章节收束

本节课看了限流的实现：请求计数、限流检查、请求拒绝。限流是 OriginOS 系统的保护伞。

下一节课会看分页与缓存如何结合。
