/**
 * User Taste Detection Types
 * Phase 1: User TASTE Generation
 *
 * Aligned with docs/specs/epic-C/story-C.1/api-design.md
 */

import { z } from 'zod';

// ============================================================================
// Session State / Status
// ============================================================================

/**
 * Culture Detection Session Status
 * (aligned with api-design.md)
 */
export const CultureDetectionStatusSchema = z.enum([
  'active',      // Session is active, accepting messages
  'analyzing',   // LLM analysis in progress
  'completed',   // Analysis completed, TASTE profile generated
  'failed',      // Analysis failed
  'expired',     // Session expired
]);
export type CultureDetectionStatus = z.infer<typeof CultureDetectionStatusSchema>;

// Legacy alias for backward compatibility
export const SessionState = CultureDetectionStatusSchema;
export type SessionState = CultureDetectionStatus;

// ============================================================================
// Dialogue and Messages
// ============================================================================

/**
 * Taste Signal Type
 */
export const TasteSignalTypeSchema = z.enum(['word_choice', 'resistance', 'repetition']);
export type TasteSignalType = z.infer<typeof TasteSignalTypeSchema>;

/**
 * Taste Dimensions
 */
export const TASTE_DIMENSIONS = ['experience_topology', 'taste_standards', 'tension_position', 'symbiosis_boundary'] as const;
export type TASTEDimension = typeof TASTE_DIMENSIONS[number];

/**
 * Culture Detection Message
 */
export const CultureDetectionMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  turn: z.number().int().min(1),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional(),
});
export type CultureDetectionMessage = z.infer<typeof CultureDetectionMessageSchema>;

/**
 * Dialogue Turn (legacy format for backward compatibility)
 */
export const DialogueTurnSchema = z.object({
  turn: z.number(),
  question: z.string(),
  userResponse: z.string(),
  timestamp: z.string(),
  extractedSignals: z.array(z.any()).optional(),
});
export type DialogueTurn = z.infer<typeof DialogueTurnSchema>;

// ============================================================================
// TASTE Profile (aligned with src/types/taste.ts)
// ============================================================================

/**
 * TASTE Profile Source
 */
export const TASTEProfileSourceSchema = z.enum(['user', 'project', 'merged']);
export type TASTEProfileSource = z.infer<typeof TASTEProfileSourceSchema>;

/**
 * User TASTE Profile
 * Aligned with api-design.md and src/types/taste.ts
 */
export const UserTasteProfileSchema = z.object({
  // Metadata
  version: z.string().default('1.0.0'),
  id: z.string().optional(),
  userId: z.string(),
  projectId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),

  // Dimension 1: Experience Topology
  experience_topology: z.array(z.string()),

  // Dimension 2: Taste Standards
  taste_standards: z.record(z.object({
    positive_vibes: z.array(z.string()),
    negative_vibes: z.array(z.string()),
  })),

  // Dimension 3: Tension Position
  tension_position: z.object({
    control_level: z.number().min(0).max(1),
    trust_level: z.number().min(0).max(1),
    intervention_threshold: z.number().min(0).max(1),
  }),

  // Dimension 4: Symbiosis Boundary
  symbiosis_boundary: z.object({
    delegated_domains: z.array(z.string()),
    reserved_domains: z.array(z.string()),
    contextual_triggers: z.array(z.string()),
  }),

  // Metadata
  metadata: z.object({
    source: TASTEProfileSourceSchema,
    confidence: z.number().min(0).max(1),
    evolution_count: z.number().default(0),
    derived_from_session: z.string().optional(),
    last_analysis_at: z.string().optional(),
  }),

  // Memory stats (optional)
  memory_stats: z.object({
    total_memories: z.number().int().min(0),
    high_confidence_count: z.number().int().min(0),
    avg_confidence: z.number().min(0).max(1),
    domains: z.array(z.string()),
  }).optional(),
});
export type UserTasteProfile = z.infer<typeof UserTasteProfileSchema>;

