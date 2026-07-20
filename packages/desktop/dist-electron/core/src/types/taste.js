"use strict";
/**
 * TASTE Types - Type Definitions for Epic C
 *
 * Core type definitions for TASTE (Taste-Aware System for Embodied Experience) layer.
 * Supports two-layer architecture: User TASTE + Project TASTE.
 *
 * @module types/taste
 * @see docs/specs/epic-C/README.md
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetTasteDraftResponseSchema = exports.AnalyzeResponseSchema = exports.AnalyzeRequestSchema = exports.SendMessageResponseSchema = exports.SendMessageRequestSchema = exports.StartDetectionResponseSchema = exports.StartDetectionRequestSchema = exports.CultureLayerDetectionSchema = exports.CultureDetectionSessionSchema = exports.CultureDetectionMessageSchema = exports.CultureDetectionStatusSchema = exports.TASTEProfileSchema = exports.TASTEProfileMetadataSchema = exports.SymbiosisBoundarySchema = exports.TensionPositionSchema = exports.TasteStandardsSchema = exports.ExperienceTopologySchema = exports.TASTEProfileSourceSchema = void 0;
exports.validateTASTEProfile = validateTASTEProfile;
exports.validateCultureDetectionSession = validateCultureDetectionSession;
exports.validateCultureLayerDetection = validateCultureLayerDetection;
exports.validateStartDetectionRequest = validateStartDetectionRequest;
exports.validateSendMessageRequest = validateSendMessageRequest;
exports.createTASTEProfile = createTASTEProfile;
exports.createCultureDetectionSession = createCultureDetectionSession;
exports.createCultureDetectionMessage = createCultureDetectionMessage;
exports.mergeTASTEProfiles = mergeTASTEProfiles;
exports.isSessionReadyForAnalysis = isSessionReadyForAnalysis;
exports.calculateSessionProgress = calculateSessionProgress;
const zod_1 = require("zod");
// ============================================================================
// TASTE Profile Schema (Two-Layer Architecture)
// ============================================================================
/**
 * TASTE Profile Source
 * Indicates whether this profile is for a user or a project
 */
exports.TASTEProfileSourceSchema = zod_1.z.enum(['user', 'project', 'merged']);
/**
 * Experience Topology - Dimension 1
 * Domains where the user has embodied experience and intuition
 *
 * Examples:
 * - "code-review" - Code review experience
 * - "architecture-design" - Architecture design experience
 * - "integration-testing" - Integration testing experience
 */
exports.ExperienceTopologySchema = zod_1.z.array(zod_1.z.string());
/**
 * Taste Standards - Dimension 2
 * Domain-specific "right" and "wrong" feelings
 *
 * positive_vibes: What feels "right" in this domain
 * negative_vibes: What feels "wrong" or "twisted" in this domain
 */
exports.TasteStandardsSchema = zod_1.z.record(zod_1.z.string(), // domain name
zod_1.z.object({
    positive_vibes: zod_1.z.array(zod_1.z.string()),
    negative_vibes: zod_1.z.array(zod_1.z.string()),
}));
/**
 * Tension Position - Dimension 3
 * ECO (Explore/Conserve/Optimize) tension state
 *
 * control_level: How much control the user wants (0-1, higher = more control)
 * trust_level: How much the user trusts AI suggestions (0-1, higher = more trust)
 * intervention_threshold: When user wants to intervene (0-1, higher = later intervention)
 */
exports.TensionPositionSchema = zod_1.z.object({
    control_level: zod_1.z.number().min(0).max(1),
    trust_level: zod_1.z.number().min(0).max(1),
    intervention_threshold: zod_1.z.number().min(0).max(1),
});
/**
 * Symbiosis Boundary - Dimension 4
 * Defines what tasks user delegates to AI vs keeps for themselves
 *
 * delegated_domains: Tasks user is comfortable delegating to AI
 * reserved_domains: Tasks user wants to keep control of
 * contextual_triggers: Situations that change delegation behavior
 */
exports.SymbiosisBoundarySchema = zod_1.z.object({
    delegated_domains: zod_1.z.array(zod_1.z.string()),
    reserved_domains: zod_1.z.array(zod_1.z.string()),
    contextual_triggers: zod_1.z.array(zod_1.z.string()),
});
/**
 * TASTE Profile Metadata
 * Additional information about the profile
 */
