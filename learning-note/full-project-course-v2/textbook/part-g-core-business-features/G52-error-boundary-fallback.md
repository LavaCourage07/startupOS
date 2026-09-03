# G52：错误边界与错误回退——`ErrorBoundary` 和 `ErrorFallback` 是怎么捕获错误的

> 本课核心问题：`ErrorBoundary` 是怎么捕获子组件错误的？`ErrorFallback` 是怎么显示错误信息的？

## 1. 开篇场景：小王的 OriginOS 崩溃了

小王正在使用 OriginOS，突然一个组件报错，整个页面白屏。

系统需要：
- 捕获错误，不让它传播。
- 显示友好的错误信息。
- 提供重试按钮。

## 2. 两种错误处理策略

### 2.1 不处理

```tsx
function App() {
  return <BuggyComponent />; // 如果报错，整个页面白屏
}
```

缺点：用户体验极差。

### 2.2 错误边界

```tsx
function App() {
  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <BuggyComponent />
    </ErrorBoundary>
  );
}
```

OriginOS 选择了**错误边界**。

## 3. 源码精读：`ErrorBoundary.tsx`

打开 [packages/core/src/lib/features/system/errors/ErrorBoundary.tsx](../../../../packages/core/src/lib/features/system/errors/ErrorBoundary.tsx)。

### 3.1 完整源码

```tsx
import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const Fallback = this.props.fallback;
      if (Fallback) {
        return <Fallback error={this.state.error} reset={this.reset} />;
      }
      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold mb-4">出错了</h2>
          <p className="text-gray-600 mb-4">{this.state.error.message}</p>
          <button onClick={this.reset} className="px-4 py-2 bg-blue-500 text-white rounded">
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

对应源码位置：[packages/core/src/lib/features/system/errors/ErrorBoundary.tsx 第 18—57 行](../../../../packages/core/src/lib/features/system/errors/ErrorBoundary.tsx#L18-L57)。

### 3.2 流程分析

```
子组件抛出错误
  ↓
getDerivedStateFromError(error)
  ↓
更新 state: { hasError: true, error }
  ↓
componentDidCatch(error, errorInfo)
  ↓
render() 显示 fallback
  ↓
用户点击"重试" → reset()
  ↓
更新 state: { hasError: false, error: null }
  ↓
render() 显示 children
```

## 4. 源码精读：`ErrorFallback.tsx`

打开 [packages/core/src/lib/features/system/errors/ErrorFallback.tsx](../../../../packages/core/src/lib/features/system/errors/ErrorFallback.tsx)。

### 4.1 完整源码

```tsx
import React from 'react';

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="text-6xl mb-4">⚠️</div>
      <h2 className="text-2xl font-bold mb-2">出错了</h2>
      <p className="text-gray-600 mb-6 max-w-md text-center">{error.message}</p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          重试
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
        >
          刷新页面
        </button>
      </div>
    </div>
  );
}
```

对应源码位置：[packages/core/src/lib/features/system/errors/ErrorFallback.tsx 第 12—34 行](../../../../packages/core/src/lib/features/system/errors/ErrorFallback.tsx#L12-L34)。

## 5. 图解：错误边界生命周期

```
┌─────────────────────────────────────────┐
│           ErrorBoundary                 │
│  ┌─────────────────────────────────┐   │
│  │         子组件树                  │   │
│  │    ┌─────────┐                  │   │
│  │    │ Component│                  │   │
│  │    │  throws  │                  │   │
│  │    │  Error!  │                  │   │
│  │    └────┬────                  │   │
│  │         │                        │   │
│  │    getDerivedStateFromError      │   │
│  │         │                        │   │
│  │    componentDidCatch             │   │
│  │         │                        │   │
│  │    ┌────▼────┐                   │   │
│  │    │ ErrorFallback│              │   │
│  │    │  ⚠️ 出错了  │              │   │
│  │    │  [重试]    │              │   │
│  │    └───────────┘               │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## 6. 设计亮点

### 6.1 可配置 Fallback

```tsx
interface ErrorBoundaryProps {
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}
```

可以自定义错误回退 UI。

### 6.2 错误回调

```tsx
interface ErrorBoundaryProps {
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}
```

可以上报错误到监控系统。

### 6.3 重试机制

```tsx
reset = (): void => {
  this.setState({ hasError: false, error: null });
};
```

用户点击"重试"后，重新渲染子组件。

## 7. 使用示例

```tsx
import { ErrorBoundary, ErrorFallback } from '@originos/core/lib/features/system';

function App() {
  return (
    <ErrorBoundary
      fallback={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('App error:', error, errorInfo);
        // 上报到 Sentry 等监控系统
      }}
    >
      <MainContent />
    </ErrorBoundary>
  );
}
```

## 8. 测试证据与缺口

### 已覆盖

- `ErrorBoundary` 没有直接测试。

### 缺口

- 错误捕获没有测试。
- 重试机制没有测试。
- Fallback 渲染没有测试。

## 9. 小实验：验证错误边界

```tsx
import { ErrorBoundary, ErrorFallback } from '@originos/core/lib/features/system';

function BuggyComponent() {
  throw new Error('Something went wrong!');
}

function TestErrorBoundary() {
  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <BuggyComponent />
    </ErrorBoundary>
  );
}
```

预期结果：显示 "⚠️ 出错了" 和 "Something went wrong!"。

## 10. 口头验收

读完本课后，应能不看书稿回答：

1. `ErrorBoundary` 是怎么捕获错误的？
2. `getDerivedStateFromError` 和 `componentDidCatch` 的区别是什么？
3. `ErrorFallback` 接收哪些 props？
4. 用户点击"重试"后发生了什么？
5. 为什么错误边界是 Class 组件而不是函数组件？

## 11. 章节收束

本课的核心认知是 **`ErrorBoundary` 通过 `getDerivedStateFromError` 和 `componentDidCatch` 捕获子组件错误，`ErrorFallback` 显示友好的错误信息和重试按钮**。

我们看到的几个关键设计：

- **错误捕获**：`getDerivedStateFromError` 更新状态，`componentDidCatch` 处理副作用。
- **友好回退**：`ErrorFallback` 显示错误信息和操作按钮。
- **重试机制**：`reset()` 方法恢复状态，重新渲染子组件。
- **可配置**：支持自定义 Fallback 和错误回调。
- **无测试**：没有直接测试覆盖。

下一课（G53）我们会看性能优化工具，了解 `LazyLoader`、`VirtualList` 和 `useMemoryCleanup`。
