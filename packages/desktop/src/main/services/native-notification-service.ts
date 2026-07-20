import { BrowserWindow, Notification, app } from 'electron';
import { IPC_CHANNELS } from '../ipc-protocol';

export interface NativeNotificationRequest {
  title: string;
  body?: string;
  silent?: boolean;
  activationTarget?: unknown;
}

export interface NativeNotificationResult {
  shown: boolean;
  reason?: string;
  error?: string;
  delivery?: 'electron-native';
  nativeSupported: boolean;
  focused?: boolean;
  permission?: string;
  appName: string;
  platform: NodeJS.Platform;
  isPackaged: boolean;
}

const activeSystemNotifications = new Set<Notification>();

export async function showNativeSystemNotification(request: NativeNotificationRequest): Promise<NativeNotificationResult> {
  const title = request.title.trim();
  const body = request.body?.trim() ?? '';

  if (!Notification.isSupported()) {
    console.warn('[notification] Electron Notification is not supported');
    return createNotificationResult({
      shown: false,
      reason: 'NOT_SUPPORTED',
      nativeSupported: false,
    });
  }

  const notification = new Notification({
    title,
    body,
    silent: request.silent ?? false,
    urgency: 'normal',
    timeoutType: 'default',
    sound: process.platform === 'darwin' ? 'default' : undefined,
  });
  const focused = BrowserWindow.getAllWindows().some((window) => !window.isDestroyed() && window.isFocused());
  const permission = process.platform === 'darwin' ? 'unknown' : 'unknown';

  console.log('[notification] show requested', {
    title,
    hasBody: Boolean(body),
    hasActivationTarget: Boolean(request.activationTarget),
    appName: app.getName(),
    platform: process.platform,
    focused,
    permission,
    nativeSupported: Notification.isSupported(),
  });

  activeSystemNotifications.add(notification);
  const delivery = await new Promise<{
    shown: boolean;
    reason?: string;
    error?: string;
    delivery?: 'electron-native';
  }>((resolve) => {
    const cleanup = () => {
      clearTimeout(timeout);
      notification.removeListener('show', onShow);
      notification.removeListener('failed', onFailed);
    };
    const onShow = () => {
      cleanup();
      console.log('[notification] shown by Electron native notification');
      resolve({ shown: true, delivery: 'electron-native' });
    };
    const onFailed = (_event: Electron.Event, error: string) => {
      cleanup();
      activeSystemNotifications.delete(notification);
      console.error('[notification] Electron native notification failed', error);
      resolve({
        shown: false,
        reason: getNotificationFailureReason(error),
        error,
      });
    };
    const timeout = setTimeout(() => {
      cleanup();
      activeSystemNotifications.delete(notification);
      console.warn('[notification] Electron native notification show event timed out');
      resolve({ shown: false, reason: 'SHOW_EVENT_TIMEOUT' });
    }, 1500);

    notification.once('show', onShow);
    notification.once('failed', onFailed);
    notification.once('close', () => {
      console.log('[notification] Electron native notification closed');
      activeSystemNotifications.delete(notification);
    });
    notification.once('click', () => {
      console.log('[notification] Electron native notification clicked');
      emitNotificationClick(request.activationTarget);
    });
    notification.show();
    if (process.platform === 'darwin' && focused) {
      app.dock?.bounce('informational');
    }
  });

  return createNotificationResult({
    ...delivery,
    nativeSupported: true,
    focused,
    permission,
  });
}

function createNotificationResult(input: {
  shown: boolean;
  reason?: string;
  error?: string;
  delivery?: 'electron-native';
  nativeSupported: boolean;
  focused?: boolean;
  permission?: string;
}): NativeNotificationResult {
  return {
    ...input,
    appName: app.getName(),
    platform: process.platform,
    isPackaged: app.isPackaged,
  };
}

function getNotificationFailureReason(error: string): string {
  const normalized = error.toLowerCase();
  if (normalized.includes('not allowed') || normalized.includes('denied') || normalized.includes('permission')) {
    return 'PERMISSION_DENIED';
  }
  return 'FAILED';
}

function emitNotificationClick(activationTarget: unknown): void {
  if (!activationTarget || typeof activationTarget !== 'object') {
    return;
  }
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    window.webContents.send(IPC_CHANNELS.NOTIFICATION_CLICK, { activationTarget });
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
}
