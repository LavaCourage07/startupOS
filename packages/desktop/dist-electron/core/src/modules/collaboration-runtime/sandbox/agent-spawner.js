"use strict";
/**
 * Agent Spawner — Runtime 侧：通过 `npx tsx` 启动 Agent Worker 子进程。
 *
 * Story 9.6: PI Agent 桥接与子进程入口
 *
 * 通过 stdio JSON Line 协议与子进程通信：
 * - Runtime → 子进程：stdin 写入 JSON 命令
 * - 子进程 → Runtime：stdout 输出 JSON 事件
 *
 * 使用 `npx tsx` 运行子进程，以自动解析 TypeScript 路径别名（@/）。
 * 暂不使用 @anthropic-ai/sandbox-runtime（Story 9.10 再引入）。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentSpawner = exports.AgentProcess = void 0;
exports.getGlobalSpawner = getGlobalSpawner;
exports.shutdownGlobalSpawner = shutdownGlobalSpawner;
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const paths_1 = require("../../../lib/paths");
// ============================================================================
// Env helpers
// ============================================================================
function summarizeModel(model) {
    if (!model)
        return { provided: false };
    const credentialSource = model.anthropicCredentialSource
        ?? (model.anthropicAuthToken ? "anthropicAuthToken" : undefined)
        ?? (model.anthropicApiKey ? "anthropicApiKey" : undefined)
        ?? (model.authToken ? "authToken" : undefined)
        ?? (model.apiKey ? "apiKey" : undefined);
    return {
        provided: true,
        provider: model.provider ?? "default",
        model: model.model ?? model.id ?? "default",
        baseUrl: model.anthropicBaseUrl ?? model.baseUrl ?? "default",
        hasCredential: Boolean(model.anthropicAuthToken || model.anthropicApiKey || model.authToken || model.apiKey),
        credentialSource: credentialSource ?? "none",
        maxTokens: model.maxTokens ?? "default",
    };
}
function logRuntime(phase, data) {
    console.error(`[MultiAgentRuntime] ${phase} ${JSON.stringify(data)}`);
}
/** 从项目 .env / .env.local 文件显式读取模型配置，避免子进程继承旧 env。
 *  优先级：.env.local > .env（与 Next.js 一致）
 */
function loadModelEnvFromEnvFile() {
    const parsed = {};
    // 按低→高优先级读取，后者覆盖前者
    for (const filename of [".env", ".env.local"]) {
        try {
            const envPath = path_1.default.join((0, paths_1.getMonorepoRoot)(), filename);
            const raw = (0, fs_1.readFileSync)(envPath, "utf-8");
            for (const line of raw.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#"))
                    continue;
                const eqIdx = trimmed.indexOf("=");
                if (eqIdx < 0)
                    continue;
                const key = trimmed.substring(0, eqIdx).trim();
                let val = trimmed.substring(eqIdx + 1).trim();
                // 去掉包裹的引号（单引号或双引号）
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }
                parsed[key] = val;
            }
        }
        catch {
            // 文件不存在时跳过
        }
    }
    return parsed;
}
/** 构建子进程 env，显式注入 .env 中的模型配置。
 *  如果 .env 中某个键**未设置**（注释/不存在），则从子进程 env 中删除，避免 shell 旧值泄漏。
 */
