"use strict";
/**
 * 系统工具
 * 提供系统级别的操作功能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemTools = void 0;
const typebox_1 = require("@sinclair/typebox");
function createToolContext(toolCallId, toolName, signal, onUpdate) {
    return { toolCallId, toolName, signal, onUpdate };
}
function checkAbort(signal) {
    if (signal?.aborted) {
        throw new DOMException("Tool execution was aborted", "AbortError");
    }
}
function logToolStart(ctx, params) {
    console.error(`[Tool:${ctx.toolName}] START_CALL_ID=${ctx.toolCallId}`, JSON.stringify(params, null, 2));
}
function logToolEnd(ctx, result) {
    console.error(`[Tool:${ctx.toolName}] END_CALL_ID=${ctx.toolCallId}`, JSON.stringify(result, null, 2));
}
function logToolError(ctx, error) {
    console.error(`[Tool:${ctx.toolName}] ERROR_CALL_ID=${ctx.toolCallId}`, error);
}
/**
 * 发送进度更新
 */
function sendProgress(ctx, message, progress, data) {
    if (!ctx.onUpdate || ctx.signal?.aborted)
        return;
    ctx.onUpdate({
        content: [],
        details: {
            type: "progress",
            toolCallId: ctx.toolCallId,
            toolName: ctx.toolName,
            status: "in_progress",
            message,
            progress,
            data,
            timestamp: Date.now(),
        },
    });
}
// ============================================================================
// 工具: 获取当前时间
// ============================================================================
const GetTimeParamsSchema = typebox_1.Type.Object({});
const GetTimeTool = {
    name: "get_current_time",
    label: "获取当前时间",
    description: "获取当前的日期和时间",
    parameters: GetTimeParamsSchema,
    category: "system",
    enabled: true,
    schedulable: true,
    async execute(toolCallId, _params, signal, onUpdate) {
        const ctx = createToolContext(toolCallId, "get_current_time", signal, onUpdate);
        try {
            logToolStart(ctx, {});
            checkAbort(ctx.signal);
            sendProgress(ctx, "正在获取当前时间...", 0.5);
            const now = new Date();
            const result = {
                success: true,
                timestamp: now.getTime(),
                isoString: now.toISOString(),
                localTime: now.toLocaleString("zh-CN"),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                milliseconds: now.getMilliseconds(),
            };
            sendProgress(ctx, "时间获取完成", 1);
            logToolEnd(ctx, result);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result),
                    },
                ],
                details: undefined,
            };
        }
        catch (error) {
            logToolError(ctx, error);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error instanceof Error ? error.message : String(error),
                        }),
                    },
                ],
                details: undefined,
            };
        }
    },
};
// ============================================================================
// 导出所有系统工具
// ============================================================================
exports.systemTools = [
    GetTimeTool,
];
