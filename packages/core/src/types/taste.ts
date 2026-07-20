/**
 * TASTE Types - Type Definitions for Epic C
 *
 * Core type definitions for TASTE (Taste-Aware System for Embodied Experience) layer.
 * Supports two-layer architecture: User TASTE + Project TASTE.
 *
 * @module types/taste
 * @see docs/specs/epic-C/README.md
 */

import { z } from 'zod';

// ============================================================================
// TASTE Profile Schema (Two-Layer Architecture)
// ============================================================================

/**
 * TASTE Profile Source
 * Indicates whether this profile is for a user or a project
 */
export const TASTEProfileSourceSchema = z.enum(['user', 'project', 'merged']);
export type TASTEProfileSource = z.infer<typeof TASTEProfileSourceSchema>;

/**
 * Experience Topology - Dimension 1
 * Domains where the user has embodied experience and intuition
 *
 * Examples:
 * - "code-review" - Code review experience
 * - "architecture-design" - Architecture design experience
 * - "integration-testing" - Integration testing experience
 */
export const ExperienceTopologySchema = z.array(z.string());

/**
 * Taste Standards - Dimension 2
 * Domain-specific "right" and "wrong" feelings
 *
 * positive_vibes: What feels "right" in this domain
 * negative_vibes: What feels "wrong" or "twisted" in this domain
 */
export const TasteStandardsSchema = z.record(
  z.string(), // domain name
  z.object({
    positive_vibes: z.array(z.string()),
    negative_vibes: z.array(z.string()),
  })
);

/**
 * Tension Position - Dimension 3
 * ECO (Explore/Conserve/Optimize) tension state
 *
 * control_level: How much control the user wants (0-1, higher = more control)
 * trust_level: How much the user trusts AI suggestions (0-1, higher = more trust)
 * intervention_threshold: When user wants to intervene (0-1, higher = later intervention)
 */
export const TensionPositionSchema = z.object({
  control_level: z.number().min(0).max(1),
  trust_level: z.number().min(0).max(1),
  intervention_threshold: z.number().min(0).max(1),
});

/**
 * Symbiosis Boundary - Dimension 4
 * Defines what tasks user delegates to AI vs keeps for themselves
 *
 * delegated_domains: Tasks user is comfortable delegating to AI
 * reserved_domains: Tasks user wants to keep control of
 * contextual_triggers: Situations that change delegation behavior
 */
export const SymbiosisBoundarySchema = z.object({
  delegated_domains: z.array(z.string()),
  reserved_domains: z.array(z.string()),
  contextual_triggers: z.array(z.string()),
});

/**
 * TASTE Profile Metadata
 * Additional information about the profile
 */
export const TASTEProfileMetadataSchema = z.object({
  source: TASTEProfileSourceSchema,
  confidence: z.number().min(0).max(1),
  evolution_count: z.number().int().min(0),
  derived_from_session: z.string().optional(),
  last_analysis_at: z.string().optional(),
});

/**
 * TASTE Profile - Complete Schema
 *
 * Supports both User TASTE and Project TASTE with the same structure.
 * When both exist, they are merged with Project TASTE taking precedence
 * for domain-specific preferences.
 */
export const TASTEProfileSchema = z.object({
  version: z.string().default('1.0.0'),
  id: z.string().optional(),
  userId: z.string().optional(),
  projectId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),

  // Dimension 1: Experience Topology
  experience_topology: ExperienceTopologySchema,

  // Dimension 2: Taste Standards
  taste_standards: TasteStandardsSchema,

  // Dimension 3: Tension Position
  tension_position: TensionPositionSchema,

  // Dimension 4: Symbiosis Boundary
  symbiosis_boundary: SymbiosisBoundarySchema,

  // Metadata
  metadata: TASTEProfileMetadataSchema,

  // Memory stats (for tracking profile evolution)
  memory_stats: z.object({
    total_memories: z.number().int().min(0),
    high_confidence_count: z.number().int().min(0),
    avg_confidence: z.number().min(0).max(1),
    domains: z.array(z.string()),
  }).optional(),
});

// ============================================================================
// Culture Detection Session Schema
// ============================================================================

/**
 * Culture Detection Session Status
 */
export const CultureDetectionStatusSchema = z.enum([
  'active',      // Session is active, accepting messages
  'analyzing',   // LLM analysis in progress
  'completed',   // Analysis completed, TASTE profile generated
  'failed',      // Analysis failed
  'expired',     // Session expired
]);
export type CultureDetectionStatus = z.infer<typeof CultureDetectionStatusSchema>;

/**
 * Culture Detection Message
 * A single message in the detection dialogue
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
 * Culture Detection Session
 * Represents a complete detection session
 */
