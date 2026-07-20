"use strict";
/**
 * Intent Detection and Skill Decision
 *
 * Determines which skill to use based on user intent and context.
 * This is the PI Agent's decision-making layer for skill selection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentDecisionMaker = exports.AgentDecisionMaker = exports.Intent = void 0;
exports.detectIntent = detectIntent;
exports.decideSkill = decideSkill;
const skill_1 = require("../../../types/skill");
const registry_1 = require("./registry");
// ============================================================================
// Intent Types
// ============================================================================
var Intent;
(function (Intent) {
    Intent["CREATE_PROJECT"] = "create_project";
    Intent["EDIT_ONTOLOGY"] = "edit_ontology";
    Intent["MANAGE_TASKS"] = "manage_tasks";
    Intent["QUERY_INFO"] = "query_info";
    Intent["CHAT_GENERAL"] = "chat_general";
})(Intent || (exports.Intent = Intent = {}));
/**
 * Detect intent from user message and context
 */
function detectIntent(message, _context) {
    const lowerMessage = message.toLowerCase();
    // Project creation intent
    if (lowerMessage.includes('create project') ||
        lowerMessage.includes('new project') ||
        lowerMessage.includes('start a project') ||
        lowerMessage.includes('initialize project')) {
        return {
            intent: Intent.CREATE_PROJECT,
            confidence: 0.9,
            suggestedSkill: 'project-initialization',
            reasoning: 'User explicitly mentions creating or starting a project',
        };
    }
    // Ontology editing intent
    if (lowerMessage.includes('add entity') ||
        lowerMessage.includes('create entity') ||
        lowerMessage.includes('update entity') ||
        lowerMessage.includes('delete entity') ||
        lowerMessage.includes('add relation') ||
        lowerMessage.includes('ontology')) {
        return {
            intent: Intent.EDIT_ONTOLOGY,
            confidence: 0.85,
            suggestedSkill: 'ontology',
            reasoning: 'User wants to modify ontology structure',
        };
    }
    // Task management intent
    if (lowerMessage.includes('add task') ||
        lowerMessage.includes('create task') ||
        lowerMessage.includes('complete task') ||
        lowerMessage.includes('task status') ||
        lowerMessage.includes('assign task')) {
        return {
            intent: Intent.MANAGE_TASKS,
            confidence: 0.8,
            suggestedSkill: 'ontology',
            reasoning: 'User wants to manage tasks',
        };
    }
    // Query intent
    if (lowerMessage.startsWith('what') ||
        lowerMessage.startsWith('show') ||
        lowerMessage.startsWith('list') ||
        lowerMessage.includes('tell me about') ||
        lowerMessage.includes('how many')) {
        return {
            intent: Intent.QUERY_INFO,
            confidence: 0.7,
            suggestedSkill: 'ontology',
            reasoning: 'User is asking for information',
        };
    }
    // General chat (fallback)
    return {
        intent: Intent.CHAT_GENERAL,
        confidence: 0.5,
        suggestedSkill: 'generic',
        reasoning: 'No specific intent detected, defaulting to general chat',
    };
}
// ============================================================================
// Decision Engine
// ============================================================================
/**
 * Decide which skill to use based on intent and context
 */
async function decideSkill(message, context) {
    // Detect intent
    const intentMatch = detectIntent(message, context);
    // Use router to find appropriate skill
    const request = {
        message,
        intent: intentMatch.intent,
        context: {
            currentPhase: context?.currentPhase,
            sessionId: context?.sessionId ?? '',
        },
    };
    const skill = await registry_1.skillRouter.route(request);
    return {
        skill,
        intent: intentMatch,
        confidence: intentMatch.confidence,
        reasoning: intentMatch.reasoning,
    };
}
/**
 * PI Agent makes decision about next action
 *
 * This is the core decision-making function that the PI Agent uses
 * to autonomously decide which skill to invoke based on context.
 */
class AgentDecisionMaker {
    constructor() {
        this.decisionHistory = [];
    }
    /**
     * Make a decision about which skill to use
     */
    async decide(message, context = {}) {
        // If we're in the middle of a composite skill, stay in it
        // unless the user explicitly wants to do something else
        if (context.activeSkill && context.currentPhase) {
            const currentSkill = registry_1.skillRegistry.get(context.activeSkill);
            if (currentSkill && currentSkill.metadata.type === skill_1.SkillType.COMPOSITE) {
                // Check if user wants to exit or change context
                const exitIndicators = ['stop', 'cancel', 'done', 'complete', 'finish'];
                const wantsToExit = exitIndicators.some(indicator => message.toLowerCase().includes(indicator));
                if (!wantsToExit) {
                    return {
                        skill: currentSkill,
                        intent: Intent.CHAT_GENERAL,
                        reasoning: `Continuing in ${context.activeSkill} skill (current phase: ${context.currentPhase})`,
                        shouldSwitchSkill: false,
                    };
                }
            }
        }
        // Use intent detection to decide
        const decision = await decideSkill(message, context);
        // Record decision
        this.recordDecision(message, decision);
        // Determine if we should switch skills
        const shouldSwitchSkill = !context.activeSkill ||
            decision.intent.confidence > 0.8 ||
            decision.skill?.metadata.name !== context.activeSkill;
        return {
            skill: decision.skill,
            intent: decision.intent.intent,
            reasoning: decision.reasoning,
            shouldSwitchSkill,
        };
    }
    /**
     * Record a decision for learning
     */
    recordDecision(message, decision) {
        this.decisionHistory.push({
            timestamp: Date.now(),
            message,
            decision: decision.skill?.metadata.name || 'none',
            intent: decision.intent.intent,
            confidence: decision.intent.confidence,
        });
        // Keep only recent decisions
        if (this.decisionHistory.length > 100) {
            this.decisionHistory = this.decisionHistory.slice(-50);
        }
    }
    /**
     * Get decision history for analysis
     */
    getDecisionHistory() {
        return this.decisionHistory;
    }
    /**
     * Analyze decision patterns
     */
    analyzePatterns() {
        const skillCounts = new Map();
        const intentCounts = new Map();
        let totalConfidence = 0;
        for (const record of this.decisionHistory) {
            skillCounts.set(record.decision, (skillCounts.get(record.decision) || 0) + 1);
            intentCounts.set(record.intent, (intentCounts.get(record.intent) || 0) + 1);
            totalConfidence += record.confidence;
        }
        return {
            mostUsedSkills: Array.from(skillCounts.entries())
                .map(([skill, count]) => ({ skill, count }))
                .sort((a, b) => b.count - a.count),
            typicalIntents: Array.from(intentCounts.entries())
                .map(([intent, count]) => ({ intent, count }))
                .sort((a, b) => b.count - a.count),
            avgConfidence: this.decisionHistory.length > 0
                ? totalConfidence / this.decisionHistory.length
                : 0,
        };
    }
}
exports.AgentDecisionMaker = AgentDecisionMaker;
// Export singleton
exports.agentDecisionMaker = new AgentDecisionMaker();
