"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultSchedulerActionRunner = void 0;
const notification_system_1 = require("../../lib/integrations/pi-agent/notification-system");
const system_tool_runner_1 = require("./system-tool-runner");
class DefaultSchedulerActionRunner {
    constructor(systemToolRunner = new system_tool_runner_1.SystemToolRunner()) {
        this.systemToolRunner = systemToolRunner;
    }
    async run(task) {
        if (task.action.type === "system-tool") {
            return this.systemToolRunner.run(task);
        }
        if (task.action.type === "system") {
            if (task.action.command === "notify") {
                const payload = task.action.payload ?? {};
                const message = typeof payload["message"] === "string" ? payload["message"] : task.title;
                const notification = await (0, notification_system_1.getNotificationManager)().createNotification(notification_system_1.NotificationType.SYSTEM_MESSAGE, task.title, message, { scheduleTaskId: task.id, ...payload });
                return { handled: true, command: task.action.command, notificationId: notification.id };
            }
            return { handled: true, command: task.action.command, payload: task.action.payload ?? null };
        }
        if (task.action.type === "agent") {
            const notification = await (0, notification_system_1.getNotificationManager)().createNotification(notification_system_1.NotificationType.SYSTEM_MESSAGE, `定时角色任务: ${task.title}`, `需要启动角色 ${task.action.agentName}: ${task.action.prompt}`, { scheduleTaskId: task.id, action: task.action });
            return { handled: true, action: "agent", notificationId: notification.id };
        }
        if (task.action.type === "skill") {
            const notification = await (0, notification_system_1.getNotificationManager)().createNotification(notification_system_1.NotificationType.SYSTEM_MESSAGE, `定时技能任务: ${task.title}`, `需要启动技能 ${task.action.skillName}${task.action.prompt ? `: ${task.action.prompt}` : ""}`, { scheduleTaskId: task.id, action: task.action });
            return { handled: true, action: "skill", notificationId: notification.id };
        }
        throw new Error("Scheduled action type is not wired yet");
    }
}
exports.DefaultSchedulerActionRunner = DefaultSchedulerActionRunner;