function buildWorkerEnv(overrides, options) {
    const envFile = loadModelEnvFromEnvFile();
    const merged = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (typeof value === "string") {
            merged[key] = value;
        }
    }
    const managedKeys = [
        "ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY",
        "ANTHROPIC_MODEL", "LLM_PROVIDER",
        "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_RESOURCE_NAME", "AZURE_OPENAI_BASE_URL",
        "AZURE_OPENAI_DEPLOYMENT_NAME", "AZURE_OPENAI_API_VERSION", "AZURE_OPENAI_API_FORMAT",
        "GOOGLE_API_KEY", "GEMINI_API_KEY",
        "OPENAI_API_KEY", "OPENAI_BASE_URL",
    ];
    const strippedKeys = [];
    const overriddenKeys = [];
    for (const key of managedKeys) {
        if (options?.stripManagedLlmEnv) {
            delete merged[key];
            strippedKeys.push(key);
            continue;
        }
        if (envFile[key] !== undefined) {
            merged[key] = envFile[key];
            overriddenKeys.push(key);
        }
        else {
            // .env 中未设置 → 删除，防止 shell 旧值干扰
            delete merged[key];
            strippedKeys.push(key);
        }
    }
    if (options?.stripManagedLlmEnv) {
        console.error(`[buildWorkerEnv] stripped managed LLM env for runtime model: ${strippedKeys.join(", ") || "none"}`);
    }
    else {
        console.error(`[buildWorkerEnv] stripped keys (not in .env): ${strippedKeys.join(", ") || "none"}`);
        console.error(`[buildWorkerEnv] overridden keys (from .env): ${overriddenKeys.join(", ") || "none"}`);
    }
    return { ...merged, ...overrides };
}
/**
 * AgentProcess 包装一个 Agent Worker 子进程。
 * 通过 stdio 发送/接收 RuntimeEvent。
 */
