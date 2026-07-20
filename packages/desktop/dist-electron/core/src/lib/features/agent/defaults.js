"use strict";
/**
 * OS.3: Default Agents Definition
 * Default agents that appear in the system on first load (Story OS.3)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AGENTS = void 0;
exports.initializeDefaultAgents = initializeDefaultAgents;
const agent_object_1 = require("../../../types/agent-object");
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
exports.DEFAULT_AGENTS = [
    {
        id: 'agent-pm-1',
        name: 'pm-1',
        displayName: '产品经理',
        type: agent_object_1.AgentType.PM,
        status: agent_object_1.AgentStatus.IDLE,
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
        type: agent_object_1.AgentType.ARCHITECT,
        status: agent_object_1.AgentStatus.IDLE,
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
        type: agent_object_1.AgentType.UX_DESIGNER,
        status: agent_object_1.AgentStatus.IDLE,
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
        type: agent_object_1.AgentType.DEVELOPER,
        status: agent_object_1.AgentStatus.IDLE,
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
        type: agent_object_1.AgentType.QA_ENGINEER,
        status: agent_object_1.AgentStatus.IDLE,
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
        type: agent_object_1.AgentType.PROJECT_INITIALIZER,
        status: agent_object_1.AgentStatus.IDLE,
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
function initializeDefaultAgents() {
    return exports.DEFAULT_AGENTS;
}
