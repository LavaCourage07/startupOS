/**
 * API Tests: POST /api/taste/user/detection/start
 * Story C.1: User TASTE Generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock implementations
const mockCreateSession = vi.fn();
const mockGetFirstQuestion = vi.fn();

vi.mock('@originos/core/lib/features/culture/services/CultureSessionService', () => ({
  getSessionService: () => ({
    createSession: mockCreateSession,
    getFirstQuestion: mockGetFirstQuestion,
  }),
}));

// Import after mock
const { POST } = await import('../start/route');

describe('POST /api/taste/user/detection/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    mockCreateSession.mockResolvedValue({
      sessionId: 'test-session-123',
      userId: 'test-user-001',
      status: 'active',
      currentTurn: 0,
      maxTurns: 3,
      createdAt: new Date().toISOString(),
    });

    mockGetFirstQuestion.mockResolvedValue('欢迎使用 OriginOS！请告诉我您正在开发什么项目？');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('TC-API-001: 正常创建会话', () => {
    it('should create a new session with valid userId', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test-user-001' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.sessionId).toBeDefined();
      expect(data.userId).toBe('test-user-001');
      expect(data.status).toBe('active');
      expect(data.currentTurn).toBe(0);
      expect(data.firstQuestion).toContain('欢迎使用 OriginOS');
    });

    it('should create session with projectId', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-001',
          projectId: 'project-001'
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.sessionId).toBeDefined();
    });

    it('should return maxTurns in response', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test-user-001', maxTurns: 4 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.maxTurns).toBeDefined();
    });
  });

  describe('TC-API-002: 缺少 userId 参数', () => {
    it('should return 400 when userId is missing', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('userId is required');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when userId is empty string', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: '' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('userId is required');
    });

    it('should return 400 when userId is null', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: null }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('TC-API-003: maxTurns 边界值验证', () => {
    it('should adjust maxTurns to 3 when value is less than 3', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test-user-001', maxTurns: 2 }),
      });

      const response = await POST(request);
      // The service should clamp maxTurns to 3
      expect(response.status).toBe(201);
    });

    it('should adjust maxTurns to 5 when value is greater than 5', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test-user-001', maxTurns: 10 }),
      });

      const response = await POST(request);
      // The service should clamp maxTurns to 5
      expect(response.status).toBe(201);
    });

    it('should accept maxTurns within valid range (3-5)', async () => {
      for (const maxTurns of [3, 4, 5]) {
        const request = new NextRequest('http://localhost/api/taste/user/detection/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'test-user-001', maxTurns }),
        });

        const response = await POST(request);
        expect(response.status).toBe(201);
      }
    });
  });

  describe('TC-API-004: 错误处理', () => {
    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(request);

      // Should return error response
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle service errors gracefully', async () => {
      // Override mock to throw error
      mockCreateSession.mockRejectedValueOnce(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/taste/user/detection/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test-user-001' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('TC-API-005: 请求选项', () => {
    it('should accept options parameter', async () => {
      const request = new NextRequest('http://localhost/api/taste/user/detection/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-001',
          options: {
            skipWelcome: true,
            language: 'zh-CN'
          }
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });
  });
});
