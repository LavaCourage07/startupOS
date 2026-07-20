"use strict";
/**
 * Skill Executor
 *
 * Handles execution of skills with proper tool injection and result handling.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillExecutor = void 0;
const ontology_1 = require("../../../lib/features/ontology");
/**
 * Skill executors
 */
class SkillExecutor {
    /**
     * Execute a skill with given context
     */
    async execute(skill, context) {
        // Inject tools into context
        const enhancedContext = {
            ...context,
            tools: this.createToolContext(context.sessionId),
        };
        try {
            const result = await skill.handler(enhancedContext);
            return result;
        }
        catch (error) {
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
    createToolContext(_sessionId) {
        return {
            createEntity: async (type, properties) => {
                console.log(`[SkillTool] createEntity: ${type}`, properties);
                return await ontology_1.ontologyClient.createEntity(type, properties);
            },
            updateEntity: async (entityId, properties) => {
                console.log(`[SkillTool] updateEntity: ${entityId}`, properties);
                return await ontology_1.ontologyClient.updateEntity(entityId, properties);
            },
            createRelation: async (fromId, relType, toId, properties) => {
                console.log(`[SkillTool] createRelation: ${fromId} -> ${relType} -> ${toId}`, properties);
                return await ontology_1.ontologyClient.createRelation(fromId, relType, toId, properties);
            },
            queryEntities: async (type, where) => {
                console.log(`[SkillTool] queryEntities: ${type}`, where);
                return await ontology_1.ontologyClient.queryEntities(type, where);
            },
            getRelated: async (entityId, relType, direction = 'outgoing') => {
                console.log(`[SkillTool] getRelated: ${entityId} via ${relType} (${direction})`);
                return await ontology_1.ontologyClient.getRelated(entityId, relType, direction);
            },
            callSkill: async (skillName, input) => {
                console.log(`[SkillTool] callSkill: ${skillName}`, input);
                // Import here to avoid circular dependency
                const { skillRouter } = await Promise.resolve().then(() => __importStar(require('./registry')));
                const request = {
                    agentType: skillName,
                    message: typeof input === 'string' ? input : JSON.stringify(input),
                    context: {
                        sessionId: '',
                    },
                };
                const skill = await skillRouter.route(request);
                if (skill) {
                    const context = {
                        sessionId: '',
                        session: {
                            projectContext: {
                                projectId: '',
                                projectName: '',
                            },
                            messages: [],
                        },
                        input: { data: input },
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
exports.skillExecutor = new SkillExecutor();
