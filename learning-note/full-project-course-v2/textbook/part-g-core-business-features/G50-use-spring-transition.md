# G50：useSpring 与 useTransition——弹簧动画和过渡动画是怎么实现的

> 本课核心问题：`useSpring` 是怎么用物理公式模拟弹簧运动的？`useTransition` 是怎么管理元素进入和离开的？

## 1. 开篇场景：小王想要更自然的动画

小王用 OriginOS 的弹窗，发现动画是线性的——"像机器人一样僵硬"。

设计师说："我们用 `useSpring` 吧，它会像弹簧一样自然地弹跳。"

## 2. 两种动画类型

### 2.1 过渡动画（Transition）

元素进入和离开时的状态变化：

```
隐藏 → 显示（entering → entered）
显示 → 隐藏（exiting → exited）
```

### 2.2 弹簧动画（Spring）

基于物理公式的自然运动：

```
位置 = 目标位置 + 速度 × 时间 + 加速度 × 时间²
```

## 3. 源码精读：`useTransition.ts`

打开 [packages/core/src/lib/features/animations/useTransition.ts](../../../../packages/core/src/lib/features/animations/useTransition.ts)。

### 3.1 状态定义

```ts
export type TransitionStatus = 'entering' | 'entered' | 'exiting' | 'exited';

interface TransitionConfig {
  duration?: number;
  onEnter?: () => void;
  onExit?: () => void;
}
```

### 3.2 核心逻辑

```ts
export function useTransition(show: boolean, config: TransitionConfig = {}) {
  const [status, setStatus] = useState<TransitionStatus>('exited');
  const duration = config.duration || durations.normal;

  useEffect(() => {
    if (show) {
      setStatus('entering');
      config.onEnter?.();
      const timer = setTimeout(() => setStatus('entered'), duration);
      return () => clearTimeout(timer);
    } else {
      setStatus('exiting');
      config.onExit?.();
      const timer = setTimeout(() => setStatus('exited'), duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, config]);

  return status;
}
```

