# K03 · 主窗口是怎样创建和管理的

> **课号** K03 · **轨道** T13 · **文件** `packages/desktop/src/main/window-manager.ts` · **预计阅读** 25 分钟

---

## 本课要回答的问题

K01 展示了 `main.ts` 中 `createWindow()` 的调用，但没有展开。`window-manager.ts` 管理着三类窗口：主窗口、Dock 窗口和原生子窗口。它们各自的创建逻辑是什么？窗口复用怎样防止重复创建？Dock 窗口为什么需要透明和忽略鼠标事件？

## 概念阶梯

### 第一层：三类窗口的角色

| 窗口 | 角色 | 生命周期 |
| --- | --- | --- |
| **主窗口（mainWindow）** | 应用的主界面，加载 Next.js 首页 | 随应用启动创建，关闭时应用退出 |
| **Dock 窗口（dockWindow）** | 可折叠的侧边栏，快速启动应用 | 随主窗口创建，折叠时忽略鼠标事件 |
| **原生子窗口（nativeWindow）** | 由 renderer 通过 IPC 请求创建的独立窗口 | 按需创建，关闭后从 Map 中移除 |

### 第二层：窗口管理的核心数据结构

```typescript
class ElectronWindowManager {
  private readonly windows = new Map<string, BrowserWindow>();
  private mainWindow: BrowserWindow | null = null;
  private dockWindow: BrowserWindow | null = null;
  // ...
}
```

`windows` Map 用窗口 ID 作为 key，管理所有原生子窗口。主窗口和 Dock 窗口有独立的字段，因为它们的生命周期和子窗口不同。

### 第三层：窗口复用策略

`createWindow()` 在创建新窗口之前先检查 `windows` Map：

```typescript
const existing = this.windows.get(config.id);
if (existing && !existing.isDestroyed()) {
  // 复用已有窗口：更新标题、恢复最小化、显示并聚焦
  existing.setTitle(config.title);
  if (existing.isMinimized()) existing.restore();
  if (!existing.isVisible()) existing.show();
  existing.focus();
  return config.id;
}
```

这防止了 renderer 多次请求同一个窗口 ID 时创建多个窗口。

## 源码窗口

### 窗口 1：主窗口创建（main.ts 第 339–380 行）

```typescript
function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'OriginOS CE',
    backgroundColor: process.platform === 'darwin' ? '#00000000' : '#e7edf3',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
    hasShadow: false,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  attachDevToolsContextMenu(window);

  void loadRenderer(window).catch((error: unknown) => {
    console.error('[electron] Failed to load renderer', error);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' });
  });

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });

  return window;
}
```

**关键配置：**

- **`titleBarStyle: 'hiddenInset'`**（macOS）：隐藏标题栏但保留交通灯按钮，让应用自己绘制标题区域。
- **`vibrancy: 'under-window'`**（macOS）：窗口背景半透明模糊效果。
- **`contextIsolation: true` + `nodeIntegration: false`**：安全配置。renderer 不能直接访问 Node.js API，必须通过 preload 的 `contextBridge`。
- **`setWindowOpenHandler`**：拦截 `window.open()` 和 `<a target="_blank">`，外部链接在默认浏览器打开而不是创建新的 Electron 窗口。

### 窗口 2：原生子窗口创建（window-manager.ts 第 205–296 行）

```typescript
createWindow(config: NativeWindowConfig): string {
  const existing = this.windows.get(config.id);
  if (existing && !existing.isDestroyed()) {
    existing.setTitle(config.title);
    if (existing.isMinimized()) existing.restore();
    if (!existing.isVisible()) existing.show();
    existing.focus();
    return config.id;
  }

  const width = Math.max(config.width ?? 960, config.minWidth ?? 400);
  const height = Math.max(config.height ?? 720, config.minHeight ?? 300);
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const x = config.x ?? Math.round((workArea.width - width) / 2);
  const y = config.y ?? Math.round((workArea.height - height) / 2);

  const windowUrl = this.buildWindowUrl(config);

  const window = new BrowserWindow({
    width, height, x, y,
    minWidth: config.minWidth ?? 400,
    minHeight: config.minHeight ?? 300,
    title: config.title,
    // ... webPreferences 同主窗口
  });

  // 防止 Next.js 覆盖标题
  window.on('page-title-updated', (e) => {
    e.preventDefault();
    window.setTitle(config.title);
  });

  window.webContents.on('did-finish-load', () => {
    window.setTitle(config.title);
  });

  // 外部链接在默认浏览器打开
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  void window.loadURL(windowUrl);

  window.on('closed', () => {
    this.windows.delete(config.id);
    this.notifyMainWindow(IPC_CHANNELS.WINDOW_CLOSED, config.id);
  });

  this.windows.set(config.id, window);
  return config.id;
}
```

