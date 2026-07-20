import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import os from "os";
import { bashTools, __test__ } from "../bash-tools";
import { getToolContextManager } from "../context";

interface ExecuteCommandDetails {
  success: boolean;
  stdout: string;
  shell: string;
  error?: string;
}

function tempDir(): string {
  return join(
    os.tmpdir(),
    `originos-shell-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
}

describe("execute_command shell resolution", () => {
  const originalShell = process.env["SHELL"];
  const executeCommand = bashTools.find((tool) => tool.name === "execute_command");
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = tempDir();
    mkdirSync(tmpRoot, { recursive: true });
    getToolContextManager().clear();
  });

  afterEach(() => {
    if (originalShell === undefined) {
      delete process.env["SHELL"];
    } else {
      process.env["SHELL"] = originalShell;
    }

    getToolContextManager().clear();

    if (existsSync(tmpRoot)) {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("treats whitespace-separated SHELL as shell candidates", async () => {
    expect(executeCommand).toBeDefined();
    process.env["SHELL"] = "zsh bash";

    const result = await executeCommand!.execute("shell-candidates", {
      command: "printf __originos_shell_ok__",
      workingDirectory: tmpRoot,
      timeout: 10000,
    });
    const details = result.details as ExecuteCommandDetails;

    expect(details.success).toBe(true);
    expect(details.stdout).toContain("__originos_shell_ok__");
    expect(details.shell).not.toContain(" ");
  });

  it("falls back to the next candidate when the first shell is unavailable", async () => {
    expect(executeCommand).toBeDefined();
    process.env["SHELL"] = "originos-missing-shell bash";

    const result = await executeCommand!.execute("shell-fallback", {
      command: "printf __originos_shell_fallback__",
      workingDirectory: tmpRoot,
      timeout: 10000,
    });
    const details = result.details as ExecuteCommandDetails;

    expect(details.success).toBe(true);
    expect(details.stdout).toContain("__originos_shell_fallback__");
    expect(details.shell).not.toContain("originos-missing-shell");
  });
});

// ============================================================================
// Windows 平台 shell 与工作目录解析（mock process.platform，不真实 spawn）
// ============================================================================

describe("Windows shell resolution (mock win32)", () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  const originalComspec = process.env["ComSpec"];
  const originalPath = process.env["PATH"];
  const originalUserprofile = process.env["USERPROFILE"];
  const originalHome = process.env["HOME"];

  beforeEach(() => {
    getToolContextManager().clear();
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    process.env["ComSpec"] = "C:\\Windows\\System32\\cmd.exe";
    process.env["PATH"] = "C:\\Program Files\\PowerShell\\7;C:\\Windows\\System32";
    process.env["USERPROFILE"] = "C:\\Users\\testuser";
    delete process.env["HOME"];
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, "platform", originalPlatform);
    }
    if (originalComspec === undefined) {
      delete process.env["ComSpec"];
    } else {
      process.env["ComSpec"] = originalComspec;
    }
    if (originalPath === undefined) {
      delete process.env["PATH"];
    } else {
      process.env["PATH"] = originalPath;
    }
    if (originalUserprofile === undefined) {
      delete process.env["USERPROFILE"];
    } else {
      process.env["USERPROFILE"] = originalUserprofile;
    }
    if (originalHome === undefined) {
      delete process.env["HOME"];
    } else {
      process.env["HOME"] = originalHome;
    }
    vi.restoreAllMocks();
  });

  it("isWindowsPlatform returns true under mock win32", () => {
    expect(__test__.isWindowsPlatform()).toBe(true);
  });

  it("shellName extracts pwsh from a Windows path on any platform", () => {
    // 非要：shellName 在 macOS 上解析 Windows 路径也必须取到 pwsh，
    // 否则 isPowerShell 误判，会回退到 bash -c 分支（曾导致 /workspace）。
    expect(__test__.shellName("C:\\Program Files\\PowerShell\\7\\pwsh.exe")).toBe("pwsh");
    expect(__test__.shellName("C:\\Windows\\System32\\cmd.exe")).toBe("cmd");
    expect(__test__.shellName("C:\\Program Files\\Git\\bin\\bash.exe")).toBe("bash");
  });

  it("PowerShell invocation skips ~/.zshrc source and uses -NoProfile", () => {
    const pwsh = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";
    const { shellArgs } = __test__.buildShellInvocation(pwsh, "echo hello");
    expect(shellArgs[0]).toBe("-NoProfile");
    expect(shellArgs.some((a) => a.includes("source"))).toBe(false);
    expect(shellArgs.some((a) => a.includes("zshrc"))).toBe(false);
  });

  it("cmd.exe invocation uses /c without Unix config loading", () => {
    const cmd = "C:\\Windows\\System32\\cmd.exe";
    const { shellArgs } = __test__.buildShellInvocation(cmd, "dir");
    expect(shellArgs).toContain("/c");
    expect(shellArgs.some((a) => a.includes("source"))).toBe(false);
  });

  it("Git Bash fallback on Windows injects HOME from USERPROFILE", () => {
    const bashExe = "C:\\Program Files\\Git\\bin\\bash.exe";
    const { env } = __test__.buildShellInvocation(bashExe, "pwd");
    expect(env["HOME"]).toBe("C:\\Users\\testuser");
    expect(env["MSYS2_ARG_CONV_EXCL"]).toBe("*");
  });

  it("PowerShell on Windows does not inject MSYS HOME (only Git Bash does)", () => {
    const pwsh = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";
    const { env } = __test__.buildShellInvocation(pwsh, "pwd");
    expect(env["HOME"]).toBeUndefined();
    expect(env["MSYS2_ARG_CONV_EXCL"]).toBeUndefined();
  });

  it("resolveWorkingDirectory keeps Windows absolute path as-is", async () => {
    const winPath = "C:\\Users\\testuser\\AppData\\Roaming\\OriginOS\\data\\skills\\x";
    const resolved = await __test__.resolveWorkingDirectory(winPath);
    // Windows 绝对路径不应被当相对路径拼上 getDataRoot()
    expect(resolved).toBe(winPath);
    expect(resolved).not.toContain("/workspace");
  });

  it("resolveWorkingDirectory does not produce /workspace for relative path on Windows", async () => {
    // tool context 未设时，相对路径拼 getDataRoot()，结果不应是 /workspace
    const resolved = await __test__.resolveWorkingDirectory("skills/my-skill");
    expect(resolved).not.toBe("/workspace");
    expect(resolved).not.toMatch(/^\/workspace/);
  });
});
