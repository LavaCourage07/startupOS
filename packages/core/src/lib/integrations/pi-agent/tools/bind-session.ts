/**
 * Session-bound tool wrapping utility.
 *
 * Tools read execution context (workingDirectory, ...) from a
 * global ToolContextManager. The manager keeps both per-session contexts and a
 * shared `defaultContext` — and because tool.execute has no sessionId in its
 * signature, every tool implementation reads from `defaultContext`.
 *
 * Multiple agent runtimes (AgentManager, PersistentAgentManager, ...) share
 * the same global manager, so the last writer to `defaultContext` wins. To
 * keep concurrent sessions isolated, we wrap each tool's execute closure to
 * refresh `defaultContext` from the session-specific context immediately
 * before delegating to the underlying implementation.
 *
 * This is the single source of truth for that wrapping behaviour — both
 * AgentManager and PersistentAgent must use it before calling agent.setTools().
 */

import type { AgentTool } from "@mariozechner/agent";
import { getToolContext, getToolContextManager } from "./context";

export function bindToolsToSession<T extends Pick<AgentTool<any>, "execute">>(
  tools: T[],
  sessionId: string,
): T[] {
  return tools.map((tool) => ({
    ...tool,
    execute: (
      toolCallId: string,
      params: unknown,
      signal?: AbortSignal,
      onUpdate?: any,
    ) => {
      const ctx = getToolContext(sessionId);
      getToolContextManager().setDefaultContext(ctx);
      return (tool.execute as any)(toolCallId, params as never, signal, onUpdate);
    },
  })) as T[];
}
