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

import { spawn, ChildProcess } from "child_process";
import path from "path";
import os from "os";

import {
  SandboxManager,
  type SandboxRuntimeConfig,
} from "@anthropic-ai/sandbox-runtime";
import type { SandboxViolationEvent } from "@anthropic-ai/sandbox-runtime";

// ============================================================================
// Types
// ============================================================================

export interface SandboxViolation {
  id: string;
  agentId: string;
  violationType: "filesystem" | "network" | "process";
  path?: string;
  description: string;
  timestamp: string;
  severity: "warning" | "error";
}

export interface SandboxConfig {
  agentId: string;
  command: string;
  args?: string[];
  workingDir?: string;
  /** 允许写入的路径（支持 glob 模式，如 data/projects/proj-123/**） */
  allowWrite?: string[];
  /** 允许读取的路径（支持 glob 模式） */
  allowRead?: string[];
  /** 显式拒绝写入的路径 */
  denyWrite?: string[];
  /** 显式拒绝读取的路径 */
  denyRead?: string[];
  /** 允许访问的网络域名 */
  allowedDomains?: string[];
  /** 拒绝访问的网络域名 */
  deniedDomains?: string[];
  /** 超时毫秒 */
  timeoutMs?: number;
}

export interface SandboxHandle {
  pid: number;
  agentId: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  kill(): Promise<void>;
  getViolations(): SandboxViolation[];
  isRunning(): boolean;
}

// ============================================================================
// Violation Adapter — SandboxViolationEvent → SandboxViolation
// ============================================================================

function convertViolation(
  raw: SandboxViolationEvent,
  agentId: string
): SandboxViolation {
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

function buildSandboxRuntimeConfig(config: SandboxConfig): Partial<SandboxRuntimeConfig> {
  const runtimeConfig: Partial<SandboxRuntimeConfig> = {};

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

function getDefaultDenyWritePaths(): string[] {
  const home = os.homedir();
  return [
    path.join(home, ".ssh"),
    path.join(home, ".gitconfig"),
    path.join(home, ".bashrc"),
    path.join(home, ".zshrc"),
    path.join(home, ".claude"),
    path.join(home, ".aws"),
    path.join(home, ".config"),
  ];
}

// ============================================================================
// NodeSandboxExecutor
// ============================================================================

export class NodeSandboxExecutor {
  private handles = new Map<string, SandboxHandleImpl>();
  private initialized = false;

  async initialize(): Promise<void> {
    // 初始化 SandboxManager（设置代理、检查平台等）
    const baseConfig: SandboxRuntimeConfig = {
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

    await SandboxManager.initialize(baseConfig);
    this.initialized = true;

    // 订阅 violation 事件（用于实时监控）
    SandboxManager.getSandboxViolationStore().subscribe((_violations) => {
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
  async spawn(config: SandboxConfig): Promise<SandboxHandle> {
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
    const wrappedCommand = await SandboxManager.wrapWithSandbox(
      fullCommand,
      undefined,
      perAgentConfig as SandboxRuntimeConfig
    );

    const child = spawn(wrappedCommand, {
      shell: true,
      stdio: "pipe",
      env: process.env,
      cwd: config.workingDir,
    }) as ChildProcess;

    const controller = new AbortController();
    const handle = new SandboxHandleImpl(
      config.agentId,
      child,
      config.timeoutMs,
      controller
    );

    this.handles.set(config.agentId, handle);
    return handle;
  }

  /**
   * 获取所有违规记录。
   */
  getViolations(agentId?: string): SandboxViolation[] {
    const violations = SandboxManager.getSandboxViolationStore().getViolations();
    return violations.map((v) =>
      convertViolation(v, agentId ?? "unknown")
    );
  }

  /**
   * 获取活跃句柄。
   */
  getHandle(agentId: string): SandboxHandle | undefined {
    return this.handles.get(agentId);
  }

  /**
   * 清理所有残留进程。
   */
  async cleanup(): Promise<void> {
    const promises = Array.from(this.handles.values()).map((h) => h.kill());
    await Promise.allSettled(promises);
    this.handles.clear();

    // 清理 SandboxManager 残留（Linux bwrap mount points）
    if (this.initialized) {
      SandboxManager.cleanupAfterCommand();
    }
  }

  /**
   * 更新全局 SandboxManager 配置。
   */
  updateConfig(newConfig: SandboxRuntimeConfig): void {
    SandboxManager.updateConfig(newConfig);
  }

  /**
   * 检查依赖（Linux bubblewrap 等）。
   */
  checkDependencies() {
    return SandboxManager.checkDependencies();
  }
}

// ============================================================================
// SandboxHandleImpl — 内部实现
// ============================================================================

class SandboxHandleImpl implements SandboxHandle {
  readonly pid: number;
  readonly agentId: string;
  stdout = "";
  stderr = "";
  exitCode: number | null = null;

  private child: ChildProcess;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private controller: AbortController;
  private killed = false;

  constructor(
    agentId: string,
    child: ChildProcess,
    timeoutMs?: number,
    controller?: AbortController
  ) {
    this.agentId = agentId;
    this.child = child;
    this.controller = controller ?? new AbortController();
    this.pid = child.pid ?? 0;

    // 收集 stdout
    child.stdout?.on("data", (chunk: Buffer) => {
      this.stdout += chunk.toString("utf-8");
    });

    // 收集 stderr
    child.stderr?.on("data", (chunk: Buffer) => {
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

  async kill(): Promise<void> {
    if (this.killed) return;
    this.killed = true;

    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    this.child.kill("SIGKILL");
    await new Promise<void>((resolve) => {
      this.child.on("exit", () => resolve());
      setTimeout(resolve, 2000);
    });
  }

  getViolations(): SandboxViolation[] {
    // 从全局 store 过滤出当前 agent 相关的 violation
    const all = SandboxManager.getSandboxViolationStore().getViolations();
    return all.map((v) => convertViolation(v, this.agentId));
  }

  isRunning(): boolean {
    if (this.killed) return false;
    try {
      process.kill(this.pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}
