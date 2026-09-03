# I57：日志记录：系统的黑匣子

上一节课看了身份验证。这节课看日志记录如何实现。

## 1. 文件用途

`app/api/logger.ts` 定义了 OriginOS 的日志记录逻辑，包括：

- 日志级别
- 日志格式
- 日志输出

## 2. 核心实现

打开 `app/api/logger.ts`：

```ts
export function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}
```

## 3. 核心逻辑

### 3.1 日志级别

```ts
export function info(message: string) {
  log(`[INFO] ${message}`);
}

export function error(message: string) {
  log(`[ERROR] ${message}`);
}
```

- `info`：信息日志。
- `error`：错误日志。

### 3.2 日志格式

```ts
`[${new Date().toISOString()}] ${message}`
```

- `new Date().toISOString()`：时间戳。
- `message`：日志消息。

## 4. 失败路径

### 4.1 日志未记录

如果日志未记录，可能导致问题无法追踪。

### 4.2 日志格式错误

如果日志格式错误，可能导致日志无法解析。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 日志一定记录 |
| 代码阅读 | 逻辑清晰 | 所有边界条件 |

## 6. 小实验

不运行项目，回答：

1. 日志记录如何格式化？
2. `log` 的作用是什么？
3. 如果日志未记录，会发生什么？

参考答案：

1. 通过时间戳和消息格式化。
2. 记录日志。
3. 问题可能无法追踪。

## 7. 章节收束

本节课看了日志记录的实现：日志级别、日志格式、日志输出。日志记录是 OriginOS 的黑匣子。

下一节课会看监控告警如何实现。
