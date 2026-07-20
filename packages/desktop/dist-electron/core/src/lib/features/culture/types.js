"use strict";
/**
 * User Taste Detection Types
 * Phase 1: User TASTE Generation
 *
 * Aligned with docs/specs/epic-C/story-C.1/api-design.md
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CultureDetectionError = exports.ERROR_CODES = exports.GetTasteDraftResponse = exports.GetTasteDraftResponseSchema = exports.AnalyzeResponseSchema = exports.AnalyzeRequestSchema = exports.SendMessageResponseSchema = exports.AddMessageRequestSchema = exports.SendMessageRequestSchema = exports.StartDetectionResponse = exports.StartDetectionResponseSchema = exports.StartDetectionRequest = exports.StartDetectionRequestSchema = exports.CultureDetectionSession = exports.CultureDetectionSessionSchema = exports.CultureLayerDetectionSchema = exports.UserTasteProfile = exports.UserTasteProfileSchema = exports.TASTEProfileSourceSchema = exports.DialogueTurnSchema = exports.CultureDetectionMessageSchema = exports.TASTE_DIMENSIONS = exports.TasteSignalTypeSchema = exports.SessionState = exports.CultureDetectionStatusSchema = void 0;
exports.validateStartDetectionRequest = validateStartDetectionRequest;
exports.validateSendMessageRequest = validateSendMessageRequest;
exports.validateUserTasteProfile = validateUserTasteProfile;
exports.validateCultureDetectionSession = validateCultureDetectionSession;
exports.createUserTasteProfile = createUserTasteProfile;
exports.createCultureDetectionSession = createCultureDetectionSession;
const zod_1 = require("zod");
// ============================================================================
// Session State / Status
// ============================================================================
/**
 * Culture Detection Session Status
 * (aligned with api-design.md)
 */
exports.CultureDetectionStatusSchema = zod_1.z.enum([
    'active', // Session is active, accepting messages
    'analyzing', // LLM analysis in progress
    'completed', // Analysis completed, TASTE profile generated
    'failed', // Analysis failed
    'expired', // Session expired
]);
// Legacy alias for backward compatibility
exports.SessionState = exports.CultureDetectionStatusSchema;
// ============================================================================
// Dialogue and Messages
// ============================================================================
/**
 * Taste Signal Type
 */
exports.TasteSignalTypeSchema = zod_1.z.enum(['word_choice', 'resistance', 'repetition']);
/**
 * Taste Dimensions
 */
exports.TASTE_DIMENSIONS = ['experience_topology', 'taste_standards', 'tension_position', 'symbiosis_boundary'];
/**
 * Culture Detection Message
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
 * Dialogue Turn (legacy format for backward compatibility)
 */
exports.DialogueTurnSchema = zod_1.z.object({
    turn: zod_1.z.number(),
    question: zod_1.z.string(),
    userResponse: zod_1.z.string(),
    timestamp: zod_1.z.string(),
    extractedSignals: zod_1.z.array(zod_1.z.any()).optional(),
});
// ============================================================================
// TASTE Profile (aligned with src/types/taste.ts)
// ============================================================================
/**
 * TASTE Profile Source
 */
exports.TASTEProfileSourceSchema = zod_1.z.enum(['user', 'project', 'merged']);
/**
 * User TASTE Profile
 * Aligned with api-design.md and src/types/taste.ts
 */