// Legacy alias
export const UserTasteProfile = UserTasteProfileSchema;

// ============================================================================
// Culture Layer Detection Result
// ============================================================================

/**
 * Culture Layer Detection Result (from LLM analysis)
 */
export const CultureLayerDetectionSchema = z.object({
  result: z.object({
    experience_topology: z.array(z.string()),
    taste_standards: z.record(
      z.string(),
      z.object({
        positive_vibes: z.array(z.string()),
        negative_vibes: z.array(z.string()),
      })
    ),
    tension_position: z.object({
      control_level: z.number().min(0).max(1),
      trust_level: z.number().min(0).max(1),
      intervention_threshold: z.number().min(0).max(1),
    }).optional(),
    symbiosis_boundary: z.object({
      delegated_domains: z.array(z.string()),
      reserved_domains: z.array(z.string()),
      contextual_triggers: z.array(z.string()),
    }).optional(),
  }),
  confidence: z.number().min(0).max(1),
  sample_size: z.number().int().min(0),
  evidence_quotes: z.array(z.string()).optional(),
});
export type CultureLayerDetection = z.infer<typeof CultureLayerDetectionSchema>;

// ============================================================================
// Culture Detection Session
// ============================================================================

/**
 * Culture Detection Session
 * Aligned with api-design.md
 */
export const CultureDetectionSessionSchema = z.object({
  version: z.string().default('1.0.0'),
  sessionId: z.string(),
  userId: z.string(),
  projectId: z.string().optional(),

  // Session state (use 'status' as primary, 'state' as alias)
  status: CultureDetectionStatusSchema,
  state: CultureDetectionStatusSchema.optional(), // Legacy alias
  currentTurn: z.number().int().min(0),
  maxTurns: z.number().int().min(3).max(5).default(3),

  // Dialogue history (new format)
  messages: z.array(CultureDetectionMessageSchema).optional(),

  // Dialogue history (legacy format)
  dialogueHistory: z.array(DialogueTurnSchema).optional(),

  // Analysis result
  cultureLayer: CultureLayerDetectionSchema.optional(),
  tasteDraftId: z.string().optional(),

  // Legacy analysis result format
  analysisResult: z.object({
    tasteProfile: UserTasteProfileSchema.optional(),
    confidence: z.number().optional(),
    evidenceQuotes: z.array(z.string()).optional(),
  }).optional(),

  // Timestamps
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),

  // Error handling
  error: z.object({
    code: z.string(),
    message: z.string(),
    timestamp: z.string(),
  }).optional(),
});
export type CultureDetectionSession = z.infer<typeof CultureDetectionSessionSchema>;

// Legacy type alias
export const CultureDetectionSession = CultureDetectionSessionSchema;

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Start Detection Request
 */
export const StartDetectionRequestSchema = z.object({
  userId: z.string(),
  projectId: z.string().optional(),
  maxTurns: z.number().int().min(3).max(5).optional().default(3),
  options: z.object({
    skipWelcome: z.boolean().optional().default(false),
    language: z.string().optional().default('zh-CN'),
  }).optional(),
});
export type StartDetectionRequest = z.infer<typeof StartDetectionRequestSchema>;

// Legacy alias
export const StartDetectionRequest = StartDetectionRequestSchema;

/**
 * Start Detection Response
 */
export const StartDetectionResponseSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  status: CultureDetectionStatusSchema,
  currentTurn: z.number(),
  maxTurns: z.number(),
  firstQuestion: z.string(),
  createdAt: z.string(),
});
export type StartDetectionResponse = z.infer<typeof StartDetectionResponseSchema>;

// Legacy alias
export const StartDetectionResponse = StartDetectionResponseSchema;

/**
 * Send Message Request
 */
export const SendMessageRequestSchema = z.object({
  content: z.string().min(1).max(2000),
  turn: z.number().int().min(1).optional(),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

// Legacy alias
export const AddMessageRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  turn: z.number().int().min(0).optional(),
});
export type AddMessageRequest = z.infer<typeof AddMessageRequestSchema>;

