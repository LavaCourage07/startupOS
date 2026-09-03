# G51：useReducedMotion——系统是怎么检测用户减少动画偏好的

> 本课核心问题：`useReducedMotion` 是怎么检测用户的 `prefers-reduced-motion` 设置的？为什么这很重要？

## 1. 开篇场景：小王对动画过敏

小王有前庭功能障碍，看到快速移动的动画会头晕恶心。

小王在系统设置中开启了"减少动画"，OriginOS 需要尊重这个偏好。

## 2. 两种动画策略

### 2.1 忽略用户偏好

```ts
function AnimatedComponent() {
  const { start } = useAnimation({ /* ... */ });
  // 总是播放动画
  return <div onClick={start}>Click me</div>;
}
```

缺点：对前庭功能障碍用户不友好。

### 2.2 检测并尊重用户偏好

```ts
function AnimatedComponent() {
  const prefersReducedMotion = useReducedMotion();
  const { start } = useAnimation({ /* ... */ });

  return (
    <div onClick={() => !prefersReducedMotion && start()}>
      Click me
    </div>
  );
}
```

OriginOS 选择了**检测并尊重**。

## 3. 源码精读：`useReducedMotion.ts`

打开 [packages/core/src/lib/features/animations/useReducedMotion.ts](../../../../packages/core/src/lib/features/animations/useReducedMotion.ts)。

### 3.1 完整源码

```ts
import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if window is available (SSR safety)
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersReducedMotion;
}
```

对应源码位置：[packages/core/src/lib/features/animations/useReducedMotion.ts 第 8—25 行](../../../../packages/core/src/lib/features/animations/useReducedMotion.ts#L8-L25)。

### 3.2 流程分析

```
useReducedMotion
  ├─ 1. 初始化状态为 false
  ├─ 2. SSR 安全检查（window 是否存在）
  ├─ 3. 创建 MediaQueryList
  ├─ 4. 设置初始值
  ├─ 5. 监听变化
  └─ 6. 清理监听器
```

## 4. 图解：Media Query 监听

```
用户设置
  │
  ▼
┌──────────────────┐
│ prefers-reduced- │
│ motion: reduce   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  matchMedia()    │
│  MediaQueryList  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  addEventListener│
│  ('change')      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ setPrefersReduced│
│ Motion(e.matches)│
└──────────────────┘
```

## 5. 设计亮点

### 5.1 SSR 安全

```ts
if (typeof window === 'undefined' || !window.matchMedia) {
  return;
}
```

服务端渲染时 `window` 不存在，直接返回。

### 5.2 实时响应

```ts
const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
mediaQuery.addEventListener('change', listener);
```

用户切换设置时，React 状态实时更新。

### 5.3 清理

```ts
return () => mediaQuery.removeEventListener('change', listener);
```

组件卸载时清理监听器，防止内存泄漏。

## 6. 在动画中的使用

### 6.1 useAnimation

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

### 6.2 useSpring

```ts
const prefersReducedMotion = useReducedMotion();

if (prefersReducedMotion) {
  setState(prev => ({ ...prev, value: targetRef.current, velocity: 0 }));
  setIsAnimating(false);
  setIsAtRest(true);
  onRestRef.current?.();
  return;
}
```

## 7. 测试证据与缺口

### 已覆盖

- `useReducedMotion` 没有直接测试。

### 缺口

- Media Query 监听没有测试。
- SSR 安全没有测试。
- 清理逻辑没有测试。

## 8. 小实验：验证减少动画

```tsx
import { useReducedMotion } from '@originos/core/lib/features/animations';

function ReducedMotionDemo() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div>
      <p>Reduced Motion: {prefersReducedMotion ? 'Yes' : 'No'}</p>
      <p>
        在系统设置中切换"减少动画"，
        这里会实时更新。
      </p>
    </div>
  );
}
```

## 9. 口头验收

读完本课后，应能不看书稿回答：

1. `useReducedMotion` 是怎么检测用户偏好的？
2. 为什么需要 SSR 安全检查？
3. 用户切换设置时，组件是怎么响应的？
4. 组件卸载时发生了什么？
5. 哪些动画组件使用了 `useReducedMotion`？

## 10. 章节收束

本课的核心认知是 **`useReducedMotion` 通过 `matchMedia('prefers-reduced-motion')` 检测用户偏好，并在用户切换设置时实时响应**。

我们看到的几个关键设计：

- **Media Query**：`matchMedia('(prefers-reduced-motion: reduce)')` 检测偏好。
- **SSR 安全**：`typeof window === 'undefined'` 避免服务端报错。
- **实时响应**：`addEventListener('change')` 监听设置变化。
- **清理**：`removeEventListener` 防止内存泄漏。
- **无测试**：没有直接测试覆盖。

下一课（G52）我们会进入系统服务模块，看看 `ErrorBoundary` 和 `ErrorFallback` 是怎么工作的。
