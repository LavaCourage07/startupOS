"use strict";
/**
 * Project Agent
 *
 * A specialized agent for managing projects through the project-initialization skill.
 * This agent autonomously decides which skill to use and handles project-related tasks.
 *
 * Integrates Epic C (Taste Engineering) - Two-layer TASTE.md architecture
 * Integrates Epic T (Accumulation System) - SignalReader and ARIA governance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectAgent = void 0;
const uuid_1 = require("uuid");
const session_service_1 = require("./session-service");
const skills_1 = require("../../../lib/features/skills");
// ============================================================================
// Project Agent Implementation
// ============================================================================
class DefaultProjectAgent {
    constructor() {
        // ============================================================================
        // State (Taste Engineering & Accumulation)
        // ============================================================================
        this.tasteCache = new Map(); // userId/projectId → TASTE
        this.trustModel = {
            overallTrust: 0.5,
            domainTrust: new Map(),
            history: [],
        };
        this.projectTASTECollection = new Map();
        // Auto-register skills on creation
        this.ensureSkillsRegistered();
    }
    ensureSkillsRegistered() {
        // This is handled by the auto-registration in loader.ts
    }
    async startProject(projectName) {
        // Create a new agent session with project-initialization agent type
        const createRequest = {
            projectId: `proj_${(0, uuid_1.v4)()}`,
            projectName,
            agentType: 'project-initialization',
            systemPrompt: await this.getSystemPrompt(),
            projectContext: {
                phase: 'foundation',
            },
        };
        const session = await session_service_1.agentSessionService.createSession(createRequest);
        // Send initial system message
        await session_service_1.agentSessionService.addMessage(session.sessionId, {
            role: 'system',
            content: 'Project initialization started',
            toolResults: [],
        });
        // Send welcome message from the agent
        const welcomeMessage = this.getWelcomeMessage(projectName);
        await session_service_1.agentSessionService.addMessage(session.sessionId, {
            role: 'assistant',
            content: welcomeMessage,
            toolResults: [],
        });
        return session;
    }
    async sendMessage(sessionId, message) {
        // Get current session
        const session = await session_service_1.agentSessionService.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        // Add user message to session
        await session_service_1.agentSessionService.addMessage(sessionId, {
            role: 'user',
            content: message,
            toolResults: [],
        });
        // =======================================
        // Taste Engineering (Epic C): Collect Project TASTE invisibly
        // =======================================
        await this.collectProjectTASTE(sessionId, message);
        // Load merged TASTE profile for context-aware response
        const tasteProfile = await this.loadTasteProfile('user', session.projectContext?.projectId);
        // =======================================
        // Accumulation System (Epic T): Read taste signals
        // =======================================
        const tasteSignals = await this.readTasteSignals(sessionId, message);
        // Add observations for ARIA Infer phase
        for (const signal of tasteSignals) {
            await this.addObservation({
                pattern_hint: signal.type,
                signal,
                timestamp: Date.now(),
                decay_factor: 0.9,
                evidence: {
                    interaction_id: sessionId,
                    context_snippet: message,
                    user_reaction: message,
                },
            });
        }
        // Get decision context
        const context = {
            conversationHistory: session.messages.slice(-10).map((m) => ({
                role: m.role,
                content: m.content,
            })),
            currentPhase: session.projectContext?.phase,
            activeSkill: session.agentType,
        };
        // Let the agent make a decision about which skill to use
        const decision = await skills_1.agentDecisionMaker.decide(message, context);
        // Execute the decided skill
        let skillResult = null;
        if (decision.skill && context.activeSkill !== decision.skill.metadata.name) {
            // Switching to a different skill
            skillResult = await skills_1.skillExecutor.execute(decision.skill, {
                sessionId,
                session: session,
                input: { message, data: { tasteProfile } }, // Pass taste profile to skill
                tools: {}, // Will be injected by executor
                config: {},
                skillData: {
                    previousPhase: context.currentPhase,
                },
            });
        }
        else if (decision.skill) {
            // Continue with current skill
            skillResult = await skills_1.skillExecutor.execute(decision.skill, {
                sessionId,
                session: session,
                input: { message, data: { tasteProfile } }, // Pass taste profile to skill
                tools: {},
                config: {},
                skillData: {
                    phase: context.currentPhase,
                },
            });
        }
        // Process trust event based on skill execution
        if (skillResult?.success) {
            await this.processTrustEvent({ type: 'successful_suggestion' });
        }
        // Add assistant response to session
        const responseMessage = skillResult?.message || this.getDefaultResponse(message);
        await session_service_1.agentSessionService.addMessage(sessionId, {
            role: 'assistant',
            content: responseMessage,
            toolResults: skillResult?.data ? [{
                    toolCallId: (0, uuid_1.v4)(),
                    result: skillResult.data,
                }] : [],
        });
        // Update phase if changed
        if (skillResult?.nextPhase && skillResult.nextPhase !== context.currentPhase) {
            await session_service_1.agentSessionService.updateSession(sessionId, {
                projectContext: {
                    ...session.projectContext,
                    phase: skillResult.nextPhase,
                },
            });
        }
        return {
            message: responseMessage,
            phase: skillResult?.nextPhase || context.currentPhase,
            complete: skillResult?.complete || false,
            intent: decision.intent,
            confidence: decision.reasoning ? this.extractConfidence(decision.reasoning) : undefined,
            entitiesCreated: skillResult?.entitiesCreated?.length || 0,
            skillUsed: decision.skill?.metadata.name,
            // =======================================
            // Taste Engineering (Epic C)
            // =======================================
            tasteSignals,
            tasteProfile: tasteProfile || undefined,
            // =======================================
            // Accumulation System (Epic T)
            // =======================================
            trustLevel: this.trustModel.overallTrust,
            autonomyLevel: this.getAutonomyLevel(),
        };
    }
    async cancel(sessionId) {
        await session_service_1.agentSessionService.updateSession(sessionId, {
            status: 'cancelled',
        });
    }
    async complete(sessionId) {
        const session = await session_service_1.agentSessionService.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        // Update project status to active
        // This would call the ontology API to update the project entity
        const projectEntityId = session.projectContext?.projectEntityId;
        if (projectEntityId) {
            // TODO: Update entity via ontology API
            console.log(`[ProjectAgent] Completing project ${projectEntityId}`);
        }
        // Persist Project TASTE to storage
        const collection = this.projectTASTECollection.get(sessionId);
        if (collection) {
            await this.buildProjectTASTE(collection);
            // TODO: Save to data/taste/projects/{projectId}/profile.json
            console.log(`[ProjectAgent] Persisting Project TASTE for ${session.projectContext?.projectId}`);
        }
        await session_service_1.agentSessionService.updateSession(sessionId, {
            status: 'completed',
        });
    }
    // ============================================================================
    // Taste Engineering Methods (Epic C)
    // ============================================================================
    async loadTasteProfile(userId, projectId) {
        const cacheKey = projectId ? `${userId}:${projectId}` : userId;
        // Check cache first
        if (this.tasteCache.has(cacheKey)) {
            return this.tasteCache.get(cacheKey);
        }
        try {
            // Load User TASTE
            const userTASTE = await this.loadUserTASTE(userId);
            if (!projectId) {
                // No project context - return User TASTE only
                if (userTASTE) {
                    this.tasteCache.set(cacheKey, userTASTE);
                }
                return userTASTE;
            }
            // Load Project TASTE
            const projectTASTE = await this.loadProjectTASTE(projectId);
            // Merge both profiles
            if (userTASTE && projectTASTE) {
                const mergedTASTE = this.mergeTASTEProfiles(userTASTE, projectTASTE);
                this.tasteCache.set(cacheKey, mergedTASTE);
                return mergedTASTE;
            }
            return projectTASTE || userTASTE;
        }
        catch (error) {
            console.error(`[ProjectAgent] Failed to load TASTE profile:`, error);
            return null;
        }
    }
    async collectProjectTASTE(sessionId, userMessage) {
        const session = await session_service_1.agentSessionService.getSession(sessionId);
        if (!session) {
            return;
        }
        let collection = this.projectTASTECollection.get(sessionId);
        if (!collection) {
            collection = {
                sessionId,
                projectName: session.projectContext?.projectName || 'Unknown',
                collectedPatterns: [],
                extractedSignals: [],
                ontologyContext: {
                    domains: [],
                    entities: [],
                    relations: [],
                },
            };
            this.projectTASTECollection.set(sessionId, collection);
        }
        // Extract taste signals from user message (invisibly)
        const signals = await this.readTasteSignals(sessionId, userMessage);
        collection.extractedSignals.push(...signals);
        // Extract potential taste patterns
        const patterns = this.extractTastePatterns(userMessage);
        collection.collectedPatterns.push(...patterns);
        // Update ontology context
        if (session.projectContext?.ontologyId) {
            const newDomains = this.extractOntologyDomains(userMessage);
            collection.ontologyContext.domains.push(...newDomains);
        }
    }
    mergeTASTEProfiles(userTASTE, projectTASTE) {
        return {
            ...projectTASTE, // Base: Project TASTE
            // Experience Topology: Merge and deduplicate
            experience_topology: [
                ...userTASTE.experience_topology,
                ...projectTASTE.experience_topology,
            ].filter((value, index, self) => self.indexOf(value) === index),
            // Taste Standards: Project overrides User (same domain)
            taste_standards: {
                ...userTASTE.taste_standards,
                ...projectTASTE.taste_standards,
            },
            // Tension Position: Weighted average (Project weight 0.7)
            tension_position: {
                control_level: this.weightedAverage(userTASTE.tension_position.control_level, projectTASTE.tension_position.control_level, 0.7),
                trust_level: this.weightedAverage(userTASTE.tension_position.trust_level, projectTASTE.tension_position.trust_level, 0.7),
                intervention_threshold: projectTASTE.tension_position.intervention_threshold,
            },
            // Symbiosis Boundaries: Merge and deduplicate
            symbiosis_boundary: {
                delegated_domains: [
                    ...userTASTE.symbiosis_boundary.delegated_domains,
                    ...projectTASTE.symbiosis_boundary.delegated_domains,
                ].filter((value, index, self) => self.indexOf(value) === index),
                reserved_domains: [
                    ...userTASTE.symbiosis_boundary.reserved_domains,
                    ...projectTASTE.symbiosis_boundary.reserved_domains,
                ].filter((value, index, self) => self.indexOf(value) === index),
                contextual_triggers: [
                    ...userTASTE.symbiosis_boundary.contextual_triggers,
                    ...projectTASTE.symbiosis_boundary.contextual_triggers,
                ].filter((value, index, self) => self.indexOf(value) === index),
            },
            // Metadata
            metadata: {
                source: 'merged',
                confidence: Math.max(userTASTE.metadata.confidence, projectTASTE.metadata.confidence),
                evolution_count: userTASTE.metadata.evolution_count + projectTASTE.metadata.evolution_count,
                projectId: projectTASTE.metadata.projectId,
            },
        };
    }
    async buildProjectTASTE(collection) {
        const now = new Date().toISOString();
        return {
            version: '1.0.0',
            createdAt: now,
            updatedAt: now,
            // Dimension 1: Experience Topology
            experience_topology: [
                ...collection.ontologyContext?.domains || [],
                ...this.extractExperienceFromSignals(collection.extractedSignals),
            ],
            // Dimension 2: Taste Standards
            taste_standards: this.extractTasteStandards(collection.extractedSignals, collection.collectedPatterns),
            // Dimension 3: Tension Position (defaults, will evolve with more signals)
            tension_position: {
                control_level: 0.5,
                trust_level: 0.5,
                intervention_threshold: 0.8,
            },
            // Dimension 4: Symbiosis Boundaries (initial empty, evolves with explicit feedback)
            symbiosis_boundary: {
                delegated_domains: [],
                reserved_domains: [],
                contextual_triggers: [],
            },
            metadata: {
                source: 'project',
                confidence: 0.3, // Low initial confidence from invisible collection
                evolution_count: 0,
            },
        };
    }
    async loadUserTASTE(_userId) {
        // In production, load from data/taste/users/{userId}/profile.json
        // For now, return null if not found
        return null;
    }
    async loadProjectTASTE(_projectId) {
        // In production, load from data/taste/projects/{projectId}/profile.json
        // For now, return null if not found
        return null;
    }
    weightedAverage(a, b, weightB) {
        return a * (1 - weightB) + b * weightB;
    }
    // ============================================================================
    // Accumulation System Methods (Epic T)
    // ============================================================================
    async readTasteSignals(_sessionId, interaction) {
        const signals = [];
        // Word choice signals
        const wordChoiceSignals = this.detectWordChoice(interaction);
        signals.push(...wordChoiceSignals);
        // Resistance patterns (would need more context for accurate detection)
        const resistanceSignals = this.detectResistancePatterns(interaction);
        signals.push(...resistanceSignals);
        return signals;
    }
    async addObservation(observation) {
        // In production, add to Observation Queue for ARIA Infer phase
        console.log(`[ProjectAgent] Observation added:`, observation);
    }
    async processTrustEvent(event) {
        const delta = this.calculateTrustDelta(event);
        this.trustModel.overallTrust = Math.min(1, Math.max(0, this.trustModel.overallTrust + delta));
        this.trustModel.history.push({
            timestamp: Date.now(),
            event,
            delta,
        });
        console.log(`[ProjectAgent] Trust event processed. Overall trust: ${this.trustModel.overallTrust}`);
    }
    getAutonomyLevel(domain) {
        const trust = domain
            ? this.trustModel.domainTrust.get(domain) || this.trustModel.overallTrust
            : this.trustModel.overallTrust;
        if (trust < 0.3)
            return 'limited';
        if (trust < 0.5)
            return 'guided';
        if (trust < 0.8)
            return 'collaborative';
        return 'autonomous';
    }
    // ============================================================================
    // Helper Methods
    // ============================================================================
    async getSystemPrompt(tasteProfile) {
        const tasteGuidance = tasteProfile
            ? this.generateTasteGuidance(tasteProfile)
            : '';
        return `You are a Project Agent for OriginOS. Your role is to help users create and manage projects.

You have access to the following skills:
1. project-initialization: For creating new projects through conversational interview
2. ontology: For managing the project knowledge graph

${tasteGuidance}

Core Principles:
1. Be conversational and helpful
2. Adapt to the user's needs and style
3. Show progress clearly
4. Allow users to skip or modify at any time
5. Respect the user's taste and preferences

When a user wants to create a project, autonomously start the project-initialization skill.
Once in a skill, follow its conversation flow naturally.

Remember to build a positive, productive relationship with the user.`;
    }
    generateTasteGuidance(tasteProfile) {
        const guidance = [];
        // Experience Topology Guidance
        if (tasteProfile.experience_topology.length > 0) {
            guidance.push(`\nUser's Experience Domains: ${tasteProfile.experience_topology.join(', ')}.`);
        }
        // Taste Standards Guidance
        const standards = tasteProfile.taste_standards;
        if (Object.keys(standards).length > 0) {
            guidance.push("\nUser's Taste Standards:");
            Object.entries(standards).forEach(([domain, prefs]) => {
                guidance.push(`- ${domain}: Prefers ${prefs.positive_vibes.join(', ')}; Avoids ${prefs.negative_vibes.join(', ')}`);
            });
        }
        // Tension Position Guidance
        const tension = tasteProfile.tension_position;
        guidance.push(`\nInteraction Style: ${tension.control_level > 0.7 ? 'User prefers more control' : 'User is comfortable delegating'}. Trust level: ${(tension.trust_level * 100).toFixed(0)}%.`);
        // Symbiosis Boundaries Guidance
        if (tasteProfile.symbiosis_boundary.reserved_domains.length > 0) {
            guidance.push(`\nReserved Domains (do not make decisions here): ${tasteProfile.symbiosis_boundary.reserved_domains.join(', ')}.`);
        }
        if (tasteProfile.symbiosis_boundary.delegated_domains.length > 0) {
            guidance.push(`\nDelegated Domains (safe to handle autonomously): ${tasteProfile.symbiosis_boundary.delegated_domains.join(', ')}.`);
        }
        return guidance.join('\n');
    }
    getWelcomeMessage(projectName) {
        return `Hello! I'm your Project Agent. I'd love to help you create a new project called "${projectName}".

To get started, could you tell me a bit about what you're working on? For example:
- What is the main purpose of this project?
- What's the problem you're trying to solve?
- Who will be involved?

Feel free to answer in your own words - I'll adapt our conversation based on your responses!`;
    }
    getDefaultResponse(message) {
        return `I understand you said: "${message}". How can I help you with your project?`;
    }
    extractConfidence(reasoning) {
        // Simple confidence extraction from reasoning
        // In production, this would be more sophisticated
        if (reasoning.includes('highly confident') || reasoning.includes('clearly')) {
            return 0.9;
        }
        if (reasoning.includes('likely') || reasoning.includes('probably')) {
            return 0.7;
        }
        return 0.5;
    }
    // ----------------------------------------------------------------------------
    // Taste Engineering Helpers
    // ----------------------------------------------------------------------------
    extractTastePatterns(message) {
        const patterns = [];
        // Simple pattern extraction (in production, use LLM)
        if (message.includes('简单') || message.includes('清晰') || message.includes('直接')) {
            patterns.push('preference_for_simplicity');
        }
        if (message.includes('灵活') || message.includes('快速') || message.includes('迭代')) {
            patterns.push('agile_preference');
        }
        if (message.includes('稳定') || message.includes('安全') || message.includes('可靠')) {
            patterns.push('conservative_preference');
        }
        if (message.includes('创新') || message.includes('探索') || message.includes('实验')) {
            patterns.push('innovation_preference');
        }
        return patterns;
    }
    extractOntologyDomains(message) {
        const domains = [];
        const domainKeywords = {
            '电商': 'e-commerce',
            '金融': 'finance',
            '医疗': 'healthcare',
            '教育': 'education',
            '社交': 'social',
            '游戏': 'gaming',
            '物联网': 'iot',
            '人工智能': 'ai',
            '后端': 'backend',
            '前端': 'frontend',
            '移动端': 'mobile',
        };
        for (const [keyword, domain] of Object.entries(domainKeywords)) {
            if (message.includes(keyword) && !domains.includes(domain)) {
                domains.push(domain);
            }
        }
        return domains;
    }
    extractExperienceFromSignals(signals) {
        const topology = [];
        // Extract from word choice signals
        signals.forEach(signal => {
            if (signal.type === 'word_choice') {
                const ws = signal;
                if (ws.nuance.conservativeness > ws.nuance.adventurousness) {
                    topology.push('conservative_architecture');
                }
                if (ws.nuance.cautiousness > ws.nuance.decisiveness) {
                    topology.push('careful_code_review');
                }
            }
        });
        return topology;
    }
    extractTasteStandards(_signals, patterns) {
        const tasteStandards = {};
        // Build standards from patterns and signals
        patterns.forEach(pattern => {
            if (pattern === 'preference_for_simplicity') {
                tasteStandards['code'] = {
                    positive_vibes: ['简洁清晰', '可读性强', '易于维护'],
                    negative_vibes: ['过度抽象', '复杂装饰', '过早优化'],
                };
            }
            if (pattern === 'conservative_preference') {
                tasteStandards['architecture'] = {
                    positive_vibes: ['分层清晰', '职责单一', '接口稳定'],
                    negative_vibes: ['循环依赖', '紧耦合', '过度设计'],
                };
            }
        });
        return tasteStandards;
    }
    // ----------------------------------------------------------------------------
    // Accumulation System Helpers
    // ----------------------------------------------------------------------------
    detectWordChoice(message) {
        const signals = [];
        // Detect word choice patterns
        const positivePatterns = [
            /可行/g,
            /不错/g,
            /可以/g,
            /喜欢/g,
        ];
        const hesitantPatterns = [
            /有点意思/g,
            /也许/g,
            /可能/g,
            /考虑/g,
        ];
        positivePatterns.forEach(pattern => {
            const matches = message.match(pattern);
            if (matches) {
                signals.push({
                    type: 'word_choice',
                    confidence: 0.7,
                    timestamp: Date.now(),
                    context: message,
                    evidence: [matches[0]],
                    chosen: matches[0],
                    alternatives: [],
                    sentimentDirection: 'positive',
                    nuance: {
                        cautiousness: 0.3,
                        decisiveness: 0.8,
                        conservativeness: 0.5,
                        adventurousness: 0.4,
                    },
                });
            }
        });
        hesitantPatterns.forEach(pattern => {
            const matches = message.match(pattern);
            if (matches) {
                signals.push({
                    type: 'word_choice',
                    confidence: 0.6,
                    timestamp: Date.now(),
                    context: message,
                    evidence: [matches[0]],
                    chosen: matches[0],
                    alternatives: [],
                    sentimentDirection: 'hesitant',
                    nuance: {
                        cautiousness: 0.9,
                        decisiveness: 0.2,
                        conservativeness: 0.7,
                        adventurousness: 0.3,
                    },
                });
            }
        });
        return signals;
    }
    detectResistancePatterns(_message) {
        // In production, this would need conversation context
        // For now, return empty as we can't detect silence from a single message
        return [];
    }
    calculateTrustDelta(event) {
        switch (event.type) {
            case 'successful_suggestion':
                return 0.05;
            case 'pattern_verified':
                return 0.03;
            case 'pattern_rejected':
                return -0.02;
            case 'correction_applied':
                switch (event.severity) {
                    case 'minor':
                        return -0.01;
                    case 'major':
                        return -0.05;
                    case 'critical':
                        return -0.1;
                    default:
                        return 0;
                }
            default:
                return 0;
        }
    }
}
// ============================================================================
// Export Singleton
// ============================================================================
exports.projectAgent = new DefaultProjectAgent();
