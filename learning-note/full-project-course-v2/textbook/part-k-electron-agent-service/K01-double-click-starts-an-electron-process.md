# K01 · 双击图标后，Electron 进程是怎样启动的

> **课号** K01 · **轨道** T13 · **文件** `packages/desktop/src/main/main.ts` · **预计阅读** 25 分钟

---

## 本课要回答的问题

用户在桌面双击 OriginOS CE 图标后，操作系统启动了一个 Electron 主进程。这个进程在 `app.whenReady()` 之后做了哪些初始化？为什么有些代码必须在其他代码之前执行？为什么有些服务要等窗口创建之后才初始化？

## 概念阶梯

### 第一层：Electron 主进程的角色

Electron 应用有**两类进程**：

- **主进程（main process）**：操作系统的直接对话者。它负责创建窗口、注册托盘、处理快捷键、管理文件系统和启动子进程。
- **渲染进程（renderer process）**：网页的运行环境。它加载 Next.js 页面，负责 UI 渲染和用户交互。

主进程是整个桌面应用的"总调度"。它决定数据在哪里、窗口怎样创建、日志怎样记录、健康怎样监控。所有桌面版能力都从 `main.ts` 的引导流程开始。

### 第二层：引导流程的四个阶段

`main.ts` 的引导流程可以分成四个阶段：

```text
阶段 1：进程级配置（同步，立即执行）
  ├─ 导入 setup-data-root（路径注入）
  ├─ macOS x64 ANGLE 修复
  ├─ app.setName('OriginOS CE')
  ├─ 开发态 userData 路径隔离
  ├─ 单实例锁
  └─ Windows AppUserModelId

阶段 2：app.whenReady() 回调（异步）
  ├─ 日志捕获初始化
  ├─ 进程健康监控启动
  ├─ 解析 renderer URL
  ├─ 等待 renderer 就绪
  └─ 创建所有服务和窗口

阶段 3：服务实例化（同步，在 whenReady 内）
  ├─ ElectronWindowManager
  ├─ LocalFileSystem / LocalAgentBridge
  ├─ TrayManager / ShortcutManager / AutoUpdaterManager
  ├─ DesktopSchedulerService
  └─ 12 个 IPC 服务

阶段 4：窗口创建与系统插件挂载
  ├─ createWindow() → 主窗口
  ├─ createDockWindow() → Dock 窗口
  ├─ trayManager.initialize()
  ├─ shortcutManager.initialize()
  └─ autoUpdaterManager.initialize() + scheduleAutoCheck()
```

### 第三层：为什么顺序很重要

引导流程中每一步都有严格的先后依赖：

1. **`setup-data-root` 必须是第一个 import**：它调用 `setElectronDataRoot()` 和 `setMonorepoRoot()` 覆写 Core 的路径解析。如果任何其他模块先导入，Core 的 `getDataRoot()` 会解析到错误的路径。
2. **单实例锁必须在 `whenReady()` 之前**：如果另一个实例已经在运行，当前进程必须立即退出，不能等到 `whenReady()` 再判断。
3. **日志捕获必须在服务实例化之前**：否则服务构造函数中的 `console.log` 不会被记录。
4. **renderer URL 解析必须在窗口创建之前**：`createWindow()` 需要知道加载哪个 URL。
5. **IPC 服务必须在窗口创建之前注册**：窗口加载后 renderer 可能立即发送 IPC 请求。

## 源码窗口

### 窗口 1：进程级配置（第 1–44 行）

```typescript
import './setup-data-root';
import { app, BrowserWindow, shell } from 'electron';
// ... 其他 import

if (process.platform === 'darwin' && process.arch === 'x64') {
  app.commandLine.appendSwitch('use-angle', 'gl');
}

app.setName('OriginOS CE');
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'OriginOS CE Dev'));
}
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}
if (process.platform === 'win32') {
  app.setAppUserModelId('com.originos.ce');
}
```

