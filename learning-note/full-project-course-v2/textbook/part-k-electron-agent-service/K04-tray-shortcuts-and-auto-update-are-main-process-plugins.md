# K04 · 托盘、快捷键和自动更新怎样挂在主进程上

> **课号** K04 · **轨道** T13 · **文件** `tray-manager.ts` · `shortcuts.ts` · `auto-updater.ts` · `devtools-context-menu.ts` · **预计阅读** 30 分钟

---

## 本课要回答的问题

K03 讲了窗口管理。但桌面应用不只有窗口——它还有系统托盘、全局快捷键和自动更新。这些"系统插件"怎样挂在主进程上？它们和窗口管理器之间怎样协作？自动更新的状态机是怎样设计的？

## 概念阶梯

### 第一层：三类系统插件

| 插件 | 职责 | 和用户的关系 |
| --- | --- | --- |
| **TrayManager** | 系统托盘图标 + 右键菜单 | 用户点击托盘图标时看到 |
| **ShortcutManager** | 全局快捷键注册 | 用户随时按下快捷键时触发 |
| **AutoUpdaterManager** | 自动检查/下载/安装更新 | 后台运行，弹窗询问用户 |

### 第二层：回调注入模式

`ShortcutManager` 不直接操作窗口管理器。它用**回调注入**模式：

```typescript
// main.ts 中
shortcutManager.setDockToggle(() => windowManager?.toggleDock());
shortcutManager.setSpotlightToggle(() => {
  mainWindow?.webContents.send('toggle-spotlight');
  mainWindow?.show();
  mainWindow?.focus();
});
```

快捷键管理器只负责"什么时候触发"，具体"做什么"由外部注入。这解耦了快捷键注册和业务逻辑。

### 第三层：自动更新的状态机

`AutoUpdaterManager` 是一个完整的状态机：

```text
idle → checking → available → downloading → downloaded → (quitAndInstall)
                  ↓                        ↓
              not-available              error
```

每个状态转换都通过 `setState()` 更新内部状态并通过 `emitState()` 广播到所有窗口。renderer 通过 IPC 订阅 `UPDATE_EVENT` 来显示更新 UI。

## 源码窗口

### 窗口 1：TrayManager — 托盘图标和菜单（第 14–81 行）

```typescript
initialize(): void {
  const icon = this.loadTrayIcon();
  if (!icon) return;

  this.tray = new Tray(icon);
  this.tray.setToolTip('OriginOS CE');
  this.tray.on('click', () => this.showMainWindow());
  this.refreshMenu();
}

private refreshMenu(): void {
  if (!this.tray) return;

  const recentProjectItems = this.recentProjects.length > 0
    ? this.recentProjects.map((project) => ({
        label: project.name,
        click: () => this.openProject(project.id),
      }))
    : [{ label: '无最近项目', enabled: false }];

  const menu = Menu.buildFromTemplate([
    { label: '打开 OriginOS', click: () => this.showMainWindow() },
    { label: '快速启动', click: () => this.showQuickLauncher() },
    { type: 'separator' },
    { label: '最近项目', submenu: recentProjectItems },
    { type: 'separator' },
    {
      label: '开机自启动',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked });
      },
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);

  this.tray.setContextMenu(menu);
}
```

**设计要点：**

1. **图标加载**：`loadTrayIcon()` 先找 `tray-iconTemplate.png`（macOS 模板图标，自动适配深浅色），再找 `tray-icon.png`。找不到时静默跳过，不崩溃。
2. **macOS 模板图标**：`image.setTemplateImage(true)` 告诉 macOS 这是模板图标，系统会自动反转颜色适配菜单栏。
3. **最近项目**：最多 5 个，通过 `updateRecentProjects()` 更新。点击后通过 `webContents.send('open-project', { projectId })` 通知 renderer。
4. **快速启动**：通过 `webContents.send('show-quick-launcher')` 通知 renderer 显示快速启动面板。
5. **开机自启动**：`app.getLoginItemSettings().openAtLogin` 读取当前状态，`app.setLoginItemSettings()` 切换。

