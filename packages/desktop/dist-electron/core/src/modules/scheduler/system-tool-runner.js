"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemToolRunner = void 0;
const value_1 = require("@sinclair/typebox/value");
const registry_1 = require("../../lib/integrations/pi-agent/tools/registry");
const context_1 = require("../../lib/integrations/pi-agent/tools/context");
class SystemToolRunner {
    async run(task) {
        if (task.action.type !== "system-tool") {
            throw new Error(`SystemToolRunner only supports system-tool actions, got ${task.action.type}`);
        }
        const tool = (0, registry_1.getToolRegistry)().get(task.action.toolName);
        if (!tool) {
            throw new Error(`System tool is not registered: ${task.action.toolName}`);
        }
        if (!tool.enabled) {
            throw new Error(`System tool is disabled: ${task.action.toolName}`);
        }
        if (!tool.schedulable) {
            throw new Error(`System tool is not schedulable: ${task.action.toolName}`);
        }
        if (tool.category !== "system" && tool.category !== "file") {
            throw new Error(`Tool category is not allowed for scheduled system-tool action: ${tool.category}`);
        }
        if (!value_1.Value.Check(tool.parameters, task.action.input)) {
            throw new Error(`System tool input failed schema validation: ${task.action.toolName}`);
        }
        const contextManager = (0, context_1.getToolContextManager)();
        const taskContext = {
            ...contextManager.getContext(task.id),
            ...(task.action.workingDirectory ? { workingDirectory: task.action.workingDirectory } : {}),
        };
        if (task.action.projectId && !taskContext.workingDirectory) {
            throw new Error("Scheduled project system-tool actions require an injected workingDirectory context");
        }
        contextManager.setDefaultContext(taskContext);
        return tool.execute(`scheduled-${task.id}-${Date.now()}`, task.action.input, undefined, undefined);
    }
}
exports.SystemToolRunner = SystemToolRunner;
