import type { AgentToolResult } from "@mariozechner/agent";
import { Value } from "@sinclair/typebox/value";
import { getToolRegistry } from "../../lib/integrations/pi-agent/tools/registry";
import { getToolContextManager } from "../../lib/integrations/pi-agent/tools/context";
import type { ScheduledTask } from "./types";

export class SystemToolRunner {
	async run(task: ScheduledTask): Promise<AgentToolResult<unknown>> {
		if (task.action.type !== "system-tool") {
			throw new Error(`SystemToolRunner only supports system-tool actions, got ${task.action.type}`);
		}
		const tool = getToolRegistry().get(task.action.toolName);
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
		if (!Value.Check(tool.parameters, task.action.input)) {
			throw new Error(`System tool input failed schema validation: ${task.action.toolName}`);
		}

		const contextManager = getToolContextManager();
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
