"use strict";
/**
 * Story C.5: Project Creation Service
 * Manages project creation session state and coordinates question flow
 *
 * @see docs/specs/epic-C/story-C.5/api-design.md
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectCreationService = exports.ProjectCreationService = void 0;
const crypto_1 = require("crypto");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const project_creation_1 = require("../../../types/project-creation");
const taste_1 = require("../../../types/taste");
const paths_1 = require("../../paths");
// Data storage paths
const DATA_DIR = (0, paths_1.getDataRoot)();
const SESSIONS_DIR = path_1.default.join(DATA_DIR, 'sessions', 'project-creation');
const PROJECTS_DIR = path_1.default.join(DATA_DIR, 'projects');
const TASTE_PROJECTS_DIR = path_1.default.join(DATA_DIR, 'taste', 'projects');
const ONTOLOGIES_DIR = path_1.default.join(DATA_DIR, 'ontologies');
/**
 * Ensure directory exists
 */
async function ensureDir(dir) {
    try {
        await promises_1.default.mkdir(dir, { recursive: true });
    }
    catch (error) {
        // Directory already exists
    }
}
/**
 * Generate unique IDs
 */
function generateSessionId() {
    return `pc_${(0, crypto_1.randomUUID)()}`;
}
function generateProjectId() {
    return `proj_${(0, crypto_1.randomUUID)()}`;
}
/**
 * Project Creation Service
 */
