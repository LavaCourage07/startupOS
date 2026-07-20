/**
 * API Tests: POST /api/taste/user/detection/:sessionId/message
 * Story C.1: User TASTE Generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Create mock functions that can be controlled in tests
const mockGetSession = vi.fn();
const mockAddMessage = vi.fn();
const mockIsReadyForAnalysis = vi.fn();

vi.mock('@originos/core/lib/features/culture/services/CultureSessionService', () => ({
  getSessionService: () => ({
    getSession: mockGetSession,
    addMessage: mockAddMessage,
    isReadyForAnalysis: mockIsReadyForAnalysis,
  }),
}));

// Default mock session
const defaultMockSession = {
  sessionId: 'test-session-123',
  userId: 'test-user-001',
  status: 'active',
  currentTurn: 1,
  maxTurns: 3,
};

describe('POST /api/taste/user/detection/:sessionId/message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mocks
    mockGetSession.mockResolvedValue(defaultMockSession);
    mockAddMessage.mockResolvedValue({
      message: '接下来，请告诉我您在项目中主要承担什么角色？',
      turn: 2,
      isComplete: false,
      nextQuestion: '接下来，请告诉我您在项目中主要承担什么角色？',
    });
    mockIsReadyForAnalysis.mockReturnValue(false);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('TC-API-004: 正常发送消息', () => {
    it('should send message successfully', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/test-session-123/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '我正在开发一个企业级 Web 应用',
          turn: 1
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ sessionId: 'test-session-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBe('test-session-123');
      expect(data.message).toBeDefined();
      expect(data.turn).toBe(2);
      expect(data.role).toBe('assistant');
    });

    it('should return nextQuestion when session continues', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/test-session-123/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '测试消息',
          turn: 1
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ sessionId: 'test-session-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.suggestedNextQuestion).toBeDefined();
      expect(data.nextAction).toBe('continue');
    });

    it('should return isComplete when max turns reached', async () => {
      mockGetSession.mockResolvedValueOnce({ ...defaultMockSession, currentTurn: 3 });
      mockAddMessage.mockResolvedValueOnce({
        message: '感谢您的回答，我们已完成所有问题。',
        turn: 3,
        isComplete: true,
        nextQuestion: null,
      });
      mockIsReadyForAnalysis.mockReturnValueOnce(true);

      const request = new NextRequest('http://localhost/api/taste/user/detection/test-session-123/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '最后一条消息',
          turn: 3
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ sessionId: 'test-session-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isComplete).toBe(true);
      expect(data.nextAction).toBe('analyze');
    });
  });

  describe('TC-API-005: 会话不存在', () => {
    it('should return 404 when session not found', async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/taste/user/detection/nonexistent-session/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '测试消息',
          turn: 1
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ sessionId: 'nonexistent-session' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Session not found');
      expect(data.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('TC-API-006: 消息内容验证', () => {
    it('should return 400 when content is missing', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/test-session-123/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turn: 1 }),
      });

      const response = await POST(request, { params: Promise.resolve({ sessionId: 'test-session-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Message content is required');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when content is empty string', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/test-session-123/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '', turn: 1 }),
      });

      const response = await POST(request, { params: Promise.resolve({ sessionId: 'test-session-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      // The actual validation message from the route
      expect(data.error).toBeDefined();
    });

    it('should return 400 when content exceeds 2000 characters', async () => {
      const longContent = 'a'.repeat(2001);
      const request = new NextRequest('http://localhost/api/taste/user/detection/test-session-123/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: longContent, turn: 1 }),
      });

      const response = await POST(request, { params: Promise.resolve({ sessionId: 'test-session-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should accept content with exactly 2000 characters', async () => {
      const maxContent = 'a'.repeat(2000);
      const request = new NextRequest('http://localhost/api/taste/user/detection/test-session-123/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: maxContent, turn: 1 }),
      });

      const response = await POST(request, { params: Promise.resolve({ sessionId: 'test-session-123' }) });
      expect(response.status).toBe(200);
    });
  });

  describe('TC-API-007: 会话状态检查', () => {
    it('should return 409 when session is already completed', async () => {
      mockGetSession.mockResolvedValueOnce({ ...defaultMockSession, status: 'completed' });

      const request = new NextRequest('http://localhost/api/taste/user/detection/test-session-123/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '测试消息', turn: 1 }),
      });

      const response = await POST(request, { params: Promise.resolve({ sessionId: 'test-session-123' }) });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Session already completed');
      expect(data.code).toBe('SESSION_ALREADY_COMPLETED');
    });

    it('should return 409 when session is analyzing', async () => {
      mockGetSession.mockResolvedValueOnce({ ...defaultMockSession, status: 'analyzing' });

      const request = new NextRequest('http://localhost/api/taste/user/detection/test-session-123/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '测试消息', turn: 1 }),
      });

      const response = await POST(request, { params: Promise.resolve({ sessionId: 'test-session-123' }) });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Session is analyzing');
      expect(data.code).toBe('ANALYSIS_IN_PROGRESS');
    });
  });
});
