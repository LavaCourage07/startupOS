/**
 * NotificationPanel Component
 * Dropdown panel showing notification list
 */

import { useNotificationStore, type Notification } from '@/store/notificationStore';
import type { SystemNotificationActivationTarget } from './SystemNotificationToastHost';

interface NotificationPanelProps {
  onClose: () => void;
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'read':
    case 'dismissed':
      return 'bg-gray-500/20 text-gray-400';
    case 'approved':
      return 'bg-green-500/20 text-green-400';
    case 'rejected':
      return 'bg-red-500/20 text-red-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return '未读';
    case 'read':
      return '已读';
    case 'dismissed':
      return '已关闭';
    case 'approved':
      return '已批准';
    case 'rejected':
      return '已拒绝';
    default:
      return status;
  }
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismissNotification = useNotificationStore((s) => s.dismissNotification);
  const markNotificationRead = useNotificationStore((s) => s.markNotificationRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  const activeNotifications = notifications.filter(
    (n) => n.status !== 'dismissed'
  );

  if (activeNotifications.length === 0) {
    return (
      <div className="bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">通知</h3>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-white/50">暂无通知</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-96 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <h3 className="text-sm font-semibold text-white">通知</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllRead}
            className="text-xs text-white/50 hover:text-white transition-colors"
          >
            全部已读
          </button>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {activeNotifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={dismissNotification}
            onActivate={async (target) => {
              if (notification.status === 'pending') {
                await markNotificationRead(notification.id);
              }
              window.dispatchEvent(new CustomEvent('originos:notification-activate', { detail: target }));
              onClose();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function NotificationItem({
  notification,
  onDismiss,
  onActivate,
}: {
  notification: Notification;
  onDismiss: (id: string) => Promise<void>;
  onActivate: (target: SystemNotificationActivationTarget) => Promise<void>;
}) {
  const isUnread = notification.status === 'pending';
  const activationTarget = getNotificationActivationTarget(notification);

  return (
    <div
      role={activationTarget ? 'button' : undefined}
      tabIndex={activationTarget ? 0 : undefined}
      onClick={() => {
        if (activationTarget) {
          void onActivate(activationTarget);
        }
      }}
      onKeyDown={(event) => {
        if (!activationTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        void onActivate(activationTarget);
      }}
      className={`px-4 py-3 border-b border-white/5 transition-colors ${
        isUnread ? 'bg-white/5' : ''
      } ${activationTarget ? 'cursor-pointer hover:bg-white/10 focus:bg-white/10 focus:outline-none' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-white truncate">
              {notification.title}
            </h4>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${getStatusBadge(
                notification.status
              )}`}
            >
              {getStatusLabel(notification.status)}
            </span>
          </div>
          <p className="text-xs text-white/60 line-clamp-2">
            {notification.message}
          </p>
          <span className="text-[10px] text-white/30 mt-1 block">
            {formatTime(notification.createdAt)}
          </span>
        </div>
        <button
          onClick={(event) => {
            event.stopPropagation();
            void onDismiss(notification.id);
          }}
          className="text-white/30 hover:text-white/60 transition-colors shrink-0 p-1"
          aria-label="关闭通知"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function getNotificationActivationTarget(notification: Notification): SystemNotificationActivationTarget | null {
  const activationTarget = notification.payload["activationTarget"];
  if (isActivationTarget(activationTarget)) return activationTarget;

  const action = notification.payload["action"];
  if (!action || typeof action !== 'object') return null;
  const record = action as Record<string, unknown>;
  if (record["type"] === 'agent' && typeof record["agentName"] === 'string') {
    return {
      entryType: 'agent',
      entryId: record["agentName"],
      title: typeof notification.title === 'string' ? notification.title : record["agentName"],
      ...(typeof record["prompt"] === 'string' && record["prompt"].trim() ? { initialMessage: record["prompt"].trim() } : {}),
    };
  }
  if (record["type"] === 'skill' && typeof record["skillName"] === 'string') {
    return {
      entryType: 'skill',
      entryId: record["skillName"],
      title: record["skillName"],
      ...(typeof record["prompt"] === 'string' && record["prompt"].trim() ? { initialMessage: record["prompt"].trim() } : {}),
    };
  }
  return null;
}

function isActivationTarget(value: unknown): value is SystemNotificationActivationTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as Record<string, unknown>;
  return (
    (target["entryType"] === 'project' || target["entryType"] === 'agent' || target["entryType"] === 'role-agent' || target["entryType"] === 'skill') &&
    typeof target["entryId"] === 'string' &&
    (target["title"] === undefined || typeof target["title"] === 'string') &&
    (target["initialMessage"] === undefined || typeof target["initialMessage"] === 'string')
  );
}
