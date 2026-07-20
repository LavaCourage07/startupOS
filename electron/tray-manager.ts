import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

interface RecentProject {
  id: string;
  name: string;
}

export class TrayManager {
  private tray: Tray | null = null;
  private recentProjects: RecentProject[] = [];

  initialize(): void {
    const icon = this.loadTrayIcon();
    if (!icon) {
      return;
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip('OriginOS CE');
    this.tray.on('click', () => {
      this.showMainWindow();
    });
    this.refreshMenu();
  }

  updateRecentProjects(projects: RecentProject[]): void {
    this.recentProjects = projects.slice(0, 5);
    this.refreshMenu();
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  private refreshMenu(): void {
    if (!this.tray) {
      return;
    }

    const recentProjectItems = this.recentProjects.length > 0
      ? this.recentProjects.map((project) => ({
          label: project.name,
          click: () => this.openProject(project.id),
        }))
      : [{ label: '无最近项目', enabled: false }];

    const menu = Menu.buildFromTemplate([
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
        checked: app.getLoginItemSettings().openAtLogin,
        click: (menuItem) => {
          app.setLoginItemSettings({ openAtLogin: menuItem.checked });
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => app.quit(),
      },
    ]);

    this.tray.setContextMenu(menu);
  }

  private showMainWindow(): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }

  private showQuickLauncher(): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      return;
    }

    mainWindow.webContents.send('show-quick-launcher');
    mainWindow.show();
    mainWindow.focus();
  }

  private openProject(projectId: string): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      return;
    }

    mainWindow.webContents.send('open-project', { projectId });
    mainWindow.show();
    mainWindow.focus();
  }

  private loadTrayIcon() {
    const resourceRoot = app.isPackaged ? process.resourcesPath : process.cwd();
    const candidates = [
      path.join(resourceRoot, 'resources/icons/tray-iconTemplate.png'),
      path.join(resourceRoot, 'resources/icons/tray-icon.png'),
    ];

    const iconPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!iconPath) {
      return null;
    }

    const image = nativeImage.createFromPath(iconPath);
    if (process.platform === 'darwin') {
      image.setTemplateImage(true);
    }
    return image;
  }
}
