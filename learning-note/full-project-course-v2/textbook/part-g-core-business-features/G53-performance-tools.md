# G53：性能优化工具——`LazyLoader`、`VirtualList`、`useMemoryCleanup` 是怎么干活的

> 本课核心问题：`LazyLoader`、`VirtualList`、`useMemoryCleanup` 分别是怎么提升性能的？它们各自解决了什么问题？

## 1. 开篇场景：小王的长列表卡顿了

小王打开 OriginOS 的文件列表，有 10000 个文件。页面卡顿，滚动时掉帧。

系统需要：
- 懒加载组件，减少初始加载时间。
- 虚拟列表，只渲染可见项。
- 内存清理，防止内存泄漏。

## 2. 三种性能问题

| 问题 | 症状 | 解决方案 |
| --- | --- | --- |
| 初始加载慢 | 页面白屏时间长 | `LazyLoader` |
| 长列表卡顿 | 滚动掉帧 | `VirtualList` |
| 内存泄漏 | 页面越来越卡 | `useMemoryCleanup` |

## 3. 源码精读：`LazyLoader.tsx`

打开 [packages/core/src/lib/features/system/formance/LazyLoader.tsx](../../../../packages/core/src/lib/features/system/performance/LazyLoader.tsx)。

### 3.1 完整源码

```tsx
import { lazy, Suspense, ComponentType } from 'react';

export function lazyLoad<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const Component = lazy(factory);

  return (props: React.ComponentProps<T>) => (
    <Suspense fallback={fallback || <div>Loading...</div>}>
      <Component {...props} />
    </Suspense>
  );
}
```

对应源码位置：[packages/core/src/lib/features/system/performance/LazyLoader.tsx 第 7—18 行](../../../../packages/core/src/lib/features/system/performance/LazyLoader.tsx#L7-L18)。

### 3.2 设计原理

```
初始加载
  │
  ▼
──────────────────┐
│ 只加载首页组件    │
│ 其他组件延迟加载  │
└──────────────────┘

用户点击导航
  │
  ▼
┌──────────────────┐
│ lazy() 动态导入  │
│ Suspense 显示 Loading │
│ 组件加载完成      │
└──────────────────┘
```

### 3.3 使用示例

```tsx
import { lazyLoad } from '@originos/core/lib/features/system';

const HeavyComponent = lazyLoad(
  () => import('./HeavyComponent'),
  <div>Loading...</div>
);

function App() {
  return <HeavyComponent />;
}
```

## 4. 源码精读：`VirtualList.tsx`

打开 [packages/core/src/lib/features/system/performance/VirtualList.tsx](../../../../packages/core/src/lib/features/system/performance/VirtualList.tsx)。

### 4.1 完整源码

```tsx
import React from 'react';

interface VirtualListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
}

export function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(height / itemHeight) + 1,
    items.length
  );

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  return (
    <div
      style={{ height, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => (
            <div key={startIndex + i} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

对应源码位置：[packages/core/src/lib/features/system/performance/VirtualList.tsx 第 14—47 行](../../../../packages/core/src/lib/features/system/performance/VirtualList.tsx#L14-L47)。

### 4.2 核心算法

```
总高度 = items.length × itemHeight

可见区域
  │
  ▼
┌──────────────────┐
│ startIndex       │ = floor(scrollTop / itemHeight)
│ endIndex         │ = min(startIndex + ceil(height / itemHeight) + 1, items.length)
│                  │
│ visibleItems     │ = items.slice(startIndex, endIndex)
│ offsetY          │ = startIndex × itemHeight
│                  │
│ translateY(offsetY) │ 偏移整个容器
└──────────────────┘
```

### 4.3 图解：虚拟列表

```
总列表（10000 项）
┌─────────────────┐
│ 第 0 项         │ ──┐
│ 第 1 项         │    │  不可见
│ ...             │    │
│ 第 49 项        │ ──┘
│ 第 50 项        │ ──┐
│ 第 51 项        │    │  可见区域
│ ...             │    │  （渲染）
│ 第 59 项        │ ──┘
│ 第 60 项        │ ──┐
│ ...             │    │  不可见
│ 第 9999 项      │ ──┘
└─────────────────┘

实际渲染（10 项）
┌─────────────────┐
│ translateY(5000)│  ← offsetY
│ ┌─────────────┐ │
│ │ 第 50 项    │ │
│ │ 第 51 项    │ │
│ │ ...         │ │
│ │ 第 59 项    │ │
│ └─────────────┘ │
└─────────────────┘
```

### 4.4 使用示例

```tsx
import { VirtualList } from '@originos/core/lib/features/system';

function FileList({ files }) {
  return (
    <VirtualList
      items={files}
      height={500}
      itemHeight={50}
      renderItem={(file, index) => (
        <div key={file.id}>
          {index}: {file.name}
        </div>
      )}
    />
  );
}
```

## 5. 源码精读：`useMemoryCleanup.ts`

打开 [packages/core/src/lib/features/system/performance/useMemoryCleanup.ts](../../../../packages/core/src/lib/features/system/performance/useMemoryCleanup.ts)。

### 5.1 完整源码

```ts
import { useEffect, useRef } from 'react';

export function useMemoryCleanup() {
  const timers = useRef<NodeJS.Timeout[]>([]);
  const listeners = useRef<Array<{ element: EventTarget; event: string; handler: EventListener }>>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      listeners.current.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
    };
  }, []);

  return {
    addTimer: (timer: NodeJS.Timeout) => timers.current.push(timer),
    addListener: (element: EventTarget, event: string, handler: EventListener) => {
      element.addEventListener(event, handler);
      listeners.current.push({ element, event, handler });
    },
  };
}
```

对应源码位置：[packages/core/src/lib/features/system/performance/useMemoryCleanup.ts 第 7—27 行](../../../../packages/core/src/lib/features/system/performance/useMemoryCleanup.ts#L7-L27)。

### 5.2 设计原理

```
组件挂载
  │
  ▼