**逐行解读：**

- **第 1 行** `import './setup-data-root'`：副作用导入。这个模块在自身被加载时立即执行 `setElectronDataRoot()` 和 `setMonorepoRoot()`，覆写 Core 的路径解析。它必须在所有其他模块之前被导入，否则 Core 的 `getDataRoot()` 会解析到错误的路径。
- **第 30–32 行** macOS x64 ANGLE 修复：这是一个平台特定的 workaround。macOS 上的 Intel 架构在某些 GPU 驱动上有渲染问题，强制使用 ANGLE OpenGL 后端可以绕过。
- **第 34 行** `app.setName('OriginOS CE')`：设置应用名称。这会影响 `app.getPath('userData')` 的默认路径（macOS 上是 `~/Library/Application Support/OriginOS CE/`）。
- **第 35–37 行** 开发态 userData 隔离：开发态使用 `OriginOS CE Dev` 目录，避免开发时的数据覆盖打包版的数据。这是一个常见的 Electron 开发模式。
- **第 38–41 行** 单实例锁：`app.requestSingleInstanceLock()` 返回 `false` 表示已有实例在运行。当前进程立即退出。这防止了用户双击图标两次导致两个进程同时运行。
- **第 42–44 行** Windows AppUserModelId：Windows 任务栏用它来分组窗口。不设置的话，开发态和打包态的窗口会被分到不同的任务栏组。

### 窗口 2：模块级变量声明（第 46–59 行）

```typescript
let mainWindow: BrowserWindow | null = null;
let windowManager: ElectronWindowManager | null = null;
let localFileSystem: LocalFileSystem | null = null;
let localAgentBridge: LocalAgentBridge | null = null;
let trayManager: TrayManager | null = null;
let shortcutManager: ShortcutManager | null = null;
let autoUpdaterManager: AutoUpdaterManager | null = null;
let desktopSchedulerService: DesktopSchedulerService | null = null;
let rendererServerProcess: ChildProcess | null = null;
let packagedRendererUrlPromise: Promise<string> | null = null;
const ipcServices: unknown[] = [];
let llmLogCaptureInitialized = false;
let desktopLogCaptureInitialized = false;
let dailyLogWriter: BufferedDailyLogWriter | null = null;
```

这些变量全部用 `let` 声明，初始值为 `null`。它们在整个主进程生命周期中存在，在 `whenReady()` 回调中被赋值，在 `before-quit` 事件中被清理。

注意 `packagedRendererUrlPromise`：它用 `Promise<string> | null` 类型缓存了打包态 renderer URL 的解析结果。这确保了 `ensurePackagedRendererUrl()` 只启动一次 renderer 子进程，即使被多次调用。

`ipcServices` 用 `unknown[]` 类型——这是一个设计选择。每个 IPC 服务在构造函数中注册自己的 handler，主进程不需要知道它们的具体类型。

### 窗口 3：whenReady 回调（第 382–462 行）

```typescript
app.whenReady().then(() => {
  if (!hasSingleInstanceLock) {
    return;
  }
  void (async () => {
  const g = globalThis as Record<string, unknown>;
  if (g['__ipcHandlersRegistered']) return;
  g['__ipcHandlersRegistered'] = true;

  initializeDesktopLogCapture();
  initializeLlmLogCapture();
  processHealthMonitor.start();
  app.on('browser-window-created', (_event, browserWindow) => {
    processHealthMonitor.trackWindow(browserWindow);
  });

  const rendererUrl = !app.isPackaged
    ? resolveRendererUrl()
    : await ensurePackagedRendererUrl();

  if (!app.isPackaged) {
    await waitForRendererReady(rendererUrl, 60000);
  }

  if (rendererUrl) {
    process.env['ELECTRON_RENDERER_URL'] = rendererUrl;
  }

  windowManager = new ElectronWindowManager({
    preloadPath: resolvePreloadPath(),
    ...(rendererUrl ? { rendererUrl } : {}),
  });
  // ... 其他服务实例化
  mainWindow = createWindow();
  windowManager.setMainWindow(mainWindow);
  windowManager.createDockWindow();
  trayManager.initialize();
  // ... 快捷键、自动更新、调度器
  })().catch((error: unknown) => {
    console.error('[electron] Failed during app bootstrap', error);
    app.quit();
  });
});
```

