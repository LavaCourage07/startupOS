import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import type { IpcResponse } from '../../../../core/src/lib/integrations/electron/ipc-protocol';
import type { AgentSession } from '../../../../core/src/types/agent';
import { agentSessionService } from '../../../../core/src/lib/features/agent';
import {
  agentManager,
  type AgentTaskRuntimeBindingOptions,
} from '../../../../core/src/lib/integrations/pi-agent/agent-manager';
import type { AgentTaskRuntimeCoordinator } from '../../../../core/src/lib/integrations/pi-agent/task-runtime/coordinator';
import {
  AGENT_TASK_RUNTIME_PROTOCOL_VERSION,
  AGENT_TASK_RUNTIME_SCHEMA_VERSION,
  isAgentTaskRuntimePersistenceV1,
  type AgentTaskRuntimeEventV1,
  type AgentTaskRuntimePersistenceV1,
  type AgentTaskRuntimeSnapshotV1,
  type ControlAgentTaskRequestV1,
  type CreateAgentTaskRequestV1,
  type GetAgentTaskRequestV1,
} from '../../../../core/src/lib/integrations/pi-agent/task-runtime';
import { IPC_CHANNELS } from '../ipc-protocol';

interface TaskEventSender {
  isDestroyed(): boolean;
  send(channel: string, payload: unknown): void;
}

interface TaskIpcRegistrar {
  handle(channel: string, listener: (event: IpcMainInvokeEvent, request: unknown) => Promise<unknown>): void;
}

interface TaskSessionStore {
  getSession(sessionId: string, projectId?: string): Promise<AgentSession | null>;
  updateSession(
    sessionId: string,
    updates: { taskRuntime?: AgentTaskRuntimePersistenceV1 },
    projectId?: string,
  ): Promise<AgentSession | null>;
}

interface TaskRuntimeManager {
  getOrCreateTaskRuntime(
    session: AgentSession,
    options: AgentTaskRuntimeBindingOptions,
  ): Promise<AgentTaskRuntimeCoordinator>;
}

export interface AgentTaskRuntimeIpcControllerOptions {
  ipc?: TaskIpcRegistrar;
  sessions?: TaskSessionStore;
  runtimes?: TaskRuntimeManager;
}

class AgentTaskIpcError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

function success<T>(data: T): IpcResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

function failure<T>(error: unknown): IpcResponse<T> {
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown } | null;
  const code = typeof candidate?.code === 'string' ? candidate.code : 'INTERNAL_ERROR';
  const message = typeof candidate?.message === 'string' ? candidate.message : 'Unknown Task Runtime error';
  console.error('[AgentTaskRuntimeIPC] command failed', { code, message });
  return {
    success: false,
    error: {
      code,
      message,
      ...(candidate?.details === undefined ? {} : { details: candidate.details }),
    },
    timestamp: new Date().toISOString(),
  };
}

function isTaskEligibleSession(session: AgentSession): boolean {
  const entryType = session.projectContext?.entryType;
  if (entryType) {
    return entryType === 'agent' || entryType === 'role-agent';
  }
  return session.agentType === 'agent'
    || session.agentType === 'assistant'
    || session.agentType === 'role-agent';
}

function assertSupportedPersistence(session: AgentSession): void {
  const persisted = session.taskRuntime;
  if (persisted === undefined) {
    return;
  }
  if (
    persisted === null
    || typeof persisted !== 'object'
    || (persisted as { schemaVersion?: unknown }).schemaVersion !== AGENT_TASK_RUNTIME_SCHEMA_VERSION
  ) {
    const schemaVersion = persisted && typeof persisted === 'object'
      ? (persisted as { schemaVersion?: unknown }).schemaVersion
      : undefined;
    if (schemaVersion !== undefined) {
      throw new AgentTaskIpcError(
        'TASK_RUNTIME_UNSUPPORTED_SCHEMA',
        `不支持的 Task Runtime schema version: ${String(schemaVersion)}`,
      );
    }
    throw new AgentTaskIpcError('TASK_RUNTIME_CORRUPT', 'Session Task Runtime 数据损坏');
  }
  if (!isAgentTaskRuntimePersistenceV1(persisted)) {
    throw new AgentTaskIpcError('TASK_RUNTIME_CORRUPT', 'Session Task Runtime 数据损坏');
  }
}