exports.TASTEProfileMetadataSchema = zod_1.z.object({
    source: exports.TASTEProfileSourceSchema,
    confidence: zod_1.z.number().min(0).max(1),
    evolution_count: zod_1.z.number().int().min(0),
    derived_from_session: zod_1.z.string().optional(),
    last_analysis_at: zod_1.z.string().optional(),
});
/**
 * TASTE Profile - Complete Schema
 *
 * Supports both User TASTE and Project TASTE with the same structure.
 * When both exist, they are merged with Project TASTE taking precedence
 * for domain-specific preferences.
 */
exports.TASTEProfileSchema = zod_1.z.object({
    version: zod_1.z.string().default('1.0.0'),
    id: zod_1.z.string().optional(),
    userId: zod_1.z.string().optional(),
    projectId: zod_1.z.string().optional(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    // Dimension 1: Experience Topology
    experience_topology: exports.ExperienceTopologySchema,
    // Dimension 2: Taste Standards
    taste_standards: exports.TasteStandardsSchema,
    // Dimension 3: Tension Position
    tension_position: exports.TensionPositionSchema,
    // Dimension 4: Symbiosis Boundary
    symbiosis_boundary: exports.SymbiosisBoundarySchema,
    // Metadata
    metadata: exports.TASTEProfileMetadataSchema,
    // Memory stats (for tracking profile evolution)
    memory_stats: zod_1.z.object({
        total_memories: zod_1.z.number().int().min(0),
        high_confidence_count: zod_1.z.number().int().min(0),
        avg_confidence: zod_1.z.number().min(0).max(1),
        domains: zod_1.z.array(zod_1.z.string()),
    }).optional(),
});
// ============================================================================
// Culture Detection Session Schema
// ============================================================================
/**
 * Culture Detection Session Status
 */
exports.CultureDetectionStatusSchema = zod_1.z.enum([
    'active', // Session is active, accepting messages
    'analyzing', // LLM analysis in progress
    'completed', // Analysis completed, TASTE profile generated
    'failed', // Analysis failed
    'expired', // Session expired
]);
/**
 * Culture Detection Message
 * A single message in the detection dialogue
 */
exports.CultureDetectionMessageSchema = zod_1.z.object({
    id: zod_1.z.string(),
    role: zod_1.z.enum(['user', 'assistant', 'system']),
    content: zod_1.z.string(),
    turn: zod_1.z.number().int().min(1),
    timestamp: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
/**
 * Culture Detection Session
 * Represents a complete detection session
 */
exports.CultureDetectionSessionSchema = zod_1.z.object({
    version: zod_1.z.string().default('1.0.0'),
    sessionId: zod_1.z.string(),
    userId: zod_1.z.string(),
    projectId: zod_1.z.string().optional(),
    // Session state
    status: exports.CultureDetectionStatusSchema,
    currentTurn: zod_1.z.number().int().min(0),
    maxTurns: zod_1.z.number().int().min(3).max(5).default(3),
    // Dialogue history
    messages: zod_1.z.array(exports.CultureDetectionMessageSchema),
    // Analysis result (populated after analysis)
    cultureLayer: zod_1.z.unknown().optional(), // CultureLayerDetection
    tasteDraftId: zod_1.z.string().optional(),
    // Timestamps
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    completedAt: zod_1.z.string().optional(),
    // Error handling
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
        timestamp: zod_1.z.string(),
    }).optional(),
});
/**
 * Culture Layer Detection Result
 * The raw analysis output from LLM
 */
exports.CultureLayerDetectionSchema = zod_1.z.object({
    result: zod_1.z.object({
        experience_topology: zod_1.z.array(zod_1.z.string()),
        taste_standards: zod_1.z.record(zod_1.z.string(), zod_1.z.object({
            positive_vibes: zod_1.z.array(zod_1.z.string()),
            negative_vibes: zod_1.z.array(zod_1.z.string()),
        })),
        tension_position: exports.TensionPositionSchema.optional(),
        symbiosis_boundary: exports.SymbiosisBoundarySchema.optional(),
    }),
    confidence: zod_1.z.number().min(0).max(1),
    sample_size: zod_1.z.number().int().min(0),
    evidence_quotes: zod_1.z.array(zod_1.z.string()).optional(),
});
// ============================================================================
// API Request/Response Types
// ============================================================================
/**
 * Start Detection Request
 */
exports.StartDetectionRequestSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    projectId: zod_1.z.string().optional(),
    maxTurns: zod_1.z.number().int().min(3).max(5).optional().default(3),
    options: zod_1.z.object({
        skipWelcome: zod_1.z.boolean().optional().default(false),
        language: zod_1.z.string().optional().default('zh-CN'),
    }).optional(),
});
/**
 * Start Detection Response
 */
