# J53：服务适配器

## 两个服务文件

Web 包的 `services/` 目录目前只有两个文件：

1. `ViewReconcilerAdapter.ts`：视图协调器适配器，整合 `view-manager`、`neural-channel` 模块，提供统一的视图生命周期管理。
2. `normalize-markdown-tables.ts`：Markdown 表格规范化，修复 LLM 生成的表格常见错误。

---

## 第一段源码：ViewReconcilerAdapter 的模块初始化

[packages/web/src/services/ViewReconcilerAdapter.ts 第 35–83 行](../../../../packages/web/src/services/ViewReconcilerAdapter.ts#L35)：

```ts
export class ViewReconcilerAdapter {
  private viewManager: ViewManagerType | null = null;
  private channelManager: ManagerType | null = null;
  private reconcilers: Map<string, ReconcilerType> = new Map();
  private pages: Map<string, any> = new Map();
  private callbacks: Map<string, ViewLifecycleCallbacks> = new Map();

  constructor() {
    this.initModules();
  }

  private async initModules(): Promise<void> {
    if (typeof window === 'undefined') return;

    const [viewManagerModule, neuralChannelModule] = await Promise.all([
      import('@neural-nexus/view-manager').catch(() => null),
      import('@neural-nexus/neural-channel').catch(() => null),
    ]);

    const tryConstruct = (Ctor: unknown, ...args: unknown[]): unknown => {
      try {
        return new (Ctor as any)(...args);
      } catch {
        return null;
      }
    };

    if (viewManagerModule) {
      const viewManagerExports = viewManagerModule as Record<string, unknown>;
      const Ctor = viewManagerExports['default'] ?? viewManagerExports['ViewManager'];
      if (typeof Ctor === 'function') {
        this.viewManager = tryConstruct(Ctor, 10);
      }
    }

    if (neuralChannelModule) {
      const neuralChannelExports = neuralChannelModule as Record<string, unknown>;
      const getManagerInstance = neuralChannelExports['getManagerInstance'];
      if (typeof getManagerInstance !== 'function') return;
      try {
        this.channelManager = (getManagerInstance as () => unknown)();
      } catch { /* fallback mode */ }
    }
  }
}
```

`ViewReconcilerAdapter` 的内部状态：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `viewManager` | `ViewManagerType \| null` | `@neural-nexus/view-manager` 实例 |
| `channelManager` | `ManagerType \| null` | `@neural-nexus/neural-channel` 实例 |
| `reconcilers` | `Map<string, ReconcilerType>` | 每个视图的协调器（当前未使用） |
| `pages` | `Map<string, any>` | 每个视图的页面对象 |
| `callbacks` | `Map<string, ViewLifecycleCallbacks>` | 每个视图的生命周期回调 |

`initModules` 的设计：

1. **SSR 保护**：`typeof window === 'undefined'` 时直接返回；
2. **动态导入 + 容错**：`import(...).catch(() => null)`，模块不存在时不崩溃；
3. **导出兼容**：检查 `default` 和命名导出两种形式；
4. **构造容错**：`tryConstruct` 包裹 `new` 调用，构造失败返回 `null`。

> `@neural-nexus/view-manager` 和 `@neural-nexus/neural-channel` 是外部包，可能未安装。动态导入 + `.catch(() => null)` 让适配器在缺少依赖时优雅降级。

## 第二段源码：createView 的内容类型过滤与降级

[packages/web/src/services/ViewReconcilerAdapter.ts 第 95–147 行](../../../../packages/web/src/services/ViewReconcilerAdapter.ts#L95)：

```ts
createView(options: ViewReconcilerOptions, callbacks?: ViewLifecycleCallbacks): string {
  const { windowId, content, containerId, context = {} } = options;

  if (
    content.type !== 'view' &&
    content.type !== 'iframe' &&
    content.type !== 'microapp' &&
    content.type !== 'qiankun'
  ) {
    console.warn(`ViewReconcilerAdapter: Unsupported content type: ${content.type}`);
    return windowId;
  }

  const viewContent = content as ViewContent;
  const viewId = viewContent.viewId || windowId;

  if (callbacks) {
    this.callbacks.set(viewId, callbacks);
  }

  if (!this.isModulesAvailable()) {
    this.createFallbackView(viewId, viewContent, containerId);
    return viewId;
  }

  try {
    const page = this.viewManager?.openPage({
      id: viewId,
      code: viewContent.viewCode || `view-${viewId}`,
      title: viewContent.title,
      url: viewContent.url,
      context: { ...context, ...viewContent.context },
      storagePath: viewContent.storagePath || '',
      iframeContentId: containerId,
      currentRouteName: viewContent.currentRouteName || '',
      urlQuery: viewContent.urlQuery || '',
    });

    if (page) {
      this.pages.set(viewId, page);
      callbacks?.onCreate?.();
    }
  } catch (error) {
    console.error('ViewReconcilerAdapter: Failed to create view', error);
    this.createFallbackView(viewId, viewContent, containerId);
  }

  return viewId;
}
```

`createView` 的三种路径：

| 条件 | 路径 | 说明 |
| --- | --- | --- |
| 内容类型不是 `view`/`iframe`/`microapp`/`qiankun` | 警告 + 返回 `windowId` | 不支持的类型 |
| 模块不可用 | `createFallbackView` | 降级为简单 iframe |
| 模块可用 | `viewManager.openPage` | 使用 view-manager 管理 |
| `openPage` 抛异常 | `createFallbackView` | 降级为简单 iframe |

> 注意 `createView` 比 `useViewReconciler` 多支持一种类型：`iframe`。Hook 只处理 `view`/`microapp`/`qiankun`，适配器多了一层 `iframe` 支持。

## 第三段源码：createFallbackView 与生命周期方法

[packages/web/src/services/ViewReconcilerAdapter.ts 第 152–266 行](../../../../packages/web/src/services/ViewReconcilerAdapter.ts#L152)：

```ts
private createFallbackView(viewId: string, content: ViewContent, containerId: string): void {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`ViewReconcilerAdapter: Container not found: ${containerId}`);
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.id = `iframe-${viewId}`;
  iframe.name = content.title || viewId;
  iframe.src = content.url;
  iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
  iframe.className = 'view-iframe';

  container.appendChild(iframe);
}

startView(viewId: string): void {
  const page = this.pages.get(viewId);
  if (page && typeof page.onStart === 'function') page.onStart();
  const callbacks = this.callbacks.get(viewId);
  callbacks?.onStart?.();
}

pauseView(viewId: string): void {
  const page = this.pages.get(viewId);
  if (page && typeof page.onPause === 'function') page.onPause();
  const callbacks = this.callbacks.get(viewId);
  callbacks?.onPause?.();
}

resumeView(viewId: string, isActive: boolean = true): void {
  const page = this.pages.get(viewId);
  if (page && typeof page.onResume === 'function') page.onResume(isActive, true);
  const callbacks = this.callbacks.get(viewId);
  callbacks?.onResume?.();
}

stopView(viewId: string): void {
  const page = this.pages.get(viewId);
  if (page && typeof page.onStop === 'function') page.onStop();
  const callbacks = this.callbacks.get(viewId);
  callbacks?.onStop?.();
}

destroyView(viewId: string): void {
  try {
    this.viewManager?.closePage(viewId);
  } catch (error) {
    console.warn('ViewReconcilerAdapter: Failed to close page via view-manager', error);
  }

  const iframe = document.getElementById(`iframe-${viewId}`);
  if (iframe) iframe.remove();

  this.pages.delete(viewId);
  this.reconcilers.delete(viewId);
  this.callbacks.delete(viewId);

  const callbacks = this.callbacks.get(viewId);
  callbacks?.onDestroy?.();
}

refreshView(viewId: string): void {
  const page = this.pages.get(viewId);
  if (page && typeof page.onRefresh === 'function') page.onRefresh(true);

  const iframe = document.getElementById(`iframe-${viewId}`) as HTMLIFrameElement;
  if (iframe) iframe.src = iframe.src;
}
```

每个生命周期方法都遵循双轨模式：

1. 如果有 `viewManager` 管理的 `page` 对象，调用 `page.onXxx()`；
2. 无论如何都调用 `callbacks.onXxx()`。

`destroyView` 清理三个 Map（`pages`、`reconcilers`、`callbacks`），并移除 DOM 中的 fallback iframe。

> 注意 `destroyView` 里的 bug：`callbacks?.onDestroy?.()` 在 `this.callbacks.delete(viewId)` 之后调用，此时 `callbacks` 已经是 `undefined`，所以 `onDestroy` 回调永远不会被触发。

## 第四段源码：通信接口与单例导出

[packages/web/src/services/ViewReconcilerAdapter.ts 第 271–366 行](../../../../packages/web/src/services/ViewReconcilerAdapter.ts#L271)：

```ts
sendToView(viewId: string, type: string, payload: any): void {
  if (!this.channelManager) {
    console.warn('ViewReconcilerAdapter: Channel manager not available');
    return;
  }
  try {
    this.channelManager.sendTo(type, payload, viewId);
  } catch (error) {
    console.error('ViewReconcilerAdapter: Failed to send message', error);
  }
}

broadcast(type: string, payload: any): void {
  if (!this.channelManager) {
    console.warn('ViewReconcilerAdapter: Channel manager not available');
    return;
  }
  try {
    this.channelManager.broadcast(type, payload);
  } catch (error) {
    console.error('ViewReconcilerAdapter: Failed to broadcast', error);
  }
}

onMessage(type: string, callback: (payload: any) => void): void {
  if (!this.channelManager) {
    console.warn('ViewReconcilerAdapter: Channel manager not available');
    return;
  }
  try {
    this.channelManager.on(type, callback);
  } catch (error) {
    console.error('ViewReconcilerAdapter: Failed to register listener', error);
  }
}

offMessage(type: string): void {
  if (!this.channelManager) return;
  try {
    this.channelManager.remove(type);
  } catch (error) {
    console.error('ViewReconcilerAdapter: Failed to remove listener', error);
  }
}

getViewIds(): string[] {
  return Array.from(this.pages.keys());
}

hasView(viewId: string): boolean {
  return this.pages.has(viewId) || document.getElementById(`iframe-${viewId}`) !== null;
}

destroyAll(): void {
  this.pages.forEach((_, viewId) => {
    this.destroyView(viewId);
  });
  document.querySelectorAll('.view-iframe').forEach((iframe) => {
    iframe.remove();
  });
  this.pages.clear();
  this.reconcilers.clear();
  this.callbacks.clear();
}

// 导出单例
export const viewReconcilerAdapter = new ViewReconcilerAdapter();
```

通信方法（`sendToView`、`broadcast`、`onMessage`、`offMessage`）都委托给 `channelManager`，每个方法都有 `channelManager` 不可用时的警告和异常捕获。

`hasView` 同时检查 `pages` Map 和 DOM 中的 fallback iframe，覆盖两种创建路径。

> 模块底部导出单例 `viewReconcilerAdapter`，`useViewReconciler` Hook 使用的就是这个单例。

---

## 第五段源码：normalizeMarkdownTables 的全角管道符处理

[packages/web/src/services/normalize-markdown-tables.ts 第 10–27 行](../../../../packages/web/src/services/normalize-markdown-tables.ts#L10)：

```ts
function normalizeFullWidthPipes(line: string): string {
  const pipeCount = line.match(/｜/g)?.length ?? 0;
  return pipeCount >= 2 ? line.replace(/｜/g, '|') : line;
}

function normalizePipesOutsideFences(lines: string[]): string[] {
  let fenceMarker: string | null = null;

  return lines.map((line) => {
    const fenceMatch = line.match(FENCE_PATTERN);
    if (fenceMatch?.[1]) {
      const marker = fenceMatch[1][0] ?? '';
      fenceMarker = fenceMarker === marker ? null : marker;
      return line;
    }
    return fenceMarker ? line : normalizeFullWidthPipes(line);
  });
}
```

LLM 生成的 Markdown 表格里经常用全角管道符 `｜`（U+FF5C）代替半角 `|`（U+007C）。`normalizeFullWidthPipes` 把全角替换为半角，但只在行内至少有 2 个全角管道符时才替换——避免误改正文中偶然出现的全角符号。

`normalizePipesOutsideFences` 追踪代码围栏（` ``` ` 或 `~~~ `）状态，只在围栏外替换。围栏内的内容是代码，不应修改。

> 围栏状态机：遇到围栏开始标记时记录字符（`` ` `` 或 `~`），遇到相同字符的围栏标记时清除。同一个 `fenceMarker` 变量同时处理开和关。

## 第六段源码：表格范围查找与分隔行规范化

[packages/web/src/services/normalize-markdown-tables.ts 第 29–96 行](../../../../packages/web/src/services/normalize-markdown-tables.ts#L29)：

```ts
function splitTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;

  const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = withoutEdges.split(/(?<!\\)\|/).map((cell) => cell.trim());
  return cells.length >= 2 ? cells : null;
}

function parseSeparatorRow(line: string): string[] | null {
  const cells = splitTableRow(line);
  if (!cells || !cells.every((cell) => SEPARATOR_CELL_PATTERN.test(cell))) return null;
  return cells;
}

function normalizeSeparatorCell(cell: string): string {
  const leftAligned = cell.startsWith(':');
  const rightAligned = cell.endsWith(':');
  return `${leftAligned ? ':' : ''}---${rightAligned ? ':' : ''}`;
}

function findTableRanges(lines: string[]): TableRange[] {
  const ranges: TableRange[] = [];
  let fenceMarker: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fenceMatch = line.match(FENCE_PATTERN);
    if (fenceMatch?.[1]) {
      const marker = fenceMatch[1][0] ?? '';
      fenceMarker = fenceMarker === marker ? null : marker;
      continue;
    }
    if (fenceMarker || index === 0) continue;

    const separatorCells = parseSeparatorRow(line);
    const headerCells = splitTableRow(lines[index - 1] ?? '');
    if (!separatorCells || !headerCells || separatorCells.length !== headerCells.length) continue;

    let end = index;
    while (end + 1 < lines.length) {
      const nextLine = lines[end + 1] ?? '';
      if (!nextLine.trim() || FENCE_PATTERN.test(nextLine)) break;
      const rowCells = splitTableRow(nextLine);
      if (!rowCells) break;
      end += 1;
    }

    ranges.push({ start: index - 1, separator: index, end });
    index = end;
  }

  return ranges;
}
```

表格识别算法：

1. **`splitTableRow`**：去掉首尾 `|`，按未转义的 `|` 分割，至少 2 列才认为是表格行；
2. **`parseSeparatorRow`**：每个单元格必须匹配 `^:?-+:?$`（如 `---`、`:---:`、`---:`）；
3. **`findTableRanges`**：遍历所有行，找到"表头行 + 分隔行"的组合，然后向下扩展数据行，直到空行、围栏或非表格行。

`normalizeSeparatorCell` 把分隔行的单元格规范化为 `:---`、`---:`、`:---:` 等标准格式，修复 LLM 生成的 `----`、`:--` 等不规则分隔符。

> `(?<!\\)\|` 是负向后行断言，跳过转义的 `\|`。这确保单元格内容里的管道符不会被错误分割。

## 第七段源码：normalizeMarkdownTables 的组装

[packages/web/src/services/normalize-markdown-tables.ts 第 102–142 行](../../../../packages/web/src/services/normalize-markdown-tables.ts#L102)：

```ts
export function normalizeMarkdownTables(markdown: string): string {
  if (!markdown.includes('|') && !markdown.includes('｜')) return markdown;

  const lines = normalizePipesOutsideFences(
    markdown.replace(/\r\n?/g, '\n').split('\n'),
  );
  const ranges = findTableRanges(lines);
  if (ranges.length === 0) return markdown;

  for (const range of ranges) {
    const cells = parseSeparatorRow(lines[range.separator] ?? '');
    if (cells) {
      lines[range.separator] = `| ${cells.map(normalizeSeparatorCell).join(' | ')} |`;
    }
  }

  const output: string[] = [];
  let rangeIndex = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const range = ranges[rangeIndex];
    if (range && index === range.start) {
      if (output.length > 0 && output[output.length - 1]?.trim()) {
        output.push('');
      }
      output.push(...lines.slice(range.start, range.end + 1));
      if (range.end + 1 < lines.length && lines[range.end + 1]?.trim()) {
        output.push('');
      }
      index = range.end;
      rangeIndex += 1;
      continue;
    }
    output.push(lines[index] ?? '');
  }

  return output.join('\n');
}
```

`normalizeMarkdownTables` 的完整流程：

1. **快速跳过**：没有 `|` 或 `｜` 时直接返回；
2. **换行符统一**：`\r\n` → `\n`；
3. **全角替换**：围栏外的 `｜` → `|`；
4. **查找表格**：找到所有表格范围；
5. **规范化分隔行**：修复分隔符格式；
6. **确保空行隔离**：表格前后各确保有一个空行，避免与周围段落粘连。

> 第 6 步的"空行隔离"很重要：`ReactMarkdown` 的 GFM 表格解析要求表格前后有空行，否则可能被当作普通段落处理。

---

## 本节小结

- `ViewReconcilerAdapter` 是 `view-manager` 和 `neural-channel` 的统一封装，动态导入外部模块，模块不可用时降级为简单 iframe。
- 适配器的生命周期方法（create/start/pause/resume/stop/destroy/refresh）都遵循双轨模式：先调用 `viewManager` 的页面对象，再调用用户回调。
- `destroyView` 有一个 bug：`callbacks?.onDestroy?.()` 在 `this.callbacks.delete(viewId)` 之后调用，`onDestroy` 永远不会触发。
- 适配器导出单例 `viewReconcilerAdapter`，被 `useViewReconciler` Hook 使用。
- `normalizeMarkdownTables` 修复 LLM 生成的 Markdown 表格常见错误：全角管道符、不规则分隔符、缺少空行隔离。
- 表格识别算法跳过代码围栏内的内容，用负向后行断言处理转义管道符。

下一节课读包基础：`lib/utils.ts`、`lib/hooks/*`、`lib/features/*` re-exports、`config/system-apps.ts`、`styles/globals.css`、类型声明、模块桩。
