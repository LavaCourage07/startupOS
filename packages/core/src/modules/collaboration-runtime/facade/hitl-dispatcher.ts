/**
 * Facade — HITL 用户回复路由
 *
 * 迁移自 src/lib/collaboration-runtime-service/index.ts（Story 9.38）
 * 职责：sendMessageToSupervisor、respondToHumanReview
 *
 * 依赖：session-store（sessions、eventStores、blackboards）、event-bus（eventEmitter）
 */

import path from "path";
import { getDataRoot } from '../../../lib/paths';
import { normalizeRuntimeLLMConfig } from "../../../lib/integrations/pi-agent/llm-config";
import { readUserConfigWithProductDefaults, userLLMConfigToRuntimeLLMConfig } from "../../../lib/features/user-config";
import { Blackboard } from "../../../modules/collaboration-runtime/session/blackboard";
import { FsEventStore } from "../../../modules/collaboration-runtime/session/fs-event-store";
import type { RuntimeEvent } from "../../../modules/collaboration-runtime/session/types";
import type { RuntimeLLMConfig } from "../../../lib/integrations/pi-agent/llm-config";

import {
  sessions,
  eventStores,
  blackboards,
  loadPersistedSessions,
} from "./session-store";
import { eventEmitter } from "./event-bus";

// startDag 需要前向引用，通过 setStartDag 注入（避免循环依赖）
let _startDag: ((session: import("../../../modules/collaboration-runtime/session/types").CollaborationSession, store: FsEventStore, id: string) => Promise<{ status: string; result: unknown }>) | null = null;

export function setStartDag(fn: (session: import("../../../modules/collaboration-runtime/session/types").CollaborationSession, store: FsEventStore, id: string) => Promise<{ status: string; result: unknown }>): void {
  _startDag = fn;
}

// resumeSupervisorHitl 需要前向引用，通过 setResumeSupervisorHitl 注入（避免循环依赖）
let _resumeSupervisorHitl: ((sessionId: string, userReply: string, workerId?: string) => boolean) | null = null;

export function setResumeSupervisorHitl(fn: (sessionId: string, userReply: string, workerId?: string) => boolean): void {
  _resumeSupervisorHitl = fn;
}

function summarizeRuntimeLLMConfig(config?: RuntimeLLMConfig): Record<string, unknown> {
  if (!config) return { provided: false };
  const credentialSource = config.anthropicCredentialSource
    ?? (config.anthropicAuthToken ? "anthropicAuthToken" : undefined)
    ?? (config.anthropicApiKey ? "anthropicApiKey" : undefined)
    ?? (config.authToken ? "authToken" : undefined)
    ?? (config.apiKey ? "apiKey" : undefined);
  return {
    provided: true,
    provider: config.provider ?? "default",
    model: config.model ?? "default",
    baseUrl: config.anthropicBaseUrl ?? config.baseUrl ?? "default",
    hasCredential: Boolean(config.anthropicAuthToken || config.anthropicApiKey || config.authToken || config.apiKey),
    credentialSource: credentialSource ?? "none",
    maxTokens: config.maxTokens ?? "default",
  };
}

function logRuntime(phase: string, data: Record<string, unknown>): void {
  console.error(`[MultiAgentRuntime] ${phase} ${JSON.stringify(data)}`);
}

/**
 * 将消息中的附件引用 `[附件: name (name)]` 展开为包含绝对路径的格式。
 * 上传 API 返回的 path 是相对于 basePath 的文件名，需要补全为绝对路径。
 */
function expandAttachmentPaths(message: string, attachmentsAbsDir: string): string {
  // 匹配 [附件: filename (filename)] 格式
  return message.replace(/\[附件: ([^\]]+?) \(([^)]+)\)\]/g, (_match, displayName: string, filePath: string) => {
    // filePath 可能是纯文件名，也可能已含路径；取 basename 拼绝对路径
    const absPath = path.join(attachmentsAbsDir, path.basename(filePath));
    return `[附件: ${displayName} (${absPath})]`;
  });
}

/** 用户回复 Human Review 请求 — Story 9.34: 路由到 Supervisor，不再直接 resume Worker */
export async function respondToHumanReview(id: string, _agentId: string, response: string): Promise<{ success: boolean; error?: string }> {
  return sendMessageToSupervisor(id, response);
}

