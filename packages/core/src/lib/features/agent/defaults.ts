/**
 * OS.3: Default Agents Definition
 * Default agents that appear in the system on first load (Story OS.3)
 */

import { AgentType, AgentStatus, type AgentObject } from '../../../types/agent-object';

/**
 * DEFAULT_AGENTS - The 5 default agents that initialize with OriginOS
 *
 * These are the core team members that users interact with:
 * - PM (Product Manager) - 📋
 * - Architect - 🏗️
 * - UX Designer - 🎨
 * - Developer - 💻
 * - QA Engineer - 🧪
 *
 * PLUS the Project Initializer agent for project management:
 * - Project Initializer - 🚀
 */
export const DEFAULT_AGENTS: AgentObject[] = [
  {
    id: 'agent-pm-1',
    name: 'pm-1',
    displayName: '产品经理',
    type: AgentType.PM,
    status: AgentStatus.IDLE,
    icon: '📋',
    color: '#EC4899',
    capabilities: ['planning', 'requirements', 'coordination'],
    createdAt: Date.now(),
    lastActivatedAt: Date.now(),
  },
  {
    id: 'agent-architect-1',
    name: 'architect-1',
    displayName: '架构师',
    type: AgentType.ARCHITECT,
    status: AgentStatus.IDLE,
    icon: '🏗️',
    color: '#3B82F6',
    capabilities: ['architecture', 'design', 'review'],
    createdAt: Date.now(),
    lastActivatedAt: Date.now(),
  },
  {
    id: 'agent-ux-designer-1',
    name: 'ux-designer-1',
    displayName: 'UX 设计师',
    type: AgentType.UX_DESIGNER,
    status: AgentStatus.IDLE,
    icon: '🎨',
    color: '#8B5CF6',
    capabilities: ['design', 'research', 'prototyping'],
    createdAt: Date.now(),
    lastActivatedAt: Date.now(),
  },
  {
    id: 'agent-developer-1',
    name: 'developer-1',
    displayName: '开发者',
    type: AgentType.DEVELOPER,
    status: AgentStatus.IDLE,
    icon: '💻',
    color: '#10B981',
    capabilities: ['code', 'test', 'debug'],
    createdAt: Date.now(),
    lastActivatedAt: Date.now(),
  },
  {
    id: 'agent-qa-1',
    name: 'qa-1',
    displayName: 'QA 工程师',
    type: AgentType.QA_ENGINEER,
    status: AgentStatus.IDLE,
    icon: '🧪',
    color: '#F59E0B',
    capabilities: ['test', 'review', 'quality'],
    createdAt: Date.now(),
    lastActivatedAt: Date.now(),
  },
  {
    id: 'agent-project-init-1',
    name: 'project-initializer',
    displayName: '项目初始化',
    type: AgentType.PROJECT_INITIALIZER,
    status: AgentStatus.IDLE,
    icon: '🚀',
    color: '#6366F1',
    capabilities: ['project_create', 'ontology_build', 'team_coordination', 'interview'],
    createdAt: Date.now(),
    lastActivatedAt: Date.now(),
  },
];

/**
 * Initialize default agents into the registry
 * Call this on app startup to seed the agent registry
 */
export function initializeDefaultAgents(): AgentObject[] {
  return DEFAULT_AGENTS;
}
