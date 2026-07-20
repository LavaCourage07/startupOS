/**
 * Skill Executor
 *
 * Handles execution of skills with proper tool injection and result handling.
 */

import { ontologyClient } from '../../../lib/features/ontology';
import type {
  SkillContext,
  SkillResult,
  SkillTools,
  LoadedSkill,
  SkillRoutingRequest,
} from '../../../types/skill';

/**
 * Skill executors
 */
class SkillExecutor {
  /**
   * Execute a skill with given context
   */
  async execute(skill: LoadedSkill, context: SkillContext): Promise<SkillResult> {
    // Inject tools into context
    const enhancedContext: SkillContext = {
      ...context,
      tools: this.createToolContext(context.sessionId),
    };

    try {
      const result = await skill.handler(enhancedContext);
      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SKILL_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      };
    }
  }

  /**
   * Create tool context for skill execution
   */
  private createToolContext(_sessionId: string): SkillTools {
    return {
      createEntity: async (type: string, properties: Record<string, unknown>) => {
        console.log(`[SkillTool] createEntity: ${type}`, properties);
        return await ontologyClient.createEntity(type, properties);
      },

      updateEntity: async (entityId: string, properties: Record<string, unknown>) => {
        console.log(`[SkillTool] updateEntity: ${entityId}`, properties);
        return await ontologyClient.updateEntity(entityId, properties);
      },

      createRelation: async (
        fromId: string,
        relType: string,
        toId: string,
        properties?: Record<string, unknown>,
      ) => {
        console.log(`[SkillTool] createRelation: ${fromId} -> ${relType} -> ${toId}`, properties);
        return await ontologyClient.createRelation(fromId, relType, toId, properties);
      },

      queryEntities: async (type: string, where: Record<string, unknown>) => {
        console.log(`[SkillTool] queryEntities: ${type}`, where);
        return await ontologyClient.queryEntities(type, where);
      },

      getRelated: async (
        entityId: string,
        relType: string,
        direction: 'outgoing' | 'incoming' | 'both' = 'outgoing',
      ) => {
        console.log(`[SkillTool] getRelated: ${entityId} via ${relType} (${direction})`);
        return await ontologyClient.getRelated(entityId, relType, direction);
      },

      callSkill: async (skillName: string, input: unknown): Promise<SkillResult> => {
        console.log(`[SkillTool] callSkill: ${skillName}`, input);
        // Import here to avoid circular dependency
        const { skillRouter } = await import('./registry');
        const request: SkillRoutingRequest = {
          agentType: skillName,
          message: typeof input === 'string' ? input : JSON.stringify(input),
          context: {
            sessionId: '',
          },
        };
        const skill = await skillRouter.route(request);
        if (skill) {
          const context: SkillContext = {
            sessionId: '',
            session: {
              projectContext: {
                projectId: '',
                projectName: '',
              },
              messages: [],
            },
            input: { data: input as Record<string, unknown> },
            tools: this.createToolContext(''),
          };
          return await this.execute(skill, context);
        }
        return {
          success: false,
          error: {
            code: 'SKILL_NOT_FOUND',
            message: `Skill '${skillName}' not found`,
          },
        };
      },
    };
  }
}

/**
 * Export singleton
 */
export const skillExecutor = new SkillExecutor();
export type { SkillExecutor };