对应源码位置：[packages/core/src/lib/features/animations/useTransition.ts 第 16—35 行](../../../../packages/core/src/lib/features/animations/useTransition.ts#L16-L35)。

### 3.3 状态机

```
show = true
  ┌──────────┐
  │  exited  │
  └────┬─────┘
       │
       ▼
  ┌──────────┐
  │ entering │ ──→ onEnter()
  └────┬─────┘
       │
       ▼
  ┌──────────┐
  │  entered │
  └──────────┘

show = false
  ┌──────────┐
  │  entered │
  └────┬─────┘
       │
       ▼
  ┌──────────┐
  │ exiting  │ ──→ onExit()
  └────┬─────┘
       │
       ▼
  ┌──────────┐
  │  exited  │
  └──────────┘
```

## 4. 源码精读：`useSpring.ts`

打开 [packages/core/src/lib/features/animations/useSpring.ts](../../../../packages/core/src/lib/features/animations/useSpring.ts)。

### 4.1 物理参数

```ts
export interface SpringConfig {
  stiffness?: number;   // 刚度（默认 180）
  damping?: number;     // 阻尼（默认 12）
  mass?: number;        // 质量（默认 1）
  duration?: number;    // 目标时长
  precision?: number;   // 精度（默认 0.001）
  velocity?: number;    // 初始速度
  onRest?: () => void;  // 停止回调
}
```

### 4.2 弹簧物理公式

```ts
// 位移 = 当前位置 - 目标位置
const displacement = state.value - targetRef.current;

// 弹簧力 = -刚度 × 位移
const springForce = -stiffness * displacement;

// 阻尼力 = -阻尼 × 速度
const dampingForce = -damping * state.velocity;

// 加速度 = (弹簧力 + 阻尼力) / 质量
const acceleration = (springForce + dampingForce) / mass;

// 新速度 = 旧速度 + 加速度 × 时间
const newVelocity = state.velocity + acceleration * deltaTime;

// 新位置 = 旧位置 + 速度 × 时间
const newValue = state.value + newVelocity * deltaTime;
```

对应源码位置：[packages/core/src/lib/features/animations/useSpring.ts 第 103—114 行](../../../../packages/core/src/lib/features/animations/useSpring.ts#L103-L114)。

### 4.3 动画循环

```ts
const animate = useCallback(() => {
  if (prefersReducedMotion) {
    setState(prev => ({ ...prev, value: targetRef.current, velocity: 0 }));
    setIsAnimating(false);
    setIsAtRest(true);
    onRestRef.current?.();
    return;
  }

  const now = performance.now();
  const deltaTime = Math.min((now - state.lastTime) / 1000, 0.064); // Cap at 64ms
  // ... 物理计算 ...

  // 检查是否稳定
  const hasSettled =
    Math.abs(newVelocity) < precision &&
    Math.abs(displacement) < precision;

  if (hasSettled) {
    setState({ value: targetRef.current, velocity: 0, lastTime: now });
    setIsAnimating(false);
    setIsAtRest(true);
    onRestRef.current?.();
    return;
  }

  setState({ value: newValue, velocity: newVelocity, lastTime: now });
  animationFrameRef.current = requestAnimationFrame(animate);
}, [state, prefersReducedMotion]);
```

对应源码位置：[packages/core/src/lib/features/animations/useSpring.ts 第 89—140 行](../../../../packages/core/src/lib/features/animations/useSpring.ts#L89-L140)。

## 5. 图解：弹簧 vs 过渡

### 5.1 过渡动画

```
位置
 │
 │        ┌──────────────┐
 │        │              │
 │        │              │
 │        │              │
 │        │              │
 │        │              │
 │        │              │
 │        │              │
 └────────┴──────────────┴────────→ 时间
       entering       entered
```

### 5.2 弹簧动画

```
位置
 │
 │    ╱╲
 │   ╱  ╲
 │  ╱    ╲
 │ ╱      ╲    ┌──────┐
 │╱        ╲   │      │
 │          ╲  │      │
 │           ╲ │      │
 └────────────┴──────┴────────→ 时间
           过冲    稳定
```

## 6. 使用示例

### 6.1 useTransition

```tsx
import { useTransition } from '@originos/core/lib/features/animations';

function FadeIn({ show, children }) {
  const status = useTransition(show, { duration: 300 });

  return (
    <div
      style={{
        opacity: status === 'entered' ? 1 : 0,
        transform: status === 'entering' ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'all 0.3s ease',
      }}
    >
      {children}
    </div>
  );
}
```

### 6.2 useSpring

```tsx
import { useSpring } from '@originos/core/lib/features/animations';

function BouncyButton() {
  const { value, isAnimating } = useSpring(100, {
    stiffness: 200,
    damping: 15,
  });

  return (
    <button
      style={{
        transform: `scale(${value / 100})`,
      }}
    >
      Click me {isAnimating ? '...' : ''}
    </button>
  );
}
```

## 7. 测试证据与缺口

### 已覆盖

- `useTransition` 和 `useSpring` 没有直接测试。

### 缺口

- 状态转换没有测试。
- 物理计算没有测试。
- 减少动画偏好没有测试。

## 8. 小实验：感受弹簧物理

```tsx
import { useSpring } from '@originos/core/lib/features/animations';

function SpringDemo() {
  const [target, setTarget] = useState(0);
  const { value } = useSpring(target, { stiffness: 180, damping: 12 });

  return (
    <div>
      <div
        style={{
          width: 50,
          height: 50,
          background: 'blue',
          transform: `translateX(${value}px)`,
        }}
      />
      <button onClick={() => setTarget(200)}>Move to 200</button>
      <button onClick={() => setTarget(0)}>Move to 0</button>
    </div>
  );
}
```

## 9. 口头验收

读完本课后，应能不看书稿回答：

1. `useTransition` 有哪些状态？
2. `useSpring` 的物理公式是什么？
3. 弹簧动画和过渡动画的区别是什么？
4. `hasSettled` 是怎么判断的？
5. 为什么 `deltaTime` 要限制在 64ms？

## 10. 章节收束

本课的核心认知是 **`useTransition` 管理元素的进入和离开状态，`useSpring` 用物理公式模拟弹簧运动**。

我们看到的几个关键设计：

- **过渡动画**：entering → entered → exiting → exited 四状态。
- **弹簧动画**：基于胡克定律和阻尼公式。
- **物理参数**：stiffness、damping、mass 控制弹簧行为。
- **稳定性检测**：速度和位移都小于精度阈值时停止。
- **无测试**：没有直接测试覆盖。

下一课（G51）我们会看 `useReducedMotion`，了解系统是怎么检测用户减少动画偏好的。
