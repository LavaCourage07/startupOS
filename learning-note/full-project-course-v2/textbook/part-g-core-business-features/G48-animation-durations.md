# G48：动画时长常量——`durations.ts` 是怎么定义动画时长的

> 本课核心问题：`durations.ts` 定义了哪些时长常量？它们是怎么被使用的？为什么这样分级？

## 1. 开篇场景：小王觉得动画"太慢了"

小王点击按钮，弹窗花了 1 秒才完全出现。小王说："这动画太慢了，我等不及。"

设计师说："我们把 `slow` 设成了 500ms，对于弹窗来说确实太慢。应该用 `normal` 300ms，或者 `fast` 200ms。"

## 2. 两种时长策略

### 2.1 随意写死

```ts
const duration = 350; // 随便写的
```

缺点：不一致，难以维护。

### 2.2 分级常量

```ts
import { durations } from '@originos/core/lib/features/animations';

const duration = durations.fast;
```

OriginOS 选择了**分级常量**。

## 3. 源码精读：`durations.ts`

打开 [packages/core/src/lib/features/animations/durations.ts](../../../../packages/core/src/lib/features/animations/durations.ts)。

### 3.1 时长常量定义

```ts
export const durations = {
  instant: 100,   // 100ms
  fast: 200,      // 200ms
  normal: 300,    // 300ms
  slow: 500,      // 500ms
  enter: 250,     // 250ms
  exit: 200,      // 200ms
  complex: 400,   // 400ms
} as const;
```

对应源码位置：[packages/core/src/lib/features/animations/durations.ts 第 7—15 行](../../../../packages/core/src/lib/features/animations/durations.ts#L7-L15)。

### 3.2 时长分级含义

| 名称 | 时长 | 用途 | 感知 |
| --- | --- | --- | --- |
| `instant` | 100ms | 微交互、按钮反馈 | 几乎瞬间 |
| `fast` | 200ms | 小元素过渡 | 快速 |
| `normal` | 300ms | 标准过渡 | 自然 |
| `slow` | 500ms | 大元素、复杂动画 | 缓慢 |
| `enter` | 250ms | 元素进入 | 略慢于标准 |
| `exit` | 200ms | 元素离开 | 略快于标准 |
| `complex` | 400ms | 复杂组合动画 | 中等偏慢 |

## 4. 设计原理

### 4.1 为什么分级？

人类的感知阈值：

| 时长 | 感知 |
| --- | --- |
| < 100ms | 瞬间，感知不到动画 |
| 100–200ms | 快速，感知到但不觉得慢 |
| 200–300ms | 标准，最自然的动画时长 |
| 300–500ms | 缓慢，适合大元素 |
| > 500ms | 太慢，用户会不耐烦 |

### 4.2 为什么 enter 比 exit 慢？

```
Enter: 250ms（用户需要时间来理解新元素）
Exit:  200ms（用户已经知道元素要离开，越快越好）
```

这是 **Material Design** 和 **Fluent Design** 的共同建议。

## 5. 使用示例

```ts
import { durations, easings } from '@originos/core/lib/features/animations';

// 按钮点击反馈
button.style.transition = `transform ${durations.instant}ms ${easings.standard}`;

// 弹窗出现
dialog.style.transition = `opacity ${durations.enter}ms ${easings.decelerate}`;

// 弹窗消失
dialog.style.transition = `opacity ${durations.exit}ms ${easings.accelerate}`;

// 复杂动画
panel.style.transition = `all ${durations.complex}ms ${easings.standard}`;
```

## 6. 测试证据与缺口

### 已覆盖

- `durations.ts` 没有直接测试。

### 缺口

- 时长值没有验证。
- 没有感知测试。

## 7. 小实验：感受不同时长

```ts
import { durations, easings } from '@originos/core/lib/features/animations';

Object.entries(durations).forEach(([name, duration]) => {
  const div = document.createElement('div');
  div.style.width = '50px';
  div.style.height = '50px';
  div.style.background = 'blue';
  div.style.margin = '10px';
  div.style.transition = `transform ${duration}ms ${easings.standard}`;
  div.textContent = `${name}\n${duration}ms`;
  document.body.appendChild(div);

  setTimeout(() => {
    div.style.transform = 'translateX(100px)';
  }, 100);
});
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `durations.ts` 定义了哪七个时长常量？
2. `enter` 和 `exit` 的时长分别是多少？为什么这样设计？
3. 人类的感知阈值是多少？
4. 为什么 `instant` 是 100ms？
5. 什么时候应该用 `complex`？

## 9. 章节收束

本课的核心认知是 **`durations.ts` 定义了七个动画时长常量，覆盖了从 100ms 到 500ms 的完整范围，遵循人类感知阈值和 Fluent Design 建议**。

我们看到的几个关键设计：

- **分级设计**：instant、fast、normal、slow 覆盖不同场景。
- **进入慢于离开**：enter 250ms > exit 200ms，符合用户认知。
- **无测试**：没有直接测试覆盖。

下一课（G49）我们会深入 `useAnimation.ts`，看看 Web Animations API 是怎么被封装成 Hook 的。
