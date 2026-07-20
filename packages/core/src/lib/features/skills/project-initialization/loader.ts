/**
 * Load the project-initialization skill into the skill registry
 */

import type { LoadedSkill, SkillContext, SkillResult } from '@/types/skill';
import { skillRegistry } from '../registry';
import { SkillType } from '@/types/skill';
import { projectInitializationSkill } from './index';

/**
 * Create the loaded project-initialization skill
 */
const projectInitializationLoadedSkill: LoadedSkill = {
  metadata: {
    name: 'project-initialization',
    displayName: 'Project Initialization',
    description: 'Composite skill for project initialization through conversational interview and ontology building',
    type: SkillType.COMPOSITE,
    version: '1.0.0',
    priority: 'critical',
    dependencies: ['ontology'],
    reads: ['Project', 'Person', 'Task', 'Goal', 'Organization'],
    writes: ['Project', 'Person', 'Task', 'Goal', 'Action'],
    preconditions: ['User wants to create a new project'],
    postconditions: [
      'Created Project entity',
      'Created Person entities for team members',
      'Created Task entities from interview',
      'Relations established between entities',
    ],
  },

  /**
   * Handler for project-initialization skill execution
   */
  handler: async (context: SkillContext): Promise<SkillResult> => {
    const { sessionId, input, tools } = context;

    if (input.message) {
      // Process user message in interview
      const phase = context.skillData?.phase as string || 'foundation';

      // Delegate to the TypeScript skill implementation
      // Note: This is a bridge between the skill system and the TypeScript implementation
      const response = await projectInitializationSkill.processMessage(sessionId, input.message as string);

      return {
        success: true,
        message: response.message,
        nextPhase: response.phase,
        complete: response.complete,
        data: {
          response,
          phase: response.phase,
        },
      };
    }

    // Initialize new interview
    const projectName = context.session.projectContext.projectName;
    const projectId = context.session.projectContext.projectId;

    const session = await projectInitializationSkill.initialize({
      projectId,
      projectName,
    });

    return {
      success: true,
      message: `Project initialization started for "${projectName}"`,
      data: {
        sessionId: session.sessionId,
        phase: 'foundation',
      },
    };
  },
};

/**
 * Register the project-initialization skill
 */
export function registerProjectInitializationSkill(): void {
  skillRegistry.register(projectInitializationLoadedSkill);
}

/**
 * Auto-register on module import
 */
registerProjectInitializationSkill();

export { projectInitializationLoadedSkill };
