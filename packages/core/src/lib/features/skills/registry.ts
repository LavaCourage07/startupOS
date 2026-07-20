/**
 * Skill Registry and Router
 *
 * Manages loading, registration, and routing of skills in the pi-agent-core system.
 */

import type {
  LoadedSkill,
  SkillRegistry,
  SkillRouter,
  SkillRoutingRequest,
  SkillRoutingRule,
} from '../../../types/skill';

// ============================================================================
// Skill Registry
// ============================================================================

class DefaultSkillRegistry implements SkillRegistry {
  private skills = new Map<string, LoadedSkill>();

  register(skill: LoadedSkill): void {
    this.skills.set(skill.metadata.name, skill);
  }

  unregister(skillName: string): void {
    this.skills.delete(skillName);
  }

  get(skillName: string): LoadedSkill | undefined {
    return this.skills.get(skillName);
  }

  list(): LoadedSkill[] {
    return Array.from(this.skills.values());
  }

  has(skillName: string): boolean {
    return this.skills.has(skillName);
  }
}

// ============================================================================
// Skill Router
// ============================================================================

class DefaultSkillRouter implements SkillRouter {
  private rules: Array<{ rule: SkillRoutingRule; priority: number }> = [];

  constructor(private registry: SkillRegistry) {}

  route(request: SkillRoutingRequest): Promise<LoadedSkill | null> {
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

  registerRule(rule: SkillRoutingRule): void {
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
const skillRouter = new DefaultSkillRouter(skillRegistry);

// Initialize with default routing rules
skillRouter.registerRule({
  condition: (request: SkillRoutingRequest) => {
    // Route project-initialization to the project-initialization skill
    return !!(request.agentType === 'project-initialization' ||
           request.message?.toLowerCase().includes('create project') ||
           request.message?.toLowerCase().includes('new project'));
  },
  skillName: 'project-initialization',
  priority: 10,
});

skillRouter.registerRule({
  condition: (request: SkillRoutingRequest) => {
    // Route ontology-related requests to ontology skill
    return !!(request.agentType === 'ontology' ||
           request.message?.toLowerCase().includes('ontology') ||
           request.message?.toLowerCase().includes('entity'));
  },
  skillName: 'ontology',
  priority: 5,
});

skillRouter.registerRule({
  condition: (_request: SkillRoutingRequest) => {
    // Default to generic agent if no specific skill matches
    return true;
  },
  skillName: 'generic',
  priority: 0,
});

export { skillRegistry, skillRouter };
export type { DefaultSkillRegistry, DefaultSkillRouter };

// Re-export types for convenience
export type {
  LoadedSkill,
  SkillMetadata,
  SkillRegistry,
  SkillRouter,
  SkillRoutingRequest,
  SkillRoutingRule,
} from '../../../types/skill';
