/**
 * Interview Module
 *
 * Handles interview session management, question flow, and answer collection.
 * Story 1.2: Structured Interview Question Collection
 */

import type {
  InterviewQuestion,
  InterviewSession,
  InterviewSessionData,
  QuestionAnswer,
  InterviewStatus,
} from './types';
import { jsonStore } from '../../storage/json-store';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interview Service
 */
export class InterviewService {
  private store = jsonStore;

  /**
   * Create a new interview session
   */
  async createInterview(
    projectId: string,
    skipOptional: boolean = false,
  ): Promise<InterviewSession> {
    const { getCoreQuestions, getAllInterviewQuestions } = await import('./types');

    const questions = skipOptional ? getCoreQuestions() : getAllInterviewQuestions();
    const interviewId = uuidv4();
    const now = new Date().toISOString();

    const interview: InterviewSession = {
      id: interviewId,
      projectId,
      questions,
      answers: {},
      currentQuestionIndex: 0,
      status: 'in_progress' as InterviewStatus,
      createdAt: now,
      updatedAt: now,
    };

    const interviewData: InterviewSessionData = {
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
  async getInterview(interviewId: string): Promise<InterviewSession | null> {
    const interviewData = await this.store.read<InterviewSession>(
      this.store.getInterviewPath(interviewId),
    );

    return interviewData?.data ?? null;
  }

  /**
   * Get all interviews for a project
   */
  async getProjectInterviews(projectId: string): Promise<InterviewSession[]> {
    const files = await this.store.listFiles(this.store.getInterviewPath('').replace(/[^/]*\.json$/, ''));

    const interviews: InterviewSession[] = [];

    for (const file of files) {
      const interviewId = file.replace('.json', '');
      const interview = await this.getInterview(interviewId);
      if (interview?.projectId === projectId) {
        interviews.push(interview);
      }
    }

    return interviews.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Submit answer to a question
   */
  async submitAnswer(
    interviewId: string,
    questionId: string,
    answer: string | string[],
  ): Promise<InterviewSession> {
    const interview = await this.getInterview(interviewId);
    if (!interview) {
      throw new Error(`Interview ${interviewId} not found`);
    }

    const question = interview.questions[parseInt(questionId) as keyof typeof interview.questions] || interview.questions.find(q => q.id === questionId);
    if (!question) {
      throw new Error(`Question ${questionId} not found`);
    }

    const answerData: QuestionAnswer = {
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
  async submitAnswers(
    interviewId: string,
    answers: Record<string, string | string[]>,
  ): Promise<InterviewSession> {
    const interview = await this.getInterview(interviewId);
    if (!interview) {
      throw new Error(`Interview ${interviewId} not found`);
    }

    const now = Date.now();

    for (const [questionId, answer] of Object.entries(answers)) {
      const answerData: QuestionAnswer = {
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
  async getCurrentQuestion(interviewId: string): Promise<InterviewQuestion | null> {
    const interview = await this.getInterview(interviewId);
    if (!interview || interview.status !== 'in_progress') {
      return null;
    }

    return interview.questions[interview.currentQuestionIndex] ?? null;
  }

  /**
   * Navigate to specific question
   */
  async goToQuestion(interviewId: string, index: number): Promise<InterviewSession> {
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
  async completeInterview(interviewId: string): Promise<InterviewSession> {
    const interview = await this.getInterview(interviewId);
    if (!interview) {
      throw new Error(`Interview ${interviewId} not found`);
    }

    // Validate all required questions are answered
    const requiredQuestions = interview.questions.filter(q => q.required);
    const unansweredRequired = requiredQuestions.filter(
      q => !interview.answers[q.id]?.answer,
    );

    if (unansweredRequired.length > 0) {
      throw new Error(
        `Cannot complete interview: ${unansweredRequired.length} required questions unanswered`,
      );
    }

    interview.status = 'completed' as InterviewStatus;
    interview.completedAt = new Date().toISOString();
    interview.updatedAt = new Date().toISOString();

    await this.saveInterview(interview);

    return interview;
  }

  /**
   * Skip interview
   */
  async skipInterview(interviewId: string): Promise<InterviewSession> {
    const interview = await this.getInterview(interviewId);
    if (!interview) {
      throw new Error(`Interview ${interviewId} not found`);
    }

    interview.status = 'skipped' as InterviewStatus;
    interview.updatedAt = new Date().toISOString();

    await this.saveInterview(interview);

    return interview;
  }

  /**
   * Get interview progress
   */
  async getProgress(interviewId: string): Promise<{
    answered: number;
    total: number;
    percentage: number;
  }> {
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
  async deleteInterview(interviewId: string): Promise<boolean> {
    return this.store.delete(this.store.getInterviewPath(interviewId));
  }

  /**
   * Save interview to store
   */
  private async saveInterview(interview: InterviewSession): Promise<void> {
    const interviewData: InterviewSessionData = {
      version: '1.0.0',
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt,
      data: interview,
    };

    await this.store.write(
      this.store.getInterviewPath(interview.id),
      interviewData,
    );
  }

  /**
   * Check if we should advance to next question
   */
  private shouldAdvanceQuestion(
    interview: InterviewSession,
    questionId: string,
  ): boolean {
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
  private getNextQuestionIndex(interview: InterviewSession): number {
    // Find first unanswered question
    for (let i = 0; i < interview.questions.length; i++) {
      if (!interview.answers[interview.questions[i]!.id]?.answer) {
        return i;
      }
    }

    // All questions answered
    return interview.questions.length;
  }
}

/**
 * Export singleton instance
 */
export const interviewService = new InterviewService();