┌──────────────────┐
│ useMemoryCleanup │
│  ┌────────────┐ │
│  │ timers     │ │ ← 存储 setTimeout ID
│  │ listeners  │ │ ← 存储事件监听器
│  └────────────┘ │
└──────────────────┘

组件卸载
  │
  ▼
┌──────────────────┐
│ cleanup          │
│  ┌──────────── │
│  │ clearTimeout│ │ ← 清理定时器
│  │ removeEvent │ │ ← 移除事件监听器
│  └────────────┘ │
└──────────────────┘
```

### 5.3 使用示例

```tsx
import { useMemoryCleanup } from '@originos/core/lib/features/system';

function MyComponent() {
  const { addTimer, addListener } = useMemoryCleanup();

  useEffect(() => {
    // 定时器会被自动清理
    const timer = setTimeout(() => console.log('Hello'), 1000);
    addTimer(timer);

    // 事件监听器会被自动清理
    const handler = () => console.log('Clicked');
    addListener(window, 'click', handler);
  }, []);

  return <div>Hello</div>;
}
```

## 6. 测试证据与缺口

### 已覆盖

- `LazyLoader`、`VirtualList`、`useMemoryCleanup` 没有直接测试。

### 缺口

- 懒加载没有测试。
- 虚拟列表没有测试。
- 内存清理没有测试。

## 7. 小实验：验证虚拟列表

```tsx
import { VirtualList } from '@originos/core/lib/features/system';

function VirtualListDemo() {
  const items = Array.from({ length: 10000 }, (_, i) => ({ id: i, name: `Item ${i}` }));

  return (
    <VirtualList
      items={items}
      height={400}
      itemHeight={50}
      renderItem={(item, index) => (
        <div style={{ padding: 10, borderBottom: '1px solid #ccc' }}>
          {index}: {item.name}
        </div>
      )}
    />
  );
}
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `LazyLoader` 是怎么工作的？
2. `VirtualList` 的核心算法是什么？
3. `useMemoryCleanup` 是怎么防止内存泄漏的？
4. 虚拟列表只渲染多少项？
5. 为什么 `useMemoryCleanup` 用 `useRef` 而不是 `useState`？

## 9. 章节收束

本课的核心认知是 **`LazyLoader` 延迟加载组件，`VirtualList` 只渲染可见项，`useMemoryCleanup` 自动清理定时器和事件监听器**。

我们看到的几个关键设计：

- **LazyLoader**：`React.lazy()` + `Suspense` 实现组件懒加载。
- **VirtualList**：计算可见索引，只渲染可见项，通过 `translateY` 偏移。
- **useMemoryCleanup**：`useRef` 存储定时器和监听器，组件卸载时自动清理。
- **无测试**：没有直接测试覆盖。

下一课（G54）我们会看快捷键系统，了解 `ShortcutRegistry` 和 `useShortcut` 是怎么工作的。
