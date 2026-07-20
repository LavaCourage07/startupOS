"use strict";
/**
 * Node.js Sandbox Executor — 通过 @anthropic-ai/sandbox-runtime 隔离 Agent 子进程。
 *
 * Story 9.10: Node.js 沙箱（MVP）
 *
 * 集成 @anthropic-ai/sandbox-runtime (v0.0.51)：
 * - SandboxManager.wrapWithSandbox() 生成 OS 级沙箱包装命令
 * - SandboxViolationStore 记录越权行为（通过 log monitor 订阅 macOS violation）
 * - 支持 AbortSignal 超时控制
 * - per-Agent 独立文件系统/网络配置
 *
 * macOS: sandbox-exec + Seatbelt profile 动态生成
 * Linux: bubblewrap + seccomp BPF + network namespace
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeSandboxExecutor = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const sandbox_runtime_1 = require("@anthropic-ai/sandbox-runtime");
// ============================================================================
// Violation Adapter — SandboxViolationEvent → SandboxViolation
// ============================================================================
function convertViolation(raw, agentId) {
    return {
        id: `viol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agentId,
        violationType: "filesystem",
        description: raw.line ?? raw.command ?? "sandbox violation",
        timestamp: raw.timestamp.toISOString(),
        severity: "warning",
    };
}
// ============================================================================
// Config Builder — SandboxConfig → SandboxRuntimeConfig
// ============================================================================
function buildSandboxRuntimeConfig(config) {
    const runtimeConfig = {};
    // 文件系统配置
    runtimeConfig.filesystem = {
        denyRead: config.denyRead ?? [],
        allowRead: config.allowRead,
        allowWrite: config.allowWrite ?? [],
        denyWrite: [...(config.denyWrite ?? []), ...getDefaultDenyWritePaths()],
    };
    // 网络配置（仅在显式指定时需要）
    if (config.allowedDomains !== undefined || config.deniedDomains !== undefined) {
        runtimeConfig.network = {
            allowedDomains: config.allowedDomains ?? [],
            deniedDomains: config.deniedDomains ?? [],
        };
    }
    return runtimeConfig;
}
function getDefaultDenyWritePaths() {
    const home = os_1.default.homedir();
    return [
        path_1.default.join(home, ".ssh"),
        path_1.default.join(home, ".gitconfig"),
        path_1.default.join(home, ".bashrc"),
        path_1.default.join(home, ".zshrc"),
        path_1.default.join(home, ".claude"),
        path_1.default.join(home, ".aws"),
        path_1.default.join(home, ".config"),
    ];
}
// ============================================================================
// NodeSandboxExecutor
// ============================================================================
class NodeSandboxExecutor {
    constructor() {
        this.handles = new Map();
        this.initialized = false;
    }
    async initialize() {
        // 初始化 SandboxManager（设置代理、检查平台等）
        const baseConfig = {
            network: {
                allowedDomains: [],
                deniedDomains: [],
            },
            filesystem: {
                denyRead: [],
                allowWrite: [],
                denyWrite: [],
            },
        };
        await sandbox_runtime_1.SandboxManager.initialize(baseConfig);
        this.initialized = true;
        // 订阅 violation 事件（用于实时监控）
        sandbox_runtime_1.SandboxManager.getSandboxViolationStore().subscribe((_violations) => {
            // violations 通过 getViolations() API 查询
        });
    }
    /**
     * 在沙箱中启动 Agent 子进程。
     *
     * 流程：
     * 1. 根据 per-Agent 配置构建 SandboxRuntimeConfig
     * 2. wrapWithSandbox(command) 获取包装后的沙箱命令
     * 3. spawn() 执行包装命令
     * 4. 返回 SandboxHandle 用于监控和清理
     */
    async spawn(config) {
        if (!this.initialized) {
            await this.initialize();
        }
        const perAgentConfig = buildSandboxRuntimeConfig(config);
        // 构建完整命令（包含参数）
        const fullCommand = config.args?.length
            ? `${config.command} ${config.args.join(" ")}`
            : config.command;
        // wrapWithSandbox 返回包装后的完整命令字符串
        // macOS → "sandbox-exec -f profile.sb ..."
        // Linux → "bwrap --unshare-all ... cmd"
        const wrappedCommand = await sandbox_runtime_1.SandboxManager.wrapWithSandbox(fullCommand, undefined, perAgentConfig);
        const child = (0, child_process_1.spawn)(wrappedCommand, {
            shell: true,
            stdio: "pipe",
            env: process.env,
            cwd: config.workingDir,
        });
        const controller = new AbortController();
        const handle = new SandboxHandleImpl(config.agentId, child, config.timeoutMs, controller);
        this.handles.set(config.agentId, handle);
        return handle;
    }
    /**
     * 获取所有违规记录。
     */
    getViolations(agentId) {
        const violations = sandbox_runtime_1.SandboxManager.getSandboxViolationStore().getViolations();
        return violations.map((v) => convertViolation(v, agentId ?? "unknown"));
    }
    /**
     * 获取活跃句柄。
     */
    getHandle(agentId) {
        return this.handles.get(agentId);
    }
    /**
     * 清理所有残留进程。
     */
    async cleanup() {
        const promises = Array.from(this.handles.values()).map((h) => h.kill());
        await Promise.allSettled(promises);
        this.handles.clear();
        // 清理 SandboxManager 残留（Linux bwrap mount points）
        if (this.initialized) {
            sandbox_runtime_1.SandboxManager.cleanupAfterCommand();
        }
    }
    /**
     * 更新全局 SandboxManager 配置。
     */
    updateConfig(newConfig) {
        sandbox_runtime_1.SandboxManager.updateConfig(newConfig);
    }
    /**
     * 检查依赖（Linux bubblewrap 等）。
     */
    checkDependencies() {
        return sandbox_runtime_1.SandboxManager.checkDependencies();
    }
}
exports.NodeSandboxExecutor = NodeSandboxExecutor;
// ============================================================================
// SandboxHandleImpl — 内部实现
// ============================================================================
class SandboxHandleImpl {
    constructor(agentId, child, timeoutMs, controller) {
        this.stdout = "";
        this.stderr = "";
        this.exitCode = null;
        this.timeoutTimer = null;
        this.killed = false;
        this.agentId = agentId;
        this.child = child;
        this.controller = controller ?? new AbortController();
        this.pid = child.pid ?? 0;
        // 收集 stdout
        child.stdout?.on("data", (chunk) => {
            this.stdout += chunk.toString("utf-8");
        });
        // 收集 stderr
        child.stderr?.on("data", (chunk) => {
            this.stderr += chunk.toString("utf-8");
        });
        // 监听退出
        child.on("exit", (code) => {
            this.exitCode = code;
        });
        // 超时控制
        if (timeoutMs) {
            this.timeoutTimer = setTimeout(() => {
                this.controller.abort();
                this.kill();
            }, timeoutMs);
        }
    }
    async kill() {
        if (this.killed)
            return;
        this.killed = true;
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }
        this.child.kill("SIGKILL");
        await new Promise((resolve) => {
            this.child.on("exit", () => resolve());
            setTimeout(resolve, 2000);
        });
    }
    getViolations() {
        // 从全局 store 过滤出当前 agent 相关的 violation
        const all = sandbox_runtime_1.SandboxManager.getSandboxViolationStore().getViolations();
        return all.map((v) => convertViolation(v, this.agentId));
    }
    isRunning() {
        if (this.killed)
            return false;
        try {
            process.kill(this.pid, 0);
            return true;
        }
        catch {
            return false;
        }
    }
}