exports.UserTasteProfileSchema = zod_1.z.object({
    // Metadata
    version: zod_1.z.string().default('1.0.0'),
    id: zod_1.z.string().optional(),
    userId: zod_1.z.string(),
    projectId: zod_1.z.string().optional(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    // Dimension 1: Experience Topology
    experience_topology: zod_1.z.array(zod_1.z.string()),
    // Dimension 2: Taste Standards
    taste_standards: zod_1.z.record(zod_1.z.object({
        positive_vibes: zod_1.z.array(zod_1.z.string()),
        negative_vibes: zod_1.z.array(zod_1.z.string()),
    })),
    // Dimension 3: Tension Position
    tension_position: zod_1.z.object({
        control_level: zod_1.z.number().min(0).max(1),
        trust_level: zod_1.z.number().min(0).max(1),
        intervention_threshold: zod_1.z.number().min(0).max(1),
    }),
    // Dimension 4: Symbiosis Boundary
    symbiosis_boundary: zod_1.z.object({
        delegated_domains: zod_1.z.array(zod_1.z.string()),
        reserved_domains: zod_1.z.array(zod_1.z.string()),
        contextual_triggers: zod_1.z.array(zod_1.z.string()),
    }),
    // Metadata
    metadata: zod_1.z.object({
        source: exports.TASTEProfileSourceSchema,
        confidence: zod_1.z.number().min(0).max(1),
        evolution_count: zod_1.z.number().default(0),
        derived_from_session: zod_1.z.string().optional(),
        last_analysis_at: zod_1.z.string().optional(),
    }),
    // Memory stats (optional)
    memory_stats: zod_1.z.object({
        total_memories: zod_1.z.number().int().min(0),
        high_confidence_count: zod_1.z.number().int().min(0),
        avg_confidence: zod_1.z.number().min(0).max(1),
        domains: zod_1.z.array(zod_1.z.string()),
    }).optional(),
});
// Legacy alias
exports.UserTasteProfile = exports.UserTasteProfileSchema;
// ============================================================================
// Culture Layer Detection Result
// ============================================================================
/**
 * Culture Layer Detection Result (from LLM analysis)
 */
exports.CultureLayerDetectionSchema = zod_1.z.object({
    result: zod_1.z.object({
        experience_topology: zod_1.z.array(zod_1.z.string()),
        taste_standards: zod_1.z.record(zod_1.z.string(), zod_1.z.object({
            positive_vibes: zod_1.z.array(zod_1.z.string()),
            negative_vibes: zod_1.z.array(zod_1.z.string()),
        })),
        tension_position: zod_1.z.object({
            control_level: zod_1.z.number().min(0).max(1),
            trust_level: zod_1.z.number().min(0).max(1),
            intervention_threshold: zod_1.z.number().min(0).max(1),
        }).optional(),
        symbiosis_boundary: zod_1.z.object({
            delegated_domains: zod_1.z.array(zod_1.z.string()),
            reserved_domains: zod_1.z.array(zod_1.z.string()),
            contextual_triggers: zod_1.z.array(zod_1.z.string()),
        }).optional(),
    }),
    confidence: zod_1.z.number().min(0).max(1),
    sample_size: zod_1.z.number().int().min(0),
    evidence_quotes: zod_1.z.array(zod_1.z.string()).optional(),
});
// ============================================================================
// Culture Detection Session
// ============================================================================
/**
 * Culture Detection Session
 * Aligned with api-design.md
 */
exports.CultureDetectionSessionSchema = zod_1.z.object({
    version: zod_1.z.string().default('1.0.0'),
    sessionId: zod_1.z.string(),
    userId: zod_1.z.string(),
    projectId: zod_1.z.string().optional(),
    // Session state (use 'status' as primary, 'state' as alias)
    status: exports.CultureDetectionStatusSchema,
    state: exports.CultureDetectionStatusSchema.optional(), // Legacy alias
    currentTurn: zod_1.z.number().int().min(0),
    maxTurns: zod_1.z.number().int().min(3).max(5).default(3),
    // Dialogue history (new format)
    messages: zod_1.z.array(exports.CultureDetectionMessageSchema).optional(),
    // Dialogue history (legacy format)
    dialogueHistory: zod_1.z.array(exports.DialogueTurnSchema).optional(),
    // Analysis result
    cultureLayer: exports.CultureLayerDetectionSchema.optional(),
    tasteDraftId: zod_1.z.string().optional(),
    // Legacy analysis result format
    analysisResult: zod_1.z.object({
        tasteProfile: exports.UserTasteProfileSchema.optional(),
        confidence: zod_1.z.number().optional(),
        evidenceQuotes: zod_1.z.array(zod_1.z.string()).optional(),
    }).optional(),
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
// Legacy type alias
exports.CultureDetectionSession = exports.CultureDetectionSessionSchema;
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
// Legacy alias
exports.StartDetectionRequest = exports.StartDetectionRequestSchema;
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
// Legacy alias
exports.StartDetectionResponse = exports.StartDetectionResponseSchema;
/**
 * Send Message Request
 */
exports.SendMessageRequestSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(2000),
    turn: zod_1.z.number().int().min(1).optional(),
});
// Legacy alias
exports.AddMessageRequestSchema = zod_1.z.object({
    message: zod_1.z.string().min(1).max(2000),
    turn: zod_1.z.number().int().min(0).optional(),
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
    estimatedTime: zod_1.z.number().optional(),
    message: zod_1.z.string().optional(),
});
/**
 * Get Taste Draft Response
 */
exports.GetTasteDraftResponseSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    userId: zod_1.z.string(),
    projectId: zod_1.z.string().optional(),
    draft: exports.UserTasteProfileSchema.nullable(),
    isComplete: zod_1.z.boolean(),
    generatedAt: zod_1.z.string().optional(),
    confidence: zod_1.z.number().min(0).max(1).optional(),
});
// Legacy alias
exports.GetTasteDraftResponse = exports.GetTasteDraftResponseSchema;
// ============================================================================
// Error Handling
// ============================================================================
/**
 * Error Codes
 */
exports.ERROR_CODES = {
    // Session errors
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    SESSION_ALREADY_COMPLETED: 'SESSION_ALREADY_COMPLETED',
    SESSION_NOT_READY: 'SESSION_NOT_READY',
    // State errors
    INVALID_STATE: 'INVALID_STATE',
    ANALYSIS_IN_PROGRESS: 'ANALYSIS_IN_PROGRESS',
    ANALYSIS_NOT_COMPLETE: 'ANALYSIS_NOT_COMPLETE',
    // Validation errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_TURN: 'INVALID_TURN',
    INVALID_MESSAGE: 'INVALID_MESSAGE',
    // LLM errors
    LLM_ERROR: 'LLM_ERROR',
    LLM_TIMEOUT: 'LLM_TIMEOUT',
    // Storage errors
    STORAGE_ERROR: 'STORAGE_ERROR',
    // General errors
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    INVALID_REQUEST: 'INVALID_REQUEST',
};
/**
 * Culture Detection Error
 */
class CultureDetectionError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'CultureDetectionError';
    }
}
exports.CultureDetectionError = CultureDetectionError;
// ============================================================================
// Validation Functions
// ============================================================================
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
/**
 * Validate user taste profile
 */
function validateUserTasteProfile(data) {
    return exports.UserTasteProfileSchema.parse(data);
}
/**
 * Validate culture detection session
 */
function validateCultureDetectionSession(data) {
    return exports.CultureDetectionSessionSchema.parse(data);
}
// ============================================================================
// Factory Functions
// ============================================================================
/**
 * Create a new user taste profile with defaults
 */
function createUserTasteProfile(params) {
    const now = new Date().toISOString();
    return {
        version: '1.0.0',
        id: `taste-${params.userId}-${Date.now()}`,
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
            confidence: params.confidence ?? 0.5,
            evolution_count: 0,
            derived_from_session: params.sessionId,
            last_analysis_at: now,
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
        state: 'active',
        currentTurn: 0,
        maxTurns: params.maxTurns ?? 3,
        messages: [],
        dialogueHistory: [],
        createdAt: now,
        updatedAt: now,
    };
}