**设计要点：**

1. **窗口 ID 复用**：同一个 `config.id` 只创建一个窗口。再次请求时复用已有窗口。
2. **标题保护**：`page-title-updated` 事件被 `preventDefault()` 拦截，防止 Next.js 的 `document.title` 覆盖窗口标题。
3. **URL 构建**：`buildWindowUrl()` 在 URL 中注入 `nativeWindowId` 和 `nativeWindow=1` 查询参数，让 renderer 知道自己在原生子窗口中运行。
4. **关闭通知**：窗口关闭时通过 `notifyMainWindow()` 告诉主窗口，让 renderer 更新状态。

### 窗口 3：Dock 窗口（window-manager.ts 第 82–175 行）

```typescript
createDockWindow(): void {
  if (this.dockWindow && !this.dockWindow.isDestroyed()) return;

  const bounds = this.getDockBounds('left', false);

  this.dockWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,           // 无边框
    transparent: true,      // 透明背景
    alwaysOnTop: true,      // 始终置顶
    skipTaskbar: true,      // 不在任务栏显示
    resizable: false,
    hasShadow: false,
    // ... webPreferences
  });

  const dockUrl = new URL('/dock', this.rendererUrl);
  dockUrl.searchParams.set('nativeWindow', '1');
  void this.dockWindow.loadURL(dockUrl.toString());

  // 折叠时忽略鼠标事件，不阻挡底层应用
  this.dockWindow.setIgnoreMouseEvents(true, { forward: true });

  // Dock IPC handlers: DOCK_SHOW, DOCK_HIDE, DOCK_ACTION, DOCK_SYNC_APPS
  // ...
}
```

**Dock 窗口的特殊之处：**

1. **`transparent: true` + `frame: false`**：Dock 窗口没有标题栏和背景，只显示内容区域。
2. **`alwaysOnTop: true`**：Dock 始终浮在其他窗口之上。
3. **`setIgnoreMouseEvents(true, { forward: true })`**：折叠时 Dock 窗口覆盖在屏幕边缘，但不阻挡鼠标点击。`forward: true` 允许鼠标移动事件仍然被接收（用于检测鼠标进入触发展开）。
4. **`getDockBounds()`**：根据屏幕尺寸和 Dock 位置（左/右/下）计算窗口位置和大小。折叠时只有 84px 宽（80px Dock + 4px 热区），展开时 324px 宽（加 240px 工具提示）。

### 窗口 4：Dock 的展开/折叠逻辑（第 120–154 行）

```typescript
ipcMain.handle(IPC_CHANNELS.DOCK_SHOW, (_event, options?: { side?: DockSide }) => {
  if (!this.dockWindow || this.dockWindow.isDestroyed()) return;
  this.dockSide = normalizeDockSide(options?.side);
  this.dockWindow.setIgnoreMouseEvents(false);
  this.dockWindow.setBounds(this.getDockBounds(this.dockSide, true));
  this.dockWindow.webContents.send('dock:animate', 'show');
});

ipcMain.handle(IPC_CHANNELS.DOCK_HIDE, (_event, options?: { side?: DockSide }) => {
  if (!this.dockWindow || this.dockWindow.isDestroyed()) return;
  this.dockSide = normalizeDockSide(options?.side);
  if (this.dockPinnedByGuide) return;  // Guide 高亮时不允许隐藏
  this.dockWindow.webContents.send('dock:animate', 'hide');
  this.dockWindow.setBounds(this.getDockBounds(this.dockSide, false));
  this.dockWindow.setIgnoreMouseEvents(true, { forward: true });
});
```

**`dockPinnedByGuide` 守卫**：当引导高亮（guide-highlight）激活时，Dock 被"钉住"不允许折叠。这用于新用户引导场景，确保 Dock 在引导期间始终可见。

