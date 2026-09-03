# G47：动画缓动函数——`easings.ts` 是怎么定义 Fluent Design 缓动曲线的

> 本课核心问题：`easings.ts` 定义了哪些缓动函数？它们是怎么来的？为什么用这四个？

## 1. 开篇场景：小王觉得动画"怪怪的"

小王打开 OriginOS，窗口弹入时感觉"很生硬"——像是一块砖头砸在桌上，而不是一张卡片滑入桌面。

设计师说："这是因为我们用了线性的 `ease-in-out`，应该用 Fluent Design 的 `standard` 缓动。"

## 2. 两种动画策略

### 2.1 线性动画

```css
transition: all 0.3s linear;
```

优点：简单，可预测。

缺点：生硬，不自然。现实世界中没有物体是匀速运动的。

### 2.2 缓动动画

```css
transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
```

OriginOS 选择了**缓动动画**。

## 3. 源码精读：`easings.ts`

打开 [packages/core/src/lib/features/animations/easings.ts](../../../../packages/core/src/lib/features/animations/easings.ts)。

### 3.1 缓动函数定义

```ts
export const easings = {
  standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
  sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)',
} as const;
```

对应源码位置：[packages/core/src/lib/features/animations/easings.ts 第 7—14 行](../../../../packages/core/src/lib/features/animations/easings.ts#L7-L14)。

### 3.2 四个缓动函数的含义

| 名称 | 曲线 | 用途 | 视觉感受 |
| --- | --- | --- | --- |
| `standard` | `cubic-bezier(0.4, 0.0, 0.2, 1)` | 默认，大多数过渡 | 自然、平滑 |
| `decelerate` | `cubic-bezier(0.0, 0.0, 0.2, 1)` | 元素进入视野 | 快速启动，缓慢停止 |
| `accelerate` | `cubic-bezier(0.4, 0.0, 1, 1)` | 元素离开视野 | 缓慢启动，快速离开 |
| `sharp` | `cubic-bezier(0.4, 0.0, 0.6, 1)` | 快速响应、小元素 | 干脆、利落 |

## 4. 图解：缓动曲线对比

```
速度
 │
 │    standard          decelerate
 │       ╱╲              ╱╲
 │      ╱  ╲            ╱  ╲
 │     ╱    ╲          ╱    ╲
 │    ╱      ╲        ╱      ╲
 │   ╱        ╲      ╱        ╲
 │  ╱          ╲    ╱          ╲
 │ ╱            ╲  ╱            ╲
 │╱              ╲╱              ╲
 └──────────────────────────────────→ 时间

  accelerate         sharp
     ╲╱              ╲╱
    ╲  ╲            ╲  ╲
   ╲    ╲          ╲    ╲
  ╲      ╲        ╲      ╲
 ╲        ╲      ╲        ╲
╲          ╲    ╲          ╲
            ╲  ╱            ╲
             ╲╱              ╲
```

## 5. 设计原理

### 5.1 为什么用 cubic-bezier？

`cubic-bezier(p1x, p1y, p2x, p2y)` 定义了一条三次贝塞尔曲线，控制动画的加速和减速。

```
(0,0) ──→ p1(p1x, p1y)
              │
              ↓
           p2(p2x, p2y)
              │
              ↓
           (1,1)
```

### 5.2 为什么选这四个？

来自 **Microsoft Fluent Design System**：

- **Standard**：大多数 UI 过渡的默认选择。
- **Decelerate**：元素进入时，快速出现然后减速停止。
- **Accelerate**：元素离开时，缓慢启动然后加速消失。
- **Sharp**：小元素或需要快速响应的场景。

## 6. 使用示例

```ts
import { easings } from '@originos/core/lib/features/animations';

// 默认过渡
element.style.transition = `transform 0.3s ${easings.standard}`;

// 元素进入
element.style.transition = `opacity 0.25s ${easings.decelerate}`;

// 元素离开
element.style.transition = `opacity 0.2s ${easings.accelerate}`;
```

## 7. 测试证据与缺口

### 已覆盖

- `easings.ts` 没有直接测试。

### 缺口

- 缓动函数值没有验证。
- 没有性能测试。

## 8. 小实验：可视化缓动曲线

```ts
import { easings } from '@originos/core/lib/features/animations';

// 在浏览器控制台运行
Object.entries(easings).forEach(([name, curve]) => {
  const div = document.createElement('div');
  div.style.width = '100px';
  div.style.height = '20px';
  div.style.background = 'blue';
  div.style.margin = '10px';
  div.style.transition = `transform 1s ${curve}`;
  div.textContent = name;
  document.body.appendChild(div);

  // 触发动画
  setTimeout(() => {
    div.style.transform = 'translateX(300px)';
  }, 100);
});
```

## 9. 口头验收

读完本课后，应能不看书稿回答：

1. `easings.ts` 定义了哪四个缓动函数？
2. `standard` 和 `decelerate` 的区别是什么？
3. 为什么用 `cubic-bezier` 而不是 `linear`？
4. 这四个缓动函数来自哪个设计系统？
5. `sharp` 适合什么场景？

## 10. 章节收束

本课的核心认知是 **`easings.ts` 定义了四个 Fluent Design 缓动函数，分别对应标准、减速、加速、干脆四种动画感受**。

我们看到的几个关键设计：

- **标准缓动**：`cubic-bezier(0.4, 0.0, 0.2, 1)`，大多数过渡的默认选择。
- **减速缓动**：`cubic-bezier(0.0, 0.0, 0.2, 1)`，元素进入时使用。
- **加速缓动**：`cubic-bezier(0.4, 0.0, 1, 1)`，元素离开时使用。
- **干脆缓动**：`cubic-bezier(0.4, 0.0, 0.6, 1)`，小元素或快速响应。
- **无测试**：没有直接测试覆盖。

下一课（G48）我们会看 `durations.ts`，了解动画时长常量是怎么设计的。
