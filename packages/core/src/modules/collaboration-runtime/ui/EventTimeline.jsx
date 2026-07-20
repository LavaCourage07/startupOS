"use client";
/**
 * Event Timeline — 按时间排序展示 RuntimeEvent，按类型着色。
 *
 * Story 9.12: UI 协作查看器
 */
import { useMemo } from "react";
// 事件类型到 Tailwind 颜色映射
const EVENT_COLORS = {
    SESSION_CREATED: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
    SESSION_COMPLETE: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
    SESSION_ABORTED: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
    AGENT_THINKING: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
    AGENT_ACT: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
    AGENT_COMPLETE_TASK: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
    AGENT_FAIL_TASK: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
    AGENT_MESSAGE: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
    AGENT_BROADCAST: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
    BLACKBOARD_WRITE: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" },
    BLACKBOARD_UPDATE: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" },
    TASK_CREATED: { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500" },
    TASK_ASSIGNED: { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500" },
    TASK_COMPLETED: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
    TASK_FAILED: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};
const DEFAULT_COLOR = { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400" };
function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
export function EventTimeline({ events }) {
    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [events]);
    if (sortedEvents.length === 0) {
        return (<div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        暂无事件
      </div>);
    }
    return (<div className="space-y-2 max-h-96 overflow-y-auto">
      {sortedEvents.map((event) => {
            const colors = EVENT_COLORS[event.type] ?? DEFAULT_COLOR;
            const payloadSummary = formatPayloadSummary(event.payload);
            return (<div key={event.id} className={`flex items-start gap-3 p-2 rounded ${colors.bg} text-xs`}>
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${colors.dot}`}/>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${colors.text}`}>{event.type}</span>
                <span className="text-gray-400">{formatTime(event.timestamp)}</span>
                {event.source && (<span className="text-gray-500 font-mono">[{event.source}]</span>)}
              </div>
              {payloadSummary && (<p className="text-gray-600 truncate mt-0.5">{payloadSummary}</p>)}
            </div>
          </div>);
        })}
    </div>);
}
function formatPayloadSummary(payload) {
    if (!payload)
        return "";
    // 提取关键信息
    const parts = [];
    if (payload["toolName"])
        parts.push(String(payload["toolName"]));
    if (payload["reason"])
        parts.push(String(payload["reason"]));
    if (payload["error"])
        parts.push(String(payload["error"]));
    if (payload["key"])
        parts.push(`${String(payload["key"])}`);
    return parts.join(" · ") || JSON.stringify(payload).slice(0, 80);
}