export async function sendMessageToSupervisor(
  id: string,
  message: string,
  workerId?: string,
  llmConfig?: RuntimeLLMConfig | null,
): Promise<{ success: boolean; error?: string }> {
  await loadPersistedSessions();

  const session = sessions.get(id);
  if (!session) {
    return { success: false, error: `Session ${id} not found` };
  }

  // 用户最新的 llmConfig 优先级更高，每次发消息时更新 session 里存的配置
  if (llmConfig !== undefined && llmConfig !== null) {
    session.config.llmConfig = normalizeRuntimeLLMConfig(llmConfig);
    logRuntime("facade.message.llm_config.request", {
      sessionId: id,
      projectId: session.projectId,
      llmConfig: summarizeRuntimeLLMConfig(session.config.llmConfig),
    });
  } else {
    const persistedConfig = userLLMConfigToRuntimeLLMConfig(readUserConfigWithProductDefaults().llm);
    if (persistedConfig) {
      session.config.llmConfig = persistedConfig;
      logRuntime("facade.message.llm_config.persisted", {
        sessionId: id,
        projectId: session.projectId,
        llmConfig: summarizeRuntimeLLMConfig(session.config.llmConfig),
      });
    } else {
      logRuntime("facade.message.llm_config.missing", {
        sessionId: id,
        projectId: session.projectId,
        llmConfig: summarizeRuntimeLLMConfig(session.config.llmConfig),
      });
    }
  }
  logRuntime("facade.message.received", {
    sessionId: id,
    projectId: session.projectId,
    status: session.status,
    workerId: workerId ?? null,
    messageChars: message.length,
  });

  // 展开消息中的附件路径为绝对路径
  const attachmentsAbsDir = path.join(
    getDataRoot(),
    "projects", session.projectId, "collaboration-sessions", id, "attachments",
  );
  const expandedMessage = expandAttachmentPaths(message, attachmentsAbsDir);

  // 欢迎模式：第一条消息成为全局目标，触发 DAG 启动（greeting 阶段不含附件，使用原始消息）
  if (session.status === "greeting") {
    session.globalGoal = expandedMessage;
    session.updatedAt = new Date().toISOString();

    // Recreate store/blackboard if lost (e.g. HMR)
    let store = eventStores.get(id);
    if (!store) {
      const sessionDir = path.join(getDataRoot(), "projects", session.projectId, "collaboration-sessions");
      store = new FsEventStore(sessionDir);
      eventStores.set(id, store);
      const bb = new Blackboard(id, path.join(getDataRoot(), "projects", session.projectId, "collaboration-sessions", id));
      blackboards.set(id, bb);
    }

    // 记录用户输入事件
    const userEvent: RuntimeEvent = {
      id: `evt-user-goal-${Date.now()}`,
      sessionId: id,
      seq: 0,
      type: "USER_INPUT",
      payload: { message: expandedMessage },
      source: "user",
      target: "supervisor",
      timestamp: new Date().toISOString(),
    };
    void store.append(userEvent);
    eventEmitter.emit(userEvent);

    if (_startDag) {
      await _startDag(session, store, id);
    }
    return { success: true };
  }

  if (session.status !== "running") {
    return { success: false, error: `Session ${id} is not running (status: ${session.status})` };
  }

  // Record the user reply event (使用展开后的消息，含附件绝对路径)
  const inputEvent = {
    id: `evt-user-reply-${Date.now()}`,
    sessionId: id,
    seq: 0,
    type: "USER_REPLY_TO_SUPERVISOR" as const,
    payload: { to: "supervisor", message: expandedMessage, workerId: workerId ?? null },
    source: "user",
    target: "supervisor",
    timestamp: new Date().toISOString(),
  };
  const typedEvent = inputEvent as RuntimeEvent;
  eventEmitter.emit(typedEvent);
  const store = eventStores.get(id);
  if (store) {
    await store.append(typedEvent);
  }

  // If supervisor is suspended in HITL, resume it via the registry
  if (_resumeSupervisorHitl && _resumeSupervisorHitl(id, expandedMessage, workerId)) {
    return { success: true };
  }

  // Supervisor is alive and running — forward the message directly to keep conversation history
  const { getGlobalSpawner } = await import("../../../modules/collaboration-runtime/sandbox");
  const spawner = getGlobalSpawner();
  const supervisorAgentId = `supervisor-${id}`;
  const supervisorProc = spawner.get(supervisorAgentId);
  if (supervisorProc) {
    supervisorProc.prompt(expandedMessage).catch((err: unknown) => {
      console.error(`[hitl-dispatcher] Supervisor prompt error:`, err);
    });
    return { success: true };
  }

  // Supervisor no longer alive — start a fresh DAG with the new goal
  if (!store) {
    const sessionDir = path.join(getDataRoot(), "projects", session.projectId, "collaboration-sessions");
    const newStore = new FsEventStore(sessionDir);
    eventStores.set(id, newStore);
  }
  const activeStore = eventStores.get(id)!;
  session.globalGoal = expandedMessage;
  if (_startDag) {
    await _startDag(session, activeStore, id);
  }
  return { success: true };
}