exports.StartDetectionResponseSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    userId: zod_1.z.string(),
    status: exports.CultureDetectionStatusSchema,
    currentTurn: zod_1.z.number(),
    maxTurns: zod_1.z.number(),
    firstQuestion: zod_1.z.string(),
    createdAt: zod_1.z.string(),
});
/**
 * Send Message Request
 */
exports.SendMessageRequestSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(2000),
    turn: zod_1.z.number().int().min(1).optional(),
});
/**
 * Send Message Response
 */
exports.SendMessageResponseSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    message: zod_1.z.string(),
    role: zod_1.z.enum(['assistant', 'system']),
    turn: zod_1.z.number(),
    isComplete: zod_1.z.boolean(),
    suggestedNextQuestion: zod_1.z.string().optional(),
    nextAction: zod_1.z.enum(['continue', 'analyze', 'complete']).optional(),
});
/**
 * Analyze Request
 */
exports.AnalyzeRequestSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    options: zod_1.z.object({
        forceReanalyze: zod_1.z.boolean().optional().default(false),
        generateDraft: zod_1.z.boolean().optional().default(true),
    }).optional(),
});
/**
 * Analyze Response
 */
exports.AnalyzeResponseSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    analysisId: zod_1.z.string(),
    status: zod_1.z.enum(['started', 'in_progress', 'completed', 'failed']),
    cultureLayer: exports.CultureLayerDetectionSchema.optional(),
    confidence: zod_1.z.number().min(0).max(1).optional(),
    tasteDraftId: zod_1.z.string().optional(),
    estimatedTime: zod_1.z.number().optional(), // seconds
    message: zod_1.z.string().optional(),
});
/**
 * Get Taste Draft Response
 */
exports.GetTasteDraftResponseSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    userId: zod_1.z.string(),
    projectId: zod_1.z.string().optional(),
    draft: exports.TASTEProfileSchema.nullable(),
    isComplete: zod_1.z.boolean(),
    generatedAt: zod_1.z.string().optional(),
    confidence: zod_1.z.number().min(0).max(1).optional(),
});
// ============================================================================
// Validation Functions
// ============================================================================
/**
 * Validate TASTE profile data
 */
function validateTASTEProfile(data) {
    return exports.TASTEProfileSchema.parse(data);
}
/**
 * Validate culture detection session data
 */
function validateCultureDetectionSession(data) {
    return exports.CultureDetectionSessionSchema.parse(data);
}
/**
 * Validate culture layer detection result
 */
function validateCultureLayerDetection(data) {
    return exports.CultureLayerDetectionSchema.parse(data);
}
/**
 * Validate start detection request
 */
function validateStartDetectionRequest(data) {
    return exports.StartDetectionRequestSchema.parse(data);
}
/**
 * Validate send message request
 */
function validateSendMessageRequest(data) {
    return exports.SendMessageRequestSchema.parse(data);
}
// ============================================================================
// Factory Functions
// ============================================================================
/**
 * Create a new TASTE profile with defaults
 */
