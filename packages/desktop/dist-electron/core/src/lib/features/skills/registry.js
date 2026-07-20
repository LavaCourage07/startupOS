"use strict";
/**
 * Skill Registry and Router
 *
 * Manages loading, registration, and routing of skills in the pi-agent-core system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillRouter = exports.skillRegistry = void 0;
// ============================================================================
// Skill Registry
// ============================================================================
class DefaultSkillRegistry {
    constructor() {
        this.skills = new Map();
    }
    register(skill) {
        this.skills.set(skill.metadata.name, skill);
    }
    unregister(skillName) {
        this.skills.delete(skillName);
    }
    get(skillName) {
        return this.skills.get(skillName);
    }
    list() {
        return Array.from(this.skills.values());
    }
    has(skillName) {
        return this.skills.has(skillName);
    }
}
// ============================================================================
// Skill Router
// ============================================================================
class DefaultSkillRouter {
    constructor(registry) {
        this.registry = registry;
        this.rules = [];
    }
    route(request) {
        // Sort rules by priority (highest first)
        const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);
        // Find the first matching rule
        for (const { rule } of sortedRules) {
            if (rule.condition(request)) {
                const skill = this.registry.get(rule.skillName);
                if (skill) {
                    return Promise.resolve(skill);
                }
            }
        }
        // Check for direct agent type match
        if (request.agentType) {
            const skill = this.registry.get(request.agentType);
            if (skill) {
                return Promise.resolve(skill);
            }
        }
        return Promise.resolve(null);
    }
    registerRule(rule) {
        this.rules.push({
            rule,
            priority: rule.priority || 0,
        });
    }
}
// ============================================================================
// Export singletons
// ============================================================================
const skillRegistry = new DefaultSkillRegistry();
exports.skillRegistry = skillRegistry;
const skillRouter = new DefaultSkillRouter(skillRegistry);
exports.skillRouter = skillRouter;
// Initialize with default routing rules
skillRouter.registerRule({
    condition: (request) => {
        // Route project-initialization to the project-initialization skill
        return !!(request.agentType === 'project-initialization' ||
            request.message?.toLowerCase().includes('create project') ||
            request.message?.toLowerCase().includes('new project'));
    },
    skillName: 'project-initialization',
    priority: 10,
});
skillRouter.registerRule({
    condition: (request) => {
        // Route ontology-related requests to ontology skill
        return !!(request.agentType === 'ontology' ||
            request.message?.toLowerCase().includes('ontology') ||
            request.message?.toLowerCase().includes('entity'));
    },
    skillName: 'ontology',
    priority: 5,
});
skillRouter.registerRule({
    condition: (_request) => {
        // Default to generic agent if no specific skill matches
        return true;
    },
    skillName: 'generic',
    priority: 0,
});
