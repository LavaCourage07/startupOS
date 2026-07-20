"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./setup-data-root");
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const node_net_1 = __importDefault(require("node:net"));
const node_fs_1 = require("node:fs");
const node_util_1 = __importDefault(require("node:util"));
const window_manager_1 = require("./window-manager");
const local_fs_1 = require("./local-fs");
const local_agent_bridge_1 = require("./local-agent-bridge");
const tray_manager_1 = require("./tray-manager");
const shortcuts_1 = require("./shortcuts");
const auto_updater_1 = require("./auto-updater");
const skill_service_1 = require("./services/skill-service");
const project_service_1 = require("./services/project-service");
const ontology_service_1 = require("./services/ontology-service");
const user_registry_service_1 = require("./services/user-registry-service");
const misc_service_1 = require("./services/misc-service");
const ontology_data_service_1 = require("./services/ontology-data-service");
const collaboration_service_1 = require("./services/collaboration-service");
const agent_session_service_1 = require("./services/agent-session-service");
const agent_project_service_1 = require("./services/agent-project-service");
const workspace_service_1 = require("./services/workspace-service");
const desktop_scheduler_service_1 = require("./services/desktop-scheduler-service");
const devtools_context_menu_1 = require("./devtools-context-menu");
if (process.platform === 'darwin' && process.arch === 'x64') {
    electron_1.app.commandLine.appendSwitch('use-angle', 'gl');
}
electron_1.app.setName('OriginOS CE');
if (process.platform === 'win32') {
    electron_1.app.setAppUserModelId('com.originos.ce');
}
let mainWindow = null;
let windowManager = null;
let localFileSystem = null;
let localAgentBridge = null;
let trayManager = null;
let shortcutManager = null;
let autoUpdaterManager = null;
let desktopSchedulerService = null;
let rendererServerProcess = null;
let packagedRendererUrlPromise = null;
const ipcServices = [];
let llmLogCaptureInitialized = false;
let desktopLogCaptureInitialized = false;
let desktopLogPath = null;
const llmLogPrefixes = [
    '[LLM',
    '[createRuntimeModel]',
    '[createOriginOSAgent]',
    '[OriginOSAgent]',
    '[streamFn]',
    '[anthropic stream]',
    '[AgentLoop]',
    '[renderer]',
    '[IPC]',
    '[AgentSessionService]',
    '[AgentManager]',
    '[WorkspaceService]',
    '[MiscService]',
    '[SkillService]',
    '[SkillLauncher]',
    '[ProjectService]',
    '[OntologyService]',
    '[OntologyDataService]',
    '[CollaborationService]',
    '[AgentProjectService]',
    '[DesktopSchedulerService]',
    '[PersistentAgent]',
    '[setup-data-root]',
    '[LocalFS]',
    '[MultiAgentRuntime]',
];
function serializeConsoleArgs(args) {
    return args.map((arg) => {
        if (typeof arg === 'string') {
            return arg;
        }
        return node_util_1.default.inspect(arg, {
            depth: 6,
            breakLength: 120,
            maxArrayLength: 50,
            maxStringLength: 4000,
            compact: false,
        });
    }).join(' ');
}
function shouldWriteLlmLog(line) {
    return llmLogPrefixes.some((prefix) => line.includes(prefix));
}
function appendDesktopLog(line) {
    if (!desktopLogPath) {
        return;
    }
    try {
        (0, node_fs_1.appendFileSync)(desktopLogPath, `[${new Date().toISOString()}] ${line}\n`, 'utf8');
    }
    catch {
        // Do not recurse through console while patching console methods.
    }
}
function initializeDesktopLogCapture() {
    if (desktopLogCaptureInitialized) {
        return;
    }
    desktopLogCaptureInitialized = true;
    const logsDir = electron_1.app.getPath('logs');
    (0, node_fs_1.mkdirSync)(logsDir, { recursive: true });
    desktopLogPath = node_path_1.default.join(logsDir, 'desktop.log');
    for (const methodName of ['log', 'warn', 'error']) {
        const original = console[methodName].bind(console);
        console[methodName] = (...args) => {
            appendDesktopLog(`${methodName.toUpperCase()} ${serializeConsoleArgs(args)}`);
            original(...args);
        };
    }
    process.on('uncaughtException', (error) => {
        appendDesktopLog(`UNCAUGHT_EXCEPTION ${serializeConsoleArgs([error])}`);
    });
    process.on('unhandledRejection', (reason) => {
        appendDesktopLog(`UNHANDLED_REJECTION ${serializeConsoleArgs([reason])}`);
    });
    console.log(`[desktop-log] capturing desktop logs to ${desktopLogPath}`);
}
function initializeLlmLogCapture() {
    if (llmLogCaptureInitialized) {
        return;
    }
    llmLogCaptureInitialized = true;
    const logsDir = electron_1.app.getPath('logs');
    (0, node_fs_1.mkdirSync)(logsDir, { recursive: true });
    const llmLogPath = node_path_1.default.join(logsDir, 'llm.log');
    for (const methodName of ['log', 'warn', 'error']) {
        const original = console[methodName].bind(console);
        console[methodName] = (...args) => {
            const line = serializeConsoleArgs(args);
            if (shouldWriteLlmLog(line)) {
                const timestamp = new Date().toISOString();
                try {
                    (0, node_fs_1.appendFileSync)(llmLogPath, `[${timestamp}] ${line}\n`, 'utf8');
                }
                catch (error) {
                    original('[llm-log] Failed to write log file', error);
                }
            }
            original(...args);
        };
    }
    console.log(`[llm-log] capturing LLM logs to ${llmLogPath}`);
}
function resolvePreloadPath() {
    return node_path_1.default.join(__dirname, 'preload.js');
}
function resolveRendererUrl() {
    const explicitUrl = process.env['ELECTRON_RENDERER_URL'];
    if (explicitUrl) {
        return explicitUrl;
    }
    if (!electron_1.app.isPackaged) {
        return 'http://localhost:3000';
    }
    throw new Error('Packaged Electron renderer URL is not configured. Set ELECTRON_RENDERER_URL before launching the packaged app.');
}
function getPackagedWebRoot() {
    return node_path_1.default.join(process.resourcesPath, 'web');
}
async function findAvailablePort() {
    return await new Promise((resolve, reject) => {
        const server = node_net_1.default.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                server.close(() => reject(new Error('Failed to resolve local port')));
                return;
            }
            const { port } = address;
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(port);
            });
        });
    });
}
async function waitForRendererReady(rendererUrl, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(rendererUrl, { method: 'GET' });
            if (response.ok) {
                return;
            }
            lastError = new Error(`Renderer responded with status ${response.status}`);
        }
        catch (error) {
            lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Timed out waiting for renderer: ${String(lastError)}`);
}
async function waitForTcpPort(port, host = '127.0.0.1', timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
        try {
            await new Promise((resolve, reject) => {
                const socket = node_net_1.default.createConnection({ host, port });
                socket.once('connect', () => {
                    socket.end();
                    resolve();
                });
                socket.once('error', reject);
                socket.setTimeout(1000, () => {
                    socket.destroy(new Error(`Timed out connecting to ${host}:${port}`));
                });
            });
            return;
        }
        catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }
    throw new Error(`Timed out waiting for renderer TCP port: ${String(lastError)}`);
}
async function ensurePackagedRendererUrl() {
    if (packagedRendererUrlPromise) {
        return packagedRendererUrlPromise;
    }
    packagedRendererUrlPromise = (async () => {
        const explicitUrl = process.env['ELECTRON_RENDERER_URL'];
        if (explicitUrl) {
            return explicitUrl;
        }
        const standaloneRoot = getPackagedWebRoot();
        const webRoot = node_path_1.default.join(standaloneRoot, 'packages', 'web');
        const serverPath = node_path_1.default.join(webRoot, 'server.js');
        const port = await findAvailablePort();
        const rendererUrl = `http://127.0.0.1:${port}`;
        const dataRoot = node_path_1.default.join(electron_1.app.getPath('userData'), 'data');
        // 显式注入 HOME / USERPROFILE，避免子进程（web server 及其 spawn 的
        // bash 子进程）继承异常 HOME，导致 Git Bash/MSYS 回退到挂载根
        // （Windows 打包态曾表现为 /workspace，使技能会话工作目录错乱）。
        const homeDir = electron_1.app.getPath('home');
        (0, node_fs_1.mkdirSync)(dataRoot, { recursive: true });
        console.log('[renderer] packaged server env', {
            rendererUrl,
            dataRoot,
            monorepoRoot: process.resourcesPath,
        });
        rendererServerProcess = (0, node_child_process_1.spawn)(process.execPath, [serverPath], {
            cwd: standaloneRoot,
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: '1',
                DATA_ROOT: dataRoot,
                MONOREPO_ROOT: process.resourcesPath,
                HOME: homeDir,
                USERPROFILE: homeDir,
                HOSTNAME: '127.0.0.1',
                PORT: String(port),
                NODE_ENV: 'production',
            },
            stdio: 'pipe',
        });
        rendererServerProcess.stdout?.on('data', (chunk) => {
            console.log(`[renderer] ${String(chunk).trimEnd()}`);
        });
        rendererServerProcess.stderr?.on('data', (chunk) => {
            console.error(`[renderer] ${String(chunk).trimEnd()}`);
        });
        rendererServerProcess.once('exit', (code, signal) => {
            console.warn(`[renderer] exited code=${code ?? 'null'} signal=${signal ?? 'null'}`);
            rendererServerProcess = null;
            packagedRendererUrlPromise = null;
        });
        await waitForRendererReady(rendererUrl);
        return rendererUrl;
    })();
    return packagedRendererUrlPromise;
}
async function loadRenderer(window) {
    const isDevelopment = !electron_1.app.isPackaged;
    const rendererUrl = isDevelopment
        ? resolveRendererUrl()
        : await ensurePackagedRendererUrl();
    if (isDevelopment) {
        const rendererAddress = new URL(rendererUrl);
        await waitForTcpPort(rendererAddress.port ? Number(rendererAddress.port) : 80, rendererAddress.hostname, 60000);
        await window.loadURL(rendererUrl);
        window.webContents.openDevTools({ mode: 'detach' });
        return;
    }
    await window.loadURL(rendererUrl);
}
function createWindow() {
    const window = new electron_1.BrowserWindow({
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
    (0, devtools_context_menu_1.attachDevToolsContextMenu)(window);
    void loadRenderer(window).catch((error) => {
        console.error('[electron] Failed to load renderer', error);
    });
    // Open external links in default browser instead of new Electron window
    window.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http:') || url.startsWith('https:')) {
            electron_1.shell.openExternal(url);
        }
        return { action: 'deny' };
    });
    window.on('closed', () => {
        if (mainWindow === window) {
            mainWindow = null;
        }
    });
    return window;
}
electron_1.app.whenReady().then(() => {
    void (async () => {
        // 防止热重载时重复初始化 IPC handlers（globalThis 跨模块重载保持不变）
        const g = globalThis;
        if (g['__ipcHandlersRegistered'])
            return;
        g['__ipcHandlersRegistered'] = true;
        initializeDesktopLogCapture();
        initializeLlmLogCapture();
        const rendererUrl = !electron_1.app.isPackaged
            ? resolveRendererUrl()
            : await ensurePackagedRendererUrl();
        if (rendererUrl) {
            process.env['ELECTRON_RENDERER_URL'] = rendererUrl;
        }
        windowManager = new window_manager_1.ElectronWindowManager({
            preloadPath: resolvePreloadPath(),
            ...(rendererUrl ? { rendererUrl } : {}),
        });
        localFileSystem = new local_fs_1.LocalFileSystem();
        localAgentBridge = new local_agent_bridge_1.LocalAgentBridge();
        trayManager = new tray_manager_1.TrayManager();
        shortcutManager = new shortcuts_1.ShortcutManager();
        autoUpdaterManager = new auto_updater_1.AutoUpdaterManager();
        desktopSchedulerService = new desktop_scheduler_service_1.DesktopSchedulerService();
        ipcServices.push(new skill_service_1.SkillService());
        ipcServices.push(new project_service_1.ProjectService());
        ipcServices.push(new ontology_service_1.OntologyService());
        ipcServices.push(new user_registry_service_1.UserRegistryService());
        ipcServices.push(new misc_service_1.MiscService());
        ipcServices.push(new ontology_data_service_1.OntologyDataService());
        ipcServices.push(new collaboration_service_1.CollaborationService());
        ipcServices.push(new agent_session_service_1.AgentSessionService());
        ipcServices.push(new agent_project_service_1.AgentProjectService());
        ipcServices.push(new workspace_service_1.WorkspaceService());
        mainWindow = createWindow();
        windowManager.setMainWindow(mainWindow);
        windowManager.createDockWindow();
        trayManager.initialize();
        shortcutManager.setDockToggle(() => windowManager?.toggleDock());
        shortcutManager.setSpotlightToggle(() => {
            mainWindow?.webContents.send('toggle-spotlight');
            mainWindow?.show();
            mainWindow?.focus();
        });
        shortcutManager.initialize();
        autoUpdaterManager.setMainWindow(mainWindow);
        void autoUpdaterManager.initialize().then(() => {
            autoUpdaterManager?.scheduleAutoCheck();
        });
        desktopSchedulerService.start();
        electron_1.app.on('activate', () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                mainWindow = createWindow();
                windowManager?.setMainWindow(mainWindow);
                if (mainWindow) {
                    autoUpdaterManager?.setMainWindow(mainWindow);
                }
            }
        });
    })().catch((error) => {
        console.error('[electron] Failed during app bootstrap', error);
        electron_1.app.quit();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', () => {
    windowManager?.closeAllWindows();
    localFileSystem?.dispose();
    void localAgentBridge?.shutdown();
    trayManager?.destroy();
    shortcutManager?.destroy();
    desktopSchedulerService?.stop();
    rendererServerProcess?.kill();
    rendererServerProcess = null;
});
