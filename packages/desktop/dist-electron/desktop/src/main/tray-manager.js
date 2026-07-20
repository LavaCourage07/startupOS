"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrayManager = void 0;
const electron_1 = require("electron");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
class TrayManager {
    constructor() {
        this.tray = null;
        this.recentProjects = [];
    }
    initialize() {
        const icon = this.loadTrayIcon();
        if (!icon) {
            return;
        }
        this.tray = new electron_1.Tray(icon);
        this.tray.setToolTip('OriginOS CE');
        this.tray.on('click', () => {
            this.showMainWindow();
        });
        this.refreshMenu();
    }
    updateRecentProjects(projects) {
        this.recentProjects = projects.slice(0, 5);
        this.refreshMenu();
    }
    destroy() {
        this.tray?.destroy();
        this.tray = null;
    }
    refreshMenu() {
        if (!this.tray) {
            return;
        }
        const recentProjectItems = this.recentProjects.length > 0
            ? this.recentProjects.map((project) => ({
                label: project.name,
                click: () => this.openProject(project.id),
            }))
            : [{ label: '无最近项目', enabled: false }];
        const menu = electron_1.Menu.buildFromTemplate([
            {
                label: '打开 OriginOS',
                click: () => this.showMainWindow(),
            },
            {
                label: '快速启动',
                click: () => this.showQuickLauncher(),
            },
            { type: 'separator' },
            {
                label: '最近项目',
                submenu: recentProjectItems,
            },
            { type: 'separator' },
            {
                label: '开机自启动',
                type: 'checkbox',
                checked: electron_1.app.getLoginItemSettings().openAtLogin,
                click: (menuItem) => {
                    electron_1.app.setLoginItemSettings({ openAtLogin: menuItem.checked });
                },
            },
            { type: 'separator' },
            {
                label: '退出',
                click: () => electron_1.app.quit(),
            },
        ]);
        this.tray.setContextMenu(menu);
    }
    showMainWindow() {
        const mainWindow = electron_1.BrowserWindow.getAllWindows()[0];
        if (!mainWindow) {
            return;
        }
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
    }
    showQuickLauncher() {
        const mainWindow = electron_1.BrowserWindow.getAllWindows()[0];
        if (!mainWindow) {
            return;
        }
        mainWindow.webContents.send('show-quick-launcher');
        mainWindow.show();
        mainWindow.focus();
    }
    openProject(projectId) {
        const mainWindow = electron_1.BrowserWindow.getAllWindows()[0];
        if (!mainWindow) {
            return;
        }
        mainWindow.webContents.send('open-project', { projectId });
        mainWindow.show();
        mainWindow.focus();
    }
    loadTrayIcon() {
        const resourceRoot = electron_1.app.isPackaged ? process.resourcesPath : process.cwd();
        const candidates = [
            node_path_1.default.join(resourceRoot, 'resources/icons/tray-iconTemplate.png'),
            node_path_1.default.join(resourceRoot, 'resources/icons/tray-icon.png'),
        ];
        const iconPath = candidates.find((candidate) => node_fs_1.default.existsSync(candidate));
        if (!iconPath) {
            return null;
        }
        const image = electron_1.nativeImage.createFromPath(iconPath);
        if (process.platform === 'darwin') {
            image.setTemplateImage(true);
        }
        return image;
    }
}
exports.TrayManager = TrayManager;
