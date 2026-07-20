/**
 * Story C.5: Project Creation Types
 * Type definitions for project creation wizard and TASTE extraction
 *
 * @see docs/specs/epic-C/story-C.5/api-design.md
 */

import { z } from 'zod';

// ============================================================================
// Work Mode Types
// ============================================================================

export const WorkModeSchema = z.enum(['solo', 'team', 'product-owner', 'custom']);
export type WorkMode = z.infer<typeof WorkModeSchema>;

// ============================================================================
// Question Types
// ============================================================================

export const QuestionTypeSchema = z.enum(['text', 'choice', 'mixed', 'confirm']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const QuestionOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
});
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

export const QuestionSchema = z.object({
  id: z.string(),
  step: z.number().int().min(1).max(4),
  text: z.string(),
  type: QuestionTypeSchema,
  placeholder: z.string().optional(),
  hint: z.string().optional(),
  options: z.array(QuestionOptionSchema).optional(),
  allowMultiple: z.boolean().optional(),
  allowCustom: z.boolean().optional(),
  allowSkip: z.boolean().optional(),
});
export type Question = z.infer<typeof QuestionSchema>;

// ============================================================================
// Session Types
// ============================================================================

export const SessionStatusSchema = z.enum(['active', 'completed', 'expired', 'failed']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const ExtractedDataSchema = z.object({
  experience_topology: z.array(z.string()),
  context_features: z.object({
    domain: z.string(),
    task_type: z.string(),
    tech_stack: z.array(z.string()),
    discourse_system: z.enum(['technical', 'business', 'mixed']),
  }).optional(),
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
  }).nullable(),
  symbiosis_boundary: z.object({
    delegated_domains: z.array(z.string()),
    reserved_domains: z.array(z.string()),
    contextual_triggers: z.array(z.string()),
    control_level: z.number().min(0).max(1),
  }).nullable(),
});
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;

export const ProjectCreationSessionSchema = z.object({
  version: z.string().default('1.0.0'),
  sessionId: z.string(),
  projectId: z.string(),
  userId: z.string(),

  // Session state
  status: SessionStatusSchema,
  currentStep: z.number().int().min(1).max(4),
  maxSteps: z.number().int().default(4),

  // User input data
  data: z.object({
    name: z.string().nullable(),
    background: z.string().nullable(),
    priorities: z.array(z.string()),
    workMode: WorkModeSchema.nullable(),
    customDescriptions: z.object({
      priorities: z.string().optional(),
      workMode: z.string().optional(),
    }),
  }),

  // Hidden extraction data
  extractedData: ExtractedDataSchema,

  // Timestamps
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  expiresAt: z.string(),

  // Error handling
  error: z.object({
    code: z.string(),
    message: z.string(),
    timestamp: z.string(),
  }).optional(),
});
export type ProjectCreationSession = z.infer<typeof ProjectCreationSessionSchema>;

// ============================================================================
// API Request/Response Types
// ============================================================================

// POST /api/project/create/start
export const StartProjectCreationRequestSchema = z.object({
  userId: z.string(),
  projectName: z.string().optional(),
  defaultValues: z.object({
    background: z.string().optional(),
    priorities: z.array(z.string()).optional(),
    workMode: WorkModeSchema.optional(),
  }).optional(),
});
export type StartProjectCreationRequest = z.infer<typeof StartProjectCreationRequestSchema>;

export const StartProjectCreationResponseSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  currentStep: z.literal(1),
  question: QuestionSchema,
  progress: z.object({
    current: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
});
export type StartProjectCreationResponse = z.infer<typeof StartProjectCreationResponseSchema>;

// POST /api/project/create/:sessionId/question
export const GetQuestionRequestSchema = z.object({
  sessionId: z.string(),
});
export type GetQuestionRequest = z.infer<typeof GetQuestionRequestSchema>;

