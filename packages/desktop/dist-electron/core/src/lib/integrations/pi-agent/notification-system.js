"use strict";
/**
 * 系统通知模块
 *
 * 处理本体变更审批通知和其他系统级通知
 * - 本体变更审批通知（Agent 修改本体时需要用户确认）
 * - 通知持久化到 notifications/ 目录
 * - 支持通知状态管理（pending, approved, rejected）
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationManager = exports.NotificationStatus = exports.NotificationType = void 0;
exports.getNotificationManager = getNotificationManager;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const paths_1 = require("../../paths");
var NotificationType;
(function (NotificationType) {
    NotificationType["ONTOLOGY_CHANGE"] = "ontology_change";
    NotificationType["SYSTEM_ALERT"] = "system_alert";
    NotificationType["TASK_COMPLETION"] = "task_completion";
    NotificationType["SYSTEM_MESSAGE"] = "system_message";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["PENDING"] = "pending";
    NotificationStatus["APPROVED"] = "approved";
    NotificationStatus["REJECTED"] = "rejected";
    NotificationStatus["DISMISSED"] = "dismissed";
    NotificationStatus["READ"] = "read";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
/**
 * 通知管理器
 */
class NotificationManager {
    constructor(baseDir) {
        this.notificationsDir = path_1.default.join(baseDir, 'notifications');
        this.ensureNotificationsDir();
    }
    /**
     * 确保通知目录存在
     */
    ensureNotificationsDir() {
        if (!(0, fs_1.existsSync)(this.notificationsDir)) {
            (0, fs_1.mkdirSync)(this.notificationsDir, { recursive: true });
        }
    }
    /**
     * 创建通知
     */
    async createNotification(type, title, message, payload, options) {
        const notification = {
            id: (0, uuid_1.v4)(),
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
    saveNotification(notification) {
        const filePath = path_1.default.join(this.notificationsDir, `${notification.id}.json`);
        (0, fs_1.writeFileSync)(filePath, JSON.stringify(notification, null, 2), 'utf-8');
    }
    /**
     * 读取通知
     */
    async getNotification(notificationId) {
        const filePath = path_1.default.join(this.notificationsDir, `${notificationId}.json`);
        if (!(0, fs_1.existsSync)(filePath)) {
            return null;
        }
        try {
            const content = (0, fs_1.readFileSync)(filePath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            console.error(`Failed to read notification ${notificationId}:`, error);
            return null;
        }
    }
    /**
     * 更新通知状态
     */
    async updateNotificationStatus(notificationId, status) {
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
    async listNotifications(filter) {
        if (!(0, fs_1.existsSync)(this.notificationsDir)) {
            return [];
        }
        const files = (0, fs_1.readdirSync)(this.notificationsDir).filter(f => f.endsWith('.json'));
        const notifications = [];
        for (const file of files) {
            const filePath = path_1.default.join(this.notificationsDir, file);
            try {
                const content = (0, fs_1.readFileSync)(filePath, 'utf-8');
                const notification = JSON.parse(content);
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
            }
            catch (error) {
                console.error(`Failed to read notification file ${file}:`, error);
            }
        }
        // Sort by createdAt descending
        return notifications.sort((a, b) => b.createdAt - a.createdAt);
    }
    /**
     * 创建本体变更审批通知
     */
    async createOntologyChangeNotification(payload, options) {
        const title = `本体变更审批: ${payload.operation} ${payload.entityType}`;
        const message = `Agent 请求 ${payload.operation} ${payload.entityType} "${payload.entityName}"${payload.reason ? `\n原因: ${payload.reason}` : ''}`;
        return this.createNotification(NotificationType.ONTOLOGY_CHANGE, title, message, payload, options);
    }
}
exports.NotificationManager = NotificationManager;
/**
 * 全局通知管理器实例
 * 使用项目根目录作为基础路径
 */
let globalNotificationManager = null;
function getNotificationManager(baseDir) {
    if (!globalNotificationManager) {
        const dir = baseDir || (0, paths_1.getDataRoot)();
        globalNotificationManager = new NotificationManager(dir);
    }
    return globalNotificationManager;
}
