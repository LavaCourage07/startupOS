# G49：useAnimation Hook——Web Animations API 是怎么被封装成动画控制器的

> 本课核心问题：`useAnimation` 是怎么用 Web Animations API 实现动画控制的？它提供了哪些控制能力？

## 1. 开篇场景：小王想控制动画

小王点击按钮，弹窗滑入。小王想：
- 暂停动画看看中间状态。
- 反转动画方向。
- 知道动画进行到哪了。

系统需要一套完整的动画控制 API。

## 2. 两种动画实现方式

### 2.1 CSS 动画

```css
@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

.dialog {
  animation: slideIn 0.3s ease-out;
}
```

缺点：无法控制（暂停、反转、进度查询）。

### 2.2 Web Animations API

```ts
const animation = element.animate(
  [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }],
  { duration: 300, easing: 'ease-out' }
);

animation.pause();
animation.reverse();
animation.currentTime; // 查询进度
```

OriginOS 选择了**Web Animations API**。

## 3. 源码精读：`useAnimation.ts`

打开 [packages/core/src/lib/features/animations/useAnimation.ts](../../../../packages/core/src/lib/features/animations/useAnimation.ts)。

### 3.1 入口函数

```ts
export function useAnimation(
  keyframes?: AnimationKeyframes,
  config: AnimationConfig = {}
): AnimationControls {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const animationRef = useRef<Animation | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  // ...
```