**关键设计点：**

1. **`globalThis.__ipcHandlersRegistered` 守卫**：防止热重载时重复注册 IPC handler。Electron 的 `ipcMain.handle()` 在同一个 channel 上注册两次会抛异常。`globalThis` 跨模块重载保持不变，所以它是一个可靠的守卫。

2. **日志捕获先于一切**：`initializeDesktopLogCapture()` 和 `initializeLlmLogCapture()` 在所有服务之前调用。这样服务构造函数中的 `console.log` 也会被记录。

3. **renderer URL 解析的分支**：
   - 开发态：`resolveRendererUrl()` 从环境变量或命令行参数获取 URL，默认 `http://localhost:3000`。
   - 打包态：`ensurePackagedRendererUrl()` 启动一个 Next.js 独立服务器子进程，等待它就绪后返回 URL。

4. **`waitForRendererReady()`**：开发态下，Next.js dev server 可能还没启动完成。这个函数用轮询（每 250ms 一次）等待 renderer 返回 200，超时 60 秒。

5. **`process.env['ELECTRON_RENDERER_URL'] = rendererUrl`**：把解析后的 URL 写回环境变量。这样后续代码（如 `window-manager.ts`）可以通过环境变量获取它。

### 窗口 4：cleanup（第 481–492 行）

```typescript
app.on('before-quit', () => {
  processHealthMonitor.stop();
  void dailyLogWriter?.flush();
  windowManager?.closeAllWindows();
  localFileSystem?.dispose();
  void localAgentBridge?.shutdown();
  trayManager?.destroy();
  shortcutManager?.destroy();
  desktopSchedulerService?.stop();
  rendererServerProcess?.kill();
  rendererServerProcess = null;
});
```

`before-quit` 是 Electron 在退出前触发的最后一个事件。清理顺序是：

1. **停止健康监控**：不再需要检测事件循环卡顿。
2. **刷新日志缓冲**：`BufferedDailyLogWriter` 有缓冲，必须显式 flush 确保最后一批日志写入磁盘。
3. **关闭窗口**：触发所有窗口的 `closed` 事件。
4. **释放资源**：文件系统监听器、Agent 桥接、托盘、快捷键、调度器。
5. **杀掉 renderer 子进程**：打包态下启动的 Next.js 服务器子进程必须被显式杀掉，否则它会成为孤儿进程。

## 失败路径

### 失败 1：单实例锁获取失败

```text
用户双击图标 → 第二个进程启动 → requestSingleInstanceLock() 返回 false
→ app.quit() → 第二个进程退出 → 第一个进程收到 'second-instance' 事件
→ 恢复并聚焦已有窗口
```

如果没有单实例锁，两个进程会同时写入同一个数据目录，导致数据损坏。

### 失败 2：renderer 启动超时

```text
打包态 → ensurePackagedRendererUrl() → spawn Next.js 服务器
→ waitForRendererReady() 轮询 60 秒 → 超时
→ 抛出 Error → catch → console.error → app.quit()
```

超时可能是因为 `server.js` 文件缺失、端口被占用或 Node.js 版本不兼容。

### 失败 3：`setup-data-root` 导入顺序错误

```text
假设某个模块在 setup-data-root 之前被导入
→ 该模块调用 getDataRoot()
→ Core 的 _electronDataRoot 还没被设置
→ getDataRoot() 返回 monorepo 根目录的 data/
→ 打包态下这个路径不存在 → 运行时错误
```

