import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  NodeSandboxExecutor,
} from "../node-executor";
import path from "path";
import os from "os";
import fs from "fs";

describe("NodeSandboxExecutor", () => {
  let executor: NodeSandboxExecutor;

  beforeEach(async () => {
    executor = new NodeSandboxExecutor();
    await executor.initialize();
  });

  afterEach(async () => {
    await executor.cleanup();
  });

  it("spawns a sandboxed process on macOS", async () => {
    const platform = os.platform();
    if (platform !== "darwin") {
      return;
    }

    const handle = await executor.spawn({
      agentId: "test-agent-1",
      command: "/bin/echo",
      args: ["hello from sandbox"],
      allowWrite: [os.tmpdir()],
    });

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!handle.isRunning()) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(check);
        resolve();
      }, 5000);
    });

    expect(handle.stdout).toContain("hello from sandbox");
    expect(handle.exitCode).toBe(0);
  });

  it("enforces write restrictions", async () => {
    const platform = os.platform();
    if (platform !== "darwin") {
      return;
    }

    const protectedDir = fs.mkdtempSync(path.join(os.tmpdir(), "protected-"));
    const protectedFile = path.join(protectedDir, "secret.txt");

    const handle = await executor.spawn({
      agentId: "test-writer",
      command: "sh",
      args: ["-c", `echo "hacked" > "${protectedFile}"`],
      allowRead: [os.tmpdir()],
      allowWrite: [os.tmpdir()],
      denyWrite: [protectedDir],
    });

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!handle.isRunning()) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(check);
        resolve();
      }, 5000);
    });

    const fileExists = fs.existsSync(protectedFile);
    expect(fileExists).toBe(false);
  });

  it("timeout kills the process", async () => {
    const platform = os.platform();
    if (platform !== "darwin") {
      return;
    }

    const handle = await executor.spawn({
      agentId: "test-timeout",
      command: "sleep",
      args: ["30"],
      timeoutMs: 500,
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    expect(handle.isRunning()).toBe(false);
  });

  it("process can read allowed paths", async () => {
    const platform = os.platform();
    if (platform !== "darwin") {
      return;
    }

    const testFile = path.join(os.tmpdir(), "sandbox-test-input.txt");
    fs.writeFileSync(testFile, "allowed content");

    const handle = await executor.spawn({
      agentId: "test-reader",
      command: "/bin/cat",
      args: [testFile],
      allowRead: [os.tmpdir()],
    });

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!handle.isRunning()) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(check);
        resolve();
      }, 5000);
    });

    expect(handle.stdout).toContain("allowed content");

    fs.unlinkSync(testFile);
  });

  it("getViolations returns violations for the executor", async () => {
    const violations = executor.getViolations();
    expect(Array.isArray(violations)).toBe(true);
  });

  it("getHandle returns the correct handle", async () => {
    const platform = os.platform();
    if (platform !== "darwin") {
      return;
    }

    const handle = await executor.spawn({
      agentId: "test-handle",
      command: "sleep",
      args: ["5"],
    });

    const retrieved = executor.getHandle("test-handle");
    expect(retrieved).toBe(handle);
    expect(retrieved?.pid).toBeGreaterThan(0);

    await handle.kill();
  });
});

describe("SandboxConfig Validation", () => {
  it("accepts valid config fields", async () => {
    const platform = os.platform();
    if (platform !== "darwin") {
      return;
    }

    const executor = new NodeSandboxExecutor();
    await executor.initialize();

    const handle = await executor.spawn({
      agentId: "config-test",
      command: "/bin/echo",
      args: ["config ok"],
      workingDir: os.tmpdir(),
      allowRead: ["/tmp"],
      allowWrite: ["/tmp"],
      denyWrite: ["~/.ssh"],
      timeoutMs: 5000,
    });

    expect(handle.pid).toBeGreaterThan(0);
    expect(handle.agentId).toBe("config-test");

    await handle.kill();
    await executor.cleanup();
  });
});
