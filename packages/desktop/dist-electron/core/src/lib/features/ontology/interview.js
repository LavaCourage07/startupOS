"use strict";
/**
 * Interview Module
 *
 * Handles interview session management, question flow, and answer collection.
 * Story 1.2: Structured Interview Question Collection
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.interviewService = exports.InterviewService = void 0;
const json_store_1 = require("../../storage/json-store");
const uuid_1 = require("uuid");
/**
 * Interview Service
 */
class InterviewService {
    constructor() {
        this.store = json_store_1.jsonStore;
    }
    /**
     * Create a new interview session
     */
    async createInterview(projectId, skipOptional = false) {
        const { getCoreQuestions, getAllInterviewQuestions } = await Promise.resolve().then(() => __importStar(require('./types')));
        const questions = skipOptional ? getCoreQuestions() : getAllInterviewQuestions();
        const interviewId = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const interview = {
            id: interviewId,
            projectId,
            questions,
            answers: {},
            currentQuestionIndex: 0,
            status: 'in_progress',
            createdAt: now,
            updatedAt: now,
        };
        const interviewData = {
            version: '1.0.0',
            createdAt: now,
            updatedAt: now,
            data: interview,
        };
        await this.store.write(this.store.getInterviewPath(interviewId), interviewData);
        return interview;
    }
    /**
     * Get interview by ID
     */
    async getInterview(interviewId) {
        const interviewData = await this.store.read(this.store.getInterviewPath(interviewId));
        return interviewData?.data ?? null;
    }
    /**
     * Get all interviews for a project
     */
    async getProjectInterviews(projectId) {
        const files = await this.store.listFiles(this.store.getInterviewPath('').replace(/[^/]*\.json$/, ''));
        const interviews = [];
        for (const file of files) {
            const interviewId = file.replace('.json', '');
            const interview = await this.getInterview(interviewId);
            if (interview?.projectId === projectId) {
                interviews.push(interview);
            }
        }
        return interviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    /**
     * Submit answer to a question
     */
    async submitAnswer(interviewId, questionId, answer) {
        const interview = await this.getInterview(interviewId);
        if (!interview) {
            throw new Error(`Interview ${interviewId} not found`);
        }
        const question = interview.questions[parseInt(questionId)] || interview.questions.find(q => q.id === questionId);
        if (!question) {
            throw new Error(`Question ${questionId} not found`);
        }
        const answerData = {
            questionId,
            answer,
            timestamp: Date.now(),
        };
        interview.answers[questionId] = answerData;
        interview.updatedAt = new Date().toISOString();
        // Move to next question unless it's optional and skipped
        if (this.shouldAdvanceQuestion(interview, questionId)) {
            interview.currentQuestionIndex = this.getNextQuestionIndex(interview);
        }
        await this.saveInterview(interview);
        return interview;
    }
    /**
     * Submit multiple answers at once
     */
    async submitAnswers(interviewId, answers) {
        const interview = await this.getInterview(interviewId);
        if (!interview) {
            throw new Error(`Interview ${interviewId} not found`);
        }
        const now = Date.now();
        for (const [questionId, answer] of Object.entries(answers)) {
            const answerData = {
                questionId,
                answer,
                timestamp: now,
            };
            interview.answers[questionId] = answerData;
        }
        interview.updatedAt = new Date().toISOString();
        interview.currentQuestionIndex = this.getNextQuestionIndex(interview);
        await this.saveInterview(interview);
        return interview;
    }
    /**
     * Get current question
     */
    async getCurrentQuestion(interviewId) {
        const interview = await this.getInterview(interviewId);
        if (!interview || interview.status !== 'in_progress') {
            return null;
        }
        return interview.questions[interview.currentQuestionIndex] ?? null;
    }
    /**
     * Navigate to specific question
     */
    async goToQuestion(interviewId, index) {
        const interview = await this.getInterview(interviewId);
        if (!interview) {
            throw new Error(`Interview ${interviewId} not found`);
        }
        if (index < 0 || index >= interview.questions.length) {
            throw new Error(`Invalid question index: ${index}`);
        }
        interview.currentQuestionIndex = index;
        interview.updatedAt = new Date().toISOString();
        await this.saveInterview(interview);
        return interview;
    }
    /**
     * Complete interview
     */
    async completeInterview(interviewId) {
        const interview = await this.getInterview(interviewId);
        if (!interview) {
            throw new Error(`Interview ${interviewId} not found`);
        }
        // Validate all required questions are answered
        const requiredQuestions = interview.questions.filter(q => q.required);
        const unansweredRequired = requiredQuestions.filter(q => !interview.answers[q.id]?.answer);
        if (unansweredRequired.length > 0) {
            throw new Error(`Cannot complete interview: ${unansweredRequired.length} required questions unanswered`);
        }
        interview.status = 'completed';
        interview.completedAt = new Date().toISOString();
        interview.updatedAt = new Date().toISOString();
        await this.saveInterview(interview);
        return interview;
    }
    /**
     * Skip interview
     */
    async skipInterview(interviewId) {
        const interview = await this.getInterview(interviewId);
        if (!interview) {
            throw new Error(`Interview ${interviewId} not found`);
        }
        interview.status = 'skipped';
        interview.updatedAt = new Date().toISOString();
        await this.saveInterview(interview);
        return interview;
    }
    /**
     * Get interview progress
     */
    async getProgress(interviewId) {
        const interview = await this.getInterview(interviewId);
        if (!interview) {
            return { answered: 0, total: 0, percentage: 0 };
        }
        const answered = Object.keys(interview.answers).length;
        const total = interview.questions.length;
        const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;
        return { answered, total, percentage };
    }
    /**
     * Delete interview
     */
    async deleteInterview(interviewId) {
        return this.store.delete(this.store.getInterviewPath(interviewId));
    }
    /**
     * Save interview to store
     */
    async saveInterview(interview) {
        const interviewData = {
            version: '1.0.0',
            createdAt: interview.createdAt,
            updatedAt: interview.updatedAt,
            data: interview,
        };
        await this.store.write(this.store.getInterviewPath(interview.id), interviewData);
    }
    /**
     * Check if we should advance to next question
     */
    shouldAdvanceQuestion(interview, questionId) {
        // Skip questions without required answers
        const question = interview.questions.find(q => q.id === questionId);
        if (question && !question.required) {
            const answer = interview.answers[questionId]?.answer;
            // Skip if answer is empty or not provided
            if (!answer || (Array.isArray(answer) && answer.length === 0)) {
                return true;
            }
        }
        return true;
    }
    /**
     * Get next question index
     */
    getNextQuestionIndex(interview) {
        // Find first unanswered question
        for (let i = 0; i < interview.questions.length; i++) {
            if (!interview.answers[interview.questions[i].id]?.answer) {
                return i;
            }
        }
        // All questions answered
        return interview.questions.length;
    }
}
exports.InterviewService = InterviewService;
/**
 * Export singleton instance
 */
exports.interviewService = new InterviewService();
