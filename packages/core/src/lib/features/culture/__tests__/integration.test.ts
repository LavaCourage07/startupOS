/**
 * API Integration Tests for Culture Detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

// Test directories
const TEST_SESSIONS_DIR = path.join(process.cwd(), 'data', 'culture', 'sessions');
const TEST_TASTE_DIR = path.join(process.cwd(), 'data', 'taste', 'users');

describe('Culture Detection API Integration', () => {
  beforeEach(async () => {
    // Ensure directories exist
    await fs.mkdir(TEST_SESSIONS_DIR, { recursive: true });
    await fs.mkdir(TEST_TASTE_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup after each test
    try {
      const files = await fs.readdir(TEST_SESSIONS_DIR).catch(() => []);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(TEST_SESSIONS_DIR, file)).catch(() => {});
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Full detection flow', () => {
    it('should complete the full detection flow', async () => {
      // Create fresh service instances
      const { CultureSessionService } = await import('../services/CultureSessionService');
      const { CultureDetectionService } = await import('../services/CultureDetectionService');

      const sessionService = new CultureSessionService();
      const detectionService = new CultureDetectionService(undefined, sessionService);

      await sessionService.initialize();

      // 1. Start session
      const session = await sessionService.createSession('integration-test-user');
      expect(session.sessionId).toBeDefined();
      expect(session.status).toBe('active');

      // 2. Get first question
      const firstQuestion = await sessionService.getFirstQuestion(session.sessionId);
      expect(firstQuestion).toContain('欢迎使用 OriginOS');

      // 3. Dialogue flow
      const responses = [
        '我正在开发一个企业级 Web 应用',
        '主要负责前端开发和架构设计',
        '我重视代码的可维护性和简洁性',
      ];

      for (let i = 0; i < responses.length; i++) {
        const result = await sessionService.addMessage(session.sessionId, responses[i]);
        expect(result.turn).toBe(i + 1);

        if (i < responses.length - 1) {
          expect(result.isComplete).toBe(false);
        }
      }

      // 4. Verify session is ready for analysis
      const sessionAfterDialogue = await sessionService.getSession(session.sessionId);
      expect(sessionService.isReadyForAnalysis(sessionAfterDialogue)).toBe(true);

      // 5. Analyze dialogue
      const analysisResult = await detectionService.analyzeDialogue(session.sessionId);
      expect(analysisResult.tasteProfile).toBeDefined();
      expect(analysisResult.tasteProfile.experience_topology.length).toBeGreaterThan(0);
      expect(analysisResult.confidence).toBeGreaterThan(0);

      // 6. Get taste draft
      const draft = await detectionService.getTasteDraft(session.sessionId);
      expect(draft.tasteProfile).toBeDefined();
      expect(draft.tasteProfile.userId).toBe('integration-test-user');
    });
  });
});
