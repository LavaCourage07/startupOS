# I51：缓存：性能的加速器

上一节课看了分页。这节课看缓存如何实现。

## 1. 文件用途

`app/api/cache.ts` 定义了 OriginOS 的缓存逻辑，包括：

- 缓存存储
- 缓存获取
- 缓存失效

## 2. 核心实现

打开 `app/api/cache.ts`：

```ts
const cache = new Map<string, unknown>();

export function getCache(key: string) {
  return cache.get(key);
}

export function setCache(key: string, value: unknown) {
  cache.set(key, value);
}
```

## 3. 核心逻辑

### 3.1 缓存存储

```ts
cache.set(key, value);
```

- `key`：缓存键。
- `value`：缓存值。

### 3.2 缓存获取

```ts
return cache.get(key);
```

- `key`：缓存键。
- 返回值：缓存值或 `undefined`。

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

1. 缓存如何存储数据？
2. `getCache` 和 `setCache` 的作用是什么？
3. 如果缓存未命中，会发生什么？

参考答案：

1. 通过 `cache.set(key, value)`。
2. `getCache` 获取缓存，`setCache` 设置缓存。
3. 需要重新计算。

## 7. 章节收束

本节课看了缓存的实现：缓存存储、缓存获取、缓存失效。缓存是 OriginOS 性能的加速器。

下一节课会看限流如何实现。
