import type {
	CreateScheduledTaskInput,
	ScheduledTask,
	ScheduledTaskRun,
	SchedulerActionRunner,
	ScheduleTrigger,
	UpdateScheduledTaskInput,
} from "./types";
import { scheduleStore, type ScheduleStore } from "./schedule-store";

function nowIso(): string {
	return new Date().toISOString();
}

function createId(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSystemTimezone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function parseDate(value: string, fieldName: string): Date {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid ${fieldName}: ${value}`);
	}
	return date;
}

function parseCron(expression: string): { minute: number | "*"; hour: number | "*" } {
	const parts = expression.trim().split(/\s+/);
	if (parts.length !== 5) {
		throw new Error("Only standard 5-field cron expressions are supported");
	}
	const [minutePart, hourPart] = parts;
	if (!minutePart || !hourPart) {
		throw new Error("Cron expression must include minute and hour fields");
	}
	const parsePart = (value: string, min: number, max: number, label: string): number | "*" => {
		if (value === "*") return "*";
		if (!/^\d+$/.test(value)) {
			throw new Error(`Unsupported cron ${label}: ${value}`);
		}
		const parsed = Number(value);
		if (parsed < min || parsed > max) {
			throw new Error(`Cron ${label} out of range: ${value}`);
		}
		return parsed;
	};
	return {
		minute: parsePart(minutePart, 0, 59, "minute"),
		hour: parsePart(hourPart, 0, 23, "hour"),
	};
}

export function computeNextRunAt(trigger: ScheduleTrigger, from: Date = new Date()): string {
	if (trigger.type === "once") {
		const runAt = parseDate(trigger.runAt, "runAt");
		if (runAt.getTime() <= from.getTime()) {
			throw new Error("once trigger runAt must be in the future");
		}
		return runAt.toISOString();
	}

	if (trigger.type === "interval") {
		if (!Number.isFinite(trigger.everyMs) || trigger.everyMs < 1000) {
			throw new Error("interval trigger everyMs must be at least 1000");
		}
		const start = trigger.startAt ? parseDate(trigger.startAt, "startAt") : from;
		const end = trigger.endAt ? parseDate(trigger.endAt, "endAt") : undefined;
		let next = start.getTime() > from.getTime() ? start.getTime() : from.getTime() + trigger.everyMs;
		if (end && next > end.getTime()) {
			throw new Error("interval trigger has no future run before endAt");
		}
		return new Date(next).toISOString();
	}

	const cron = parseCron(trigger.expression);
	const candidate = new Date(from.getTime() + 60_000);
	candidate.setSeconds(0, 0);
	for (let i = 0; i < 366 * 24 * 60; i += 1) {
		const minuteMatches = cron.minute === "*" || candidate.getMinutes() === cron.minute;
		const hourMatches = cron.hour === "*" || candidate.getHours() === cron.hour;
		if (minuteMatches && hourMatches) {
			return candidate.toISOString();
		}
		candidate.setMinutes(candidate.getMinutes() + 1);
	}
	throw new Error("cron trigger has no future run in search window");
}

export class SchedulerService {
	constructor(
		private readonly store: ScheduleStore = scheduleStore,
		private readonly runner?: SchedulerActionRunner
	) {}

	async listTasks(): Promise<ScheduledTask[]> {
		return this.store.listTasks();
	}

	async createTask(input: CreateScheduledTaskInput): Promise<ScheduledTask> {
		const timestamp = nowIso();
		const task: ScheduledTask = {
			id: createId("schedule"),
			title: input.title,
			...(input.description ? { description: input.description } : {}),
			status: "enabled",
			trigger: input.trigger,
			action: input.action,
			timezone: input.timezone ?? getSystemTimezone(),
			nextRunAt: computeNextRunAt(input.trigger),
			createdAt: timestamp,
			updatedAt: timestamp,
		};
		const tasks = await this.store.listTasks();
		await this.store.saveTasks([...tasks, task]);
		return task;
	}

	async updateTask(taskId: string, input: UpdateScheduledTaskInput): Promise<ScheduledTask> {
		const tasks = await this.store.listTasks();
		const index = tasks.findIndex((task) => task.id === taskId);
		if (index < 0) throw new Error(`Scheduled task not found: ${taskId}`);
		const existing = tasks[index];
		if (!existing) throw new Error(`Scheduled task not found: ${taskId}`);
		const trigger = input.trigger ?? existing.trigger;
		const status = input.status ?? existing.status;
		const task: ScheduledTask = {
			...existing,
			...input,
			status,
			trigger,
			nextRunAt: status === "enabled" && (input.trigger || existing.status !== "enabled")
				? computeNextRunAt(trigger)
				: existing.nextRunAt,
			updatedAt: nowIso(),
		};
		tasks[index] = task;
		await this.store.saveTasks(tasks);
		return task;
	}

	async deleteTask(taskId: string): Promise<boolean> {
		const tasks = await this.store.listTasks();
		const next = tasks.filter((task) => task.id !== taskId);
		if (next.length === tasks.length) return false;
		await this.store.saveTasks(next);
		return true;
	}

	async runTask(taskId: string): Promise<ScheduledTaskRun> {
		const tasks = await this.store.listTasks();
		const index = tasks.findIndex((task) => task.id === taskId);
		if (index < 0) throw new Error(`Scheduled task not found: ${taskId}`);
		return this.runAndPersist(tasks, index);
	}

	async runDueTasks(referenceTime: Date = new Date()): Promise<ScheduledTaskRun[]> {
		const tasks = await this.store.listTasks();
		const runs: ScheduledTaskRun[] = [];
		for (let i = 0; i < tasks.length; i += 1) {
			const task = tasks[i];
			if (!task) continue;
			if (task.status !== "enabled") continue;
			if (parseDate(task.nextRunAt, "nextRunAt").getTime() > referenceTime.getTime()) continue;
			runs.push(await this.runAndPersist(tasks, i, referenceTime));
		}
		return runs;
	}

	private async runAndPersist(tasks: ScheduledTask[], index: number, referenceTime: Date = new Date()): Promise<ScheduledTaskRun> {
		const task = tasks[index];
		if (!task) throw new Error(`Scheduled task not found at index: ${index}`);
		const startedAt = nowIso();
		let run: ScheduledTaskRun;
		try {
			const result = this.runner ? await this.runner.run(task) : { skipped: true, reason: "No scheduler action runner configured" };
			run = {
				id: createId("schedule-run"),
				taskId: task.id,
				startedAt,
				endedAt: nowIso(),
				status: this.runner ? "success" : "skipped",
				actionType: task.action.type,
				result,
			};
			tasks[index] = this.advanceTask(task, referenceTime, run.status === "success" ? undefined : "failed");
		} catch (error) {
			run = {
				id: createId("schedule-run"),
				taskId: task.id,
				startedAt,
				endedAt: nowIso(),
				status: "failed",
				actionType: task.action.type,
				error: error instanceof Error ? error.message : String(error),
			};
			tasks[index] = this.advanceTask(task, referenceTime, "failed");
		}
		await this.store.appendRun(run);
		await this.store.saveTasks(tasks);
		return run;
	}

	private advanceTask(task: ScheduledTask, referenceTime: Date, failureStatus?: "failed"): ScheduledTask {
		const timestamp = nowIso();
		if (task.trigger.type === "once") {
			return {
				...task,
				status: failureStatus ?? "completed",
				lastRunAt: timestamp,
				updatedAt: timestamp,
			};
		}
		try {
			return {
				...task,
				status: failureStatus ?? "enabled",
				lastRunAt: timestamp,
				nextRunAt: computeNextRunAt(task.trigger, referenceTime),
				updatedAt: timestamp,
			};
		} catch {
			return {
				...task,
				status: "completed",
				lastRunAt: timestamp,
				updatedAt: timestamp,
			};
		}
	}
}
