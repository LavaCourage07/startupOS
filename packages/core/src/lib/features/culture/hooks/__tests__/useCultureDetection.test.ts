/**
 * Hook Tests: useCultureDetection
 * Story C.1: User TASTE Generation
 *
 * Note: Tests are isolated to prevent cross-test pollution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCultureDetection } from '../useCultureDetection';

describe('useCultureDetection Hook', () => {
  // Create a fresh mock for each test
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create fresh mock for each test
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe('TC-HOOK-001: 初始化状态', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useCultureDetection());

      expect(result.current.sessionId).toBeNull();
      expect(result.current.currentQuestion).toBeNull();
      expect(result.current.turnCount).toBe(0);
      expect(result.current.isComplete).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.tasteProfile).toBeNull();
      expect(result.current.confidence).toBe(0);
    });

    it('should return all required actions', () => {
      const { result } = renderHook(() => useCultureDetection());

      expect(typeof result.current.startSession).toBe('function');
      expect(typeof result.current.sendMessage).toBe('function');
      expect(typeof result.current.analyzeDialogue).toBe('function');
      expect(typeof result.current.getTasteDraft).toBe('function');
    });
  });

  describe('TC-HOOK-002: startSession 成功', () => {
    it('should start session successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'test-session-123',
          userId: 'test-user-001',
          status: 'active',
          currentTurn: 0,
          maxTurns: 3,
          firstQuestion: '欢迎使用 OriginOS！请告诉我您正在开发什么项目？',
        }),
      });

      const { result } = renderHook(() => useCultureDetection());

      await act(async () => {
        await result.current.startSession('test-user-001');
      });

      expect(result.current.sessionId).toBe('test-session-123');
      expect(result.current.currentQuestion).toBe('欢迎使用 OriginOS！请告诉我您正在开发什么项目？');
      expect(result.current.turnCount).toBe(0);
      expect(result.current.isComplete).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should call onSessionCreated callback', async () => {
      const onSessionCreated = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'test-session-456',
          firstQuestion: '测试问题',
        }),
      });

      const { result } = renderHook(() =>
        useCultureDetection({ onSessionCreated })
      );

      await act(async () => {
        await result.current.startSession('test-user-001');
      });

      expect(onSessionCreated).toHaveBeenCalledWith('test-session-456');
    });

    it('should complete loading state after session creation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session', firstQuestion: 'test' }),
      });

      const { result } = renderHook(() => useCultureDetection());

      await act(async () => {
        await result.current.startSession('test-user-001');
      });

      // After completion, isLoading should be false
      expect(result.current.isLoading).toBe(false);
      expect(result.current.sessionId).toBe('test-session');
    });
  });

  describe('TC-HOOK-003: startSession 错误处理', () => {
    it('should handle startSession error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'userId is required', code: 'VALIDATION_ERROR' }),
      });

      const { result } = renderHook(() => useCultureDetection());

      await act(async () => {
        await result.current.startSession('');
      });

      expect(result.current.error).toBe('userId is required');
      expect(result.current.sessionId).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should call onError callback on error', async () => {
      const onError = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Internal server error' }),
      });

      const { result } = renderHook(() => useCultureDetection({ onError }));

      await act(async () => {
        await result.current.startSession('test-user');
      });

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toBe('Internal server error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useCultureDetection());

      await act(async () => {
        await result.current.startSession('test-user');
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('TC-HOOK-004: sendMessage 成功', () => {
    it('should send message successfully', async () => {
      // First start session
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'test-session-123',
          firstQuestion: '问题 1',
        }),
      });

      // Then send message
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: '下一条问题',
          turn: 2,
          isComplete: false,
          suggestedNextQuestion: '问题 2',
          nextAction: 'continue',
        }),
      });

      const { result } = renderHook(() => useCultureDetection());

      await act(async () => {
        await result.current.startSession('test-user');
      });

      await act(async () => {
        await result.current.sendMessage('测试消息');
      });

      expect(result.current.turnCount).toBe(2);
      expect(result.current.currentQuestion).toBe('问题 2');
      expect(result.current.isComplete).toBe(false);
    });

    it('should set isComplete when max turns reached', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'test-session-123',
          firstQuestion: '问题 1',
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: '对话完成',
          turn: 3,
          isComplete: true,
          suggestedNextQuestion: null,
          nextAction: 'analyze',
        }),
      });

      const { result } = renderHook(() => useCultureDetection());

      await act(async () => {
        await result.current.startSession('test-user');
      });

      await act(async () => {
        await result.current.sendMessage('最后一条消息');
      });

      expect(result.current.isComplete).toBe(true);
    });

    it('should complete loading after message send', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session', firstQuestion: 'test' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ turn: 1, isComplete: false }),
      });

      const { result } = renderHook(() => useCultureDetection());

      await act(async () => {
        await result.current.startSession('test-user');
      });

      await act(async () => {
        await result.current.sendMessage('test');
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('TC-HOOK-005: sendMessage 无会话', () => {
    it('should return error when no active session', async () => {
      const { result } = renderHook(() => useCultureDetection());

      await act(async () => {
        await result.current.sendMessage('测试消息');
      });

      expect(result.current.error).toBe('No active session');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('TC-HOOK-006: analyzeDialogue 成功', () => {
    it('should analyze dialogue and get taste profile', async () => {
      // Start session
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session', firstQuestion: 'test' }),
      });

      // Analyze
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'test-session',
          status: 'completed',
          cultureLayer: { technology: ['React'] },
          confidence: 0.85,
        }),
      });

      // Get taste draft
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'test-session',
          draft: {
            technology: ['React', 'TypeScript'],
            methodology: ['Agile'],
            domain: ['Web'],
          },
          confidence: 0.92,
        }),
      });

      const onAnalysisComplete = vi.fn();
      const { result } = renderHook(() =>
        useCultureDetection({ onAnalysisComplete })
      );

      await act(async () => {
        await result.current.startSession('test-user');
      });

      await act(async () => {
        await result.current.analyzeDialogue();
      });

      expect(result.current.tasteProfile).toEqual({
        technology: ['React', 'TypeScript'],
        methodology: ['Agile'],
        domain: ['Web'],
      });
      expect(result.current.confidence).toBe(0.92);
      expect(onAnalysisComplete).toHaveBeenCalled();
    });
  });

  describe('TC-HOOK-007: getTasteDraft 成功', () => {
    it('should get taste draft successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session', firstQuestion: 'test' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'test-session',
          draft: {
            technology: ['React'],
            methodology: ['TDD'],
            preferences: { codeStyle: 'functional' },
          },
          confidence: 0.88,
          isComplete: true,
        }),
      });

      const { result } = renderHook(() => useCultureDetection());

      await act(async () => {
        await result.current.startSession('test-user');
      });

      await act(async () => {
        await result.current.getTasteDraft();
      });

      expect(result.current.tasteProfile).toEqual({
        technology: ['React'],
        methodology: ['TDD'],
        preferences: { codeStyle: 'functional' },
      });
      expect(result.current.confidence).toBe(0.88);
    });

    it('should handle getTasteDraft without session', async () => {
      const { result } = renderHook(() => useCultureDetection());

      await act(async () => {
        await result.current.getTasteDraft();
      });

      expect(result.current.error).toBe('No active session');
    });

    it('should handle getTasteDraft error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session', firstQuestion: 'test' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Analysis not yet completed' }),
      });

      const { result } = renderHook(() => useCultureDetection());

      await act(async () => {
        await result.current.startSession('test-user');
      });

      await act(async () => {
        await result.current.getTasteDraft();
      });

      expect(result.current.error).toBe('Analysis not yet completed');
      expect(result.current.tasteProfile).toBeNull();
    });
  });

  describe('TC-HOOK-008: 完整流程测试', () => {
    it('should complete full detection flow', async () => {
      // 1. Start session
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'flow-test-session',
          firstQuestion: '问题 1',
        }),
      });

      // 2. Send message 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: '问题 2',
          turn: 1,
          isComplete: false,
          suggestedNextQuestion: '问题 2',
        }),
      });

      // 3. Send message 2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: '问题 3',
          turn: 2,
          isComplete: false,
          suggestedNextQuestion: '问题 3',
        }),
      });

      // 4. Send message 3 (complete)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: '对话完成',
          turn: 3,
          isComplete: true,
          suggestedNextQuestion: null,
        }),
      });

      // 5. Analyze
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          cultureLayer: {},
        }),
      });

      // 6. Get taste draft
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          draft: { technology: ['React'] },
          confidence: 0.9,
        }),
      });

      const { result } = renderHook(() => useCultureDetection());

      // Step 1: Start session
      await act(async () => {
        await result.current.startSession('full-flow-user');
      });
      expect(result.current.sessionId).toBe('flow-test-session');

      // Step 2: Send message 1
      await act(async () => {
        await result.current.sendMessage('回答 1');
      });
      expect(result.current.turnCount).toBe(1);

      // Step 3: Send message 2
      await act(async () => {
        await result.current.sendMessage('回答 2');
      });
      expect(result.current.turnCount).toBe(2);

      // Step 4: Send message 3
      await act(async () => {
        await result.current.sendMessage('回答 3');
      });
      expect(result.current.isComplete).toBe(true);

      // Step 5: Analyze
      await act(async () => {
        await result.current.analyzeDialogue();
      });

      // Step 6: Verify result
      expect(result.current.tasteProfile).toEqual({ technology: ['React'] });
      expect(result.current.confidence).toBe(0.9);
    });
  });

  describe('TC-HOOK-009: 边界情况', () => {
    it('should reset state when starting new session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'session-1',
          firstQuestion: '问题 1',
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'session-2',
          firstQuestion: '新问题',
        }),
      });

      const { result } = renderHook(() => useCultureDetection());

      await act(async () => {
        await result.current.startSession('user-1');
      });

      expect(result.current.sessionId).toBe('session-1');

      // Start new session should reset
      await act(async () => {
        await result.current.startSession('user-2');
      });

      expect(result.current.sessionId).toBe('session-2');
      expect(result.current.turnCount).toBe(0);
      expect(result.current.isComplete).toBe(false);
      expect(result.current.tasteProfile).toBeNull();
    });

    it('should handle concurrent calls gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sessionId: 'concurrent-test', firstQuestion: 'test' }),
      });

      const { result } = renderHook(() => useCultureDetection());

      // Call startSession multiple times concurrently
      await act(async () => {
        await Promise.all([
          result.current.startSession('user-1'),
          result.current.startSession('user-2'),
        ]);
      });

      // Should have one of the results
      expect(result.current.sessionId).toBe('concurrent-test');
    });
  });
});
