/**
 * StatusIndicator Component
 * Displays the current status of an agent
 */

import { AgentStatus } from '@originos/core/types';

interface StatusIndicatorProps {
  status: AgentStatus;
  isThinking?: boolean;
}

export default function StatusIndicator({ status, isThinking }: StatusIndicatorProps) {
  if (isThinking) {
    return (
      <span className="text-xs text-blue-500 flex items-center gap-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        思考中...
      </span>
    );
  }

  switch (status) {
    case AgentStatus.RUNNING:
      return <span className="text-xs text-teal-400">● 在线</span>;
    case AgentStatus.IDLE:
      return <span className="text-xs text-gray-500">○ 空闲</span>;
    case AgentStatus.ERROR:
      return <span className="text-xs text-red-500">⚠ 错误</span>;
    default:
      return <span className="text-xs text-gray-400">○ 离线</span>;
  }
}
