/**
 * Notification Store - Zustand State Management
 */

import { create } from 'zustand';
import { listNotifications, updateNotification } from '@originos/core/lib/integrations/electron/services/misc';

export interface Notification {
  id: string;
  type: string;
  status: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  sessionId?: string;
  projectId?: string;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  fetchNotifications: (options?: { silent?: boolean }) => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async ({ silent = false } = {}) => {
    if (!silent) {
      set({ isLoading: true });
    }
    try {
      const result = await listNotifications();
      if (result.success) {
        const raw = result.data;
        const notifications: Notification[] = Array.isArray(raw)
          ? raw
          : (raw as { notifications: Notification[] })?.notifications ?? [];
        const unreadCount = notifications.filter(
          (n) => n.status === 'pending',
        ).length;
        set({ notifications, unreadCount });
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      if (!silent) {
        set({ isLoading: false });
      }
    }
  },

  dismissNotification: async (id: string) => {
    try {
      const result = await updateNotification(id, { status: 'dismissed' });
      if (result.success) {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, status: 'dismissed', updatedAt: Date.now() } : n,
          ),
          unreadCount: Math.max(0, state.unreadCount - (state.notifications.find((n) => n.id === id)?.status === 'pending' ? 1 : 0)),
        }));
      }
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  },

  markNotificationRead: async (id: string) => {
    try {
      const notification = get().notifications.find((n) => n.id === id);
      if (!notification || notification.status !== 'pending') return;

      const result = await updateNotification(id, { status: 'read' });
      if (result.success) {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, status: 'read', updatedAt: Date.now() } : n,
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      }
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  },

  markAllRead: async () => {
    try {
      const { notifications } = get();
      const pendingIds = notifications
        .filter((n) => n.status === 'pending')
        .map((n) => n.id);

      await Promise.all(
        pendingIds.map((id) =>
          updateNotification(id, { status: 'read' }),
        ),
      );

      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.status === 'pending' ? { ...n, status: 'read', updatedAt: Date.now() } : n,
        ),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('Failed to mark all read:', error);
    }
  },

  refresh: async () => {
    await get().fetchNotifications();
  },
}));
