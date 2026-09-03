# I54：缓存与限流的结合：稳定性的双重保障

上一节课看了分页与缓存的结合。这节课看缓存与限流如何结合。

## 1. 文件用途

缓存与限流的结合提升了 OriginOS 的稳定性，包括：

- 缓存命中时跳过限流
- 缓存未命中时检查限流
- 限流通过后才计算缓存

## 2. 核心实现

打开 `app/api/cache.ts`：

```ts
import { checkRateLimit } from './rate-limit';

const cache = new Map<string, unknown>();

export function getCacheWithRateLimit(key: string, limit: number) {
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  
  if (!checkRateLimit(key, limit)) {
    throw new Error('Rate limit exceeded');
  }
  
  return null;
}
```

## 3. 核心逻辑

### 3.1 缓存检查

```ts
const cached = cache.get(key);
if (cached) {
  return cached;
}
```

- 如果缓存命中，直接返回，跳过限流。

### 3.2 限流检查

```ts
if (!checkRateLimit(key, limit)) {
  throw new Error('Rate limit exceeded');
}
```

- 如果缓存未命中，检查限流。
- 如果超过限制，抛出错误。

## 4. 失败路径

### 4.1 限流失效

如果限流失效，可能导致系统过载。

### 4.2 缓存失效

如果缓存失效，可能导致频繁限流。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 限流一定生效 |
| 代码阅读 | 逻辑清晰 | 所有边界条件 |

## 6. 小实验

不运行项目，回答：

1. 缓存与限流如何结合？
2. `getCacheWithRateLimit` 的作用是什么？
3. 如果限流失效，会发生什么？

参考答案：

1. 缓存命中时跳过限流，缓存未命中时检查限流。
2. 获取缓存并检查限流。
3. 可能导致系统过载。

## 7. 章节收束

本节课看了缓存与限流的结合：缓存命中时跳过限流、缓存未命中时检查限流。缓存与限流的结合提升了 OriginOS 的稳定性。

下一节课是 U9 的总结课。
