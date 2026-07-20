"use client";

/**
 * CollaborationViewer — 主容器，左侧 Agent 活动卡片（可点击进入 CUI），右侧消息流。
 *
 * Story 9.12: UI 协作查看器
 * Story 9.29 UI: 点击 Agent 卡片查看该 Agent 的思考/工具调用详情，结构化展示工具 JSON 输出。
 * Story 9.36: HITL 问答卡片 + Supervisor 派发进度面板
 */

import { useEffect, useRef, useMemo, useState, useCallback, createContext, useContext } from "react";
import { useCollaborationUi } from "./store";
import { useSSEConnection } from "./use-sse";
import { BlackboardViewer } from "./BlackboardViewer";
import type { RuntimeEvent } from "../session/types";
import type { CollaborationRuntimeUiDeps } from "./ui-deps";
import { sendCollaborationMessage } from "../../../lib/integrations/electron/services/collaboration";

const UiDepsContext = createContext<CollaborationRuntimeUiDeps | null>(null);
function useUiDeps(): CollaborationRuntimeUiDeps {
  const ctx = useContext(UiDepsContext);
  if (!ctx) throw new Error("UiDepsContext not provided");
  return ctx;
}

const AGENT_STATUS_COLORS: Record<string, { bg: string; dot: string; border: string }> = {
  idle:      { bg: "bg-gray-100",   dot: "bg-gray-400",   border: "border-gray-200" },
  thinking:  { bg: "bg-blue-50",    dot: "bg-blue-500",   border: "border-blue-200" },
  tool_call: { bg: "bg-yellow-50",  dot: "bg-yellow-500", border: "border-yellow-200" },
  complete:  { bg: "bg-green-50",   dot: "bg-green-500",  border: "border-green-200" },
  fail:      { bg: "bg-red-50",     dot: "bg-red-500",    border: "border-red-200" },
  waiting:   { bg: "bg-amber-50",   dot: "bg-amber-500",  border: "border-amber-200" },
};

const AGENT_STATUS_LABELS: Record<string, string> = {
  idle:      "空闲",
  thinking:  "思考",
  tool_call: "执行工具",
  complete:  "完成",
  fail:      "失败",
  waiting:   "等待确认",
};

function isSupervisorAgent(agentId: string): boolean {
  return agentId.trim().toLowerCase() === "supervisor";
}

// ============================================================================
// Event → message helpers
// ============================================================================

interface CuiMessage {
  id: string;
  agentId: string;
  agentName: string;
  type: "text" | "tool_call" | "tool_result" | "thinking" | "status";
  text: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  isError: boolean;
  timestamp: string;
}

interface MessageBubbleProps {
  msg: CuiMessage;
  showAgent: boolean;
  onAnswer?: (msgId: string, selectedLabels: string[]) => void;
  answeredIds?: Set<string>;
}

function tryParseJson(raw: unknown): unknown {
  if (typeof raw !== "string") { return raw; }
  try { return JSON.parse(raw); } catch { return raw; }
}

