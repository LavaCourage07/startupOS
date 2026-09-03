# J49：剩余 Store 与通用 Hook

## 本单元的基础设施层

单元六从 Web 包里还没讲过的 store 和 hook 开始。这些文件不像 `SkillDialog` 或 `AppWindowManager` 那样引人注目，但它们是上层组件的"地基"：沙箱状态、LLM 设置、右键菜单、桌面网格、响应式布局、全局快捷键。

这节课读六个文件：

- `sandboxStore.ts`：代码沙箱的应用列表、运行时日志、控制台状态
- `settingsStore.ts`：LLM 提供商配置、用户偏好、本地 + 服务端双写
- `useContextMenu.ts`：右键菜单的打开/关闭/外部点击/ESC 关闭
- `useDesktopGrid.ts`：桌面图标的网格布局管理
- `useResponsive.ts`：窗口尺寸监听与断点判断
- `useGlobalShortcut.ts`：全局快捷键注册

## 第一段源码：sandboxStore 的状态结构

[packages/web/src/store/sandboxStore.ts 第 9–15 行](../../../../packages/web/src/store/sandboxStore.ts#L9)：

```ts
const useSandboxStore = create<SandboxStoreState>((set) => ({
  apps: [],
  activeAppId: null,
  runtime: {},
  isConsoleOpen: false,
  consoleFilter: 'all',
```

`sandboxStore` 管理代码沙箱的五个状态：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `apps` | `SandboxApp[]` | 可用的沙箱应用列表 |
| `activeAppId` | `string \| null` | 当前运行的应用 |
| `runtime` | `Record<appId, RuntimeState>` | 每个应用的运行时状态（日志、错误） |
| `isConsoleOpen` | `boolean` | 控制台面板是否展开 |
| `consoleFilter` | `'all' \| 'log' \| 'warn' \| 'error'` | 控制台过滤级别 |

## 第二段源码：addLog 的日志截断策略

[packages/web/src/store/sandboxStore.ts 第 31–41 行](../../../../packages/web/src/store/sandboxStore.ts#L31)：

```ts
  addLog: (appId: string, log: SandboxLog) => {
    set((state) => {
      const runtime = state.runtime[appId] ?? { appId, status: 'running', logs: [], errors: [] };
      const logs = runtime.logs.length >= 1000
        ? [...runtime.logs.slice(-500), log]
        : [...runtime.logs, log];
      return {
        runtime: { ...state.runtime, [appId]: { ...runtime, logs } },
      };
    });
  },
```

`addLog` 有一个日志截断策略：

- 日志数量 < 1000：直接追加；
- 日志数量 >= 1000：保留最后 500 条，再追加新日志。

这种"半量截断"避免了每次追加都触发数组拷贝的性能问题。如果每次到 1000 就清空再追加，用户会看到日志突然消失；保留 500 条则让截断不那么突兀。

> 注意 `runtime` 的初始化用了 `??` 空值合并：如果该 `appId` 还没有运行时状态，就创建一个默认的 `{ status: 'running', logs: [], errors: [] }`。

## 第三段源码：settingsStore 的类型与工具函数

[packages/web/src/store/settingsStore.ts 第 5–36 行](../../../../packages/web/src/store/settingsStore.ts#L5)：

```ts
export type LLMProviderType = 'anthropic' | 'openai';
export type UserLanguagePreference = 'zh-CN' | 'en-US' | 'ja-JP';

export interface ProviderConfig {
  enabled: boolean;
  baseUrl: string;
  authToken: string;
  apiKey: string;
  anthropicCredentialSource?: AnthropicCredentialSource;
  model: string;
  maxTokens: number;
  mapping: Record<string, string>;
}

export interface LLMSettings {
  provider: LLMProviderType;
  anthropic: ProviderConfig;
  openai: ProviderConfig;
}

export function hasUsableProviderConfig(config: ProviderConfig): boolean {
  const hasCredential = config.authToken.trim().length > 0 || config.apiKey.trim().length > 0;
  return config.enabled && hasCredential && config.model.trim().length > 0;
}

export function hasConfiguredLLM(settings: LLMSettings): boolean {
  return hasUsableProviderConfig(settings.anthropic) || hasUsableProviderConfig(settings.openai);
}
```

`settingsStore` 的类型设计：

- `LLMProviderType`：支持 Anthropic 和 OpenAI 两种提供商；
- `ProviderConfig`：每个提供商的配置——启用状态、baseUrl、凭证、模型、最大 token、模型映射；
- `LLMSettings`：当前选中的提供商 + 两个提供商的完整配置。

`hasUsableProviderConfig` 判断一个提供商是否可用：启用 + 有凭证 + 有模型。`hasConfiguredLLM` 判断是否至少有一个可用提供商。

> `mapping` 字段是模型名映射，比如把 `"gpt-4"` 映射到实际的模型 ID。这在 OpenAI 兼容 API 里很常见。

## 第四段源码：settingsStore 的凭证规范化

[packages/web/src/store/settingsStore.ts 第 107–144 行](../../../../packages/web/src/store/settingsStore.ts#L107)：

```ts
function normalizeCredentialString(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return stripBearerPrefix(trimmed);

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const candidate = extractCredentialValue(parsed);
    return candidate ? stripBearerPrefix(candidate) : stripBearerPrefix(trimmed);
  } catch {
    return stripBearerPrefix(trimmed);
  }
}

function extractCredentialValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const enabledEntry = value.find((item) => {
      return Boolean(item)
        && typeof item === 'object'
        && 'enabled' in item
        && (item as { enabled?: unknown }).enabled !== false;
    });
    return extractCredentialValue(enabledEntry ?? value[0]);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record['value'] === 'string') return record['value'];
    if (typeof record['apiKey'] === 'string') return record['apiKey'];
    if (typeof record['authToken'] === 'string') return record['authToken'];
    if (typeof record['key'] === 'string') return record['key'];
  }
  return undefined;
}

function stripBearerPrefix(value: string): string {
  return value.trim().replace(/^Bearer\s+/i, '').trim();
}
```

`normalizeCredentialString` 处理用户粘贴的各种凭证格式：

1. 空值 → `undefined`；
2. 不以 `{` 或 `[` 开头 → 当作纯字符串，去掉 `Bearer ` 前缀；
3. 以 `{` 或 `[` 开头 → 尝试 JSON 解析，从解析结果里提取凭证。

`extractCredentialValue` 递归提取：

- 字符串 → 直接返回；
- 数组 → 找第一个 `enabled !== false` 的条目，递归提取；
- 对象 → 按优先级检查 `value`、`apiKey`、`authToken`、`key` 字段。

> 这种宽容的解析是因为用户可能从各种地方复制凭证：纯 API Key、JSON 配置对象、带 `Bearer` 前缀的 token、甚至整个 credentials 数组。

## 第五段源码：settingsStore 的本地 + 服务端双写

[packages/web/src/store/settingsStore.ts 第 188–207 行](../../../../packages/web/src/store/settingsStore.ts#L188)：

```ts
function persistToServer(settings: LLMSettings): void {
  const provider = getEffectiveProvider(settings);
  const effective = settings[provider];
  setUserConfig({
    llm: {
      enabled: effective.enabled,
      provider: toServerProvider(provider),
      anthropicAuthToken: provider === 'anthropic' ? effective.authToken || null : null,
      anthropicApiKey: provider === 'anthropic' ? effective.apiKey || null : null,
      anthropicBaseUrl: provider === 'anthropic' ? effective.baseUrl || null : null,
      anthropicCredentialSource: provider === 'anthropic' ? getAnthropicCredentialSource(effective) ?? null : null,
      authToken: provider === 'anthropic' ? effective.authToken || null : null,
      apiKey: provider === 'openai' ? effective.apiKey || null : null,
      baseUrl: provider === 'openai' ? effective.baseUrl || null : null,
      model: effective.model || undefined,
      maxTokens: effective.maxTokens || undefined,
      mapping: Object.keys(effective.mapping).length > 0 ? effective.mapping : undefined,
    },
  }).catch(() => {});
}
```

`settingsStore` 每次修改设置都双写：

1. **本地**：`saveToStorage` 写入 `localStorage`，保证离线可用；
2. **服务端**：`persistToServer` 调用 `setUserConfig` API，同步到服务端。

注意 `persistToServer` 的 `.catch(() => {})`：服务端写入失败时静默忽略。这是因为本地优先，服务端同步是"尽力而为"。

`getEffectiveProvider` 决定实际使用哪个提供商：

```ts
function getEffectiveProvider(settings: LLMSettings): LLMProviderType {
  if (settings[settings.provider].enabled) return settings.provider;
  if (settings.anthropic.enabled) return 'anthropic';
  if (settings.openai.enabled) return 'openai';
  return settings.provider;
}
```

优先使用用户选中的提供商，如果没启用就降级到其他已启用的提供商。

## 第六段源码：useContextMenu 的外部点击关闭

[packages/web/src/hooks/useContextMenu.ts 第 37–51 行](../../../../packages/web/src/hooks/useContextMenu.ts#L37)：

```ts
  // 点击外部关闭菜单
  useEffect(() => {
    if (!contextMenu.isOpen) return;

    const handleClickOutside = () => {
      close();
    };

    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.isOpen, close]);
```

`useContextMenu` 封装了右键菜单的完整交互：

1. `open`：阻止默认右键菜单，保存菜单项和位置，调用 `desktopStore.openMenu`；
2. `close`：关闭菜单，清空菜单项；
3. 外部点击关闭：`setTimeout(0)` 延迟注册 `click` 监听器，避免右键事件本身触发关闭；
4. ESC 关闭：监听 `keydown` 事件。

> `setTimeout(0)` 是一个经典技巧：右键菜单打开时，鼠标松开的事件会冒泡到 `document`，如果不延迟注册，菜单会立即被关闭。

## 第七段源码：useDesktopGrid 的网格管理

[packages/web/src/hooks/useDesktopGrid.ts 第 24–81 行](../../../../packages/web/src/hooks/useDesktopGrid.ts#L24)：

```ts
export function useDesktopGrid(
  options: UseDesktopGridOptions
): UseDesktopGridReturn {
  const [grid, setGrid] = useState<Map<string, GridPosition>>(new Map());
  const maxRows = options.rows ?? 10;

  const addToGrid = useCallback((iconId: string, position?: GridPosition) => {
    setGrid((prev) => {
      const newGrid = new Map(prev);
      const pos = position ?? getAvailablePosition(newGrid, options.columns, maxRows);
      if (pos) {
        newGrid.set(iconId, pos);
      }
      return newGrid;
    });
  }, [options.columns, maxRows]);

  const removeFromGrid = useCallback((iconId: string) => {
    setGrid((prev) => {
      const newGrid = new Map(prev);
      newGrid.delete(iconId);
      return newGrid;
    });
  }, []);

  const moveInGrid = useCallback((iconId: string, to: GridPosition) => {
    setGrid((prev) => {
      const newGrid = new Map(prev);
      newGrid.set(iconId, to);
      return newGrid;
    });
  }, []);

  const clearGrid = useCallback(() => {
    setGrid(new Map());
  }, []);

  const getIconAtPosition = useCallback(
    (position: GridPosition): string | null => {
      for (const [iconId, pos] of Array.from(grid.entries())) {
        if (pos.column === position.column && pos.row === position.row) {
          return iconId;
        }
      }
      return null;
    },
    [grid]
  );

  return { grid, addToGrid, removeFromGrid, moveInGrid, clearGrid, getIconAtPosition };
}
```

`useDesktopGrid` 管理桌面图标的网格布局：

- `grid`：`Map<iconId, GridPosition>`，存储每个图标的网格坐标；
- `addToGrid`：添加图标，如果没指定位置就自动找空位；
- `removeFromGrid`：移除图标；
- `moveInGrid`：移动图标到新位置；
- `getIconAtPosition`：查询某个网格位置上的图标。

`getAvailablePosition` 按行优先顺序找第一个空位：

```ts
function getAvailablePosition(grid: Map<string, GridPosition>, columns: number, rows: number): GridPosition | null {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const found = Array.from(grid.values()).some(
        (pos) => pos.column === col && pos.row === row
      );
      if (!found) return { column: col, row };
    }
  }
  return null;
}
```

> 这个 Hook 还导出了两个工具函数：`calculateIconPosition`（网格坐标 → 屏幕像素）和 `calculateGridFromPosition`（屏幕像素 → 网格坐标），用于拖拽时的坐标转换。

## 第八段源码：useResponsive 的断点判断

[packages/web/src/hooks/useResponsive.ts 第 32–67 行](../../../../packages/web/src/hooks/useResponsive.ts#L32)：

```ts
export function useResponsive(config: ResponsiveConfig = DEFAULT_CONFIG): useResponsiveReturn {
  const [size, setSize] = useState<{
    width: number;
    height: number;
    type: 'tablet' | 'desktop';
  }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    type: typeof window !== 'undefined' && window.innerWidth >= config.breakpoints.tablet
      ? 'desktop' : 'tablet',
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setSize({
        width, height,
        type: width >= config.breakpoints.tablet ? 'desktop' : 'tablet',
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [config.breakpoints.tablet]);

  const gridSize = size.type === 'desktop' ? config.gridSize.desktop : config.gridSize.tablet;

  return { size, gridSize };
}
```

`useResponsive` 监听窗口尺寸，返回：

- `size.width` / `size.height`：当前窗口尺寸；
- `size.type`：`'tablet'`（< 1366px）或 `'desktop'`（>= 1366px）；
- `gridSize`：当前断点对应的网格尺寸（tablet: 2×8，desktop: 4×6）。

> SSR 兼容：初始状态用 `typeof window !== 'undefined'` 判断，服务端渲染时默认 1920×1080 desktop。

## 第九段源码：useGlobalShortcut 的两种模式

[packages/web/src/hooks/useGlobalShortcut.ts 第 20–76 行](../../../../packages/web/src/hooks/useGlobalShortcut.ts#L20)：

```ts
export function useGlobalShortcutForKey(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) return;

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        e.ctrlKey === (options.ctrl ?? false) &&
        e.metaKey === (options.meta ?? false) &&
        e.shiftKey === (options.shift ?? false)
      ) {
        e.preventDefault();
        e.stopPropagation();
        callback();
      }
    };

    window.addEventListener('keydown', handler, { capture: true, passive: false });
    return () => window.removeEventListener('keydown', handler, true);
  }, [callback, key, options.ctrl, options.meta, options.shift]);
}

export function useGlobalShortcut(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) return;

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        e.ctrlKey === (options.ctrl ?? false) &&
        e.metaKey === (options.meta ?? false) &&
        e.shiftKey === (options.shift ?? false)
      ) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [callback, key, options.ctrl, options.meta, options.shift]);
}
```

两个快捷键 Hook 的区别：

| Hook | 事件阶段 | `stopPropagation` | 用途 |
| --- | --- | --- | --- |
| `useGlobalShortcutForKey` | capture（捕获） | 是 | 需要优先拦截的快捷键（如 Spotlight 的 `⌘K`） |
| `useGlobalShortcut` | bubble（冒泡） | 否 | 普通快捷键 |

两者都跳过可编辑元素（`input`、`textarea`、`select`、`contentEditable`），避免在输入框里触发全局快捷键。

> `isEditableElement` 检查四种元素类型，确保用户在输入文字时不会被全局快捷键打断。

## 本节小结

- `sandboxStore` 管理沙箱应用列表和运行时日志，日志超过 1000 条时截断保留 500 条。
- `settingsStore` 管理 LLM 配置，支持 Anthropic/OpenAI 双提供商，本地 `localStorage` + 服务端双写，凭证解析兼容纯文本、JSON、Bearer 前缀等多种格式。
- `useContextMenu` 封装右键菜单的打开/关闭/外部点击/ESC 关闭，用 `setTimeout(0)` 避免右键事件冒泡导致立即关闭。
- `useDesktopGrid` 管理桌面图标网格布局，支持添加/移除/移动/查询，自动找空位。
- `useResponsive` 监听窗口尺寸，返回断点类型和网格尺寸，SSR 兼容。
- `useGlobalShortcut` 有两个版本：capture 阶段优先拦截和 bubble 阶段普通监听，都跳过可编辑元素。

下一节课读 `useViewReconciler`、`useLocalAgent`、`agent.ts`，看视图生命周期协调和 Agent 注册表查询。