export const CultureDetectionSessionSchema = z.object({
  version: z.string().default('1.0.0'),
  sessionId: z.string(),
  userId: z.string(),
  projectId: z.string().optional(),

  // Session state
  status: CultureDetectionStatusSchema,
  currentTurn: z.number().int().min(0),
  maxTurns: z.number().int().min(3).max(5).default(3),

  // Dialogue history
  messages: z.array(CultureDetectionMessageSchema),

  // Analysis result (populated after analysis)
  cultureLayer: z.unknown().optional(), // CultureLayerDetection
  tasteDraftId: z.string().optional(),

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

/**
 * Culture Layer Detection Result
 * The raw analysis output from LLM
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
    tension_position: TensionPositionSchema.optional(),
    symbiosis_boundary: SymbiosisBoundarySchema.optional(),
  }),
  confidence: z.number().min(0).max(1),
  sample_size: z.number().int().min(0),
  evidence_quotes: z.array(z.string()).optional(),
});
export type CultureLayerDetection = z.infer<typeof CultureLayerDetectionSchema>;

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

/**
 * Send Message Request
 */
export const SendMessageRequestSchema = z.object({
  content: z.string().min(1).max(2000),
  turn: z.number().int().min(1).optional(),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

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
  estimatedTime: z.number().optional(), // seconds
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
  draft: TASTEProfileSchema.nullable(),
  isComplete: z.boolean(),
  generatedAt: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type GetTasteDraftResponse = z.infer<typeof GetTasteDraftResponseSchema>;

// ============================================================================
// Type Exports
// ============================================================================

export type TASTEProfile = z.infer<typeof TASTEProfileSchema>;
export type ExperienceTopology = z.infer<typeof ExperienceTopologySchema>;
export type TasteStandards = z.infer<typeof TasteStandardsSchema>;
export type TensionPosition = z.infer<typeof TensionPositionSchema>;
export type SymbiosisBoundary = z.infer<typeof SymbiosisBoundarySchema>;
export type TASTEProfileMetadata = z.infer<typeof TASTEProfileMetadataSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate TASTE profile data
 */
export function validateTASTEProfile(data: unknown): TASTEProfile {
  return TASTEProfileSchema.parse(data);
}

/**
 * Validate culture detection session data
 */
export function validateCultureDetectionSession(data: unknown): CultureDetectionSession {
  return CultureDetectionSessionSchema.parse(data);
}

/**
 * Validate culture layer detection result
 */
export function validateCultureLayerDetection(data: unknown): CultureLayerDetection {
  return CultureLayerDetectionSchema.parse(data);
}

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

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new TASTE profile with defaults
 */
export function createTASTEProfile(params: {
  userId?: string;
  projectId?: string;
  experience_topology?: string[];
  taste_standards?: Record<string, { positive_vibes: string[]; negative_vibes: string[] }>;
  tension_position?: Partial<TensionPosition>;
  symbiosis_boundary?: Partial<SymbiosisBoundary>;
  metadata?: Partial<TASTEProfileMetadata>;
}): TASTEProfile {
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
export function createCultureDetectionMessage(params: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  turn: number;
  metadata?: Record<string, unknown>;
}): CultureDetectionMessage {
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
export function mergeTASTEProfiles(
  userTASTE: TASTEProfile,
  projectTASTE: TASTEProfile
): TASTEProfile {
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
      control_level:
        userTASTE.tension_position.control_level * 0.3 +
        projectTASTE.tension_position.control_level * 0.7,
      trust_level:
        userTASTE.tension_position.trust_level * 0.3 +
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
      confidence: Math.max(
        userTASTE.metadata.confidence,
        projectTASTE.metadata.confidence
      ),
      evolution_count:
        userTASTE.metadata.evolution_count + projectTASTE.metadata.evolution_count,
      last_analysis_at: now,
    },

    memory_stats: {
      total_memories:
        (userTASTE.memory_stats?.total_memories ?? 0) +
        (projectTASTE.memory_stats?.total_memories ?? 0),
      high_confidence_count:
        (userTASTE.memory_stats?.high_confidence_count ?? 0) +
        (projectTASTE.memory_stats?.high_confidence_count ?? 0),
      avg_confidence:
        ((userTASTE.memory_stats?.avg_confidence ?? 0) +
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
export function isSessionReadyForAnalysis(session: CultureDetectionSession): boolean {
  const minTurns = Math.ceil(session.maxTurns * 0.6); // At least 60% completion
  const userMessageCount = session.messages.filter(m => m.role === 'user').length;
  return userMessageCount >= minTurns;
}

/**
 * Calculate session progress percentage
 */
export function calculateSessionProgress(session: CultureDetectionSession): number {
  const userMessageCount = session.messages.filter(m => m.role === 'user').length;
  return Math.min((userMessageCount / session.maxTurns) * 100, 100);
}