function createTASTEProfile(params) {
    const now = new Date().toISOString();
    return {
        version: '1.0.0',
        id: `taste-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        userId: params.userId,
        projectId: params.projectId,
        createdAt: now,
        updatedAt: now,
        experience_topology: params.experience_topology ?? [],
        taste_standards: params.taste_standards ?? {},
        tension_position: {
            control_level: 0.5,
            trust_level: 0.5,
            intervention_threshold: 0.7,
            ...params.tension_position,
        },
        symbiosis_boundary: {
            delegated_domains: [],
            reserved_domains: [],
            contextual_triggers: [],
            ...params.symbiosis_boundary,
        },
        metadata: {
            source: params.projectId ? 'project' : 'user',
            confidence: 0.5,
            evolution_count: 0,
            derived_from_session: undefined,
            last_analysis_at: now,
            ...params.metadata,
        },
        memory_stats: {
            total_memories: 0,
            high_confidence_count: 0,
            avg_confidence: 0,
            domains: [],
        },
    };
}
/**
 * Create a new culture detection session
 */
function createCultureDetectionSession(params) {
    const now = new Date().toISOString();
    return {
        version: '1.0.0',
        sessionId: params.sessionId,
        userId: params.userId,
        projectId: params.projectId,
        status: 'active',
        currentTurn: 0,
        maxTurns: params.maxTurns ?? 3,
        messages: [],
        createdAt: now,
        updatedAt: now,
    };
}
/**
 * Create a culture detection message
 */
function createCultureDetectionMessage(params) {
    return {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        role: params.role,
        content: params.content,
        turn: params.turn,
        timestamp: new Date().toISOString(),
        metadata: params.metadata,
    };
}
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Merge User TASTE and Project TASTE
 * Project TASTE takes precedence for domain-specific preferences
 */
function mergeTASTEProfiles(userTASTE, projectTASTE) {
    const now = new Date().toISOString();
    return {
        version: '1.0.0',
        id: `merged-${Date.now()}`,
        userId: userTASTE.userId,
        projectId: projectTASTE.projectId,
        createdAt: now,
        updatedAt: now,
        // Experience topology: merge and deduplicate
        experience_topology: [
            ...new Set([
                ...userTASTE.experience_topology,
                ...projectTASTE.experience_topology,
            ]),
        ],
        // Taste standards: Project overrides User for same domain
        taste_standards: {
            ...userTASTE.taste_standards,
            ...projectTASTE.taste_standards,
        },
        // Tension position: weighted average (Project has higher weight: 0.7)
        tension_position: {
            control_level: userTASTE.tension_position.control_level * 0.3 +
                projectTASTE.tension_position.control_level * 0.7,
            trust_level: userTASTE.tension_position.trust_level * 0.3 +
                projectTASTE.tension_position.trust_level * 0.7,
            intervention_threshold: projectTASTE.tension_position.intervention_threshold,
        },
        // Symbiosis boundary: merge
        symbiosis_boundary: {
            delegated_domains: [
                ...new Set([
                    ...userTASTE.symbiosis_boundary.delegated_domains,
                    ...projectTASTE.symbiosis_boundary.delegated_domains,
                ]),
            ],
            reserved_domains: [
                ...new Set([
                    ...userTASTE.symbiosis_boundary.reserved_domains,
                    ...projectTASTE.symbiosis_boundary.reserved_domains,
                ]),
            ],
            contextual_triggers: [
                ...new Set([
                    ...userTASTE.symbiosis_boundary.contextual_triggers,
                    ...projectTASTE.symbiosis_boundary.contextual_triggers,
                ]),
            ],
        },
        metadata: {
            source: 'merged',
            confidence: Math.max(userTASTE.metadata.confidence, projectTASTE.metadata.confidence),
            evolution_count: userTASTE.metadata.evolution_count + projectTASTE.metadata.evolution_count,
            last_analysis_at: now,
        },
        memory_stats: {
            total_memories: (userTASTE.memory_stats?.total_memories ?? 0) +
                (projectTASTE.memory_stats?.total_memories ?? 0),
            high_confidence_count: (userTASTE.memory_stats?.high_confidence_count ?? 0) +
                (projectTASTE.memory_stats?.high_confidence_count ?? 0),
            avg_confidence: ((userTASTE.memory_stats?.avg_confidence ?? 0) +
                (projectTASTE.memory_stats?.avg_confidence ?? 0)) /
                2,
            domains: [
                ...new Set([
                    ...(userTASTE.memory_stats?.domains ?? []),
                    ...(projectTASTE.memory_stats?.domains ?? []),
                ]),
            ],
        },
    };
}
/**
 * Check if a detection session is ready for analysis
 */
function isSessionReadyForAnalysis(session) {
    const minTurns = Math.ceil(session.maxTurns * 0.6); // At least 60% completion
    const userMessageCount = session.messages.filter(m => m.role === 'user').length;
    return userMessageCount >= minTurns;
}
/**
 * Calculate session progress percentage
 */
function calculateSessionProgress(session) {
    const userMessageCount = session.messages.filter(m => m.role === 'user').length;
    return Math.min((userMessageCount / session.maxTurns) * 100, 100);
}
