# I58：监控告警：系统的哨兵

上一节课看了日志记录。这节课看监控告警如何实现。

## 1. 文件用途

`app/api/monitor.ts` 定义了 OriginOS 的监控告警逻辑，包括：

- 指标收集
- 阈值判断
- 告警触发

## 2. 核心实现

打开 `app/api/monitor.ts`：

```ts
export function alert(message: string) {
  console.error(`[ALERT] ${message}`);
}
```

## 3. 核心逻辑

### 3.1 指标收集

```ts
const metrics = new Map<string, number>();

export function recordMetric(name: string, value: number) {
  metrics.set(name, value);
}
```

- `metrics`：指标存储。
- `recordMetric`：记录指标。

### 3.2 阈值判断

```ts
export function checkThreshold(name: string, threshold: number) {
  const value = metrics.get(name) || 0;
  return value > threshold;
}
```

- `threshold`：阈值。
- 返回值：是否超过阈值。

### 3.3 告警触发

```ts
export function triggerAlert(name: string, threshold: number) {
  if (checkThreshold(name, threshold)) {
    alert(`${name} exceeded threshold ${threshold}`);
  }
}
```

- `triggerAlert`：触发告警。
- `alert`：输出告警。

## 4. 失败路径

### 4.1 告警未触发

如果告警未触发，可能导致问题无法及时发现。

### 4.2 误报

如果阈值设置不当，可能导致误报。

## 5. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器访问 | 页面能渲染 | 告警一定触发 |
| 代码阅读 | 逻辑清晰 | 所有边界条件 |

## 6. 小实验

不运行项目，回答：

1. 监控告警如何触发？
2. `triggerAlert` 的作用是什么？
3. 如果告警未触发，会发生什么？

参考答案：

1. 通过检查指标是否超过阈值。
2. 触发告警。
3. 问题可能无法及时发现。

## 7. 章节收束

本节课看了监控告警的实现：指标收集、阈值判断、告警触发。监控告警是 OriginOS 的哨兵。

下一节课会看安全与监控如何结合。