class AgentProcess {
    constructor(id, _deps, config) {
        this.child = null;
        this.status = "stopped";
        this.pendingCommand = null;
        this.promptQueue = [];
        this.buffer = "";
        this.stderrTail = "";
        this.id = id;
        this.config = config;
    }
    // ==========================================================================
    // Lifecycle
    // ==========================================================================
    /** 启动 Agent Worker 子进程 */
    async start(onEvent) {
        this.eventHandler = onEvent;
        const startAt = Date.now();
        // 检测是否是打包环境
        const isPackaged = (() => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const electron = require('electron');
                return electron.app?.isPackaged === true;
            }
            catch {
                return false;
            }
        })();
        // 打包环境使用 extraResources 中的文件，开发环境使用源文件
        let workerPath;
        let packagedAgentWorkerDir = null;
        let packagedCoreSrcDir = null;
        let cmd;
        let args;
        if (isPackaged) {
            // 打包环境：agent-worker.mjs 通过 extraResources 放在 process.resourcesPath 下
            const resourcesPath = process.resourcesPath ?? path_1.default.dirname(process.execPath);
            packagedAgentWorkerDir = path_1.default.join(resourcesPath, 'agent-worker');
            packagedCoreSrcDir = path_1.default.join(resourcesPath, 'app.asar', 'dist-electron', 'core', 'src');
            workerPath = path_1.default.join(packagedAgentWorkerDir, 'agent-worker.mjs');
            // 使用 Electron 自带的 Node.js（process.execPath）
            // 设置 ELECTRON_RUN_AS_NODE=1 让 Electron 以 Node.js 模式运行，而不是启动新应用
            cmd = process.execPath;
            args = [workerPath];
        }
        else {
            // 开发环境：使用源文件
            workerPath = path_1.default.resolve((0, paths_1.getMonorepoRoot)(), "packages/core/src/modules/collaboration-runtime/sandbox/agent-worker.mts");
            // 开发环境：查找 tsx
            const candidates = [
                path_1.default.join((0, paths_1.getMonorepoRoot)(), "node_modules", "tsx", "dist", "cli.mjs"),
                path_1.default.join(path_1.default.dirname(process.execPath), "..", "lib", "node_modules", "tsx", "dist", "cli.mjs"),
            ];
            const tsxCli = candidates.find(p => {
                try {
                    (0, fs_1.accessSync)(p);
                    return true;
                }
                catch {
                    return false;
                }
            });
            if (tsxCli) {
                cmd = "node";
                args = [path_1.default.resolve(tsxCli), workerPath];
            }
            else {
                cmd = "npx";
                args = ["tsx", workerPath];
            }
        }
        // Resolve workingDirectory to absolute path — the child process cwd()
        // may differ from the monorepo root (especially in Electron).
        const absWorkingDir = path_1.default.isAbsolute(this.config.workingDirectory)
            ? this.config.workingDirectory
            : path_1.default.resolve((0, paths_1.getMonorepoRoot)(), this.config.workingDirectory);
        const spawnOptions = {
            shell: false,
            cwd: (0, paths_1.getMonorepoRoot)(),
            env: buildWorkerEnv({
                AGENT_PROJECT_ID: this.config.projectId,
                AGENT_ID: this.config.agentId,
                AGENT_WORKING_DIR: absWorkingDir,
                ...(this.config.collaborationSessionId ? { AGENT_COLLAB_SESSION_ID: this.config.collaborationSessionId } : {}),
                ...(this.config.blackboardDir ? { AGENT_BLACKBOARD_DIR: this.config.blackboardDir } : {}),
                // 打包环境：让 Electron 以 Node.js 模式运行，而不是启动新应用实例
                ...(isPackaged ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
                ...(packagedAgentWorkerDir ? { ORIGINOS_AGENT_WORKER_DIR: packagedAgentWorkerDir } : {}),
                ...(packagedCoreSrcDir ? { ORIGINOS_CORE_SRC_DIR: packagedCoreSrcDir } : {}),
            }, {
                // Multi-agent workers always receive an explicit runtime model from the
                // parent process. Avoid leaking .env LLM credentials into the child,
                // otherwise the SDK may read conflicting provider auth from env and
                // diverge from the runtime model used by normal windows.
                stripManagedLlmEnv: !!this.config.model,
            }),
        };
        logRuntime("process.spawn.start", {
            projectId: this.config.projectId,
            agentId: this.config.agentId,
            agentType: this.config.agentType ?? "persistent",
            workingDirectory: absWorkingDir,
            cmd,
            args: args.map((arg) => path_1.default.basename(arg)),
            hasCollaborationSessionId: Boolean(this.config.collaborationSessionId),
            hasBlackboardDir: Boolean(this.config.blackboardDir),
            packagedAgentWorkerDir: packagedAgentWorkerDir ? path_1.default.basename(packagedAgentWorkerDir) : null,
            model: summarizeModel(this.config.model),
        });
        const child = (0, child_process_1.spawn)(cmd, args, spawnOptions);
        this.child = child;
        this.status = "starting";
        logRuntime("process.spawned", {
            projectId: this.config.projectId,
            agentId: this.config.agentId,
            pid: child.pid ?? null,
            elapsedMs: Date.now() - startAt,
        });
        // stdout: JSON Line 事件流
        child.stdout?.on("data", (chunk) => {
            this.buffer += chunk.toString("utf-8");
            this.flushLines();
        });
        child.stderr?.on("data", (chunk) => {
            // Forward worker stderr to parent stderr for debugging
            const text = chunk.toString("utf-8");
            this.stderrTail = (this.stderrTail + text).slice(-4000);
            process.stderr.write(chunk);
        });
        child.on("exit", (code, signal) => {
            console.error(`[AgentProcess:${this.id}] exited (code: ${code}, signal: ${signal})`);
            logRuntime("process.exit", {
                projectId: this.config.projectId,
                agentId: this.config.agentId,
                code,
                signal,
                stderrTail: this.stderrTail.trim().slice(-1200),
            });
            this.status = "stopped";
            this.eventHandler?.({
                id: `evt-agent-end-${Date.now()}`,
                sessionId: this.config.projectId,
                seq: 0,
                type: "AGENT_END",
                payload: { exitCode: code, signal },
                source: this.id,
                timestamp: new Date().toISOString(),
            });
            this.pendingCommand?.reject(new Error(`Agent process exited with code ${code}, signal ${signal}`));
            this.pendingCommand = null;
            // Reject all queued prompts
            const exitErr = new Error(`Agent process exited with code ${code}`);
            for (const q of this.promptQueue)
                q.reject(exitErr);
            this.promptQueue = [];
        });
        child.on("error", (err) => {
            this.status = "error";
            this.pendingCommand?.reject(err);
            this.pendingCommand = null;
        });
        // 发送 initialize 命令
        await this.sendCommand({
            type: "initialize",
            config: {
                projectId: this.config.projectId,
                agentId: this.config.agentId,
                workingDirectory: absWorkingDir,
                agentType: this.config.agentType ?? "persistent",
                systemPrompt: this.config.systemPrompt,
                model: this.config.model,
            },
        });
        this.status = "running";
        logRuntime("process.initialize.ready", {
            projectId: this.config.projectId,
            agentId: this.config.agentId,
            pid: child.pid ?? null,
            elapsedMs: Date.now() - startAt,
        });
    }
    /** 发送 prompt 给 Agent Worker — 串行队列，确保不并发 */
    async prompt(message) {
        if (this.status !== "running") {
            throw new Error(`Agent ${this.id} is not running (status: ${this.status})`);
        }
        if (!this.child?.stdin) {
            throw new Error("Agent stdin not available");
        }
        // If a prompt is already in-flight, queue this one instead of clobbering
        if (this.pendingCommand) {
            return new Promise((resolve, reject) => {
                this.promptQueue.push({ message, resolve, reject });
            });
        }
        return this._sendPrompt(message);
    }
    _sendPrompt(message) {
        const promptAt = Date.now();
        logRuntime("process.prompt.send", {
            projectId: this.config.projectId,
            agentId: this.config.agentId,
            messageChars: message.length,
        });
        this.child.stdin.write(JSON.stringify({ type: "prompt", message }) + "\n");
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingCommand = null;
                reject(new Error("Prompt timed out waiting for agent response"));
                this._drainPromptQueue();
            }, 300000);
            this.pendingCommand = {
                resolve: (s) => {
                    logRuntime("process.prompt.done", {
                        projectId: this.config.projectId,
                        agentId: this.config.agentId,
                        state: s,
                        elapsedMs: Date.now() - promptAt,
                    });
                    resolve(s);
                    this._drainPromptQueue();
                },
                reject: (e) => {
                    logRuntime("process.prompt.error", {
                        projectId: this.config.projectId,
                        agentId: this.config.agentId,
                        error: e.message,
                        elapsedMs: Date.now() - promptAt,
                    });
                    reject(e);
                    this._drainPromptQueue();
                },
                timer,
            };
        });
    }
    _drainPromptQueue() {
        this.pendingCommand = null;
        const next = this.promptQueue.shift();
        if (!next)
            return;
        if (this.status !== "running" || !this.child?.stdin) {
            next.reject(new Error(`Agent ${this.id} is not running`));
            this._drainPromptQueue();
            return;
        }
        this._sendPrompt(next.message).then(next.resolve, next.reject);
    }
    /** 中断当前操作 */
    async abort() {
        if (this.status === "stopped")
            return;
        await this.sendCommand({ type: "abort" });
    }
    /** 发送 resume 给暂停的 Agent Worker，等待 agent loop 完成 */
    async resume(response) {
        if (this.status !== "running") {
            throw new Error(`Agent ${this.id} is not running (status: ${this.status})`);
        }
        if (!this.child?.stdin) {
            throw new Error("Agent stdin not available");
        }
        console.error(`[AgentProcess:${this.id}] resume: writing to stdin, response length=${response.length}`);
        // 清除任何 pending command（resume 不需要等待 ready）
        if (this.pendingCommand) {
            clearTimeout(this.pendingCommand.timer);
            this.pendingCommand = null;
        }
        // 设置等待 "ready" 信号（agent loop 完成后发送）
        const readyPromise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error("resume timed out waiting for agent response"));
            }, 300000); // 5 分钟超时
            this.pendingCommand = { resolve: () => { }, reject, timer };
            this.pendingCommand.resolve = () => { clearTimeout(timer); resolve(); };
        });
        this.child.stdin.write(JSON.stringify({ type: "resume", response }) + "\n");
        await readyPromise;
        console.error(`[AgentProcess:${this.id}] resume: agent loop completed`);
    }
    /**
     * 向 Supervisor Worker 发送协调工具调用结果（SUPA-02）。
     * glue 层执行 dispatch_worker / wait_workers / run_verifier 后通过此方法
     * 将结果回传给 supervisor 子进程，以解除其 callCoordinatorTool 等待。
     */
    sendToolResult(toolCallId, result) {
        if (!this.child?.stdin)
            return;
        this.child.stdin.write(JSON.stringify({ type: "tool_result", toolCallId, result }) + "\n");
    }
    /** 等待 Agent 下一次发出 "ready" 信号（resume 后使用） */
    async waitForReady() {
        if (this.status !== "running") {
            throw new Error(`Agent ${this.id} is not running (status: ${this.status})`);
        }
        if (this.pendingCommand) {
            clearTimeout(this.pendingCommand.timer);
            this.pendingCommand = null;
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error("waitForReady timed out waiting for agent response"));
            }, 300000);
            this.pendingCommand = { resolve, reject, timer };
        });
    }
    /** 关闭子进程 */
    async shutdown() {
        if (this.status === "stopped") {
            console.error(`[AgentProcess:${this.id}] already stopped, skipping shutdown`);
            return;
        }
        console.error(`[AgentProcess:${this.id}] shutting down (status: ${this.status})`);
        this.status = "stopping";
        try {
            await this.sendCommand({ type: "shutdown" });
            console.error(`[AgentProcess:${this.id}] shutdown command sent`);
        }
        catch {
            console.error(`[AgentProcess:${this.id}] shutdown command timed out, forcing kill`);
        }
        // 确保进程真正退出：先 kill，再等待 exit 事件
        if (this.child) {
            this.child.kill("SIGKILL");
            // 给进程 2s 退出时间
            await new Promise(resolve => {
                this.child.once("exit", () => resolve());
                setTimeout(resolve, 2000);
            });
            this.child = null;
        }
        this.status = "stopped";
        console.error(`[AgentProcess:${this.id}] process killed`);
    }
    getStatus() {
        return this.status;
    }
    // ==========================================================================
    // Internal
    // ==========================================================================
    sendCommand(cmd) {
        return new Promise((resolve, reject) => {
            if (!this.child?.stdin) {
                reject(new Error("Agent stdin not available"));
                return;
            }
            const timer = setTimeout(() => {
                console.error(`[AgentProcess:${this.id}] Command timed out after 300s waiting for child acknowledgment`);
                reject(new Error("Command timed out waiting for child acknowledgment"));
            }, 300000); // 5 分钟 — 首次初始化需要动态加载大量模块
            this.pendingCommand = { resolve, reject, timer };
            this.child.stdin.write(JSON.stringify(cmd) + "\n");
            // Do NOT resolve immediately — wait for worker to send 'ready' signal
            // which is handled by flushLines() parsing stdout.
        });
    }
    flushLines() {
        const lines = this.buffer.split("\n");
        // 最后一行可能不完整，留到下次
        this.buffer = lines.pop() ?? "";
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const msg = JSON.parse(line);
                if (msg["type"] === "ready") {
                    this.pendingCommand?.resolve("ready");
                    this.pendingCommand = null;
                }
                else if (msg["type"] === "waiting") {
                    this.pendingCommand?.resolve("waiting");
                    this.pendingCommand = null;
                }
                else if (msg["type"] === "event" && msg["event"]) {
                    this.eventHandler?.(msg["event"]);
                }
                else if (msg["type"] === "error") {
                    const err = new Error(String(msg["message"] ?? msg["error"] ?? "Unknown error"));
                    this.pendingCommand?.reject(err);
                    this.pendingCommand = null;
                }
            }
            catch (e) {
                // 忽略非 JSON 行（如 agent 直接输出的文本内容）
            }
        }
    }
}
exports.AgentProcess = AgentProcess;
// ============================================================================
// Agent Spawner — 工厂 & 生命周期管理
// ============================================================================
class AgentSpawner {
    constructor(_deps) {
        this.processes = new Map();
        void _deps;
    }
    /** 启动一个新的 Agent 子进程。如果同 ID 已在运行，先 destroy 再 spawn。 */
    async spawn(config, onEvent) {
        // 如果同 ID 已在运行，先清理旧进程
        if (this.processes.has(config.agentId)) {
            logRuntime("spawner.replace_existing", {
                projectId: config.projectId,
                agentId: config.agentId,
            });
            await this.destroy(config.agentId);
        }
        logRuntime("spawner.spawn", {
            projectId: config.projectId,
            agentId: config.agentId,
            agentType: config.agentType ?? "persistent",
            model: summarizeModel(config.model),
        });
        const proc = new AgentProcess(config.agentId, null, config);
        await proc.start(onEvent);
        this.processes.set(config.agentId, proc);
        logRuntime("spawner.spawn.ready", {
            projectId: config.projectId,
            agentId: config.agentId,
            runningProcesses: this.processes.size,
        });
        return proc;
    }
    /** 停止指定 Agent */
    async stop(agentId) {
        const proc = this.processes.get(agentId);
        if (!proc)
            return;
        await proc.shutdown();
        this.processes.delete(agentId);
    }
    /** 停止并立即清理指定 Agent（同步标记，不等待） */
    forceStop(agentId) {
        const proc = this.processes.get(agentId);
        if (!proc)
            return;
        // 立即从 map 中移除，避免竞态
        this.processes.delete(agentId);
        // 触发异步关闭（内部会 kill）
        proc.shutdown().catch(() => { });
    }
    /** 停止并彻底销毁指定 Agent（保证子进程被清理） */
    async destroy(agentId) {
        const proc = this.processes.get(agentId);
        if (!proc)
            return;
        // shutdown 内部会 kill，等它完成
        await proc.shutdown();
        // 从 map 中移除
        this.processes.delete(agentId);
    }
    /** 获取 Agent 实例 */
    get(agentId) {
        return this.processes.get(agentId);
    }
    /** 列出所有运行中的 Agent */
    list() {
        return Array.from(this.processes.values());
    }
    /** 停止所有 Agent */
    async stopAll() {
        const promises = Array.from(this.processes.keys()).map((id) => this.stop(id));
        await Promise.all(promises);
    }
    /** 清理已停止的 Agent */
    cleanup() {
        for (const [id, proc] of this.processes) {
            if (proc.getStatus() === "stopped") {
                this.processes.delete(id);
            }
        }
    }
}
exports.AgentSpawner = AgentSpawner;
function getGlobalSpawnerVar() { return globalThis.__globalSpawner; }
function setGlobalSpawnerVar(v) { globalThis.__globalSpawner = v; }
function getCleanupTimerVar() { return globalThis.__cleanupTimer; }
function setCleanupTimerVar(v) { globalThis.__cleanupTimer = v; }
function getGlobalSpawner() {
    let globalSpawner = getGlobalSpawnerVar();
    let cleanupTimer = getCleanupTimerVar();
    if (!globalSpawner) {
        globalSpawner = new AgentSpawner(null);
        setGlobalSpawnerVar(globalSpawner);
        cleanupTimer = setInterval(() => {
            getGlobalSpawnerVar()?.cleanup();
        }, 60 * 1000);
        setCleanupTimerVar(cleanupTimer);
        cleanupTimer.unref();
    }
    return globalSpawner;
}
async function shutdownGlobalSpawner() {
    console.error(`[AgentSpawner] Global shutdown started`);
    let cleanupTimer = getCleanupTimerVar();
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        setCleanupTimerVar(undefined);
    }
    let globalSpawner = getGlobalSpawnerVar();
    if (globalSpawner) {
        const processes = globalSpawner.list();
        console.error(`[AgentSpawner] Stopping ${processes.length} running processes`);
        await globalSpawner.stopAll();
    }
    setGlobalSpawnerVar(undefined);
    console.error(`[AgentSpawner] Global shutdown complete`);
}
// 进程退出时自动清理所有子进程
process.on('exit', () => {
    const g = getGlobalSpawnerVar();
    if (g) {
        const procs = g.list();
        if (procs.length > 0) {
            console.error(`[AgentSpawner] Process exit: force killing ${procs.length} subprocesses`);
            for (const p of procs) {
                try {
                    p['child']?.kill('SIGKILL');
                }
                catch { }
            }
        }
    }
});