### 窗口 2：ShortcutManager — 全局快捷键（第 15–38 行）

```typescript
initialize(): void {
  globalShortcut.register('CmdOrCtrl+Shift+D', () => {
    this.toggleDockCallback?.();
  });

  globalShortcut.register('CmdOrCtrl+K', () => {
    this.toggleSpotlightCallback?.();
  });

  globalShortcut.register('CmdOrCtrl+Shift+O', () => {
    this.toggleSpotlightCallback?.();
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return;
    mainWindow.webContents.send('show-quick-launcher');
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

destroy(): void {
  globalShortcut.unregisterAll();
}
```

**三个快捷键：**

| 快捷键 | 功能 | 实现 |
| --- | --- | --- |
| `CmdOrCtrl+Shift+D` | 切换 Dock 显示/隐藏 | 回调注入 `toggleDockCallback` |
| `CmdOrCtrl+K` | 切换 Spotlight | 回调注入 `toggleSpotlightCallback` |
| `CmdOrCtrl+Shift+O` | 快速启动器 | 直接发送 IPC + 聚焦主窗口 |

**注意**：`CmdOrCtrl+Shift+O` 没有用回调注入，而是直接操作主窗口。这是因为快速启动器总是作用于主窗口，不需要外部定义行为。

### 窗口 3：AutoUpdaterManager — 状态机和事件绑定（第 85–131 行）

```typescript
export class AutoUpdaterManager {
  private mainWindow: BrowserWindow | null = null;
  private updater: UpdaterModule['autoUpdater'] | null = null;
  private isChecking = false;
  private handlersRegistered = false;
  private lastCheckWasManual = false;
  private lastDownloadWasManual = false;
  private state: UpdateState = {
    status: app.isPackaged ? 'idle' : 'unsupported',
    available: false,
    currentVersion: app.getVersion(),
    ...(app.isPackaged ? {} : { error: '自动更新仅在已打包桌面应用中可用。' }),
  };

  async initialize(): Promise<void> {
    this.registerIpcHandlers();

    if (!app.isPackaged) {
      console.log('[auto-updater] Skipping initialization in development mode');
      this.emitState();
      return;
    }

    const updaterModule = await this.loadOptionalModule<UpdaterModule>('electron-updater');
    if (!updaterModule?.autoUpdater) {
      this.setState({ status: 'unsupported', available: false,
        error: 'electron-updater is not available in this runtime.' });
      return;
    }

    this.updater = updaterModule.autoUpdater;
    this.updater.autoDownload = false;           // 不自动下载
    this.updater.autoInstallOnAppQuit = true;    // 退出时自动安装

    const loggerModule = await this.loadOptionalModule<LoggerModule>('electron-log');
    if (loggerModule?.default) {
      this.updater.logger = loggerModule.default;
    }

    this.bindEvents();
    this.emitState();
  }
}
```

**关键设计：**

1. **开发态跳过**：`app.isPackaged` 为 `false` 时，状态设为 `unsupported`，不加载 `electron-updater`。
2. **动态导入**：`loadOptionalModule()` 用 `await import()` 加载 `electron-updater` 和 `electron-log`。如果没安装，返回 `null` 而不是崩溃。
3. **`autoDownload: false`**：发现更新后不自动下载，先弹窗询问用户。
4. **`autoInstallOnAppQuit: true`**：如果用户下载了更新但没安装，退出应用时自动安装。

### 窗口 4：状态转换和事件绑定（第 275–345 行）

