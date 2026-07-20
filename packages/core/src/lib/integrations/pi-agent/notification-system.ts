/**
 * 系统通知模块
 *
 * 处理本体变更审批通知和其他系统级通知
 * - 本体变更审批通知（Agent 修改本体时需要用户确认）
 * - 通知持久化到 notifications/ 目录
 * - 支持通知状态管理（pending, approved, rejected）
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDataRoot } from '../../paths';

export enum NotificationType {
  ONTOLOGY_CHANGE = 'ontology_change',
  SYSTEM_ALERT = 'system_alert',
  TASK_COMPLETION = 'task_completion',
  SYSTEM_MESSAGE = 'system_message',
}

export enum NotificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DISMISSED = 'dismissed',
  READ = 'read',
}

export interface OntologyChangePayload {
  entityType: 'concept' | 'relation' | 'instance';
  operation: 'create' | 'update' | 'delete';
  entityId: string;
  entityName: string;
  changes: Record<string, unknown>;
  reason?: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  message: string;
  payload: OntologyChangePayload | Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  sessionId?: string;
  projectId?: string;
}

/**
 * 通知管理器
 */
export class NotificationManager {
  private notificationsDir: string;

  constructor(baseDir: string) {
    this.notificationsDir = path.join(baseDir, 'notifications');
    this.ensureNotificationsDir();
  }

  /**
   * 确保通知目录存在
   */
  private ensureNotificationsDir(): void {
    if (!existsSync(this.notificationsDir)) {
      mkdirSync(this.notificationsDir, { recursive: true });
    }
  }

  /**
   * 创建通知
   */
  async createNotification(
    type: NotificationType,
    title: string,
    message: string,
    payload: OntologyChangePayload | Record<string, unknown>,
    options?: {
      sessionId?: string;
      projectId?: string;
    }
  ): Promise<Notification> {
    const notification: Notification = {
      id: uuidv4(),
      type,
      status: NotificationStatus.PENDING,
      title,
      message,
      payload,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionId: options?.sessionId,
      projectId: options?.projectId,
    };

    this.saveNotification(notification);

    return notification;
  }

  /**
   * 保存通知到文件
   */
  private saveNotification(notification: Notification): void {
    const filePath = path.join(this.notificationsDir, `${notification.id}.json`);
    writeFileSync(filePath, JSON.stringify(notification, null, 2), 'utf-8');
  }

  /**
   * 读取通知
   */
  async getNotification(notificationId: string): Promise<Notification | null> {
    const filePath = path.join(this.notificationsDir, `${notificationId}.json`);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as Notification;
    } catch (error) {
      console.error(`Failed to read notification ${notificationId}:`, error);
      return null;
    }
  }

  /**
   * 更新通知状态
   */
  async updateNotificationStatus(
    notificationId: string,
    status: NotificationStatus
  ): Promise<Notification | null> {
    const notification = await this.getNotification(notificationId);

    if (!notification) {
      return null;
    }

    notification.status = status;
    notification.updatedAt = Date.now();

    this.saveNotification(notification);

    return notification;
  }

  /**
   * 列出所有通知
   */
  async listNotifications(filter?: {
    status?: NotificationStatus;
    type?: NotificationType;
    sessionId?: string;
    projectId?: string;
  }): Promise<Notification[]> {
    if (!existsSync(this.notificationsDir)) {
      return [];
    }

    const files = readdirSync(this.notificationsDir).filter(f => f.endsWith('.json'));
    const notifications: Notification[] = [];

    for (const file of files) {
      const filePath = path.join(this.notificationsDir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const notification = JSON.parse(content) as Notification;

        // Apply filters
        if (filter?.status && notification.status !== filter.status) {
          continue;
        }
        if (filter?.type && notification.type !== filter.type) {
          continue;
        }
        if (filter?.sessionId && notification.sessionId !== filter.sessionId) {
          continue;
        }
        if (filter?.projectId && notification.projectId !== filter.projectId) {
          continue;
        }

        notifications.push(notification);
      } catch (error) {
        console.error(`Failed to read notification file ${file}:`, error);
      }
    }

    // Sort by createdAt descending
    return notifications.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 创建本体变更审批通知
   */
  async createOntologyChangeNotification(
    payload: OntologyChangePayload,
    options?: {
      sessionId?: string;
      projectId?: string;
    }
  ): Promise<Notification> {
    const title = `本体变更审批: ${payload.operation} ${payload.entityType}`;
    const message = `Agent 请求 ${payload.operation} ${payload.entityType} "${payload.entityName}"${payload.reason ? `\n原因: ${payload.reason}` : ''}`;

    return this.createNotification(
      NotificationType.ONTOLOGY_CHANGE,
      title,
      message,
      payload,
      options
    );
  }
}

/**
 * 全局通知管理器实例
 * 使用项目根目录作为基础路径
 */
let globalNotificationManager: NotificationManager | null = null;

export function getNotificationManager(baseDir?: string): NotificationManager {
  if (!globalNotificationManager) {
    const dir = baseDir || getDataRoot();
    globalNotificationManager = new NotificationManager(dir);
  }
  return globalNotificationManager;
}
