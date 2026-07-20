/**
 * OrphanReconciler — PID 孤儿会话检测与回收（Story 9.24）。
 *
 * 借鉴 Ruflo #1799 方案：协作会话创建时记录宿主进程 PID，
 * 后续加载时检测孤儿会话并自动清理。
 *
 * 回收策略：
 * - PID-based: process.kill(pid, 0) → ESRCH 标记 terminated
 * - PID-based: process.kill(pid, 0) → EPERM 跳过（其他用户）
 * - TTL fallback: 无 PID 且 updatedAt > 24h 标记 terminated
 */

import fs from "fs/promises";
import path from "path";
import type { CollaborationSession, OrphanReport } from "./types";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSIONS_STATE_FILE = "collaboration-sessions.state.json";

interface SessionsStateFile {
  sessions: CollaborationSession[];
  savedAt: string; // ISO 8601
}

/**
 * 检测进程是否存活。
 * signal 0 仅检测进程存在，不发送信号。
 */
export function checkProcessAlive(pid: number): "alive" | "dead" | "unknown" {
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ESRCH") return "dead";
    if (error.code === "EPERM") return "alive";
    return "unknown";
  }
}

export class OrphanReconciler {
  constructor(
    private stateDir: string,
    private ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  // ==========================================================================
  // 持久化
  // ==========================================================================

  /** 保存会话状态到磁盘 */
  async saveSessions(sessions: CollaborationSession[]): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    const stateFile: SessionsStateFile = {
      sessions,
      savedAt: new Date().toISOString(),
    };
    await fs.writeFile(
      path.join(this.stateDir, SESSIONS_STATE_FILE),
      JSON.stringify(stateFile, null, 2),
      "utf-8",
    );
  }

  /** 从磁盘加载会话状态 */
  async loadSessions(): Promise<CollaborationSession[]> {
    const filePath = path.join(this.stateDir, SESSIONS_STATE_FILE);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const stateFile: SessionsStateFile = JSON.parse(content);
      return stateFile.sessions ?? [];
    } catch {
      return [];
    }
  }

  // ==========================================================================
  // PID 记录
  // ==========================================================================

  /** 创建会话时记录 PID */
  recordPid(session: CollaborationSession): CollaborationSession {
    return {
      ...session,
      hostPid: process.pid,
    };
  }

  // ==========================================================================
  // 孤儿检测
  // ==========================================================================

  /**
   * 检测单个会话是否为孤儿。
   */
  private checkSession(session: CollaborationSession): OrphanReport {
    // 已经终止的会话不需要检测
    if (session.status === "terminated" || session.status === "completed" || session.status === "aborted") {
      return {
        sessionId: session.id,
        hostPid: session.hostPid ?? null,
        status: "alive",
        reason: "already_terminal",
        action: "kept",
      };
    }

    // 有 PID：检测进程存活
    if (session.hostPid !== undefined) {
      const alive = checkProcessAlive(session.hostPid);
      if (alive === "dead") {
        return {
          sessionId: session.id,
          hostPid: session.hostPid,
          status: "orphan",
          reason: `ESRCH: process ${session.hostPid} is dead`,
          action: "terminated",
        };
      }
      if (alive === "alive") {
        return {
          sessionId: session.id,
          hostPid: session.hostPid,
          status: "alive",
          reason: `EPERM or alive: process ${session.hostPid} is running`,
          action: "kept",
        };
      }
      return {
        sessionId: session.id,
        hostPid: session.hostPid,
        status: "unknown",
        reason: `unknown: process ${session.hostPid} check inconclusive`,
        action: "pending",
      };
    }

    // 无 PID：TTL 兜底检查
    const updatedAt = new Date(session.updatedAt).getTime();
    const ageMs = Date.now() - updatedAt;
    if (ageMs > this.ttlMs) {
      return {
        sessionId: session.id,
        hostPid: null,
        status: "orphan",
        reason: `TTL expired: last updated ${Math.round(ageMs / 60000)}min ago (threshold: ${Math.round(this.ttlMs / 60000)}min)`,
        action: "terminated",
      };
    }

    return {
      sessionId: session.id,
      hostPid: null,
      status: "alive",
      reason: `within TTL (${Math.round(ageMs / 60000)}min < ${Math.round(this.ttlMs / 60000)}min)`,
      action: "kept",
    };
  }

  /**
   * 检测所有运行中的会话是否为孤儿。
   */
  async detectOrphans(sessions: CollaborationSession[]): Promise<OrphanReport[]> {
    const reports: OrphanReport[] = [];
    for (const session of sessions) {
      if (session.status === "running" || session.status === "created") {
        reports.push(this.checkSession(session));
      }
    }
    return reports;
  }

  /**
   * 根据检测报告清理孤儿会话。
   */
  async reconcile(
    sessions: CollaborationSession[],
    reports: OrphanReport[],
  ): Promise<CollaborationSession[]> {
    const updated = new Map<string, CollaborationSession>();

    for (const report of reports) {
      if (report.action === "terminated") {
        const session = sessions.find((s) => s.id === report.sessionId);
        if (session) {
          updated.set(session.id, {
            ...session,
            status: "terminated" as const,
            terminationReason: report.reason,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    return sessions.map((s) => updated.get(s.id) ?? s);
  }

  /**
   * 检查 TTL 过期的会话（无 PID 的旧条目）。
   */
  async checkTTLExpired(sessions: CollaborationSession[]): Promise<OrphanReport[]> {
    const reports: OrphanReport[] = [];
    for (const session of sessions) {
      if (session.status === "terminated" || session.status === "completed" || session.status === "aborted") {
        continue;
      }
      if (session.hostPid !== undefined) continue; // 有 PID 的走 PID 检测

      const updatedAt = new Date(session.updatedAt).getTime();
      const ageMs = Date.now() - updatedAt;
      if (ageMs > this.ttlMs) {
        reports.push({
          sessionId: session.id,
          hostPid: null,
          status: "orphan",
          reason: `TTL expired: last updated ${Math.round(ageMs / 60000)}min ago`,
          action: "terminated",
        });
      }
    }
    return reports;
  }

  /**
   * 完整回收流程：检测 → 清理 → 持久化。
   * 返回被回收的会话列表。
   */
  async runReconciliation(sessions: CollaborationSession[]): Promise<OrphanReport[]> {
    const reports = await this.detectOrphans(sessions);

    // 额外检查无 PID 的 TTL 过期会话
    const ttlReports = await this.checkTTLExpired(sessions);
    const allReports = [...reports, ...ttlReports];

    const terminated = allReports.filter((r) => r.action === "terminated");
    if (terminated.length > 0) {
      const reconciled = await this.reconcile(sessions, allReports);
      await this.saveSessions(reconciled);
    }

    return allReports;
  }
}