```typescript
private bindEvents(): void {
  this.updater.on('checking-for-update', () => {
    this.setState({ status: 'checking', error: undefined,
      lastCheckedAt: new Date().toISOString() });
  });

  this.updater.on('update-available', (...args: unknown[]) => {
    const info = (args[0] ?? {}) as UpdateInfo;
    this.setState({ status: 'available', available: true, updateInfo: info });

    if (!this.lastCheckWasManual) {
      void this.promptDownload(info);  // 自动检查 → 弹窗询问下载
    }
  });

  this.updater.on('update-downloaded', (...args: unknown[]) => {
    const info = (args[0] ?? this.state.updateInfo ?? {}) as UpdateInfo;
    this.setState({ status: 'downloaded', available: true, updateInfo: info });

    if (!this.lastDownloadWasManual) {
      void this.promptInstall(info);  // 自动下载 → 弹窗询问安装
    }
    this.lastDownloadWasManual = false;
  });

  this.updater.on('error', (error: unknown) => {
    this.setState({ status: 'error',
      error: error instanceof Error ? error.message : 'Auto updater error' });
  });
}
```

**`lastCheckWasManual` 的作用：**

- 自动检查（`scheduleAutoCheck()`）：`lastCheckWasManual = false` → 发现更新后自动弹窗询问下载。
- 手动检查（IPC `UPDATE_CHECK`）：`lastCheckWasManual = true` → 不弹窗，只更新状态让 renderer 显示。

这防止了自动检查时弹出两个对话框（"发现更新" + "是否下载"），同时让手动检查时 renderer 可以控制 UI 流程。

### 窗口 5：弹窗和 IPC 广播（第 347–401 行）

```typescript
private async promptDownload(info: UpdateInfo): Promise<void> {
  const options: MessageBoxOptions = {
    type: 'info',
    title: '发现新版本',
    message: `OriginOS CE ${info.version ?? ''} 可用`,
    detail: this.formatReleaseNotes(info) ?? '是否现在下载更新？',
    buttons: ['下载更新', '稍后提醒'],
    defaultId: 0,
    cancelId: 1,
  };
  const { response } = this.mainWindow && !this.mainWindow.isDestroyed()
    ? await dialog.showMessageBox(this.mainWindow, options)
    : await dialog.showMessageBox(options);

  if (response === 0) {
    await this.downloadUpdate({ manual: false });
  }
}

private emitState(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.UPDATE_EVENT, this.getState());
    }
  }
}
```

**`emitState()`** 每次状态变化时广播到所有窗口。renderer 通过 `window.electron.ipcRenderer.on('update:event', callback)` 订阅，更新 UI。

### 窗口 6：devtools-context-menu.ts（40 行）

```typescript
export function attachDevToolsContextMenu(window: BrowserWindow): void {
  window.webContents.on('context-menu', (_event, params) => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Inspect Element',
        click: () => window.webContents.inspectElement(params.x, params.y),
      },
      {
        label: 'Open DevTools',
        click: () => window.webContents.openDevTools({ mode: 'detach' }),
      },
      {
        label: 'Reload Window',
        click: () => window.webContents.reload(),
      },
    ]);
    menu.popup({ window });
  });
}
```

开发态下的右键菜单。生产环境也应该有（`attachDevToolsContextMenu` 在主窗口和 Dock 窗口上都被调用），但 `contextIsolation: true` 和 `nodeIntegration: false` 确保了安全性。

## 失败路径

### 失败 1：托盘图标找不到

`loadTrayIcon()` 找不到图标文件时返回 `null`，`initialize()` 静默跳过。用户看不到托盘图标但应用不崩溃。

### 失败 2：electron-updater 没安装

`loadOptionalModule('electron-updater')` 返回 `null`，状态设为 `unsupported`。用户看到"自动更新不可用"但不崩溃。

### 失败 3：快捷键注册冲突

如果另一个应用已经注册了 `CmdOrCtrl+Shift+D`，`globalShortcut.register()` 会静默失败。用户按快捷键没有反应但应用不崩溃。

### 失败 4：更新检查网络错误

