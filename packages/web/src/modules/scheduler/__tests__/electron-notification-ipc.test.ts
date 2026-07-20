import { afterEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
const BrowserNotification = vi.fn(() => ({}));

vi.mock('@originos/core/lib/integrations/electron/env', () => ({
  isElectron: () => true,
  getIpcRenderer: () => ({ invoke }),
}));

describe('electron notification IPC payloads', () => {
  afterEach(() => {
    invoke.mockReset();
    BrowserNotification.mockReset();
    BrowserNotification.mockImplementation(() => ({}));
    Reflect.deleteProperty(window, 'Notification');
  });

  it('does not pass undefined when listing notifications without filters', async () => {
    const { listNotifications } = await import('@originos/core/lib/integrations/electron/services/misc');
    invoke.mockResolvedValue({ success: true, data: [] });

    await listNotifications();

    expect(invoke).toHaveBeenCalledWith('notification:list', {});
  });

  it('omits undefined fields when showing a native system notification', async () => {
    const { showSystemNotification } = await import('@originos/core/lib/integrations/electron/services/misc');
    invoke.mockResolvedValue({ success: true, data: { shown: true } });
    const listener = vi.fn();
    window.addEventListener('originos:system-notification', listener);

    await showSystemNotification({
      title: '定时任务已运行',
      body: undefined,
      silent: undefined,
      activationTarget: { entryType: 'skill', entryId: 'weekly-report', title: '周报技能' },
    });

    expect(invoke).toHaveBeenCalledWith('notification:show', {
      title: '定时任务已运行',
      activationTarget: { entryType: 'skill', entryId: 'weekly-report', title: '周报技能' },
    });
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('originos:system-notification', listener);
  });

  it('does not fall back to in-app notification when native Electron notification fails', async () => {
    const { showSystemNotification } = await import('@originos/core/lib/integrations/electron/services/misc');
    invoke.mockResolvedValue({ success: true, data: { shown: false, reason: 'PERMISSION_DENIED' } });
    Object.defineProperty(BrowserNotification, 'permission', { value: 'granted', configurable: true });
    Object.defineProperty(window, 'Notification', { value: BrowserNotification, configurable: true });
    const listener = vi.fn();
    window.addEventListener('originos:system-notification', listener);

    const result = await showSystemNotification({ title: '定时任务已运行', body: '测试通知' });

    expect(result.data).toMatchObject({ shown: false, reason: 'PERMISSION_DENIED' });
    expect(BrowserNotification).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('originos:system-notification', listener);
  });
});