class ProjectCreationService {
    constructor(sessionsDir) {
        this.sessionsDir = sessionsDir ?? SESSIONS_DIR;
    }
    /**
     * Start a new project creation session
     */
    async startSession(request) {
        await ensureDir(this.sessionsDir);
        const sessionId = generateSessionId();
        const projectId = generateProjectId();
        const session = (0, project_creation_1.createProjectCreationSession)({
            sessionId,
            projectId,
            userId: request.userId,
            projectName: request.projectName,
        });
        // Apply default values if provided
        if (request.defaultValues) {
            if (request.defaultValues.background) {
                session.data.background = request.defaultValues.background;
            }
            if (request.defaultValues.priorities && request.defaultValues.priorities.length > 0) {
                session.data.priorities = request.defaultValues.priorities;
            }
            if (request.defaultValues.workMode) {
                session.data.workMode = request.defaultValues.workMode;
            }
        }
        // Save session
        await this.saveSession(session);
        const question = (0, project_creation_1.getQuestionForStep)(1);
        if (!question) {
            throw new Error('Failed to get first question');
        }
        return { session, question };
    }
    /**
     * Get session by ID
     */
    async getSession(sessionId) {
        try {
            const filePath = path_1.default.join(this.sessionsDir, `${sessionId}.json`);
            const data = await promises_1.default.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(data);
            return project_creation_1.ProjectCreationSessionSchema.parse(parsed);
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Save session
     */
    async saveSession(session) {
        await ensureDir(this.sessionsDir);
        const filePath = path_1.default.join(this.sessionsDir, `${session.sessionId}.json`);
        session.updatedAt = new Date().toISOString();
        await promises_1.default.writeFile(filePath, JSON.stringify(session, null, 2));
    }
    /**
     * Get current question for session
     */
    getCurrentQuestion(session) {
        return (0, project_creation_1.getQuestionForStep)(session.currentStep) ?? null;
    }
    /**
     * Submit answer for current step
     */
    async submitAnswer(sessionId, request) {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error('SESSION_NOT_FOUND');
        }
        if (session.status !== 'active') {
            throw new Error('SESSION_NOT_ACTIVE');
        }
        if (session.currentStep !== request.step) {
            throw new Error('INVALID_STEP');
        }
        // Update session data based on step
        await this.processAnswer(session, request);
        // Move to next step
        const nextStep = session.currentStep + 1;
        session.currentStep = Math.min(nextStep, session.maxSteps);
        await this.saveSession(session);
        const nextQuestion = this.getCurrentQuestion(session);
        return { session, nextQuestion };
    }
    /**
     * Process answer and extract TASTE data
     */
    async processAnswer(session, request) {
        const { step, answer } = request;
        switch (step) {
            case 1:
                // Step 1: Project Background -> Extract Experience Topology
                if (answer.type === 'text' && typeof answer.value === 'string') {
                    session.data.background = answer.value;
                    // Extract experience topology from background
                    session.extractedData.experience_topology = this.extractExperienceTopology(answer.value);
                    // Extract context features
                    session.extractedData.context_features = this.extractContextFeatures(answer.value);
                }
                break;
            case 2:
                // Step 2: Priorities -> Extract Taste Standards + Tension Position
                if (answer.type === 'choice' && Array.isArray(answer.value)) {
                    session.data.priorities = answer.value;
                    if (answer.customDescription) {
                        session.data.customDescriptions.priorities = answer.customDescription;
                    }
                    // Extract taste standards
                    session.extractedData.taste_standards = this.extractTasteStandards(answer.value, answer.customDescription);
                    // Extract tension position
                    session.extractedData.tension_position = this.extractTensionPosition(answer.value, answer.customDescription);
                }
                break;
            case 3:
                // Step 3: Work Mode -> Extract Symbiosis Boundary
                if (answer.type === 'choice' && typeof answer.value === 'string') {
                    session.data.workMode = answer.value;
                    if (answer.customDescription) {
                        session.data.customDescriptions.workMode = answer.customDescription;
                    }
                    // Extract symbiosis boundary
                    session.extractedData.symbiosis_boundary = this.extractSymbiosisBoundary(answer.value, answer.customDescription);
                }
                break;
        }
    }
    /**
     * Complete project creation
     */
    async completeCreation(sessionId, request) {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error('SESSION_NOT_FOUND');
        }
        // Update session data with final confirm data
        session.data.name = request.projectName;
        if (request.confirmData.background) {
            session.data.background = request.confirmData.background;
        }
        if (request.confirmData.priorities) {
            session.data.priorities = request.confirmData.priorities;
        }
        if (request.confirmData.workMode) {
            session.data.workMode = request.confirmData.workMode;
        }
        // Generate project ID
        const projectId = session.projectId;
        const now = new Date().toISOString();
        // 1. Create project file
        await ensureDir(PROJECTS_DIR);
        const projectDir = path_1.default.join(PROJECTS_DIR, projectId);
        await ensureDir(projectDir);
        const project = {
            id: projectId,
            name: request.projectName,
            description: session.data.background ?? '',
            domain: session.extractedData.context_features?.domain ?? 'general',
            type: 'web-application',
            ontologyId: `ontology_${projectId}`,
            createdAt: now,
            updatedAt: now,
            lastModified: now,
            userId: session.userId,
            status: 'active',
            color: '#3B82F6', // Default blue
            metadata: {
                workMode: session.data.workMode ?? undefined,
                priorities: session.data.priorities,
                techStack: session.extractedData.context_features?.tech_stack,
            },
        };
        await promises_1.default.writeFile(path_1.default.join(projectDir, 'project.json'), JSON.stringify(project, null, 2));
        // 2. Generate Project TASTE
        const taste = this.generateProjectTASTE(session);
        await ensureDir(TASTE_PROJECTS_DIR);
        const tasteDir = path_1.default.join(TASTE_PROJECTS_DIR, projectId);
        await ensureDir(tasteDir);
        await promises_1.default.writeFile(path_1.default.join(tasteDir, 'profile.json'), JSON.stringify(taste, null, 2));
        // 3. Build initial Ontology
        const ontology = this.buildOntology(session);
        await ensureDir(ONTOLOGIES_DIR);
        const ontologyDir = path_1.default.join(ONTOLOGIES_DIR, projectId);
        await ensureDir(ontologyDir);
        await promises_1.default.writeFile(path_1.default.join(ontologyDir, 'ontology.json'), JSON.stringify(ontology, null, 2));
        // 4. Update session status
        session.status = 'completed';
        session.completedAt = now;
        await this.saveSession(session);
        return {
            project: {
                id: projectId,
                name: request.projectName,
                createdAt: now,
                path: `/projects/${projectId}`,
            },
            taste,
            ontology: { domains: ontology.domains.length },
        };
    }
    /**
     * Extract experience topology from background text
     */
    extractExperienceTopology(background) {
        const keywords = [];
        // Tech stack detection
        const techPatterns = [
            { pattern: /react|next\.?js|vue|angular|svelte/i, value: 'web-development' },
            { pattern: /api|rest|graphql|backend/i, value: 'api-design' },
            { pattern: /typescript|javascript/i, value: 'javascript' },
            { pattern: /python|django|flask/i, value: 'python' },
            { pattern: /node\.?js|express/i, value: 'nodejs' },
            { pattern: /database|sql|mongodb|postgres/i, value: 'database' },
            { pattern: /docker|kubernetes|devops/i, value: 'devops' },
            { pattern: /mobile|ios|android|react native|flutter/i, value: 'mobile-development' },
            { pattern: /ai|machine learning|ml|llm/i, value: 'ai-ml' },
            { pattern: /ecommerce|e-commerce|电商/i, value: 'ecommerce' },
            { pattern: /inventory|库存/i, value: 'inventory-management' },
            { pattern: /crm|customer/i, value: 'crm' },
        ];
        for (const { pattern, value } of techPatterns) {
            if (pattern.test(background)) {
                keywords.push(value);
            }
        }
        // Default if nothing detected
        if (keywords.length === 0) {
            keywords.push('general-development');
        }
        return [...new Set(keywords)];
    }
    /**
     * Extract context features from background text
     */
    extractContextFeatures(background) {
        const techStack = [];
        // Detect tech stack
        const techPatterns = [
            { pattern: /react/i, value: 'React' },
            { pattern: /next\.?js/i, value: 'Next.js' },
            { pattern: /typescript/i, value: 'TypeScript' },
            { pattern: /javascript/i, value: 'JavaScript' },
            { pattern: /node\.?js/i, value: 'Node.js' },
            { pattern: /python/i, value: 'Python' },
            { pattern: /django/i, value: 'Django' },
            { pattern: /postgresql|postgres/i, value: 'PostgreSQL' },
            { pattern: /mongodb/i, value: 'MongoDB' },
        ];
        for (const { pattern, value } of techPatterns) {
            if (pattern.test(background)) {
                techStack.push(value);
            }
        }
        // Detect domain
        let domain = 'general';
        if (/ecommerce|电商|shop|store/i.test(background)) {
            domain = 'ecommerce';
        }
        else if (/inventory|库存/i.test(background)) {
            domain = 'inventory-management';
        }
        else if (/crm|customer/i.test(background)) {
            domain = 'crm';
        }
        else if (/analytics|分析/i.test(background)) {
            domain = 'analytics';
        }
        // Detect task type
        let taskType = 'general';
        if (/api|backend|服务/i.test(background)) {
            taskType = 'backend-integration';
        }
        else if (/frontend|ui|界面/i.test(background)) {
            taskType = 'frontend-development';
        }
        else if (/dashboard|仪表/i.test(background)) {
            taskType = 'dashboard';
        }
        // Detect discourse system
        let discourseSystem = 'mixed';
        const technicalTerms = /api|backend|frontend|database|algorithm/i.test(background);
        const businessTerms = /客户|用户|业务|流程|管理|效率/i.test(background);
        if (technicalTerms && !businessTerms) {
            discourseSystem = 'technical';
        }
        else if (businessTerms && !technicalTerms) {
            discourseSystem = 'business';
        }
        return {
            domain,
            task_type: taskType,
            tech_stack: techStack,
            discourse_system: discourseSystem,
        };
    }
    /**
     * Extract taste standards from priorities
     */
    extractTasteStandards(priorities, customDescription) {
        const result = {};
        for (const priority of priorities) {
            const preset = project_creation_1.PRIORITY_TASTE_STANDARDS_PRESETS[priority];
            if (preset) {
                result[priority] = preset;
            }
        }
        // If custom description provided, add generic entry
        if (customDescription) {
            result['custom'] = {
                positive_vibes: [customDescription.toLowerCase()],
                negative_vibes: ['opposite-of-' + customDescription.toLowerCase()],
            };
        }
        // Default if empty
        if (Object.keys(result).length === 0) {
            result['general'] = {
                positive_vibes: ['clean-code', 'documentation'],
                negative_vibes: ['complexity', 'spaghetti-code'],
            };
        }
        return result;
    }
    /**
     * Extract tension position from priorities
     */
    extractTensionPosition(priorities, _customDescription) {
        let controlLevel = 0.5;
        let trustLevel = 0.5;
        let interventionThreshold = 0.5;
        for (const priority of priorities) {
            switch (priority) {
                case 'velocity':
                    controlLevel += 0.1;
                    trustLevel += 0.15;
                    interventionThreshold -= 0.15;
                    break;
                case 'stability':
                    controlLevel += 0.2;
                    trustLevel -= 0.1;
                    interventionThreshold += 0.2;
                    break;
                case 'maintainability':
                    controlLevel += 0.15;
                    trustLevel += 0.05;
                    interventionThreshold += 0.1;
                    break;
            }
        }
        // Clamp values
        return {
            control_level: Math.max(0, Math.min(1, controlLevel)),
            trust_level: Math.max(0, Math.min(1, trustLevel)),
            intervention_threshold: Math.max(0, Math.min(1, interventionThreshold)),
        };
    }
    /**
     * Extract symbiosis boundary from work mode
     */
    extractSymbiosisBoundary(workMode, _customDescription) {
        // Use preset mapping
        const preset = project_creation_1.WORK_MODE_SYMBIOSIS_PRESETS[workMode];
        if (preset) {
            return preset;
        }
        // Default for custom work mode
        return {
            delegated_domains: ['document-generation'],
            reserved_domains: ['architecture-decisions'],
            contextual_triggers: [],
            control_level: 0.5,
        };
    }
    /**
     * Generate Project TASTE from session data
     */
    generateProjectTASTE(session) {
        const now = new Date().toISOString();
        return (0, taste_1.createTASTEProfile)({
            projectId: session.projectId,
            experience_topology: session.extractedData.experience_topology.length > 0
                ? session.extractedData.experience_topology
                : ['general-development'],
            taste_standards: Object.keys(session.extractedData.taste_standards).length > 0
                ? session.extractedData.taste_standards
                : { general: { positive_vibes: ['clean-code'], negative_vibes: ['complexity'] } },
            tension_position: session.extractedData.tension_position ?? {
                control_level: 0.5,
                trust_level: 0.5,
                intervention_threshold: 0.5,
            },
            symbiosis_boundary: session.extractedData.symbiosis_boundary ?? {
                delegated_domains: ['document-generation'],
                reserved_domains: ['architecture-decisions'],
                contextual_triggers: [],
            },
            metadata: {
                source: 'project',
                confidence: this.calculateConfidence(session),
                evolution_count: 0,
                derived_from_session: session.sessionId,
                last_analysis_at: now,
            },
        });
    }
    /**
     * Calculate confidence based on data completeness
     */
    calculateConfidence(session) {
        let score = 0;
        if (session.data.background)
            score += 0.25;
        if (session.data.priorities.length > 0)
            score += 0.25;
        if (session.data.workMode)
            score += 0.25;
        if (session.data.name)
            score += 0.25;
        return score;
    }
    /**
     * Build initial Ontology from session data
     */
    buildOntology(session) {
        const now = new Date().toISOString();
        const domains = [];
        // Extract domains from experience topology
        const topology = session.extractedData.experience_topology;
        for (let i = 0; i < topology.length; i++) {
            domains.push({
                id: `domain_${i}`,
                name: topology[i] ?? '',
                description: `${topology[i]} domain`,
                confidence: 0.7,
            });
        }
        // Add domain from context features if available
        if (session.extractedData.context_features?.domain) {
            domains.push({
                id: `domain_${domains.length}`,
                name: session.extractedData.context_features.domain,
                description: `Primary project domain: ${session.extractedData.context_features.domain}`,
                confidence: 0.8,
            });
        }
        // Default domain if empty
        if (domains.length === 0) {
            domains.push({
                id: 'domain_0',
                name: 'general',
                description: 'General project domain',
                confidence: 0.5,
            });
        }
        // Generate concepts from domain
        const concepts = [];
        domains.forEach((domain, idx) => {
            concepts.push({
                id: `concept_${idx}_main`,
                domainId: domain.id,
                name: `${domain.name} concept`,
                type: 'entity',
                confidence: 0.6,
            });
        });
        // Generate simple relations
        const relations = [];
        for (let i = 0; i < concepts.length - 1; i++) {
            relations.push({
                id: `rel_${i}`,
                sourceId: concepts[i].id,
                targetId: concepts[i + 1].id,
                type: 'related_to',
                confidence: 0.5,
            });
        }
        return {
            version: '1.0.0',
            projectId: session.projectId,
            domains,
            concepts,
            instances: [],
            relations,
            metadata: {
                derived_from_session: session.sessionId,
                generated_at: now,
                confidence: domains.length > 0 ? 0.7 : 0.5,
            },
            createdAt: now,
            updatedAt: now,
        };
    }
    /**
     * Get session status
     */
    async getSessionStatus(sessionId) {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error('SESSION_NOT_FOUND');
        }
        // Check if expired
        const now = new Date();
        const expiresAt = new Date(session.expiresAt);
        if (now > expiresAt) {
            session.status = 'expired';
            await this.saveSession(session);
        }
        const canResume = session.status === 'active' && now <= expiresAt;
        return { session, canResume };
    }
    /**
     * Delete expired sessions
     */
    async cleanupExpiredSessions() {
        try {
            const files = await promises_1.default.readdir(this.sessionsDir);
            const now = new Date();
            let deletedCount = 0;
            for (const file of files) {
                if (!file.endsWith('.json'))
                    continue;
                const filePath = path_1.default.join(this.sessionsDir, file);
                const data = JSON.parse(await promises_1.default.readFile(filePath, 'utf-8'));
                const expiresAt = new Date(data.expiresAt);
                if (now > expiresAt) {
                    await promises_1.default.unlink(filePath);
                    deletedCount++;
                }
            }
            return deletedCount;
        }
        catch (error) {
            return 0;
        }
    }
}
exports.ProjectCreationService = ProjectCreationService;
// Export singleton instance
exports.projectCreationService = new ProjectCreationService();
