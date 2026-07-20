"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleTools = void 0;
const typebox_1 = require("@sinclair/typebox");
const scheduler_1 = require("../../../../modules/scheduler");
const context_1 = require("./context");
const TriggerSchema = typebox_1.Type.Union([
    typebox_1.Type.Object({
        type: typebox_1.Type.Literal("once"),
        runAt: typebox_1.Type.String({ description: "ISO 8601 time when the task should run." }),
    }),
    typebox_1.Type.Object({
        type: typebox_1.Type.Literal("interval"),
        everyMs: typebox_1.Type.Number({ minimum: 1000 }),
        startAt: typebox_1.Type.Optional(typebox_1.Type.String()),
        endAt: typebox_1.Type.Optional(typebox_1.Type.String()),
    }),
    typebox_1.Type.Object({
        type: typebox_1.Type.Literal("cron"),
        expression: typebox_1.Type.String({ description: "Standard 5-field cron expression. Initial implementation supports numeric or * minute/hour fields." }),
    }),
]);
const ActionSchema = typebox_1.Type.Union([
    typebox_1.Type.Object({
        type: typebox_1.Type.Literal("system"),
        command: typebox_1.Type.Union([typebox_1.Type.Literal("open-window"), typebox_1.Type.Literal("notify"), typebox_1.Type.Literal("check-update")]),
        payload: typebox_1.Type.Optional(typebox_1.Type.Record(typebox_1.Type.String(), typebox_1.Type.Unknown())),
    }),
    typebox_1.Type.Object({
        type: typebox_1.Type.Literal("system-tool"),
        toolName: typebox_1.Type.String({ minLength: 1 }),
        input: typebox_1.Type.Record(typebox_1.Type.String(), typebox_1.Type.Unknown()),
        projectId: typebox_1.Type.Optional(typebox_1.Type.String()),
        workingDirectory: typebox_1.Type.Optional(typebox_1.Type.String({
            description: "Optional working directory for project-bound scheduled system tools. Must be resolved by the caller; tools still enforce their own path boundaries.",
        })),
    }),
]);
const CreateScheduleParamsSchema = typebox_1.Type.Object({
    title: typebox_1.Type.String({ minLength: 1 }),
    description: typebox_1.Type.Optional(typebox_1.Type.String()),
    trigger: TriggerSchema,
    action: ActionSchema,
    timezone: typebox_1.Type.Optional(typebox_1.Type.String()),
});
const TaskIdParamsSchema = typebox_1.Type.Object({
    taskId: typebox_1.Type.String({ minLength: 1 }),
});
function result(data) {
    return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        details: data,
    };
}
function errorResult(error) {
    return result({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
    });
}
function service() {
    return new scheduler_1.SchedulerService(undefined, new scheduler_1.DefaultSchedulerActionRunner());
}
function normalizeAction(action) {
    return action;
}
const ScheduleTaskTool = {
    name: "schedule_task",
    label: "创建定时任务",
    description: "Create a system-level scheduled task. Supports safe system actions and schedulable system-tool actions only. Never accepts raw shell commands.",
    parameters: CreateScheduleParamsSchema,
    category: "system",
    enabled: true,
    async execute(_toolCallId, params) {
        try {
            const scheduler = service();
            const task = await scheduler.createTask({
                title: params.title,
                description: params.description,
                trigger: params.trigger,
                action: normalizeAction(params.action),
                timezone: params.timezone,
            });
            if (params.action.type === "system-tool" && params.action.workingDirectory) {
                (0, context_1.setToolContext)(task.id, { sessionId: task.id, workingDirectory: params.action.workingDirectory });
            }
            return result({ ok: true, task });
        }
        catch (error) {
            return errorResult(error);
        }
    },
};
const RunScheduleNowTool = {
    name: "run_schedule_now",
    label: "立即运行定时任务",
    description: "Run a scheduled task immediately by id and append a run log.",
    parameters: TaskIdParamsSchema,
    category: "system",
    enabled: true,
    async execute(_toolCallId, params) {
        try {
            const run = await service().runTask(params.taskId);
            return result({ ok: true, run });
        }
        catch (error) {
            return errorResult(error);
        }
    },
};
exports.scheduleTools = [
    ScheduleTaskTool,
    RunScheduleNowTool,
];