function extractAgentMessages(
  events: RuntimeEvent[],
  agentNames: Record<string, string>,
  filterAgentId?: string,
): CuiMessage[] {
  const messages: CuiMessage[] = [];
  // Accumulate streaming MESSAGE_SENT chunks per agent
  const pendingText = new Map<string, { text: string; timestamp: string }>();

  const flushPending = (agentId: string) => {
    const p = pendingText.get(agentId);
    if (p !== undefined && p.text.trim().length > 0) {
      messages.push({
        id: `text-${agentId}-${p.timestamp}`,
        agentId,
        agentName: agentNames[agentId] ?? agentId,
        type: "text",
        text: p.text,
        isError: false,
        timestamp: p.timestamp,
      });
    }
    pendingText.delete(agentId);
  };

  for (const event of events) {
    const agentId = event.source;
    if (filterAgentId !== undefined && agentId !== filterAgentId) { continue; }

    switch (event.type) {
      case "MESSAGE_SENT": {
        const chunk = event.payload?.["text"];
        if (typeof chunk === "string" && chunk.length > 0) {
          const existing = pendingText.get(agentId);
          if (existing !== undefined) {
            existing.text += chunk;
          } else {
            pendingText.set(agentId, { text: chunk, timestamp: event.timestamp });
          }
        }
        break;
      }

      case "AGENT_THINKING": {
        // Flush any accumulated text first
        flushPending(agentId);
        const msg = event.payload?.["message"];
        // Skip the initial big prompt blob (usually the first AGENT_THINKING)
        if (typeof msg === "string" && msg !== "Agent started" && msg.length < 500) {
          messages.push({
            id: event.id,
            agentId,
            agentName: agentNames[agentId] ?? agentId,
            type: "thinking",
            text: msg,
            isError: false,
            timestamp: event.timestamp,
          });
        }
        break;
      }

      case "TOOL_CALL":
      case "AGENT_ACT": {
        flushPending(agentId);
        const tool = event.payload?.["toolName"] ?? event.payload?.["tool"];
        const args = event.payload?.["args"] ?? event.payload?.["input"];
        if (typeof tool === "string") {
          messages.push({
            id: event.id,
            agentId,
            agentName: agentNames[agentId] ?? agentId,
            type: "tool_call",
            text: `调用工具: ${tool}`,
            toolName: tool,
            toolArgs: args,
            isError: false,
            timestamp: event.timestamp,
          });
        }
        break;
      }

      case "TOOL_RESULT": {
        flushPending(agentId);
        const toolName = event.payload?.["toolName"] as string | undefined;
        const rawResult = event.payload?.["result"];
        // Unwrap nested content[].text JSON strings
        const result = unwrapToolResult(rawResult);
        messages.push({
          id: event.id,
          agentId,
          agentName: agentNames[agentId] ?? agentId,
          type: "tool_result",
          text: toolName !== undefined ? `${toolName} 结果` : "工具结果",
          toolName,
          toolResult: result,
          isError: false,
          timestamp: event.timestamp,
        });
        break;
      }

      case "TOOL_FAILURE": {
        flushPending(agentId);
        const error = event.payload?.["error"] ?? event.payload?.["message"];
        messages.push({
          id: event.id,
          agentId,
          agentName: agentNames[agentId] ?? agentId,
          type: "tool_result",
          text: `工具失败`,
          toolName: event.payload?.["toolName"] as string | undefined,
          toolResult: { error },
          isError: true,
          timestamp: event.timestamp,
        });
        break;
      }

      case "AGENT_COMPLETE_TASK": {
        flushPending(agentId);
        const output = event.payload?.["output"];
        if (typeof output === "string" && output.trim().length > 0) {
          messages.push({
            id: event.id,
            agentId,
            agentName: agentNames[agentId] ?? agentId,
            type: "status",
            text: output,
            isError: false,
            timestamp: event.timestamp,
          });
        }
        break;
      }

      case "AGENT_FAIL_TASK": {
        flushPending(agentId);
        const error = event.payload?.["error"];
        messages.push({
          id: event.id,
          agentId,
          agentName: agentNames[agentId] ?? agentId,
          type: "status",
          text: typeof error === "string" ? error : "任务失败",
          isError: true,
          timestamp: event.timestamp,
        });
        break;
      }

      default:
        // Non-message events (AGENT_END, etc.) flush pending text
        if (
          event.type === "AGENT_END" ||
          event.type === "SESSION_COMPLETE" ||
          event.type === "SESSION_ABORTED"
        ) {
          flushPending(agentId);
        }
        break;
    }
  }

  // Flush any remaining pending text
  for (const agentId of pendingText.keys()) {
    if (filterAgentId === undefined || agentId === filterAgentId) {
      flushPending(agentId);
    }
  }

  return messages;
}

/** Unwrap tool result: pull out nested content[].text JSON strings */
function unwrapToolResult(raw: unknown): unknown {
  if (raw === null || raw === undefined) { return raw; }
  if (typeof raw !== "object") { return tryParseJson(raw); }

  const obj = raw as Record<string, unknown>;

  // Pattern: { content: [{ type: "text", text: "{...}" }], details: {...} }
  if (Array.isArray(obj["content"])) {
    const content = obj["content"] as Array<{ type?: string; text?: string }>;
    const texts = content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => tryParseJson(b.text));
    if (texts.length === 1) {
      // Prefer details if available (it's already parsed)
      return (obj["details"] !== undefined && obj["details"] !== null)
        ? obj["details"]
        : texts[0];
    }
    if (texts.length > 1) { return texts; }
  }

  // Already a plain object — return as-is
  return obj["details"] !== undefined ? obj["details"] : raw;
}