## 失败路径

### 失败 1：窗口 ID 冲突

如果 renderer 用同一个 ID 请求创建两个不同标题的窗口，第二个请求会复用第一个窗口但更新标题。这可能导致用户困惑。解决方案是 renderer 使用唯一的窗口 ID（如 UUID）。

### 失败 2：renderer URL 未就绪

`createWindow()` 调用 `loadURL(windowUrl)` 时，renderer 服务器可能还没启动完成。`loadRenderer()` 中有 `waitForRendererReady()` 等待，但 `createWindow()` 本身不等待。如果 renderer 未就绪，`loadURL()` 会失败但被 `catch` 捕获，不会崩溃。

### 失败 3：Dock 窗口创建失败

`createDockWindow()` 中 `loadURL()` 失败被 `catch` 捕获。Dock 窗口会显示空白但不会崩溃。主窗口不受影响。

## 测试证据

窗口管理的正确性通过以下方式验证：

- **手动测试**：启动应用，检查主窗口和 Dock 窗口是否创建。通过托盘菜单或快捷键 `CmdOrCtrl+Shift+D` 切换 Dock。
- **IPC 测试**：在 renderer 中调用 `window.electron.ipcRenderer.invoke('window:create', config)`，检查新窗口是否创建。
- **复用测试**：用同一个 ID 调用两次 `window:create`，检查是否只创建一个窗口。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么 Dock 窗口需要 `transparent: true` 和 `frame: false`？如果去掉这两个配置会怎样？

2. `setIgnoreMouseEvents(true, { forward: true })` 的作用是什么？如果 `forward` 设为 `false` 会怎样？

3. 为什么 `page-title-updated` 事件要 `preventDefault()`？如果不拦截会怎样？

<details>
<summary>参考答案</summary>

1. Dock 是贴在屏幕边缘的半透明侧边栏，需要无边框和透明背景才能融入桌面。去掉后会显示一个有标题栏和白色背景的普通窗口，破坏视觉效果。

2. `forward: true` 允许鼠标移动事件穿透 Dock 窗口被底层应用接收。如果设为 `false`，鼠标移动事件也会被阻挡，底层应用无法检测鼠标悬停。

3. Next.js 在 hydration 后会设置 `document.title`，这会触发 `page-title-updated` 事件覆盖窗口标题。不拦截的话，窗口标题会变成 Next.js 页面的标题而不是 `config.title`。

</details>

### 练习 2（源码阅读）

阅读 `buildWindowUrl()` 函数（第 67–80 行），回答：

1. 为什么要在 URL 中注入 `nativeWindowId` 和 `nativeWindow=1`？
2. `config.query` 中的参数怎样被传递到 URL 中？
3. 如果 `config.route` 不是以 `/` 开头，会发生什么？

<details>
<summary>参考答案</summary>

1. renderer 需要知道自己在原生子窗口中运行（而不是主窗口或浏览器），以便调整 UI 布局和行为。`nativeWindowId` 让 renderer 可以查询窗口配置。

2. `config.query` 是一个 `Record<string, string>`，通过 `searchParams.set()` 逐个注入到 URL 查询参数中。

3. 如果 `config.route` 不以 `/` 开头，`buildWindowUrl()` 会回退到 `/`（第 69 行的三元表达式）。

</details>

## 口头验收

完成本课后，你应该能用 60 秒口头描述：

> "窗口管理器管理三类窗口。主窗口在 `main.ts` 的 `createWindow()` 中创建，配置 macOS 的 hiddenInset 标题栏和 vibrancy 模糊效果，加载 renderer URL。原生子窗口由 renderer 通过 IPC 请求创建，`createWindow()` 先检查 Map 复用已有窗口，否则新建并注入 `nativeWindowId` 查询参数。标题被 `page-title-updated` 保护防止 Next.js 覆盖。Dock 窗口是透明无边框的置顶窗口，折叠时用 `setIgnoreMouseEvents(true, { forward: true })` 让鼠标事件穿透。展开时接收鼠标事件并显示工具提示。Guide 高亮时 Dock 被钉住不允许折叠。"

## 下一课预告

K03 讲了窗口管理。K04 会看托盘、快捷键和自动更新怎样挂在主进程上——它们是主进程的"系统插件"。
