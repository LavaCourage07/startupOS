# I53：分页与缓存的结合：性能与体验的双重提升

上一节课看了限流。这节课看分页与缓存如何结合。

## 1. 文件用途

分页与缓存的结合提升了 OriginOS 的性能和体验，包括：

- 分页数据缓存
- 缓存命中优化
- 缓存失效策略

## 2. 核心实现

打开 `app/api/pagination.ts`：

```ts
import { getCache, setCache } from './cache';

export function paginateWithCache(data: unknown[], page: number, limit: number, cacheKey: string) {
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  const start = (page - 1) * limit;
  const end = start + limit;
  const result = data.slice(start, end);
  
  setCache(cacheKey, result);
  return result;
}
```

## 3. 核心逻辑

### 3.1 缓存检查

```ts
const cached = getCache(cacheKey);
if (cached) {
  return cached;
}
```

- `getCache`：获取缓存。
- 如果缓存命中，直接返回。

### 3.2 数据截取

```ts
const start = (page - 1) * limit;
const end = start + limit;
const result = data.slice(start, end);
```

- 计算起始和结束位置。
- 截取数据。

### 3.3 缓存存储

```ts
setCache(cacheKey, result);
```

- `setCache`：存储缓存。

## 4. 失败路径

### 4.1 缓存未命中

如果缓存未命中，需要重新计算。

### 4.2 缓存失效

如果缓存失效，需要更新缓存。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 缓存一定命中 |
| 代码阅读 | 逻辑清晰 | 所有边界条件 |

## 6. 小实验

不运行项目，回答：

1. 分页与缓存如何结合？
2. `paginateWithCache` 的作用是什么？
3. 如果缓存未命中，会发生什么？

参考答案：

1. 先检查缓存，如果命中直接返回，否则计算并存储缓存。
2. 分页并缓存结果。
3. 需要重新计算。

## 7. 章节收束

本节课看了分页与缓存的结合：缓存检查、数据截取、缓存存储。分页与缓存的结合提升了 OriginOS 的性能和体验。

下一节课会看缓存与限流的结合。