function collectAgentNames(events: RuntimeEvent[], names: Record<string, string>): Record<string, string> {
  for (const event of events) {
    if (event.type === "AGENT_REGISTERED" && typeof event.payload?.["name"] === "string") {
      names[event.source] = event.payload["name"] as string;
    }
  }
  return names;
}

// ============================================================================
// Structured JSON renderer
// ============================================================================

/** Extract plain text string from a tool result (handles wrapped content[].text) */
function extractTextFromResult(result: unknown): string | null {
  if (typeof result === "string") return result;
  if (result === null || result === undefined) return null;
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj["content"])) {
      const content = obj["content"] as Array<{ type?: string; text?: string }>;
      const text = content.find((b) => b.type === "text")?.text;
      if (typeof text === "string") return text;
    }
    if (typeof obj["text"] === "string") return obj["text"];
  }
  return null;
}

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (value === null || value === undefined) {
    return <span className="text-slate-400">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className={value ? "text-emerald-600" : "text-rose-500"}>{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-violet-600">{String(value)}</span>;
  }
  if (typeof value === "string") {
    if (value.length > 200) {
      return (
        <LongStringValue value={value} />
      );
    }
    return <span className="text-amber-700 break-all">"{value}"</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) { return <span className="text-slate-400">[]</span>; }
    return (
      <span>
        <button
          onClick={() => { setExpanded((e) => !e); }}
          className="text-slate-500 hover:text-slate-700 font-mono text-[10px]"
        >
          [{expanded ? "▾" : "▸"} {value.length}]
        </button>
        {expanded && (
          <div className="ml-3 border-l border-slate-200 pl-2 space-y-0.5 mt-0.5">
            {value.map((item, i) => (
              <div key={i} className="flex gap-1">
                <span className="text-slate-400 text-[10px] flex-shrink-0">{i}:</span>
                <JsonValue value={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) { return <span className="text-slate-400">{"{}"}</span>; }
    return (
      <span>
        <button
          onClick={() => { setExpanded((e) => !e); }}
          className="text-slate-500 hover:text-slate-700 font-mono text-[10px]"
        >
          {"{"}{expanded ? "▾" : "▸"} {entries.length} keys{"}"}
        </button>
        {expanded && (
          <div className="ml-3 border-l border-slate-200 pl-2 space-y-0.5 mt-0.5">
            {entries.map(([k, v]) => (
              <div key={k} className="flex gap-1 flex-wrap">
                <span className="text-sky-700 font-medium text-[10px] flex-shrink-0">{k}:</span>
                <JsonValue value={v} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }
  return <span className="text-slate-600">{String(value)}</span>;
}

function LongStringValue({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = value.slice(0, 120);
  return (
    <span>
      <span className="text-amber-700 break-all">
        "{expanded ? value : preview}
        {!expanded && value.length > 120 && "…"}
        "
      </span>
      <button
        onClick={() => { setExpanded((e) => !e); }}
        className="ml-1 text-[10px] text-sky-600 hover:underline"
      >
        {expanded ? "收起" : `展开 (${value.length}字符)`}
      </button>
    </span>
  );
}

// ============================================================================
// Message bubble
// ============================================================================

function MessageBubble({ msg, showAgent, onAnswer, answeredIds }: MessageBubbleProps) {
  const { parseAskUserQuestion, removeYamlBlock, AskUserQuestionComponent } = useUiDeps();
  const [toolOpen, setToolOpen] = useState(false);
  const isAnswered = answeredIds?.has(msg.id) ?? false;

  if (msg.type === "thinking") {
    return (
      <div className="flex items-start gap-2 opacity-70">
        <span className="text-base mt-0.5">💭</span>
        <div className="text-[11px] text-slate-500 italic leading-5">{msg.text}</div>
      </div>
    );
  }

  if (msg.type === "tool_call") {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🔧</span>
          <span className="text-xs font-semibold text-yellow-800">{msg.toolName ?? "tool"}</span>
          <span className="text-[10px] text-yellow-600">{new Date(msg.timestamp).toLocaleTimeString()}</span>
        </div>
        {msg.toolArgs !== undefined && msg.toolArgs !== null && (
          <div className="mt-1.5 text-[11px] font-mono">
            <JsonValue value={msg.toolArgs} depth={0} />
          </div>
        )}
      </div>
    );
  }

  if (msg.type === "tool_result") {
    // ask_user_question: extract YAML from result and render as interactive card
    if (msg.toolName === "ask_user_question") {
      const resultText = extractTextFromResult(msg.toolResult);
      const parsed = resultText ? parseAskUserQuestion(resultText) : null;
      if (parsed) {
        const displayText = removeYamlBlock(resultText ?? "");
        return (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">💬</span>
              <span className="text-xs font-semibold text-blue-800">{msg.agentName} 向您提问</span>
              <span className="text-[10px] text-blue-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
            </div>
            {displayText && (
              <p className="text-xs text-blue-900 mb-2 whitespace-pre-wrap">{displayText}</p>
            )}
            <AskUserQuestionComponent
              parsedQuestion={parsed}
              onAnswer={(labels) => { onAnswer?.(msg.id, labels); }}
              disabled={isAnswered || !onAnswer}
            />
            {isAnswered && (
              <p className="mt-2 text-[10px] text-blue-500">已提交回答</p>
            )}
          </div>
        );
      }
    }

    return (
      <div className={`rounded-xl border px-3 py-2 ${msg.isError ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
        <button
          className="flex w-full items-center gap-2 text-left"
          onClick={() => { setToolOpen((o) => !o); }}
        >
          <span className="text-base">{msg.isError ? "⚠️" : "📋"}</span>
          <span className={`text-xs font-semibold ${msg.isError ? "text-rose-700" : "text-slate-700"}`}>
            {msg.text}
          </span>
          <span className="ml-auto text-[10px] text-slate-400">{toolOpen ? "▲ 收起" : "▼ 展开"}</span>
        </button>
        {toolOpen && (
          <div className="mt-2 text-[11px] font-mono max-h-48 overflow-y-auto">
            <JsonValue value={msg.toolResult} depth={0} />
          </div>
        )}
      </div>
    );
  }

  if (msg.type === "status") {
    return (
      <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${msg.isError ? "border-rose-200 bg-rose-50" : "border-green-200 bg-green-50"}`}>
        <span className="text-base">{msg.isError ? "❌" : "✅"}</span>
        <p className={`text-xs leading-5 whitespace-pre-wrap break-words ${msg.isError ? "text-rose-700" : "text-green-800"}`}>{msg.text}</p>
      </div>
    );
  }

  // type === "text" — also support inline ask_user_question YAML
  const parsedQuestion = onAnswer ? parseAskUserQuestion(msg.text) : null;
  const displayText = parsedQuestion ? removeYamlBlock(msg.text) : msg.text;

  return (
    <div className="flex items-start gap-3">
      {showAgent && (
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white bg-gradient-to-br from-orange-400 to-rose-400 shadow-sm">
          {msg.agentName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className={`min-w-0 flex-1 rounded-[16px] border border-white/75 bg-white/90 px-4 py-3 shadow-sm ${showAgent ? "" : "ml-10"}`}>
        {showAgent && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs font-semibold text-slate-800">{msg.agentName}</span>
            <span className="text-[10px] text-slate-400">{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
        )}
        <p className="text-xs leading-6 text-slate-700 whitespace-pre-wrap break-words">{displayText}</p>
        {parsedQuestion && onAnswer && (
          <div className="mt-2">
            <AskUserQuestionComponent
              parsedQuestion={parsedQuestion}
              onAnswer={(labels) => { onAnswer(msg.id, labels); }}
              disabled={isAnswered}
            />
            {isAnswered && (
              <p className="mt-2 text-[10px] text-slate-400">已提交回答</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Agent CUI panel (selected agent view)
// ============================================================================

function AgentCuiPanel({ agentId, agentName, sessionId, onBack }: { agentId: string; agentName: string; sessionId: string; onBack: () => void }) {
  const events = useCollaborationUi((state) => state.events);
  const agentNames = useMemo(() => collectAgentNames(events, {}), [events]);
  const messages = useMemo(
    () => extractAgentMessages(events, agentNames, agentId),
    [events, agentNames, agentId],
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());

  const handleAnswer = useCallback(async (msgId: string, selectedLabels: string[]) => {
    setAnsweredIds((prev) => new Set([...prev, msgId]));
    await sendCollaborationMessage(sessionId, selectedLabels.join(", "));
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 transition-colors"
        >
          ← 全部
        </button>
        <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold text-white bg-gradient-to-br from-orange-400 to-rose-400">
          {agentName.slice(0, 1).toUpperCase()}
        </span>
        <span className="text-sm font-semibold text-slate-800">{agentName}</span>
        <span className="text-xs text-slate-400">{messages.length} 条消息</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">等待 {agentName} 的消息...</div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} showAgent={false} onAnswer={handleAnswer} answeredIds={answeredIds} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ============================================================================
// Global message stream (all agents)
// ============================================================================

function MessageStream({ sessionId, onSelectAgent }: { sessionId: string; onSelectAgent: (id: string) => void }) {
  const events = useCollaborationUi((state) => state.events);
  const agentNames = useMemo(() => collectAgentNames(events, {}), [events]);
  const messages = useMemo(() => extractAgentMessages(events, agentNames), [events, agentNames]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());

  const handleAnswer = useCallback(async (msgId: string, selectedLabels: string[]) => {
    setAnsweredIds((prev) => new Set([...prev, msgId]));
    await sendCollaborationMessage(sessionId, selectedLabels.join(", "));
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white/35">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/70 px-5 py-3 backdrop-blur-xl">
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Agent 消息流</h3>
        <span className="rounded-full border border-slate-200 bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-500">
          {messages.length} 条
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.52),rgba(248,250,252,0.9))] px-5 py-4">
        {messages.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-xs text-slate-400">等待 Agent 消息...</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => { if (msg.type !== "tool_result" || msg.toolName !== "ask_user_question") onSelectAgent(msg.agentId); }}
              className={msg.type === "tool_result" && msg.toolName === "ask_user_question" ? "" : "cursor-pointer"}
            >
              <MessageBubble msg={msg} showAgent onAnswer={handleAnswer} answeredIds={answeredIds} />
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}

// ============================================================================
// Agent activity cards
// ============================================================================

function AgentActivityCards({ onSelect, selectedId }: { onSelect: (id: string) => void; selectedId: string | null }) {
  const activities = useCollaborationUi((state) => state.activities);
  const events = useCollaborationUi((state) => state.events);
  const agentNamesRef = useRef<Record<string, string>>({});
  const visibleActivities = useMemo(
    () => Object.values(activities).filter((activity) => !isSupervisorAgent(activity.agentId)),
    [activities],
  );

  useEffect(() => {
    for (const event of events) {
      if (event.type === "AGENT_REGISTERED" && typeof event.payload?.["name"] === "string") {
        agentNamesRef.current[event.source] = event.payload["name"] as string;
      }
    }
  }, [events]);

  return (
    <aside className="w-full flex-shrink-0 border-b border-slate-200/70 bg-white/55 p-4 backdrop-blur-xl lg:w-72 lg:border-b-0 lg:border-r">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Agent 活动</h3>
          <p className="mt-1 text-xs text-slate-500">查看当前协作节点的状态与最近动态</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-500">
          {visibleActivities.length} 个
        </span>
      </div>
      <div className="space-y-2 overflow-y-auto">
      {visibleActivities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/65 p-5 text-center text-xs text-slate-400">
          暂无可展示的 Agent
        </div>
      ) : (
        visibleActivities.map((activity) => {
          const defaultStatus = AGENT_STATUS_COLORS["idle"]!;
          const colors = AGENT_STATUS_COLORS[activity.status] ?? defaultStatus;
          const label = AGENT_STATUS_LABELS[activity.status] ?? "未知";
          const name = agentNamesRef.current[activity.agentId] ?? activity.agentId;
          const isSelected = selectedId === activity.agentId;

          return (
            <button
              key={activity.agentId}
              onClick={() => { onSelect(activity.agentId); }}
              className={`w-full rounded-2xl border px-3.5 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${colors.bg} ${
                isSelected
                  ? `${colors.border} ring-2 ring-blue-500/20 ring-offset-1 ring-offset-transparent`
                  : "border-slate-200/70 bg-white/80 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                <span className="truncate text-xs font-semibold text-slate-800">{name}</span>
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
              {activity.message !== undefined && (
                <div className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">
                  {activity.message}
                </div>
              )}
              <div className="mt-2 text-[10px] text-sky-600 font-medium">点击查看 →</div>
            </button>
          );
        })
      )}
      </div>
    </aside>
  );
}

// ============================================================================
// Status / error / blackboard strips
// ============================================================================

function ConnectionStatus() {
  const { isConnected, isConnecting } = useCollaborationUi((state) => ({
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
  }));

  return (
    <div className="flex items-center gap-2">
      {isConnecting && <span className="text-xs font-medium text-sky-600">连接中...</span>}
      {isConnected && (
        <span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          已连接
        </span>
      )}
      {!isConnected && !isConnecting && <span className="text-xs text-slate-400">未连接</span>}
    </div>
  );
}

function ErrorBanner() {
  const error = useCollaborationUi((state) => state.error);
  if (error === null || error === undefined) { return null; }
  return <div className="flex-shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>;
}

function BlackboardSection() {
  const { blackboardData, tasks } = useCollaborationUi((state) => ({
    blackboardData: state.blackboardData,
    tasks: state.tasks,
  }));

  return (
    <div className="flex-shrink-0 border-t border-slate-200/70 bg-white/65 px-4 py-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">黑板状态</h3>
        <span className="text-[11px] text-slate-400">共享上下文</span>
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white/88 p-3 shadow-sm">
        <BlackboardViewer data={blackboardData} tasks={tasks} />
      </div>
    </div>
  );
}

// ============================================================================
// HITL 问答卡片
// ============================================================================

interface HitlRequest {
  eventId: string;
  agentId: string;
  agentName: string;
  question: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect: boolean;
  timestamp: string;
}

function HitlCard({ request, sessionId, onDismiss }: { request: HitlRequest; sessionId: string; onDismiss: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const answer = selected.length > 0 ? selected.join(", ") : freeText.trim();
    if (!answer) return;
    setSubmitting(true);
    try {
      await sendCollaborationMessage(sessionId, answer);
      onDismiss();
    } catch {
      setSubmitting(false);
    }
  };

  const toggleOption = (label: string) => {
    if (request.multiSelect) {
      setSelected((prev) => prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]);
    } else {
      setSelected([label]);
    }
  };

  return (
    <div className="flex-shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="text-lg">💬</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-amber-800">{request.agentName}</span>
            <span className="text-[10px] text-amber-600">需要您的确认</span>
          </div>
          <p className="text-xs text-amber-900 mb-2">{request.question}</p>
          {request.options.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-2">
              {request.options.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => { toggleOption(opt.label); }}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    selected.includes(opt.label)
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-amber-300 bg-white text-amber-800 hover:border-amber-400"
                  }`}
                >
                  {opt.label}
                  {opt.description && <span className="ml-1 opacity-70">— {opt.description}</span>}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={freeText}
              onChange={(e) => { setFreeText(e.target.value); }}
              onKeyDown={(e) => { if (e.key === "Enter") { void handleSubmit(); } }}
              placeholder="输入您的回答..."
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-500 mb-2"
            />
          )}
          <div className="flex gap-2">
            <button
              disabled={submitting || (request.options.length > 0 ? selected.length === 0 : freeText.trim() === "")}
              onClick={() => { void handleSubmit(); }}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-amber-600 transition-colors"
            >
              {submitting ? "提交中..." : "确认"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Supervisor 派发进度面板
// ============================================================================

interface WorkerPlan {
  workerId: string;
  action: string;
  status: "dispatched" | "complete" | "failed" | "waiting";
}

function SupervisorPlanPanel({ events }: { events: RuntimeEvent[] }) {
  const workers = useMemo(() => {
    const map = new Map<string, WorkerPlan>();
    for (const ev of events) {
      if (ev.type === "SUPERVISOR_TOOL_CALL") {
        const args = ev.payload?.["args"] as Record<string, unknown> | undefined;
        const toolName = ev.payload?.["toolName"] as string | undefined;
        if (toolName === "dispatch_worker" && args?.["workerId"]) {
          const wId = String(args["workerId"]);
          map.set(wId, {
            workerId: wId,
            action: String(args["specificAction"] ?? "").slice(0, 60),
            status: "dispatched",
          });
        }
      }
      if (ev.type === "SUPERVISOR_WORKER_COMPLETE") {
        const wId = String(ev.payload?.["workerId"] ?? "");
        if (wId && map.has(wId)) {
          map.get(wId)!.status = "complete";
        }
      }
      if (ev.type === "HUMAN_REVIEW_REQUEST" && ev.source !== "supervisor") {
        const wId = ev.source;
        if (wId && map.has(wId)) {
          map.get(wId)!.status = "waiting";
        }
      }
      if (ev.type === "AGENT_FAIL_TASK") {
        const wId = ev.source;
        if (wId && map.has(wId)) {
          map.get(wId)!.status = "failed";
        }
      }
    }
    return Array.from(map.values());
  }, [events]);

  if (workers.length === 0) return null;

  const statusIcon: Record<string, string> = {
    dispatched: "⏳",
    complete: "✅",
    failed: "❌",
    waiting: "💬",
  };
  const statusText: Record<string, string> = {
    dispatched: "执行中",
    complete: "完成",
    failed: "失败",
    waiting: "等待回答",
  };

  return (
    <div className="flex-shrink-0 border-b border-slate-200/70 bg-slate-50/70 px-4 py-2.5 backdrop-blur-xl">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 flex-shrink-0">Supervisor 计划</span>
        {workers.map((w) => (
          <div
            key={w.workerId}
            className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600"
            title={w.action}
          >
            <span>{statusIcon[w.status]}</span>
            <span className="font-medium">{w.workerId}</span>
            <span className="text-slate-400">{statusText[w.status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Root
// ============================================================================

interface CollaborationViewerProps {
  sessionId: string;
  uiDeps: CollaborationRuntimeUiDeps;
}

export function CollaborationViewer({ sessionId, uiDeps }: CollaborationViewerProps) {
  useSSEConnection(sessionId);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [dismissedHitls, setDismissedHitls] = useState<Set<string>>(new Set());
  const events = useCollaborationUi((state) => state.events);
  const agentNames = useMemo(() => collectAgentNames(events, {}), [events]);

  const selectedName = selectedAgentId !== null
    ? (agentNames[selectedAgentId] ?? selectedAgentId)
    : null;

  // 从事件流提取待回答的 HITL 请求（去重、排除已 dismiss 的）
  const pendingHitls = useMemo<HitlRequest[]>(() => {
    const seen = new Set<string>();
    const result: HitlRequest[] = [];
    for (const ev of events) {
      if (ev.type !== "HUMAN_REVIEW_REQUEST") continue;
      if (seen.has(ev.id) || dismissedHitls.has(ev.id)) continue;
      seen.add(ev.id);
      result.push({
        eventId: ev.id,
        agentId: ev.source,
        agentName: agentNames[ev.source] ?? ev.source,
        question: String(ev.payload?.["question"] ?? ""),
        options: (ev.payload?.["options"] as Array<{ label: string; description?: string }> | undefined) ?? [],
        multiSelect: Boolean(ev.payload?.["multiSelect"] ?? false),
        timestamp: ev.timestamp,
      });
    }
    return result;
  }, [events, agentNames, dismissedHitls]);

  const dismissHitl = (eventId: string) => {
    setDismissedHitls((prev) => new Set([...prev, eventId]));
  };

  return (
    <UiDepsContext.Provider value={uiDeps}>
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,250,252,0.9))] shadow-[0_18px_45px_-30px_rgba(15,23,42,0.35)]">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/72 px-5 py-3 backdrop-blur-xl">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">多 Agent 协作</h2>
          <p className="mt-1 text-xs text-slate-500">统一查看协作节点状态、消息流与共享黑板</p>
        </div>
        <ConnectionStatus />
      </div>

      <ErrorBanner />

      {/* Supervisor 派发进度 */}
      <SupervisorPlanPanel events={events} />

      {/* HITL 待回答卡片（最多显示最新一条） */}
      {pendingHitls.slice(-1).map((req) => (
        <HitlCard
          key={req.eventId}
          request={req}
          sessionId={sessionId}
          onDismiss={() => { dismissHitl(req.eventId); }}
        />
      ))}

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <AgentActivityCards
          onSelect={(id) => { setSelectedAgentId((cur) => cur === id ? null : id); }}
          selectedId={selectedAgentId}
        />

        {selectedAgentId !== null && selectedName !== null ? (
          <AgentCuiPanel
            agentId={selectedAgentId}
            agentName={selectedName}
            sessionId={sessionId}
            onBack={() => { setSelectedAgentId(null); }}
          />
        ) : (
          <MessageStream sessionId={sessionId} onSelectAgent={(id) => { setSelectedAgentId(id); }} />
        )}
      </div>

      <BlackboardSection />
    </div>
    </UiDepsContext.Provider>
  );
}
