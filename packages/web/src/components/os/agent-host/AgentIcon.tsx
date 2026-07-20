/**
 * OS.7: AgentIcon Component
 */

import React from 'react';
import { AgentHost, AgentStatus } from '@originos/core/types';

interface AgentIconProps {
  agent: AgentHost;
  status?: AgentStatus;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
}

const sizeStyles = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

const statusColors: Record<AgentStatus, string> = {
  [AgentStatus.IDLE]: 'bg-gray-400',
  [AgentStatus.INITIALIZING]: 'bg-yellow-400',
  [AgentStatus.RUNNING]: 'bg-green-400 animate-pulse',
  [AgentStatus.PAUSED]: 'bg-orange-400',
  [AgentStatus.ERROR]: 'bg-red-400',
  [AgentStatus.UNREGISTERED]: 'bg-gray-400',
};

export default function AgentIcon({
  agent,
  status = AgentStatus.IDLE,
  onClick,
  size = 'md',
  showStatus = true,
}: AgentIconProps) {
  return (
    <div
      className={`relative ${sizeStyles[size]} cursor-pointer`}
      onClick={onClick}
      title={agent.name}
    >
      <div className="w-full h-full rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
        {agent.icon ? (
          <span className="flex items-center justify-center w-full h-full text-2xl">
            {agent.icon}
          </span>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500" />
        )}
      </div>
      {showStatus && (
        <div
          className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${statusColors[status]}`}
        />
      )}
    </div>
  );
}
