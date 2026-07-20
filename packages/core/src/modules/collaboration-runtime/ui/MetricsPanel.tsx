/**
 * Metrics Panel — 运行指标面板。
 *
 * Story 9.17: 运行指标面板 — Agent 思考次数、消息数、Token 消耗、任务完成率
 */

interface AgentMetrics {
  agentId: string;
  thinkingCount: number;
  toolCallCount: number;
  messageCount: number;
  tokenUsed: number;
  tasksCompleted: number;
  tasksFailed: number;
}

interface RuntimeMetrics {
  agents: AgentMetrics[];
  totalMessages: number;
  conflictsDetected: number;
  conflictsResolved: number;
  durationSeconds: number;
}

interface MetricsPanelProps {
  metrics: RuntimeMetrics | null;
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  if (!metrics || metrics.agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
        暂无指标数据
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="消息总数" value={metrics.totalMessages} />
        <StatCard label="冲突检测" value={metrics.conflictsDetected} />
        <StatCard label="冲突消解" value={metrics.conflictsResolved} />
        <StatCard label="运行时长" value={`${metrics.durationSeconds}s`} />
      </div>

      {/* Per-agent metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {metrics.agents.map((agent) => {
          const totalTasks = agent.tasksCompleted + agent.tasksFailed;
          const completionRate =
            totalTasks > 0
              ? ((agent.tasksCompleted / totalTasks) * 100).toFixed(0)
              : "—";

          return (
            <div
              key={agent.agentId}
              className="p-3 rounded border border-gray-200 bg-white"
            >
              <div className="font-mono text-sm font-semibold text-gray-800 mb-2">
                {agent.agentId}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <MetricItem label="思考" value={agent.thinkingCount} />
                <MetricItem label="工具" value={agent.toolCallCount} />
                <MetricItem label="消息" value={agent.messageCount} />
                <MetricItem label="Token" value={formatToken(agent.tokenUsed)} />
                <MetricItem label="完成" value={agent.tasksCompleted} />
                <MetricItem label="完成率" value={`${completionRate}%`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-2 rounded bg-gray-50 text-center">
      <div className="text-lg font-bold text-gray-800">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono text-gray-800">{value}</span>
    </div>
  );
}

function formatToken(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
