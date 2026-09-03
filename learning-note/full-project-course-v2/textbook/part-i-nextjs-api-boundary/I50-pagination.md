# I50：分页：大数据量的优雅处理

前八个单元追踪了页面路由、会话管理、消息流式响应、项目级 Agent 生命周期、统计和摘要、Skill 和 Interview、全局样式和布局、API 路由与中间件。这个单元转向高级 API 模式。这节课先看分页。

## 1. 文件用途

`app/api/pagination.ts` 定义了 OriginOS 的分页逻辑，包括：

- 数据截取
- 页码计算
- 边界处理

## 2. 核心实现

打开 `app/api/pagination.ts`：

```ts
export function paginate(data: unknown[], page: number, limit: number) {
  const start = (page - 1) * limit;
  const end = start + limit;
  return data.slice(start, end);
}
```

## 3. 核心逻辑

### 3.1 数据截取

```ts
const start = (page - 1) * limit;
const end = start + limit;
return data.slice(start, end);
```

- `start`：起始位置。
- `end`：结束位置。
- `data.slice(start, end)`：截取数据。

### 3.2 页码计算

```ts
const start = (page - 1) * limit;
```

- `page`：当前页码。
- `limit`：每页数量。

## 4. 失败路径

### 4.1 页码错误

如果页码错误，可能返回空数据。

### 4.2 边界越界

如果边界越界，可能返回空数组。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 所有边界条件 |
| 代码阅读 | 逻辑清晰 | 所有错误场景 |

## 6. 小实验

不运行项目，回答：

1. 分页如何实现数据截取？
2. `start` 和 `end` 如何计算？
3. 如果页码错误，会发生什么？

参考答案：

1. 通过 `data.slice(start, end)`。
2. `start = (page - 1) * limit`, `end = start + limit`。
3. 可能返回空数据。

## 7. 章节收束

本节课看了分页的实现：数据截取、页码计算、边界处理。分页是 OriginOS 处理大数据量的基础。

下一节课会看缓存如何实现。
