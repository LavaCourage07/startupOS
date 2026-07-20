/**
 * OS.9: ViewReconciler 适配器
 * 整合 view-manager, view-reconciler, neural-channel
 */

import { AppWindowContent, ViewContent } from '@originos/core/types';

// 动态导入模块类型
type ViewManagerType = any;
type ReconcilerType = any;
type ManagerType = any;

export interface ViewReconcilerOptions {
  windowId: string;
  content: AppWindowContent;
  containerId: string;
  context?: Record<string, unknown>;
}

export interface ViewLifecycleCallbacks {
  onCreate?: () => void;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onDestroy?: () => void;
}

/**
 * ViewReconciler 适配器
 *
 * 整合 view-manager、view-reconciler 和 neural-channel 模块，
 * 提供统一的视图生命周期管理和通信接口。
 */
export class ViewReconcilerAdapter {
  private viewManager: ViewManagerType | null = null;
  private channelManager: ManagerType | null = null;
  private reconcilers: Map<string, ReconcilerType> = new Map();
  private pages: Map<string, any> = new Map();
  private callbacks: Map<string, ViewLifecycleCallbacks> = new Map();

  constructor() {
    this.initModules();
  }

  /**
   * 初始化模块
   */
  private async initModules(): Promise<void> {
    // 仅在浏览器环境初始化，SSR 不支持这些模块
    if (typeof window === 'undefined') return;

    const [viewManagerModule, neuralChannelModule] = await Promise.all([
      import('@neural-nexus/view-manager').catch(() => null),
      import('@neural-nexus/neural-channel').catch(() => null),
    ]);

    const tryConstruct = (Ctor: unknown, ...args: unknown[]): unknown => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  /**
   * 检查模块是否可用
   */
  isModulesAvailable(): boolean {
    return this.viewManager !== null && this.channelManager !== null;
  }

  /**
   * 创建视图
   */
  createView(options: ViewReconcilerOptions, callbacks?: ViewLifecycleCallbacks): string {
    const { windowId, content, containerId, context = {} } = options;

    // 只处理视图类型的内容
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

    // 保存回调
    if (callbacks) {
      this.callbacks.set(viewId, callbacks);
    }

    // 如果模块不可用，使用简单的 iframe 渲染
    if (!this.isModulesAvailable()) {
      this.createFallbackView(viewId, viewContent, containerId);
      return viewId;
    }

    // 使用 view-manager 创建页面
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

  /**
   * 创建备用视图 (简单 iframe)
   */
  private createFallbackView(
    viewId: string,
    content: ViewContent,
    containerId: string
  ): void {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`ViewReconcilerAdapter: Container not found: ${containerId}`);
      return;
    }

    // 创建 iframe
    const iframe = document.createElement('iframe');
    iframe.id = `iframe-${viewId}`;
    iframe.name = content.title || viewId;
    iframe.src = content.url;
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    iframe.className = 'view-iframe';

    container.appendChild(iframe);
  }

  /**
   * 启动视图
   */
  startView(viewId: string): void {
    const page = this.pages.get(viewId);
    if (page && typeof page.onStart === 'function') {
      page.onStart();
    }

    const callbacks = this.callbacks.get(viewId);
    callbacks?.onStart?.();
  }

  /**
   * 暂停视图
   */
  pauseView(viewId: string): void {
    const page = this.pages.get(viewId);
    if (page && typeof page.onPause === 'function') {
      page.onPause();
    }

    const callbacks = this.callbacks.get(viewId);
    callbacks?.onPause?.();
  }

  /**
   * 恢复视图
   */
  resumeView(viewId: string, isActive: boolean = true): void {
    const page = this.pages.get(viewId);
    if (page && typeof page.onResume === 'function') {
      page.onResume(isActive, true);
    }

    const callbacks = this.callbacks.get(viewId);
    callbacks?.onResume?.();
  }

  /**
   * 停止视图
   */
  stopView(viewId: string): void {
    const page = this.pages.get(viewId);
    if (page && typeof page.onStop === 'function') {
      page.onStop();
    }

    const callbacks = this.callbacks.get(viewId);
    callbacks?.onStop?.();
  }

  /**
   * 销毁视图
   */
  destroyView(viewId: string): void {
    // 使用 view-manager 关闭页面
    try {
      this.viewManager?.closePage(viewId);
    } catch (error) {
      console.warn('ViewReconcilerAdapter: Failed to close page via view-manager', error);
    }

    // 移除备用 iframe
    const iframe = document.getElementById(`iframe-${viewId}`);
    if (iframe) {
      iframe.remove();
    }

    // 清理
    this.pages.delete(viewId);
    this.reconcilers.delete(viewId);
    this.callbacks.delete(viewId);

    const callbacks = this.callbacks.get(viewId);
    callbacks?.onDestroy?.();
  }

  /**
   * 刷新视图
   */
  refreshView(viewId: string): void {
    const page = this.pages.get(viewId);
    if (page && typeof page.onRefresh === 'function') {
      page.onRefresh(true);
    }

    // 刷新备用 iframe
    const iframe = document.getElementById(`iframe-${viewId}`) as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  }

  /**
   * 发送消息到视图
   */
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

  /**
   * 广播消息到所有视图
   */
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

  /**
   * 监听消息
   */
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

  /**
   * 移除监听
   */
  offMessage(type: string): void {
    if (!this.channelManager) {
      return;
    }

    try {
      this.channelManager.remove(type);
    } catch (error) {
      console.error('ViewReconcilerAdapter: Failed to remove listener', error);
    }
  }

  /**
   * 获取所有视图 ID
   */
  getViewIds(): string[] {
    return Array.from(this.pages.keys());
  }

  /**
   * 检查视图是否存在
   */
  hasView(viewId: string): boolean {
    return this.pages.has(viewId) || document.getElementById(`iframe-${viewId}`) !== null;
  }

  /**
   * 销毁所有视图
   */
  destroyAll(): void {
    // 销毁所有页面
    this.pages.forEach((_, viewId) => {
      this.destroyView(viewId);
    });

    // 清理备用 iframes
    document.querySelectorAll('.view-iframe').forEach((iframe) => {
      iframe.remove();
    });

    this.pages.clear();
    this.reconcilers.clear();
    this.callbacks.clear();
  }
}

// 导出单例
export const viewReconcilerAdapter = new ViewReconcilerAdapter();