function assertProtocolVersion(request: unknown): asserts request is { version: 1; sessionId: string } {
  if (!request || typeof request !== 'object') {
    throw new AgentTaskIpcError('TASK_RUNTIME_PROTOCOL_ERROR', 'Task Runtime 请求不能为空');
  }
  const candidate = request as { version?: unknown; sessionId?: unknown };
  if (candidate.version !== AGENT_TASK_RUNTIME_PROTOCOL_VERSION) {
    throw new AgentTaskIpcError(
      'TASK_RUNTIME_PROTOCOL_ERROR',
      `不支持的 Task Runtime protocol version: ${String(candidate.version)}`,
    );
  }
  if (typeof candidate.sessionId !== 'string' || !candidate.sessionId.trim()) {
    throw new AgentTaskIpcError('TASK_RUNTIME_PROTOCOL_ERROR', 'Task Runtime sessionId 不能为空');
  }
}

export class AgentTaskRuntimeIpcController {
  private readonly ipc: TaskIpcRegistrar;
  private readonly sessions: TaskSessionStore;
  private readonly runtimes: TaskRuntimeManager;
  private readonly sessionProjects = new Map<string, string>();
  private readonly senders = new Map<string, TaskEventSender>();
  private readonly commandTails = new Map<string, Promise<void>>();
  private readonly pendingUserMessages = new Set<string>();
  private readonly lastEventKeys = new Map<string, string>();

  constructor(options: AgentTaskRuntimeIpcControllerOptions = {}) {
    this.ipc = options.ipc ?? ipcMain;
    this.sessions = options.sessions ?? agentSessionService;
    this.runtimes = options.runtimes ?? agentManager;
  }

  registerHandlers(): void {
    this.ipc.handle(IPC_CHANNELS.AGENT_TASK_CREATE, async (event, rawRequest) => {
      try {
        assertProtocolVersion(rawRequest);
        const request = rawRequest as CreateAgentTaskRequestV1;
        return await this.runSerialized(request.sessionId, async () => {
          const session = await this.resolveEligibleSession(request.sessionId, event.sender);
          const runtime = await this.bindRuntime(session);
          return success(await runtime.createTask(request));
        });
      } catch (error) {
        return failure<AgentTaskRuntimeSnapshotV1>(error);
      }
    });

    this.ipc.handle(IPC_CHANNELS.AGENT_TASK_GET, async (event, rawRequest) => {
      try {
        assertProtocolVersion(rawRequest);
        const request = rawRequest as GetAgentTaskRequestV1;
        return await this.runSerialized(request.sessionId, async () => {
          const session = await this.resolveEligibleSession(request.sessionId, event.sender);
          assertSupportedPersistence(session);
          const runtime = await this.bindRuntime(session);
          const snapshot = session.taskRuntime?.execution.mode === 'task_running'
            && session.taskRuntime.execution.status === 'running'
            ? await runtime.resumeAfterRestore()
            : runtime.getSnapshot();
          return success(snapshot);
        });
      } catch (error) {
        return failure<AgentTaskRuntimeSnapshotV1>(error);
      }
    });

    this.ipc.handle(IPC_CHANNELS.AGENT_TASK_CONTROL, async (event, rawRequest) => {
      try {
        assertProtocolVersion(rawRequest);
        const request = rawRequest as ControlAgentTaskRequestV1;
        return await this.runSerialized(request.sessionId, async () => {
          const session = await this.resolveEligibleSession(request.sessionId, event.sender);
          const runtime = await this.bindRuntime(session);
          return success(await runtime.controlTask(request));
        });
      } catch (error) {
        return failure<AgentTaskRuntimeSnapshotV1>(error);
      }
    });
  }