这就是为什么 `setup-data-root` 必须是 `main.ts` 的第一行 import。

## 测试证据

本课内容对应的测试分散在多个文件中：

- `main.ts` 本身没有直接的单元测试（它是引导流程，不适合单元测试）。
- `setup-data-root.ts` 的效果通过集成测试验证：打包态下运行应用，检查 `getDataRoot()` 返回值。
- 单实例锁的行为通过手动测试验证：启动应用后再次双击图标，观察第一个窗口是否被聚焦。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么 `setup-data-root` 必须是第一个 import？如果把它移到 `import { ElectronWindowManager } from './window-manager'` 之后，会发生什么？

2. `app.setPath('userData', ...)` 在开发态被调用。如果不设置，开发态和打包态会共享同一个 userData 目录吗？这会有什么问题？

3. `globalThis.__ipcHandlersRegistered` 守卫的作用是什么？如果去掉它，在开发态热重载时会发生什么？

<details>
<summary>参考答案</summary>

1. `setup-data-root` 在导入时立即执行 `setElectronDataRoot()`。如果移到 `window-manager` 之后，`window-manager` 的导入链中如果有代码调用 `getDataRoot()`，会得到错误的路径（monorepo 根目录的 `data/` 而不是 `userData/data`）。

2. 不设置的话，开发态和打包态共享 `~/Library/Application Support/OriginOS CE/`。开发时的测试数据会覆盖打包版的生产数据，反之亦然。

3. 开发态下，ESBuild 或 Webpack 的热重载会重新执行 `main.ts`。`ipcMain.handle()` 在同一个 channel 上注册两次会抛异常。`globalThis` 守卫确保 IPC handler 只注册一次。

</details>

### 练习 2（源码阅读）

阅读 `main.ts` 第 255–316 行的 `ensurePackagedRendererUrl()` 函数，回答：

1. 为什么用 `packagedRendererUrlPromise` 缓存 Promise 而不是缓存 URL 字符串？
2. `rendererServerProcess` 的 `exit` 事件处理中，为什么要把 `packagedRendererUrlPromise` 重置为 `null`？
3. 子进程的环境变量中为什么要显式注入 `HOME` 和 `USERPROFILE`？

<details>
<summary>参考答案</summary>

1. 缓存 Promise 可以防止并发调用时启动多个子进程。如果缓存 URL 字符串，第一次调用还没完成时第二次调用就会启动另一个子进程。

2. 子进程退出后，`packagedRendererUrlPromise` 指向的 Promise 已经 resolved 到一个无效的 URL。重置为 `null` 允许下次调用时重新启动子进程。

3. 注释说明了原因：Windows 打包态曾出现子进程继承异常 HOME（`/workspace`），导致 Git Bash/MSYS 回退到挂载根，技能会话工作目录错乱。显式注入确保子进程使用正确的用户目录。

</details>

## 口头验收

完成本课后，你应该能用 60 秒口头描述：

> "用户双击图标后，Electron 启动主进程。第一件事是导入 `setup-data-root` 注入路径——打包态指向 `userData/data`，开发态用 monorepo 的 `data/`。然后设置应用名、隔离开发态 userData、获取单实例锁。`app.whenReady()` 之后，先初始化日志捕获和健康监控，再解析 renderer URL——开发态从环境变量获取，打包态启动一个 Next.js 子进程。然后创建 12 个 IPC 服务、主窗口和 Dock 窗口，挂载托盘、快捷键和自动更新。退出时 `before-quit` 按相反顺序清理：停监控、刷日志、关窗口、释放资源、杀子进程。"

## 下一课预告

K01 讲了主进程的引导流程，但数据目录的具体解析逻辑在 `setup-data-root.ts` 和 `paths.ts` 中。K02 会深入这两个文件，解释打包态和开发态的路径解析差异，以及 Core 的 `getDataRoot()` 怎样被覆写。
