export type ScheduledTaskStatus = "enabled" | "paused" | "completed" | "failed";

export type ScheduleTrigger =
	| { type: "once"; runAt: string }
	| { type: "interval"; everyMs: number; startAt?: string; endAt?: string }
	| { type: "cron"; expression: string };

export type ScheduledAction =
	| { type: "agent"; agentName: string; prompt: string; projectId?: string }
	| { type: "skill"; skillName: string; prompt?: string; projectId?: string }
	| { type: "system"; command: "open-window" | "notify" | "check-update"; payload?: Record<string, unknown> }
	| { type: "system-tool"; toolName: string; input: Record<string, unknown>; projectId?: string; workingDirectory?: string };

export interface ScheduledTask {
	id: string;
	title: string;
	description?: string;
	status: ScheduledTaskStatus;
	trigger: ScheduleTrigger;
	action: ScheduledAction;
	timezone: string;
	nextRunAt: string;
	lastRunAt?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ScheduledTaskRun {
	id: string;
	taskId: string;
	startedAt: string;
	endedAt: string;
	status: "success" | "failed" | "skipped";
	actionType: ScheduledAction["type"];
	result?: unknown;
	error?: string;
}

export interface CreateScheduledTaskInput {
	title: string;
	description?: string;
	trigger: ScheduleTrigger;
	action: ScheduledAction;
	timezone?: string;
}

export interface UpdateScheduledTaskInput {
	title?: string;
	description?: string;
	status?: ScheduledTaskStatus;
	trigger?: ScheduleTrigger;
	action?: ScheduledAction;
	timezone?: string;
}

export interface SchedulerActionRunner {
	run(task: ScheduledTask): Promise<unknown>;
}