`checkForUpdates()` 的 `catch` 捕获网络错误，状态设为 `not-available`。不会弹窗打扰用户。

## 测试证据

系统插件的正确性通过以下方式验证：

- **托盘**：启动应用，检查菜单栏/系统托盘是否出现图标。右键检查菜单项。点击"打开 OriginOS"检查主窗口是否聚焦。
- **快捷键**：按 `CmdOrCtrl+Shift+D` 检查 Dock 是否切换。按 `CmdOrCtrl+Shift+O` 检查快速启动器是否出现。
- **自动更新**：开发态检查状态是否为 `unsupported`。打包态检查 30 秒后是否自动检查更新。
- **右键菜单**：在主窗口右键检查是否出现 Inspect Element / Open DevTools / Reload Window。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么 `ShortcutManager` 用回调注入而不是直接依赖 `WindowManager`？
2. `autoDownload: false` 和 `autoInstallOnAppQuit: true` 的组合意味着什么？
3. `lastCheckWasManual` 的作用是什么？如果去掉它会怎样？

<details>
<summary>参考答案</summary>

1. 回调注入解耦了快捷键注册和业务逻辑。`ShortcutManager` 不需要知道 Dock 怎样切换，只需要在快捷键按下时调用回调。这允许在不修改 `ShortcutManager` 的情况下改变行为。

2. 发现更新后不自动下载（先弹窗询问），但退出时自动安装已下载的更新。这平衡了用户控制权（不强制下载）和便利性（退出时自动安装）。

3. 区分自动检查和手动检查。自动检查发现更新后弹窗询问下载；手动检查不弹窗，只更新状态让 renderer 控制 UI。去掉后自动检查也会弹窗，但 renderer 无法知道用户是否主动检查。

</details>

### 练习 2（源码阅读）

阅读 `AutoUpdaterManager` 的 `registerIpcHandlers()` 方法（第 250–273 行），回答：

1. 为什么每个 `ipcMain.handle()` 之前都有 `ipcMain.removeHandler()`？
2. `UPDATE_INSTALL` 的 handler 为什么用 `fail()` 返回错误而不是直接抛出异常？
3. `handlersRegistered` 守卫和 `removeHandler` 的作用是否重复？

<details>
<summary>参考答案</summary>

1. `ipcMain.handle()` 在同一个 channel 上注册两次会抛异常。`removeHandler()` 先移除已有的 handler，确保注册不会冲突。这在热重载时特别重要。

2. IPC handler 不应该抛出异常——异常会被 Electron 序列化为错误响应，但格式不可控。用 `fail()` 返回统一的 `{ success: false, error: { code, message } }` 格式，renderer 可以统一处理。

3. 不完全重复。`handlersRegistered` 防止重复注册（性能优化），`removeHandler` 防止注册冲突（安全兜底）。两者配合确保即使 `handlersRegistered` 守卫被绕过，注册也不会失败。

</details>

## 口头验收

完成本课后，你应该能用 60 秒口头描述：

> "三个系统插件挂在主进程上。TrayManager 加载模板图标，构建右键菜单：打开主窗口、快速启动、最近项目（最多 5 个）、开机自启动、退出。通过 `webContents.send()` 和 renderer 通信。ShortcutManager 注册三个全局快捷键：`CmdOrCtrl+Shift+D` 切换 Dock、`CmdOrCtrl+K` 切换 Spotlight、`CmdOrCtrl+Shift+O` 快速启动。用回调注入解耦注册和行为。AutoUpdaterManager 是状态机：idle → checking → available → downloading → downloaded。动态导入 `electron-updater`，开发态跳过。`lastCheckWasManual` 区分自动/手动检查——自动检查弹窗询问下载，手动检查只更新状态。每次状态变化通过 `emitState()` 广播到所有窗口。"

## 下一课预告

K04 讲了系统插件。K05 会进入日志系统——`console.log` 怎样被拦截并分流到桌面日志和 LLM 日志。
