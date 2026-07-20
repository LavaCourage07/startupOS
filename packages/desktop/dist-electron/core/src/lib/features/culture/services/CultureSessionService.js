"use strict";
/**
 * Culture Session Service
 * Manages user taste detection dialogue sessions
 *
 * Aligned with docs/specs/epic-C/story-C.1/api-design.md
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CultureSessionService = void 0;
exports.getSessionService = getSessionService;
const types_1 = require("../types");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
// ============================================================================
// Constants
// ============================================================================
/**
 * Session storage path
 */
const paths_1 = require("../../../paths");
const SESSIONS_DIR = path_1.default.join((0, paths_1.getDataRoot)(), 'culture', 'sessions');
const SESSION_FILE_PATTERN = (sessionId) => path_1.default.join(SESSIONS_DIR, `${sessionId}.json`);
/**
 * Default max turns for dialogue
 */
const DEFAULT_MAX_TURNS = 3;
/**
 * Dialogue questions for taste extraction
 * Designed to avoid abstract questions and extract implicit taste signals
 */
const DIALOGUE_QUESTIONS = [
    {
        turn: 0,
        question: "欢迎使用 OriginOS！让我们互相了解一下，这样我能更好地为你服务。\n\n最近在做什么类型的项目？（比如：Web 应用、移动应用、数据平台...）",
        signal_targets: ['experience_topology', 'domain_focus'],
    },
    {
        turn: 1,
        question: "了解了。在这个项目中，你主要负责哪个部分？（比如：前端开发、架构设计、全栈、测试...）",
        signal_targets: ['experience_topology', 'role_preference'],
    },
    {
        turn: 2,
        question: "好的。在开发这个项目时，你觉得什么样的做法或特点是你更关注的？（不用太详细，比如：可维护性、性能、简洁...）",
        signal_targets: ['taste_standards', 'tension_position'],
    },
    {
        turn: 3,
        question: "最后一个问题：当你遇到技术选择时，你通常更倾向于什么样的方案？或者说你对什么样的方案更有感觉？",
        signal_targets: ['taste_standards', 'tension_position', 'symbiosis_boundary'],
    },
];
// ============================================================================
// Culture Session Service
// ============================================================================
class CultureSessionService {
    /**
     * Initialize sessions directory
     */
    async initialize() {
        await fs_1.promises.mkdir(SESSIONS_DIR, { recursive: true });
    }
    /**
     * Create a new detection session
     */
    async createSession(userId, projectId, maxTurns = DEFAULT_MAX_TURNS) {
        const sessionId = `culture-${crypto_1.default.randomUUID()}`;
        const session = (0, types_1.createCultureDetectionSession)({
            sessionId,
            userId,
            projectId,
            maxTurns: Math.max(3, Math.min(5, maxTurns)),
        });
        await this.saveSession(session);
        return session;
    }
    /**
     * Get session by ID
     */
    async getSession(sessionId) {
        const sessionPath = SESSION_FILE_PATTERN(sessionId);
        try {
            const data = await fs_1.promises.readFile(sessionPath, 'utf-8');
            const session = JSON.parse(data);
            // Normalize status/state
            if (!session.status && session.state) {
                session.status = session.state;
            }
            return session;
        }
        catch (error) {
            throw new types_1.CultureDetectionError(types_1.ERROR_CODES.SESSION_NOT_FOUND, `Session not found: ${sessionId}`, { sessionId });
        }
    }
    /**
     * Save session
     */
    async saveSession(session) {
        await this.initialize();
        const sessionPath = SESSION_FILE_PATTERN(session.sessionId);
        session.updatedAt = new Date().toISOString();
        // Keep status and state in sync
        if (session.status) {
            session.state = session.status;
        }
        else if (session.state) {
            session.status = session.state;
        }
        await fs_1.promises.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
    }
    /**
     * Get first question for a new session
     */
    async getFirstQuestion(sessionId) {
        const session = await this.getSession(sessionId);
        if (session.status !== 'active') {
            throw new types_1.CultureDetectionError(types_1.ERROR_CODES.INVALID_STATE, `Session is not active: ${session.status}`, { sessionId, status: session.status });
        }
        return DIALOGUE_QUESTIONS[0].question;
    }
    /**
     * Get next question for the session
     */
    async getNextQuestion(sessionId) {
        const session = await this.getSession(sessionId);
        if (session.status !== 'active') {
            throw new types_1.CultureDetectionError(types_1.ERROR_CODES.INVALID_STATE, `Session is not active: ${session.status}`, { sessionId, status: session.status });
        }
        if (session.currentTurn >= (session.maxTurns ?? DEFAULT_MAX_TURNS)) {
            return "感谢你的分享！我已经了解了你的风格。";
        }
        const questionData = DIALOGUE_QUESTIONS[session.currentTurn];
        return questionData?.question ?? "感谢你的分享！";
    }
    /**
     * Add user message and get response
     */
    async addMessage(sessionId, content, turn) {
        const session = await this.getSession(sessionId);
        if (session.status !== 'active') {
            throw new types_1.CultureDetectionError(types_1.ERROR_CODES.INVALID_STATE, `Session is not active: ${session.status}`, { sessionId, status: session.status });
        }
        // Validate turn if provided
        if (turn !== undefined && turn !== session.currentTurn) {
            throw new types_1.CultureDetectionError(types_1.ERROR_CODES.INVALID_TURN, `Turn mismatch: expected ${session.currentTurn}, got ${turn}`, { sessionId, expectedTurn: session.currentTurn, actualTurn: turn });
        }
        // Get current question for this turn
        const currentQuestion = DIALOGUE_QUESTIONS[session.currentTurn];
        // Create message entry
        const timestamp = new Date().toISOString();
        const messageId = `msg-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}`;
        // Add user message to messages array
        if (!session.messages) {
            session.messages = [];
        }
        session.messages.push({
            id: messageId,
            role: 'user',
            content,
            turn: session.currentTurn + 1,
            timestamp,
        });
        // Add to dialogue history (legacy format)
        if (!session.dialogueHistory) {
            session.dialogueHistory = [];
        }
        session.dialogueHistory.push({
            turn: session.currentTurn,
            question: currentQuestion?.question ?? '',
            userResponse: content,
            timestamp,
        });
        // Advance turn
        session.currentTurn += 1;
        // Check if dialogue is complete
        const maxTurns = session.maxTurns ?? DEFAULT_MAX_TURNS;
        const isComplete = session.currentTurn >= maxTurns;
        let responseMessage;
        let nextQuestion;
        if (isComplete) {
            responseMessage = "感谢你的分享！我现在已经了解了你的风格偏好。\n\n正在分析你的回答...";
            session.status = 'active'; // Still active, ready for analysis
        }
        else {
            const nextQuestionData = DIALOGUE_QUESTIONS[session.currentTurn];
            nextQuestion = nextQuestionData?.question;
            responseMessage = nextQuestion ?? "请继续...";
        }
        await this.saveSession(session);
        return {
            message: responseMessage,
            nextQuestion: isComplete ? undefined : nextQuestion,
            isComplete,
            turn: session.currentTurn,
        };
    }
    /**
     * Check if session is ready for analysis
     */
    isReadyForAnalysis(session) {
        const maxTurns = session.maxTurns ?? DEFAULT_MAX_TURNS;
        const minTurns = Math.ceil(maxTurns * 0.6); // At least 60% completion
        const userMessageCount = session.messages?.filter(m => m.role === 'user').length ??
            session.dialogueHistory?.length ?? 0;
        return userMessageCount >= minTurns;
    }
    /**
     * Mark session as analyzing
     */
    async markAsAnalyzing(sessionId) {
        const session = await this.getSession(sessionId);
        if (session.status !== 'active') {
            throw new types_1.CultureDetectionError(types_1.ERROR_CODES.INVALID_STATE, `Cannot mark as analyzing from state: ${session.status}`, { sessionId, status: session.status });
        }
        session.status = 'analyzing';
        session.state = 'analyzing';
        session.updatedAt = new Date().toISOString();
        await this.saveSession(session);
    }
    /**
     * Store analysis result
     */
    async storeAnalysisResult(sessionId, tasteProfile, confidence, evidenceQuotes, cultureLayer) {
        const session = await this.getSession(sessionId);
        if (session.status !== 'analyzing') {
            throw new types_1.CultureDetectionError(types_1.ERROR_CODES.INVALID_STATE, `Cannot store analysis result from state: ${session.status}`, { sessionId, status: session.status });
        }
        const tasteDraftId = `taste-${session.userId}-${Date.now()}`;
        // Store in legacy format
        session.analysisResult = {
            tasteProfile: tasteProfile,
            confidence,
            evidenceQuotes,
        };
        // Store in new format
        if (cultureLayer) {
            session.cultureLayer = cultureLayer;
        }
        session.tasteDraftId = tasteDraftId;
        session.status = 'completed';
        session.state = 'completed';
        session.completedAt = new Date().toISOString();
        session.updatedAt = new Date().toISOString();
        await this.saveSession(session);
        return tasteDraftId;
    }
    /**
     * Get session for taste analysis
     */
    async getSessionForAnalysis(sessionId) {
        const session = await this.getSession(sessionId);
        return {
            dialogueHistory: session.dialogueHistory ?? [],
            messages: session.messages ?? [],
            userId: session.userId,
            projectId: session.projectId,
        };
    }
    /**
     * Delete session
     */
    async deleteSession(sessionId) {
        const sessionPath = SESSION_FILE_PATTERN(sessionId);
        try {
            await fs_1.promises.unlink(sessionPath);
        }
        catch (error) {
            throw new types_1.CultureDetectionError(types_1.ERROR_CODES.SESSION_NOT_FOUND, `Session not found: ${sessionId}`, { sessionId });
        }
    }
    /**
     * Cleanup old sessions
     */
    async cleanupOldSessions(olderThanHours = 24) {
        const now = Date.now();
        const cutoffTime = now - (olderThanHours * 60 * 60 * 1000);
        let deletedCount = 0;
        try {
            await this.initialize();
            const files = await fs_1.promises.readdir(SESSIONS_DIR);
            for (const file of files) {
                if (!file.endsWith('.json'))
                    continue;
                const filePath = path_1.default.join(SESSIONS_DIR, file);
                const stats = await fs_1.promises.stat(filePath);
                if (stats.mtimeMs < cutoffTime) {
                    await fs_1.promises.unlink(filePath);
                    deletedCount++;
                }
            }
        }
        catch (error) {
            // Ignore errors if directory doesn't exist
        }
        return deletedCount;
    }
}
exports.CultureSessionService = CultureSessionService;
// ============================================================================
// Singleton
// ============================================================================
let sessionServiceInstance = null;
function getSessionService() {
    if (!sessionServiceInstance) {
        sessionServiceInstance = new CultureSessionService();
    }
    return sessionServiceInstance;
}
