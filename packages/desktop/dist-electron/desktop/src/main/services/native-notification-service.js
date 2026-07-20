"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showNativeSystemNotification = showNativeSystemNotification;
const electron_1 = require("electron");
const ipc_protocol_1 = require("../ipc-protocol");
const activeSystemNotifications = new Set();
async function showNativeSystemNotification(request) {
    const title = request.title.trim();
    const body = request.body?.trim() ?? '';
    if (!electron_1.Notification.isSupported()) {
        console.warn('[notification] Electron Notification is not supported');
        return createNotificationResult({
            shown: false,
            reason: 'NOT_SUPPORTED',
            nativeSupported: false,
        });
    }
    const notification = new electron_1.Notification({
        title,
        body,
        silent: request.silent ?? false,
        urgency: 'normal',
        timeoutType: 'default',
        sound: process.platform === 'darwin' ? 'default' : undefined,
    });
    const focused = electron_1.BrowserWindow.getAllWindows().some((window) => !window.isDestroyed() && window.isFocused());
    const permission = process.platform === 'darwin' ? 'unknown' : 'unknown';
    console.log('[notification] show requested', {
        title,
        hasBody: Boolean(body),
        hasActivationTarget: Boolean(request.activationTarget),
        appName: electron_1.app.getName(),
        platform: process.platform,
        focused,
        permission,
        nativeSupported: electron_1.Notification.isSupported(),
    });
    activeSystemNotifications.add(notification);
    const delivery = await new Promise((resolve) => {
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
        const onFailed = (_event, error) => {
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
            electron_1.app.dock?.bounce('informational');
        }
    });
    return createNotificationResult({
        ...delivery,
        nativeSupported: true,
        focused,
        permission,
    });
}
function createNotificationResult(input) {
    return {
        ...input,
        appName: electron_1.app.getName(),
        platform: process.platform,
        isPackaged: electron_1.app.isPackaged,
    };
}
function getNotificationFailureReason(error) {
    const normalized = error.toLowerCase();
    if (normalized.includes('not allowed') || normalized.includes('denied') || normalized.includes('permission')) {
        return 'PERMISSION_DENIED';
    }
    return 'FAILED';
}
function emitNotificationClick(activationTarget) {
    if (!activationTarget || typeof activationTarget !== 'object') {
        return;
    }
    for (const window of electron_1.BrowserWindow.getAllWindows()) {
        if (window.isDestroyed())
            continue;
        window.webContents.send(ipc_protocol_1.IPC_CHANNELS.NOTIFICATION_CLICK, { activationTarget });
        if (window.isMinimized())
            window.restore();
        window.show();
        window.focus();
    }
}
