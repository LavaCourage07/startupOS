/**
 * CollaborationRuntimeDeps — external dependency injection interface.
 *
 * Module internal code MUST NOT import from `src/lib/` or `src/components/`.
 * All external services are injected via this interface at construction time.
 */

import type { RuntimeEvent, CollaborationSession } from "./session/types";

// ============================================================================
// External dependency interfaces
// ============================================================================

export interface AgentConfig {
  projectId: string;
  agentId: string;
  workingDirectory: string;
}

export interface AgentInstance {
  id: string;
  status: "running" | "stopped" | "error";
  prompt(message: string): Promise<void>;
  abort(): Promise<void>;
}

export interface AgentEngine {
  startAgent(config: AgentConfig): Promise<AgentInstance>;
  stopAgent(id: string): Promise<void>;
  getAgent(id: string): AgentInstance | null;
}

export interface ToolRegistration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolExecutor {
  execute(toolName: string, args: Record<string, unknown>): Promise<unknown>;
  listTools(): ToolRegistration[];
}

export interface OntologyStore {
  query(
    entityType: string,
    filter: Record<string, unknown>
  ): Promise<unknown[]>;
  save(entityType: string, data: unknown): Promise<void>;
  delete(entityType: string, id: string): Promise<void>;
}

export interface FileOps {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listDir(path: string): Promise<string[]>;
}

export interface EventEmitter {
  emit(event: RuntimeEvent): void;
}

export interface AgentDefinitionParser {
  parseAgentDefinition(content: string): unknown;
  parseToolDefinition(content: string): unknown;
}

// ============================================================================
// Combined deps — injected by API routes at assembly time
// ============================================================================

export interface CollaborationRuntimeDeps {
  agentEngine: AgentEngine;
  toolExecutor: ToolExecutor;
  ontologyStore: OntologyStore;
  fileOps: FileOps;
  eventEmitter: EventEmitter;
  agentDefinitionParser: AgentDefinitionParser;
}

// ============================================================================
// CollaborationRuntime — module entry point
// ============================================================================

export class CollaborationRuntime {
  readonly deps: CollaborationRuntimeDeps;
  private sessions: Map<string, CollaborationSession>;

  constructor(deps: CollaborationRuntimeDeps) {
    this.deps = deps;
    this.sessions = new Map();
  }

  createSession(session: CollaborationSession): void {
    this.sessions.set(session.id, session);
  }

  getSession(id: string): CollaborationSession | undefined {
    return this.sessions.get(id);
  }

  listSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values());
  }
}
