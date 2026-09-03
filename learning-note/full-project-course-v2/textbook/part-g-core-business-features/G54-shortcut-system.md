# G54：快捷键系统——`ShortcutRegistry` 和 `useShortcut` 是怎么管理快捷键的

> 本课核心问题：`ShortcutRegistry` 是怎么注册和分发快捷键的？`useShortcut` 是怎么在 React 组件中使用快捷键的？

## 1. 开篇场景：小王想用快捷键

小王正在使用 OriginOS，想用 `Ctrl+K` 打开命令面板，用 `Ctrl+S` 保存文件。

系统需要：
- 注册快捷键。
- 监听键盘事件。
- 分发到对应的处理函数。
- 支持上下文（不同页面不同快捷键）。

## 2. 两种快捷键策略

### 2.1 每个组件自己监听

```tsx
function MyComponent() {
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'k') {
        openCommandPalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
```

缺点：冲突、难以管理。

### 2.2 集中式注册表

```tsx
useShortcut('k', openCommandPalette, { ctrl: true });
```

OriginOS 选择了**集中式注册表**。

## 3. 源码精读：`ShortcutRegistry.ts`

打开 [packages/core/src/lib/features/system/shortcuts/ShortcutRegistry.ts](../../../../packages/core/src/lib/features/system/shortcuts/ShortcutRegistry.ts)。

### 3.1 完整源码

```ts
import { ShortcutConfig } from './types';

export class ShortcutRegistry {
  private shortcuts = new Map<string, ShortcutConfig[]>();
  private activeContext: string | null = null;

  register(id: string, config: ShortcutConfig): () => void {
    const key = this.getKey(config);
    const existing = this.shortcuts.get(key) || [];

    const conflict = existing.find(s => s.context === config.context);
    if (conflict) {
      console.warn(`快捷键冲突: ${key} 在 ${config.context}`);
    }

    existing.push(config);
    existing.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    this.shortcuts.set(key, existing);

    return () => this.unregister(key, config);
  }

  private getKey(config: ShortcutConfig): string {
    const parts = [];
    if (config.ctrl) parts.push('ctrl');
    if (config.meta) parts.push('meta');
    if (config.shift) parts.push('shift');
    if (config.alt) parts.push('alt');
    parts.push(config.key.toLowerCase());
    return parts.join('+');
  }

  handle(e: KeyboardEvent): boolean {
    const key = this.getKeyFromEvent(e);
    const shortcuts = this.shortcuts.get(key) || [];

    for (const shortcut of shortcuts) {
      if (shortcut.context && shortcut.context !== this.activeContext) {
        continue;
      }

      shortcut.handler(e);
      return true;
    }

    return false;
  }

  setContext(context: string | null): void {
    this.activeContext = context;
  }

  private getKeyFromEvent(e: KeyboardEvent): string {
    const parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.metaKey) parts.push('meta');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  private unregister(key: string, config: ShortcutConfig): void {
    const shortcuts = this.shortcuts.get(key);
    if (shortcuts) {
      const filtered = shortcuts.filter(s => s !== config);
      this.shortcuts.set(key, filtered);
    }
  }
}

export const shortcutRegistry = new ShortcutRegistry();
```

