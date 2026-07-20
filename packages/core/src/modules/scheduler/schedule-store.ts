import { promises as fs } from "fs";
import path from "path";
import { getDataRoot } from "../../lib/paths";
import type { ScheduledTask, ScheduledTaskRun } from "./types";

interface DataFile<T> {
	version: string;
	createdAt: string;
	updatedAt: string;
	data: T;
}

const STORE_VERSION = "1.0.0";
const TASKS_FILE = "tasks.json";

function schedulesDir(): string {
	return path.join(getDataRoot(), "schedules");
}

function runsDir(): string {
	return path.join(schedulesDir(), "runs");
}

function tasksPath(): string {
	return path.join(schedulesDir(), TASKS_FILE);
}

async function ensureDirs(): Promise<void> {
	await fs.mkdir(runsDir(), { recursive: true });
}

export class ScheduleStore {
	async listTasks(): Promise<ScheduledTask[]> {
		await ensureDirs();
		try {
			const raw = await fs.readFile(tasksPath(), "utf-8");
			const parsed = JSON.parse(raw) as DataFile<ScheduledTask[]>;
			return Array.isArray(parsed.data) ? parsed.data : [];
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
			if (error instanceof SyntaxError) return [];
			throw error;
		}
	}

	async saveTasks(tasks: ScheduledTask[]): Promise<void> {
		await ensureDirs();
		const existing = await this.readTasksFile();
		const now = new Date().toISOString();
		const file: DataFile<ScheduledTask[]> = {
			version: STORE_VERSION,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
			data: tasks,
		};
		await fs.writeFile(tasksPath(), JSON.stringify(file, null, 2), "utf-8");
	}

	async getTask(taskId: string): Promise<ScheduledTask | undefined> {
		const tasks = await this.listTasks();
		return tasks.find((task) => task.id === taskId);
	}

	async appendRun(run: ScheduledTaskRun): Promise<void> {
		await ensureDirs();
		const line = JSON.stringify(run);
		await fs.appendFile(path.join(runsDir(), `${run.taskId}.jsonl`), `${line}\n`, "utf-8");
	}

	private async readTasksFile(): Promise<DataFile<ScheduledTask[]> | null> {
		try {
			const raw = await fs.readFile(tasksPath(), "utf-8");
			return JSON.parse(raw) as DataFile<ScheduledTask[]>;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) {
				return null;
			}
			throw error;
		}
	}
}

export const scheduleStore = new ScheduleStore();