  rememberSession(session: AgentSession, sender?: TaskEventSender): void {
    this.sessionProjects.set(session.sessionId, session.projectContext.projectId);
    if (sender) {
      this.senders.set(session.sessionId, sender);
    }
  }

  setUserMessagePending(sessionId: string, pending: boolean): void {
    if (pending) {
      this.pendingUserMessages.add(sessionId);
    } else {
      this.pendingUserMessages.delete(sessionId);
    }
  }

  async restoreForSession(session: AgentSession, sender: TaskEventSender): Promise<void> {
    this.rememberSession(session, sender);
    if (session.taskRuntime === undefined || !isTaskEligibleSession(session)) {
      return;
    }
    try {
      assertSupportedPersistence(session);
      await this.runSerialized(session.sessionId, async () => {
        const runtime = await this.bindRuntime(session);
        await runtime.resumeAfterRestore();
      });
    } catch (error) {
      const response = failure<AgentTaskRuntimeSnapshotV1>(error);
      console.error('[AgentTaskRuntimeIPC] Session restore skipped', response.error);
    }
  }

  private async bindRuntime(session: AgentSession): Promise<AgentTaskRuntimeCoordinator> {
    assertSupportedPersistence(session);
    return this.runtimes.getOrCreateTaskRuntime(session, {
      persist: async (state) => {
        const projectId = this.sessionProjects.get(session.sessionId)
          ?? session.projectContext.projectId;
        const updated = await this.sessions.updateSession(
          session.sessionId,
          { taskRuntime: state },
          projectId,
        );
        if (!updated) {
          throw new AgentTaskIpcError('NOT_FOUND', 'Task Runtime 持久化时 Session 已不存在');
        }
      },
      onState: (snapshot) => this.sendState(snapshot),
      hasPendingUserMessage: () => this.pendingUserMessages.has(session.sessionId),
    });
  }

  private async resolveEligibleSession(
    sessionId: string,
    sender: TaskEventSender,
  ): Promise<AgentSession> {
    const projectId = this.sessionProjects.get(sessionId);
    const session = await this.sessions.getSession(sessionId, projectId);
    if (!session) {
      throw new AgentTaskIpcError(
        'NOT_FOUND',
        projectId
          ? 'Session 不存在'
          : 'Session scope 未恢复，请先打开对应 Agent 会话',
      );
    }
    if (!isTaskEligibleSession(session)) {
      throw new AgentTaskIpcError(
        'TASK_RUNTIME_NOT_SUPPORTED',
        'Task Runtime 仅支持 Agent 与 RoleAgent Session',
      );
    }
    this.rememberSession(session, sender);
    assertSupportedPersistence(session);
    return session;
  }

  private sendState(snapshot: AgentTaskRuntimeSnapshotV1): void {
    const sender = this.senders.get(snapshot.sessionId);
    if (!sender || sender.isDestroyed()) {
      return;
    }
    const eventKey = JSON.stringify({
      mode: snapshot.execution.mode,
      status: snapshot.execution.status,
      revision: snapshot.execution.expectedRevision,
      cursor: snapshot.execution.expectedCursor,
      continuationCount: snapshot.execution.continuationCount,
      noProgressCount: snapshot.execution.noProgressCount,
      error: snapshot.execution.lastError?.code,
    });
    if (this.lastEventKeys.get(snapshot.sessionId) === eventKey) {
      return;
    }
    this.lastEventKeys.set(snapshot.sessionId, eventKey);
    const event: AgentTaskRuntimeEventV1 = {
      version: AGENT_TASK_RUNTIME_PROTOCOL_VERSION,
      type: 'agent_task_runtime_state',
      sessionId: snapshot.sessionId,
      snapshot,
    };
    sender.send(IPC_CHANNELS.AGENT_TASK_EVENT, event);
  }

  private runSerialized<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.commandTails.get(sessionId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    const tail = current.then(() => undefined, () => undefined);
    this.commandTails.set(sessionId, tail);
    void tail.finally(() => {
      if (this.commandTails.get(sessionId) === tail) {
        this.commandTails.delete(sessionId);
      }
    });
    return current;
  }
}