export const GetQuestionResponseSchema = z.object({
  sessionId: z.string(),
  currentStep: z.number(),
  question: QuestionSchema,
  progress: z.object({
    current: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
  canGoBack: z.boolean(),
  canSkip: z.boolean(),
});
export type GetQuestionResponse = z.infer<typeof GetQuestionResponseSchema>;

// POST /api/project/create/:sessionId/answer
export const SubmitAnswerRequestSchema = z.object({
  sessionId: z.string(),
  step: z.number().int().min(1).max(4),
  answer: z.object({
    type: z.enum(['text', 'choice', 'confirm']),
    value: z.union([z.string(), z.array(z.string()), z.record(z.unknown())]),
    customDescription: z.string().optional(),
  }),
});
export type SubmitAnswerRequest = z.infer<typeof SubmitAnswerRequestSchema>;

export const SubmitAnswerResponseSchema = z.object({
  sessionId: z.string(),
  step: z.number(),
  saved: z.boolean(),
  nextStep: z.number().nullable(),
  nextQuestion: QuestionSchema.optional(),
  progress: z.object({
    current: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
});
export type SubmitAnswerResponse = z.infer<typeof SubmitAnswerResponseSchema>;

// POST /api/project/create/:sessionId/complete
export const CompleteCreationRequestSchema = z.object({
  sessionId: z.string(),
  projectName: z.string(),
  confirmData: z.object({
    background: z.string().optional(),
    priorities: z.array(z.string()).optional(),
    workMode: z.string().optional(),
  }),
});
export type CompleteCreationRequest = z.infer<typeof CompleteCreationRequestSchema>;

export const CompleteCreationResponseSchema = z.object({
  success: z.boolean(),
  project: z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string(),
    path: z.string(),
  }),
  taste: z.object({
    generated: z.boolean(),
    confidence: z.number(),
  }),
  ontology: z.object({
    generated: z.boolean(),
    domainCount: z.number(),
  }),
});
export type CompleteCreationResponse = z.infer<typeof CompleteCreationResponseSchema>;

// GET /api/project/create/:sessionId/status
export const GetStatusRequestSchema = z.object({
  sessionId: z.string(),
});
export type GetStatusRequest = z.infer<typeof GetStatusRequestSchema>;

export const GetStatusResponseSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  status: SessionStatusSchema,
  currentStep: z.number(),
  progress: z.object({
    current: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
  data: z.object({
    name: z.string().optional(),
    background: z.string().optional(),
    priorities: z.array(z.string()).optional(),
    workMode: z.string().optional(),
  }),
  canResume: z.boolean(),
  expiresAt: z.string().optional(),
});
export type GetStatusResponse = z.infer<typeof GetStatusResponseSchema>;

// ============================================================================
// Error Types
// ============================================================================

export const ErrorCodeSchema = z.enum([
  'SESSION_NOT_FOUND',
  'SESSION_EXPIRED',
  'INVALID_STEP',
  'INVALID_ANSWER',
  'PROJECT_NAME_REQUIRED',
  'TASTE_GENERATION_FAILED',
  'ONTOLOGY_BUILD_FAILED',
  'STORAGE_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
  timestamp: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================================================
// Question Configuration
// ============================================================================

export const PROJECT_CREATION_QUESTIONS: Question[] = [
  {
    step: 1,
    id: 'background',
    text: '这个项目主要是做什么的？',
    type: 'text',
    placeholder: '例如：给电商网站做库存管理系统...',
    hint: '自然描述即可，比如：产品类型、使用的技术、解决的问题...',
    allowSkip: true,
  },
  {
    step: 2,
    id: 'priorities',
    text: '这个项目最重要的是什么？',
    type: 'choice',
    options: [
      { value: 'velocity', label: '快速上线', description: '先把功能做出来，后续再优化' },
      { value: 'stability', label: '稳定可靠', description: '代码质量高，减少 bug 和维护成本' },
      { value: 'maintainability', label: '易于维护', description: '结构清晰，方便后续扩展和团队协作' },
    ],
    allowMultiple: true,
    allowCustom: true,
    allowSkip: true,
  },
  {
    step: 3,
    id: 'workMode',
    text: '你希望怎么使用这个项目？',
    type: 'choice',
    options: [
      { value: 'solo', label: '我自己开发和维护', icon: '👤', description: '全程自己掌控，AI 辅助具体任务' },
      { value: 'team', label: '和小团队一起协作', icon: '👥', description: '团队成员共同贡献，AI 帮助协调' },
      { value: 'product-owner', label: '交给其他人使用', icon: '🎯', description: '我是产品角色，AI 帮我实现想法' },
    ],
    allowMultiple: false,
    allowCustom: true,
    allowSkip: true,
  },
  {
    step: 4,
    id: 'confirm',
    text: '确认项目信息',
    type: 'confirm',
    allowSkip: false,
  },
];

// ============================================================================
// Preset Mappings
// ============================================================================

/**
 * Preset work mode to symbiosis boundary mapping
 */
export const WORK_MODE_SYMBIOSIS_PRESETS: Record<string, {
  delegated_domains: string[];
  reserved_domains: string[];
  contextual_triggers: string[];
  control_level: number;
}> = {
  solo: {
    delegated_domains: [],
    reserved_domains: ['all'],
    contextual_triggers: [],
    control_level: 0.9,
  },
  team: {
    delegated_domains: ['document-generation', 'code-formatting', 'testing'],
    reserved_domains: ['architecture-decisions', 'database-schema'],
    contextual_triggers: ['team-review-required'],
    control_level: 0.5,
  },
  'product-owner': {
    delegated_domains: ['implementation', 'testing', 'documentation'],
    reserved_domains: ['requirements', 'priorities'],
    contextual_triggers: ['milestone-review'],
    control_level: 0.3,
  },
};

/**
 * Priority to taste standards mapping
 */
export const PRIORITY_TASTE_STANDARDS_PRESETS: Record<string, {
  positive_vibes: string[];
  negative_vibes: string[];
}> = {
  velocity: {
    positive_vibes: ['velocity', 'iteration-speed', 'quick-wins', 'fast-feedback'],
    negative_vibes: ['over-engineering', 'analysis-paralysis', 'perfect-is-enemy-of-good'],
  },
  stability: {
    positive_vibes: ['predictability', 'error-absence', 'defensive-programming', 'test-coverage'],
    negative_vibes: ['rushed-code', 'shortcuts', 'technical-debt'],
  },
  maintainability: {
    positive_vibes: ['clean-structure', 'documentation', 'separation-of-concerns', 'readability'],
    negative_vibes: ['complexity', 'spaghetti-code', 'magic-numbers'],
  },
};

// ============================================================================
// Validation Functions
// ============================================================================

export function validateStartProjectCreationRequest(data: unknown): StartProjectCreationRequest {
  return StartProjectCreationRequestSchema.parse(data);
}

export function validateSubmitAnswerRequest(data: unknown): SubmitAnswerRequest {
  return SubmitAnswerRequestSchema.parse(data);
}

export function validateCompleteCreationRequest(data: unknown): CompleteCreationRequest {
  return CompleteCreationRequestSchema.parse(data);
}

export function validateProjectCreationSession(data: unknown): ProjectCreationSession {
  return ProjectCreationSessionSchema.parse(data);
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new project creation session
 */
export function createProjectCreationSession(params: {
  sessionId: string;
  projectId: string;
  userId: string;
  projectName?: string;
}): ProjectCreationSession {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  return {
    version: '1.0.0',
    sessionId: params.sessionId,
    projectId: params.projectId,
    userId: params.userId,
    status: 'active',
    currentStep: 1,
    maxSteps: 4,
    data: {
      name: params.projectName ?? null,
      background: null,
      priorities: [],
      workMode: null,
      customDescriptions: {},
    },
    extractedData: {
      experience_topology: [],
      taste_standards: {},
      tension_position: null,
      symbiosis_boundary: null,
    },
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };
}

/**
 * Get question for a specific step
 */
export function getQuestionForStep(step: number): Question | undefined {
  return PROJECT_CREATION_QUESTIONS.find(q => q.step === step);
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(currentStep: number, totalSteps: number = 4): number {
  return Math.round((currentStep / totalSteps) * 100);
}
