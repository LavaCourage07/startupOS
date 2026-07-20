"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesktopSchedulerService = void 0;
const scheduler_1 = require("../../../../core/src/modules/scheduler");
const notification_system_1 = require("../../../../core/src/lib/integrations/pi-agent/notification-system");
const native_notification_service_1 = require("./native-notification-service");
const DEFAULT_POLL_INTERVAL_MS = 30000;
class DesktopSchedulerService {
    constructor(pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
        this.pollIntervalMs = pollIntervalMs;
        this.timer = null;
        this.running = false;
        this.scheduler = new scheduler_1.SchedulerService(undefined, new DesktopSchedulerActionRunner());
    }
    start() {
        if (this.timer) {
            return;
        }
        void this.tick('startup');
        this.timer = setInterval(() => {
            void this.tick('interval');
        }, this.pollIntervalMs);
        this.timer.unref();
        console.log('[DesktopSchedulerService] started', { pollIntervalMs: this.pollIntervalMs });
    }
    stop() {
        if (!this.timer) {
            return;
        }
        clearInterval(this.timer);
        this.timer = null;
        console.log('[DesktopSchedulerService] stopped');
    }
    async tick(reason) {
        if (this.running) {
            console.warn('[DesktopSchedulerService] skip tick while previous run is active', { reason });
            return;
        }
        this.running = true;
        try {
            const runs = await this.scheduler.runDueTasks();
            if (runs.length > 0) {
                console.log('[DesktopSchedulerService] due tasks executed', {
                    reason,
                    count: runs.length,
                    runs: runs.map(summarizeRun),
                });
            }
        }
        catch (error) {
            console.error('[DesktopSchedulerService] failed to run due tasks', error);
        }
        finally {
            this.running = false;
        }
    }
}
exports.DesktopSchedulerService = DesktopSchedulerService;
class DesktopSchedulerActionRunner extends scheduler_1.DefaultSchedulerActionRunner {
    async run(task) {
        if (task.action.type !== 'system' || task.action.command !== 'notify') {
            return super.run(task);
        }
        const payload = task.action.payload ?? {};
        const message = typeof payload['message'] === 'string' ? payload['message'] : task.title;
        const notification = await (0, notification_system_1.getNotificationManager)().createNotification(notification_system_1.NotificationType.SYSTEM_MESSAGE, task.title, message, { scheduleTaskId: task.id, ...payload });
        const nativeNotification = await (0, native_notification_service_1.showNativeSystemNotification)({
            title: task.title,
            body: message,
            activationTarget: payload['activationTarget'],
        });
        return {
            handled: true,
            command: task.action.command,
            notificationId: notification.id,
            nativeNotification,
        };
    }
}
function summarizeRun(run) {
    return {
        id: run.id,
        taskId: run.taskId,
        status: run.status,
        actionType: run.actionType,
    };
}
