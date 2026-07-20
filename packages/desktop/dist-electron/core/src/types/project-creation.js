"use strict";
/**
 * Story C.5: Project Creation Types
 * Type definitions for project creation wizard and TASTE extraction
 *
 * @see docs/specs/epic-C/story-C.5/api-design.md
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRIORITY_TASTE_STANDARDS_PRESETS = exports.WORK_MODE_SYMBIOSIS_PRESETS = exports.PROJECT_CREATION_QUESTIONS = exports.ErrorResponseSchema = exports.ErrorCodeSchema = exports.GetStatusResponseSchema = exports.GetStatusRequestSchema = exports.CompleteCreationResponseSchema = exports.CompleteCreationRequestSchema = exports.SubmitAnswerResponseSchema = exports.SubmitAnswerRequestSchema = exports.GetQuestionResponseSchema = exports.GetQuestionRequestSchema = exports.StartProjectCreationResponseSchema = exports.StartProjectCreationRequestSchema = exports.ProjectCreationSessionSchema = exports.ExtractedDataSchema = exports.SessionStatusSchema = exports.QuestionSchema = exports.QuestionOptionSchema = exports.QuestionTypeSchema = exports.WorkModeSchema = void 0;
exports.validateStartProjectCreationRequest = validateStartProjectCreationRequest;
exports.validateSubmitAnswerRequest = validateSubmitAnswerRequest;
exports.validateCompleteCreationRequest = validateCompleteCreationRequest;
exports.validateProjectCreationSession = validateProjectCreationSession;
exports.createProjectCreationSession = createProjectCreationSession;
exports.getQuestionForStep = getQuestionForStep;
exports.calculateProgress = calculateProgress;
const zod_1 = require("zod");
// ============================================================================
// Work Mode Types
// ============================================================================
exports.WorkModeSchema = zod_1.z.enum(['solo', 'team', 'product-owner', 'custom']);
// ============================================================================
// Question Types
// ============================================================================
exports.QuestionTypeSchema = zod_1.z.enum(['text', 'choice', 'mixed', 'confirm']);
exports.QuestionOptionSchema = zod_1.z.object({
    value: zod_1.z.string(),
    label: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    icon: zod_1.z.string().optional(),
});
exports.QuestionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    step: zod_1.z.number().int().min(1).max(4),
    text: zod_1.z.string(),
    type: exports.QuestionTypeSchema,
    placeholder: zod_1.z.string().optional(),
    hint: zod_1.z.string().optional(),
    options: zod_1.z.array(exports.QuestionOptionSchema).optional(),
    allowMultiple: zod_1.z.boolean().optional(),
    allowCustom: zod_1.z.boolean().optional(),
    allowSkip: zod_1.z.boolean().optional(),
});
// ============================================================================
// Session Types
// ============================================================================
exports.SessionStatusSchema = zod_1.z.enum(['active', 'completed', 'expired', 'failed']);
exports.ExtractedDataSchema = zod_1.z.object({
    experience_topology: zod_1.z.array(zod_1.z.string()),
    context_features: zod_1.z.object({
        domain: zod_1.z.string(),
        task_type: zod_1.z.string(),
        tech_stack: zod_1.z.array(zod_1.z.string()),
        discourse_system: zod_1.z.enum(['technical', 'business', 'mixed']),
    }).optional(),
    taste_standards: zod_1.z.record(zod_1.z.string(), zod_1.z.object({
        positive_vibes: zod_1.z.array(zod_1.z.string()),
        negative_vibes: zod_1.z.array(zod_1.z.string()),
    })),
    tension_position: zod_1.z.object({
        control_level: zod_1.z.number().min(0).max(1),
        trust_level: zod_1.z.number().min(0).max(1),
        intervention_threshold: zod_1.z.number().min(0).max(1),
    }).nullable(),
    symbiosis_boundary: zod_1.z.object({
        delegated_domains: zod_1.z.array(zod_1.z.string()),
        reserved_domains: zod_1.z.array(zod_1.z.string()),
        contextual_triggers: zod_1.z.array(zod_1.z.string()),
        control_level: zod_1.z.number().min(0).max(1),
    }).nullable(),
});
exports.ProjectCreationSessionSchema = zod_1.z.object({
    version: zod_1.z.string().default('1.0.0'),
    sessionId: zod_1.z.string(),
    projectId: zod_1.z.string(),
    userId: zod_1.z.string(),
    // Session state
    status: exports.SessionStatusSchema,
    currentStep: zod_1.z.number().int().min(1).max(4),
    maxSteps: zod_1.z.number().int().default(4),
    // User input data
    data: zod_1.z.object({
        name: zod_1.z.string().nullable(),
        background: zod_1.z.string().nullable(),
        priorities: zod_1.z.array(zod_1.z.string()),
        workMode: exports.WorkModeSchema.nullable(),
        customDescriptions: zod_1.z.object({
            priorities: zod_1.z.string().optional(),
            workMode: zod_1.z.string().optional(),
        }),
    }),
    // Hidden extraction data
    extractedData: exports.ExtractedDataSchema,
    // Timestamps
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    completedAt: zod_1.z.string().optional(),
    expiresAt: zod_1.z.string(),
    // Error handling
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
        timestamp: zod_1.z.string(),
    }).optional(),
});
// ============================================================================
// API Request/Response Types
// ============================================================================
// POST /api/project/create/start
exports.StartProjectCreationRequestSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    projectName: zod_1.z.string().optional(),
    defaultValues: zod_1.z.object({
        background: zod_1.z.string().optional(),
        priorities: zod_1.z.array(zod_1.z.string()).optional(),
        workMode: exports.WorkModeSchema.optional(),
    }).optional(),
});
exports.StartProjectCreationResponseSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    projectId: zod_1.z.string(),
    currentStep: zod_1.z.literal(1),
    question: exports.QuestionSchema,
    progress: zod_1.z.object({
        current: zod_1.z.number(),
        total: zod_1.z.number(),
        percentage: zod_1.z.number(),
    }),
});
// POST /api/project/create/:sessionId/question
exports.GetQuestionRequestSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
});
exports.GetQuestionResponseSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    currentStep: zod_1.z.number(),
    question: exports.QuestionSchema,
    progress: zod_1.z.object({
        current: zod_1.z.number(),
        total: zod_1.z.number(),
        percentage: zod_1.z.number(),
    }),
    canGoBack: zod_1.z.boolean(),
    canSkip: zod_1.z.boolean(),
});
// POST /api/project/create/:sessionId/answer
exports.SubmitAnswerRequestSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    step: zod_1.z.number().int().min(1).max(4),
    answer: zod_1.z.object({
        type: zod_1.z.enum(['text', 'choice', 'confirm']),
        value: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string()), zod_1.z.record(zod_1.z.unknown())]),
        customDescription: zod_1.z.string().optional(),
    }),
});
exports.SubmitAnswerResponseSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    step: zod_1.z.number(),
    saved: zod_1.z.boolean(),
    nextStep: zod_1.z.number().nullable(),
    nextQuestion: exports.QuestionSchema.optional(),
    progress: zod_1.z.object({
        current: zod_1.z.number(),
        total: zod_1.z.number(),
        percentage: zod_1.z.number(),
    }),
});
// POST /api/project/create/:sessionId/complete
exports.CompleteCreationRequestSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    projectName: zod_1.z.string(),
    confirmData: zod_1.z.object({
        background: zod_1.z.string().optional(),
        priorities: zod_1.z.array(zod_1.z.string()).optional(),
        workMode: zod_1.z.string().optional(),
    }),
});
exports.CompleteCreationResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    project: zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        createdAt: zod_1.z.string(),
        path: zod_1.z.string(),
    }),
    taste: zod_1.z.object({
        generated: zod_1.z.boolean(),
        confidence: zod_1.z.number(),
    }),
    ontology: zod_1.z.object({
        generated: zod_1.z.boolean(),
        domainCount: zod_1.z.number(),
    }),
});
// GET /api/project/create/:sessionId/status
exports.GetStatusRequestSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
});
exports.GetStatusResponseSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    projectId: zod_1.z.string(),
    status: exports.SessionStatusSchema,
    currentStep: zod_1.z.number(),
    progress: zod_1.z.object({
        current: zod_1.z.number(),
        total: zod_1.z.number(),
        percentage: zod_1.z.number(),
    }),
    data: zod_1.z.object({
        name: zod_1.z.string().optional(),
        background: zod_1.z.string().optional(),
        priorities: zod_1.z.array(zod_1.z.string()).optional(),
        workMode: zod_1.z.string().optional(),
    }),
    canResume: zod_1.z.boolean(),
    expiresAt: zod_1.z.string().optional(),
});
// ============================================================================
// Error Types
// ============================================================================
exports.ErrorCodeSchema = zod_1.z.enum([
    'SESSION_NOT_FOUND',
    'SESSION_EXPIRED',
    'INVALID_STEP',
    'INVALID_ANSWER',
    'PROJECT_NAME_REQUIRED',
    'TASTE_GENERATION_FAILED',
    'ONTOLOGY_BUILD_FAILED',
    'STORAGE_ERROR',
]);
exports.ErrorResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(false),
    error: zod_1.z.object({
        code: exports.ErrorCodeSchema,
        message: zod_1.z.string(),
        details: zod_1.z.record(zod_1.z.unknown()).optional(),
    }),
    timestamp: zod_1.z.string(),
});
// ============================================================================
// Question Configuration
// ============================================================================
exports.PROJECT_CREATION_QUESTIONS = [
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
exports.WORK_MODE_SYMBIOSIS_PRESETS = {
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
exports.PRIORITY_TASTE_STANDARDS_PRESETS = {
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
function validateStartProjectCreationRequest(data) {
    return exports.StartProjectCreationRequestSchema.parse(data);
}
function validateSubmitAnswerRequest(data) {
    return exports.SubmitAnswerRequestSchema.parse(data);
}
function validateCompleteCreationRequest(data) {
    return exports.CompleteCreationRequestSchema.parse(data);
}
function validateProjectCreationSession(data) {
    return exports.ProjectCreationSessionSchema.parse(data);
}
// ============================================================================
// Factory Functions
// ============================================================================
/**
 * Create a new project creation session
 */
function createProjectCreationSession(params) {
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
function getQuestionForStep(step) {
    return exports.PROJECT_CREATION_QUESTIONS.find(q => q.step === step);
}
/**
 * Calculate progress percentage
 */
function calculateProgress(currentStep, totalSteps = 4) {
    return Math.round((currentStep / totalSteps) * 100);
}