对应源码位置：[packages/core/src/lib/features/animations/useAnimation.ts 第 72—83 行](../../../../packages/core/src/lib/features/animations/useAnimation.ts#L72-L83)。

### 3.2 动画创建

```ts
const createAnimation = useCallback((element: HTMLElement) => {
  if (prefersReducedMotion) {
    // Skip animation for reduced motion preference
    if (keyframes?.to) {
      Object.assign(element.style, keyframes.to);
    }
    config.onComplete?.();
    return null;
  }

  const duration = config.duration || durations.normal;
  const easing = getEasing(config.easing);

  const animationKeyframes: Keyframe[] = [
    (keyframes?.from || {}) as unknown as Keyframe,
    (keyframes?.to || {}) as unknown as Keyframe,
  ].filter(kf => Object.keys(kf).length > 0);

  if (animationKeyframes.length < 2) {
    return null;
  }

  const animation = element.animate(animationKeyframes, {
    duration,
    easing,
    delay: config.delay || 0,
    iterations: config.iterations || 1,
    direction: config.direction || 'normal',
    fill: config.fill || 'forwards',
  });
  // ...
```

对应源码位置：[packages/core/src/lib/features/animations/useAnimation.ts 第 109—138 行](../../../../packages/core/src/lib/features/animations/useAnimation.ts#L109-L138)。

### 3.3 事件监听

```ts
animation.addEventListener('start', () => {
  setIsAnimating(true);
  setIsPaused(false);
  config.onStart?.();
  trackProgress();
});

animation.addEventListener('finish', () => {
  setIsAnimating(false);
  setIsPaused(false);
  setProgress(1);
  clearProgressTracking();
  config.onComplete?.();
});

animation.addEventListener('cancel', () => {
  setIsAnimating(false);
  setIsPaused(false);
  setProgress(0);
  clearProgressTracking();
  config.onCancel?.();
});
```

对应源码位置：[packages/core/src/lib/features/animations/useAnimation.ts 第 140—161 行](../../../../packages/core/src/lib/features/animations/useAnimation.ts#L140-L161)。

### 3.4 控制方法

```ts
const start = useCallback(() => {
  if (!elementRef.current || animationRef.current) return;
  const animation = createAnimation(elementRef.current);
  if (animation) {
    animationRef.current = animation;
    animation.play();
  }
}, [createAnimation]);

const stop = useCallback(() => {
  if (animationRef.current) {
    animationRef.current.pause();
    setIsPaused(true);
  }
}, []);

const resume = useCallback(() => {
  if (animationRef.current && isPaused) {
    animationRef.current.play();
    setIsPaused(false);
    setIsAnimating(true);
    trackProgress();
  }
}, [isPaused, trackProgress]);

const reverse = useCallback(() => {
  if (animationRef.current) {
    animationRef.current.reverse();
  }
}, []);

const finish = useCallback(() => {
  if (animationRef.current) {
    animationRef.current.finish();
  }
}, []);
```

对应源码位置：[packages/core/src/lib/features/animations/useAnimation.ts 第 170—217 行](../../../../packages/core/src/lib/features/animations/useAnimation.ts#L170-L217)。

## 4. 图解：useAnimation 状态机

```
┌─────────
│  idle   │
└────┬────┘
     │ start()
     ▼
┌─────────┐     ┌─────────┐
│ running │────▶│ paused  │
└────┬────┘ stop └────┬────┘
     │                │ resume()
     │ finish()       ▼
     ▼            ┌─────────┐
┌─────────┐      │ running │
│ finished│      └────┬────┘
└─────────┘           │ finish()
                      ▼
                 ┌─────────┐
                 │ finished│
                 └─────────┘
```

## 5. 设计亮点

### 5.1 减少动画偏好支持

```ts
const prefersReducedMotion = useReducedMotion();

if (prefersReducedMotion) {
  if (keyframes?.to) {
    Object.assign(element.style, keyframes.to);
  }
  config.onComplete?.();
  return null;
}
```

如果用户偏好减少动画，直接跳到最终状态，不播放动画。

### 5.2 进度追踪

```ts
const trackProgress = useCallback(() => {
  if (!animationRef.current || !isAnimating) return;

  const animation = animationRef.current;
  const currentTime = typeof animation.currentTime === 'number' ? animation.currentTime : 0;
  setProgress(currentTime ? currentTime / (config.duration || durations.normal) : 0);

  if (animation.playState === 'running') {
    frameRef.current = requestAnimationFrame(trackProgress);
  }
}, [config.duration, isAnimating]);
```

通过 `requestAnimationFrame` 实时追踪动画进度。

## 6. 使用示例

```tsx
import { useAnimation, useAnimationRef } from '@originos/core/lib/features/animations';

function Dialog() {
  const ref = useAnimationRef<HTMLDivElement>();
  const { start, stop, resume, reverse, finish, isAnimating, progress } = useAnimation(
    {
      from: { transform: 'translateX(-100%)', opacity: '0' },
      to: { transform: 'translateX(0)', opacity: '1' },
    },
    {
      duration: 300,
      easing: 'decelerate',
      onComplete: () => console.log('Animation done!'),
    }
  );

  return (
    <div>
      <div ref={ref} style={{ opacity: 0 }}>
        Dialog content
      </div>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
      <button onClick={resume}>Resume</button>
      <button onClick={reverse}>Reverse</button>
      <button onClick={finish}>Finish</button>
      <p>Progress: {Math.round(progress * 100)}%</p>
    </div>
  );
}
```

## 7. 测试证据与缺口

### 已覆盖

- `useAnimation` 没有直接测试。

### 缺口

- 动画状态机没有测试。
- 进度追踪没有测试。
- 减少动画偏好没有测试。

## 8. 小实验：验证动画控制

```tsx
import { useAnimation, useAnimationRef } from '@originos/core/lib/features/animations';

function AnimationDemo() {
  const ref = useAnimationRef<HTMLDivElement>();
  const controls = useAnimation(
    {
      from: { transform: 'scale(0.5)', opacity: '0' },
      to: { transform: 'scale(1)', opacity: '1' },
    },
    { duration: 1000, easing: 'standard' }
  );

  return (
    <div>
      <div ref={ref} style={{ width: 100, height: 100, background: 'blue' }} />
      <button onClick={controls.start}>Start</button>
      <button onClick={controls.stop}>Stop</button>
      <button onClick={controls.resume}>Resume</button>
      <button onClick={controls.reverse}>Reverse</button>
      <p>Progress: {Math.round(controls.progress * 100)}%</p>
    </div>
  );
}
```

## 9. 口头验收

读完本课后，应能不看书稿回答：

1. `useAnimation` 返回哪些控制方法？
2. 它是怎么支持减少动画偏好的？
3. 进度是怎么被追踪的？
4. `AnimationControls` 包含哪些状态？
5. 动画完成时会发生什么？

## 10. 章节收束

本课的核心认知是 **`useAnimation` 通过 Web Animations API 提供了完整的动画控制能力，包括启动、暂停、恢复、反转、完成，同时支持减少动画偏好**。

我们看到的几个关键设计：

- **完整控制**：start、stop、resume、reverse、finish 五个控制方法。
- **状态追踪**：isAnimating、isPaused、progress 三个状态。
- **减少动画支持**：prefersReducedMotion 时直接跳到最终状态。
- **事件驱动**：通过 'start'、'finish'、'cancel' 事件监听动画状态。
- **无测试**：没有直接测试覆盖。

下一课（G50）我们会看 `useSpring` 和 `useTransition`，了解弹簧动画和过渡动画是怎么实现的。