对应源码位置：[packages/core/src/lib/features/system/shortcuts/ShortcutRegistry.ts 第 7—77 行](../../../../packages/core/src/lib/features/system/shortcuts/ShortcutRegistry.ts#L7-L77)。

### 3.2 流程分析

```
register('cmd-palette', { key: 'k', ctrl: true, handler: openPalette })
  │
  ▼
getKey({ key: 'k', ctrl: true }) → 'ctrl+k'
  │
  ▼
shortcuts.set('ctrl+k', [{ key: 'k', ctrl: true, handler: openPalette }])

// 用户按下 Ctrl+K
  │
  ▼
handle(KeyboardEvent)
  │
  ▼
getKeyFromEvent(e) → 'ctrl+k'
  │
  ▼
shortcuts.get('ctrl+k') → [{ key: 'k', ctrl: true, handler: openPalette }]
  │
  ▼
handler(e) → openPalette()
```

## 4. 源码精读：`useShortcut.ts`

打开 [packages/core/src/lib/features/system/shortcuts/useShortcut.ts](../../../../packages/core/src/lib/features/system/shortcuts/useShortcut.ts)。

### 4.1 完整源码

```ts
import { useEffect } from 'react';
import { shortcutRegistry } from './ShortcutRegistry';

export function useShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  options: {
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    priority?: number;
    context?: string;
  } = {}
): void {
  useEffect(() => {
    const unregister = shortcutRegistry.register('hook', {
      key,
      ...options,
      handler,
    });

    return unregister;
  }, [key, handler, options.ctrl, options.meta, options.shift, options.priority, options.context]);
}
```

对应源码位置：[packages/core/src/lib/features/system/shortcuts/useShortcut.ts 第 8—28 行](../../../../packages/core/src/lib/features/system/shortcuts/useShortcut.ts#L8-L28)。

### 4.2 流程分析

```
useShortcut('k', openPalette, { ctrl: true })
  │
  ▼
useEffect
  │
  ▼
shortcutRegistry.register('hook', { key: 'k', ctrl: true, handler: openPalette })
  │
  ▼
组件卸载时
  │
  ▼
unregister() → 移除快捷键
```

## 5. 图解：快捷键分发

```
用户按下键盘
  │
  ▼
┌──────────────────┐
│ KeyboardEvent   │
│  ctrlKey: true  │
│  key: 'k'       │
└────────┬─────────┘
         │
         ▼
──────────────────┐
│ getKeyFromEvent │
│  → 'ctrl+k'     │
└────────┬─────────┘
         │
         ▼
┌──────────────────
│ shortcuts.get   │
│  → [config]     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 检查 context    │
│  → 匹配 → 执行   │
│  → 不匹配 → 跳过 │
└──────────────────┘
```

## 6. 设计亮点

### 6.1 优先级排序

```ts
existing.sort((a, b) => (b.priority || 0) - (a.priority || 0));
```

高优先级的快捷键先执行。

### 6.2 上下文隔离

```ts
if (shortcut.context && shortcut.context !== this.activeContext) {
  continue;
}
```

不同页面可以注册相同的快捷键。

### 6.3 自动清理

```ts
useEffect(() => {
  const unregister = shortcutRegistry.register('hook', { ... });
  return unregister;
}, []);
```

组件卸载时自动移除快捷键。

## 7. 使用示例

```tsx
import { useShortcut } from '@originos/core/lib/features/system';

function Editor() {
  useShortcut('s', (e) => {
    e.preventDefault();
    saveFile();
  }, { ctrl: true });

  useShortcut('k', (e) => {
    e.preventDefault();
    openCommandPalette();
  }, { ctrl: true, context: 'editor' });

  return <div>Editor content</div>;
}
```

## 8. 测试证据与缺口

### 已覆盖

- `ShortcutRegistry` 和 `useShortcut` 没有直接测试。

### 缺口

- 快捷键注册没有测试。
- 冲突检测没有测试。
- 上下文切换没有测试。

## 9. 小实验：验证快捷键

```tsx
import { useShortcut } from '@originos/core/lib/features/system';

function ShortcutDemo() {
  const [count, setCount] = useState(0);

  useShortcut('k', () => {
    setCount(c => c + 1);
  }, { ctrl: true });

  return (
    <div>
      <p>按下 Ctrl+K，计数: {count}</p>
    </div>
  );
}
```

## 10. 口头验收

读完本课后，应能不看书稿回答：

1. `ShortcutRegistry` 是怎么存储快捷键的？
2. `getKey` 和 `getKeyFromEvent` 的区别是什么？
3. 快捷键冲突是怎么处理的？
4. `useShortcut` 是怎么在组件卸载时清理的？
5. 上下文是怎么工作的？

## 11. 章节收束

本课的核心认知是 **`ShortcutRegistry` 通过 Map 存储快捷键，支持优先级排序和上下文隔离，`useShortcut` 在 React 组件中注册和自动清理快捷键**。

我们看到的几个关键设计：

- **集中式注册**：`Map<string, ShortcutConfig[]>` 存储所有快捷键。
- **优先级排序**：高优先级先执行。
- **上下文隔离**：不同页面可以注册相同快捷键。
- **自动清理**：组件卸载时自动移除。
- **无测试**：没有直接测试覆盖。

下一课（G55）我们会进入 Taste 模块，了解 `taste-schema.ts` 是怎么定义品味类型和验证的。
