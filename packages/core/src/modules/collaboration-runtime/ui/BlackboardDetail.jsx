"use client";
/**
 * BlackboardDetail — 黑板详细视图。
 *
 * Story 9.17: 黑板状态详细查看器 — sharedData, messages, tasks, artifacts, locks
 */
"use client";
import { useState } from "react";
export function BlackboardDetail({ state }) {
    const [activeTab, setActiveTab] = useState("data");
    if (!state) {
        return (<div className="flex items-center justify-center h-24 text-gray-400 text-sm">
        暂无黑板数据
      </div>);
    }
    const tabs = [
        { id: "data", label: `数据 (${Object.keys(state.sharedData).length})` },
        { id: "tasks", label: `任务 (${state.tasks.length})` },
        { id: "messages", label: `消息 (${state.messages.length})` },
        { id: "locks", label: `锁 (${Object.keys(state.locks).length})` },
        { id: "artifacts", label: `产物 (${Object.keys(state.artifacts).length})` },
    ];
    return (<div className="space-y-2">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-3 py-1.5 text-xs font-medium rounded-t ${activeTab === tab.id
                ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>))}
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto text-xs font-mono">
        {activeTab === "data" && <DataView data={state.sharedData}/>}
        {activeTab === "tasks" && <TaskView tasks={state.tasks}/>}
        {activeTab === "messages" && <MessageView messages={state.messages}/>}
        {activeTab === "locks" && <LockView locks={state.locks}/>}
        {activeTab === "artifacts" && <ArtifactView artifacts={state.artifacts}/>}
      </div>
    </div>);
}
// ============================================================================
// Sub-views
// ============================================================================
function DataView({ data }) {
    const keys = Object.keys(data);
    if (keys.length === 0) {
        return <div className="text-gray-400 p-4">暂无数据</div>;
    }
    return (<div className="divide-y divide-gray-100">
      {keys.map((key) => {
            const entry = data[key];
            if (!entry)
                return null;
            return (<div key={key} className="p-2 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800">{key}</span>
              {entry.provenance && (<span className="text-gray-400">
                  v{entry.provenance.version} · {entry.provenance.writer}
                </span>)}
            </div>
            <pre className="text-gray-600 mt-1 whitespace-pre-wrap break-all">
              {typeof entry.value === "string"
                    ? entry.value
                    : JSON.stringify(entry.value, null, 2)}
            </pre>
          </div>);
        })}
    </div>);
}
function TaskView({ tasks }) {
    if (tasks.length === 0) {
        return <div className="text-gray-400 p-4">暂无任务</div>;
    }
    const STATUS_COLORS = {
        pending: "bg-gray-100 text-gray-600",
        assigned: "bg-blue-100 text-blue-600",
        running: "bg-yellow-100 text-yellow-600",
        completed: "bg-green-100 text-green-600",
        failed: "bg-red-100 text-red-600",
    };
    return (<div className="divide-y divide-gray-100">
      {tasks.map((task) => (<div key={task.id} className="p-2 hover:bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800">{task.description}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] ${STATUS_COLORS[task.status] ?? "bg-gray-100 text-gray-600"}`}>
              {task.status}
            </span>
          </div>
          <div className="flex gap-3 text-gray-400 mt-1">
            <span>{task.id}</span>
            {task.assignedTo && <span>→ {task.assignedTo}</span>}
            {task.dependsOn && task.dependsOn.length > 0 && (<span>deps: {task.dependsOn.join(", ")}</span>)}
          </div>
        </div>))}
    </div>);
}
function MessageView({ messages }) {
    if (messages.length === 0) {
        return <div className="text-gray-400 p-4">暂无消息</div>;
    }
    return (<div className="divide-y divide-gray-100">
      {messages.map((msg) => (<div key={msg.id} className="p-2 hover:bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">#{msg.seq}</span>
            <span className="font-medium text-gray-800">{msg.from}</span>
            <span className="text-gray-400">→</span>
            <span className="font-medium text-gray-800">{msg.to}</span>
            <span className="text-gray-400 text-[10px]">[{msg.type}]</span>
          </div>
          <pre className="text-gray-600 mt-1 text-[10px] whitespace-pre-wrap break-all">
            {typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content, null, 2).slice(0, 100)}
          </pre>
        </div>))}
    </div>);
}
function LockView({ locks }) {
    if (Object.keys(locks).length === 0) {
        return <div className="text-gray-400 p-4">无活跃锁</div>;
    }
    return (<div className="divide-y divide-gray-100">
      {Object.entries(locks).map(([key, lock]) => (<div key={key} className="p-2 hover:bg-gray-50 flex items-center justify-between">
          <div>
            <span className="font-semibold text-gray-800">{key}</span>
            <span className="text-gray-400 ml-2">held by {lock.holder}</span>
          </div>
          <span className="text-gray-400 text-[10px]">
            expires: {new Date(lock.expiresAt).toLocaleTimeString()}
          </span>
        </div>))}
    </div>);
}
function ArtifactView({ artifacts }) {
    if (Object.keys(artifacts).length === 0) {
        return <div className="text-gray-400 p-4">暂无产物</div>;
    }
    return (<div className="divide-y divide-gray-100">
      {Object.values(artifacts).map((artifact) => (<div key={artifact.name} className="p-2 hover:bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800">{artifact.name}</span>
            <span className="text-gray-400 text-[10px]">by {artifact.producer}</span>
          </div>
          <pre className="text-gray-600 mt-1 text-[10px] whitespace-pre-wrap break-all">
            {typeof artifact.data === "string"
                ? artifact.data
                : JSON.stringify(artifact.data, null, 2).slice(0, 100)}
          </pre>
        </div>))}
    </div>);
}