/**
 * Send Message Response
 */
export const SendMessageResponseSchema = z.object({
  sessionId: z.string(),
  message: z.string(),
  role: z.enum(['assistant', 'system']),
  turn: z.number(),
  isComplete: z.boolean(),
  suggestedNextQuestion: z.string().optional(),
  nextAction: z.enum(['continue', 'analyze', 'complete']).optional(),
});
export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;

/**
 * Analyze Request
 */
export const AnalyzeRequestSchema = z.object({
  sessionId: z.string(),
  options: z.object({
    forceReanalyze: z.boolean().optional().default(false),
    generateDraft: z.boolean().optional().default(true),
  }).optional(),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

/**
 * Analyze Response
 */
export const AnalyzeResponseSchema = z.object({
  sessionId: z.string(),
  analysisId: z.string(),
  status: z.enum(['started', 'in_progress', 'completed', 'failed']),
  cultureLayer: CultureLayerDetectionSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  tasteDraftId: z.string().optional(),
  estimatedTime: z.number().optional(),
  message: z.string().optional(),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

/**
 * Get Taste Draft Response
 */
export const GetTasteDraftResponseSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  projectId: z.string().optional(),
  draft: UserTasteProfileSchema.nullable(),
  isComplete: z.boolean(),
  generatedAt: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type GetTasteDraftResponse = z.infer<typeof GetTasteDraftResponseSchema>;

// Legacy alias
export const GetTasteDraftResponse = GetTasteDraftResponseSchema;

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Error Codes
 */
export const ERROR_CODES = {
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
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Culture Detection Error
 */
export class CultureDetectionError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CultureDetectionError';
  }
}

// ============================================================================
// LLM Prompt Builder Interface
// ============================================================================

/**
 * LLM Prompt Builder Interface
 */
export interface LLMPromptBuilder {
  buildExtractionPrompt(dialogueHistory: DialogueTurn[] | CultureDetectionMessage[]): string;
  buildSummaryPrompt(tasteProfile: UserTasteProfile): string;
}

// ============================================================================
// TASTE Merger Interface (Phase 1.5)
// ============================================================================

/**
 * TASTE Merger Interface (for Phase 1.5)
 */
export interface TasteMerger {
  merge(userTaste: UserTasteProfile, projectTaste: UserTasteProfile): UserTasteProfile;
  validateMerge(result: UserTasteProfile): boolean;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * User Taste Context
 */
export interface UserTasteContext {
  userId: string;
  sessionId?: string;
  projectId?: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate start detection request
 */
export function validateStartDetectionRequest(data: unknown): StartDetectionRequest {
  return StartDetectionRequestSchema.parse(data);
}

/**
 * Validate send message request
 */
export function validateSendMessageRequest(data: unknown): SendMessageRequest {
  return SendMessageRequestSchema.parse(data);
}

/**
 * Validate user taste profile
 */
export function validateUserTasteProfile(data: unknown): UserTasteProfile {
  return UserTasteProfileSchema.parse(data);
}

/**
 * Validate culture detection session
 */
export function validateCultureDetectionSession(data: unknown): CultureDetectionSession {
  return CultureDetectionSessionSchema.parse(data);
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new user taste profile with defaults
 */
export function createUserTasteProfile(params: {
  userId: string;
  projectId?: string;
  experience_topology?: string[];
  taste_standards?: Record<string, { positive_vibes: string[]; negative_vibes: string[] }>;
  tension_position?: Partial<UserTasteProfile['tension_position']>;
  symbiosis_boundary?: Partial<UserTasteProfile['symbiosis_boundary']>;
  sessionId?: string;
  confidence?: number;
}): UserTasteProfile {
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
export function createCultureDetectionSession(params: {
  sessionId: string;
  userId: string;
  projectId?: string;
  maxTurns?: number;
}): CultureDetectionSession {
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
