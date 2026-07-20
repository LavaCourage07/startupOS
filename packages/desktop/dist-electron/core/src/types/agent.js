"use strict";
/**
 * OS.3: Agent 对象定义 - Type Definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_STATUS_COLOR = exports.AGENT_STATUS_ICON = exports.AGENT_TYPE_INFO = exports.AgentStatus = exports.AgentType = void 0;
// ============ Agent Type Enum ============
var AgentType;
(function (AgentType) {
    AgentType["ARCHITECT"] = "architect";
    AgentType["DEVELOPER"] = "developer";
    AgentType["QA_ENGINEER"] = "qa-engineer";
    AgentType["UX_DESIGNER"] = "ux-designer";
    AgentType["PM"] = "pm";
    AgentType["PROJECT_INITIALIZER"] = "project-initializer";
})(AgentType || (exports.AgentType = AgentType = {}));
// ============ Agent Status Enum ============
var AgentStatus;
(function (AgentStatus) {
    AgentStatus["IDLE"] = "idle";
    AgentStatus["INITIALIZING"] = "initializing";
    AgentStatus["RUNNING"] = "running";
    AgentStatus["PAUSED"] = "paused";
    AgentStatus["ERROR"] = "error";
    AgentStatus["UNREGISTERED"] = "unregistered";
})(AgentStatus || (exports.AgentStatus = AgentStatus = {}));
exports.AGENT_TYPE_INFO = {
    [AgentType.ARCHITECT]: {
        id: AgentType.ARCHITECT,
        name: 'architect',
        displayName: '架构师',
        icon: '🏗️',
        color: '#3B82F6',
        capabilities: ['architecture', 'design', 'review'],
    },
    [AgentType.DEVELOPER]: {
        id: AgentType.DEVELOPER,
        name: 'developer',
        displayName: '开发者',
        icon: '💻',
        color: '#10B981',
        capabilities: ['code', 'test', 'debug'],
    },
    [AgentType.QA_ENGINEER]: {
        id: AgentType.QA_ENGINEER,
        name: 'qa-engineer',
        displayName: 'QA 工程师',
        icon: '🧪',
        color: '#F59E0B',
        capabilities: ['test', 'review', 'quality'],
    },
    [AgentType.UX_DESIGNER]: {
        id: AgentType.UX_DESIGNER,
        name: 'ux-designer',
        displayName: 'UX 设计师',
        icon: '🎨',
        color: '#8B5CF6',
        capabilities: ['design', 'research', 'prototyping'],
    },
    [AgentType.PM]: {
        id: AgentType.PM,
        name: 'pm',
        displayName: '产品经理',
        icon: '📋',
        color: '#EC4899',
        capabilities: ['planning', 'requirements', 'coordination'],
    },
    [AgentType.PROJECT_INITIALIZER]: {
        id: AgentType.PROJECT_INITIALIZER,
        name: 'project-initializer',
        displayName: '项目初始化',
        icon: '🚀',
        color: '#6366F1',
        capabilities: ['project_create', 'ontology_build', 'team_coordination', 'interview'],
    },
};
// ============ Agent Status Icons & Colors ============
exports.AGENT_STATUS_ICON = {
    [AgentStatus.IDLE]: '⚪',
    [AgentStatus.INITIALIZING]: '🔵',
    [AgentStatus.RUNNING]: '🟢',
    [AgentStatus.PAUSED]: '🟡',
    [AgentStatus.ERROR]: '🔴',
    [AgentStatus.UNREGISTERED]: '⚫',
};
exports.AGENT_STATUS_COLOR = {
    [AgentStatus.IDLE]: '#9CA3AF',
    [AgentStatus.INITIALIZING]: '#3B82F6',
    [AgentStatus.RUNNING]: '#10B981',
    [AgentStatus.PAUSED]: '#F59E0B',
    [AgentStatus.ERROR]: '#EF4444',
    [AgentStatus.UNREGISTERED]: '#6B7280',
};
