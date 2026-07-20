"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleStore = exports.ScheduleStore = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const paths_1 = require("../../lib/paths");
const STORE_VERSION = "1.0.0";
const TASKS_FILE = "tasks.json";
function schedulesDir() {
    return path_1.default.join((0, paths_1.getDataRoot)(), "schedules");
}
function runsDir() {
    return path_1.default.join(schedulesDir(), "runs");
}
function tasksPath() {
    return path_1.default.join(schedulesDir(), TASKS_FILE);
}
async function ensureDirs() {
    await fs_1.promises.mkdir(runsDir(), { recursive: true });
}
class ScheduleStore {
    async listTasks() {
        await ensureDirs();
        try {
            const raw = await fs_1.promises.readFile(tasksPath(), "utf-8");
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed.data) ? parsed.data : [];
        }
        catch (error) {
            if (error.code === "ENOENT")
                return [];
            if (error instanceof SyntaxError)
                return [];
            throw error;
        }
    }
    async saveTasks(tasks) {
        await ensureDirs();
        const existing = await this.readTasksFile();
        const now = new Date().toISOString();
        const file = {
            version: STORE_VERSION,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            data: tasks,
        };
        await fs_1.promises.writeFile(tasksPath(), JSON.stringify(file, null, 2), "utf-8");
    }
    async getTask(taskId) {
        const tasks = await this.listTasks();
        return tasks.find((task) => task.id === taskId);
    }
    async appendRun(run) {
        await ensureDirs();
        const line = JSON.stringify(run);
        await fs_1.promises.appendFile(path_1.default.join(runsDir(), `${run.taskId}.jsonl`), `${line}\n`, "utf-8");
    }
    async readTasksFile() {
        try {
            const raw = await fs_1.promises.readFile(tasksPath(), "utf-8");
            return JSON.parse(raw);
        }
        catch (error) {
            if (error.code === "ENOENT" || error instanceof SyntaxError) {
                return null;
            }
            throw error;
        }
    }
}
exports.ScheduleStore = ScheduleStore;
exports.scheduleStore = new ScheduleStore();
