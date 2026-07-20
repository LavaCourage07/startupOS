/**
 * Culture Detection Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CultureSessionService, getSessionService } from '../services/CultureSessionService';
import { CultureDetectionService, getDetectionService } from '../services/CultureDetectionService';
import { CultureDetectionError, ERROR_CODES, createUserTasteProfile } from '../types';
import { promises as fs } from 'fs';
import path from 'path';

// Test directories
const TEST_SESSIONS_DIR = path.join(process.cwd(), 'data', 'culture', 'sessions');
const TEST_TASTE_DIR = path.join(process.cwd(), 'data', 'taste', 'users');

describe('CultureSessionService', () => {
  let sessionService: CultureSessionService;

  beforeEach(async () => {
    // Create a fresh instance for each test
    sessionService = new CultureSessionService();
    // Ensure directory exists
    await sessionService.initialize();
  });

  afterEach(async () => {
    // Cleanup test sessions - only delete files created during this test run
    // Don't delete the entire directory to avoid race conditions
    try {
      const files = await fs.readdir(TEST_SESSIONS_DIR).catch(() => []);
      const now = Date.now();
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(TEST_SESSIONS_DIR, file);
          const stats = await fs.stat(filePath).catch(() => null);
          // Only delete files older than 5 seconds (from previous test runs)
          if (stats && now - stats.mtimeMs > 5000) {
            await fs.unlink(filePath).catch(() => {});
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('createSession', () => {
    it('should create a new session with default settings', async () => {
      const session = await sessionService.createSession('test-user-1');

      expect(session.sessionId).toBeDefined();
      expect(session.sessionId).toMatch(/^culture-/);
      expect(session.userId).toBe('test-user-1');
      expect(session.status).toBe('active');
      expect(session.currentTurn).toBe(0);
      expect(session.maxTurns).toBe(3);
      expect(session.messages).toEqual([]);
      expect(session.dialogueHistory).toEqual([]);
    });

    it('should create a session with custom maxTurns', async () => {
      const session = await sessionService.createSession('test-user-2', undefined, 5);

      expect(session.maxTurns).toBe(5);
    });

    it('should clamp maxTurns to valid range', async () => {
      const session1 = await sessionService.createSession('test-user-3', undefined, 10);
      expect(session1.maxTurns).toBe(5); // Max is 5

      const session2 = await sessionService.createSession('test-user-4', undefined, 1);
      expect(session2.maxTurns).toBe(3); // Min is 3
    });

    it('should create a session with projectId', async () => {
      const session = await sessionService.createSession('test-user-5', 'project-123');

      expect(session.projectId).toBe('project-123');
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      const created = await sessionService.createSession('test-user-6');
      const retrieved = await sessionService.getSession(created.sessionId);

      expect(retrieved.sessionId).toBe(created.sessionId);
      expect(retrieved.userId).toBe('test-user-6');
    });

    it('should throw SESSION_NOT_FOUND for non-existent session', async () => {
      await expect(sessionService.getSession('non-existent')).rejects.toThrow(CultureDetectionError);
      await expect(sessionService.getSession('non-existent')).rejects.toHaveProperty('code', ERROR_CODES.SESSION_NOT_FOUND);
    });
  });

  describe('addMessage', () => {
    it('should add a message and return the next question', async () => {
      const session = await sessionService.createSession('test-user-7');
      const result = await sessionService.addMessage(session.sessionId, 'I am working on a web application');

      expect(result.turn).toBe(1);
      expect(result.isComplete).toBe(false);
      expect(result.nextQuestion).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('should track turns correctly', async () => {
      const session = await sessionService.createSession('test-user-8', undefined, 3);

      // Turn 0 -> 1
      const result1 = await sessionService.addMessage(session.sessionId, 'Web application');
      expect(result1.turn).toBe(1);
      expect(result1.isComplete).toBe(false);

      // Turn 1 -> 2
      const result2 = await sessionService.addMessage(session.sessionId, 'Frontend development');
      expect(result2.turn).toBe(2);
      expect(result2.isComplete).toBe(false);

      // Turn 2 -> 3 (complete)
      const result3 = await sessionService.addMessage(session.sessionId, 'I value maintainability');
      expect(result3.turn).toBe(3);
      expect(result3.isComplete).toBe(true);
      expect(result3.nextQuestion).toBeUndefined();
    });

    it('should store messages in session', async () => {
      const session = await sessionService.createSession('test-user-9');
      await sessionService.addMessage(session.sessionId, 'Test message');

      const updated = await sessionService.getSession(session.sessionId);
      expect(updated.messages).toHaveLength(1);
      expect(updated.messages[0].role).toBe('user');
      expect(updated.messages[0].content).toBe('Test message');
    });

    it('should throw INVALID_TURN on turn mismatch', async () => {
      const session = await sessionService.createSession('test-user-10');
      await expect(
        sessionService.addMessage(session.sessionId, 'Test', 5)
      ).rejects.toHaveProperty('code', ERROR_CODES.INVALID_TURN);
    });
  });

  describe('isReadyForAnalysis', () => {
    it('should return false for new session', async () => {
      const session = await sessionService.createSession('test-user-11');
      expect(sessionService.isReadyForAnalysis(session)).toBe(false);
    });

    it('should return true after 60% completion', async () => {
      const session = await sessionService.createSession('test-user-12', undefined, 3);
      await sessionService.addMessage(session.sessionId, 'First message');
      await sessionService.addMessage(session.sessionId, 'Second message');

      const updated = await sessionService.getSession(session.sessionId);
      expect(sessionService.isReadyForAnalysis(updated)).toBe(true);
    });
  });

  describe('markAsAnalyzing', () => {
    it('should change status to analyzing', async () => {
      const session = await sessionService.createSession('test-user-13');
      await sessionService.markAsAnalyzing(session.sessionId);

      const updated = await sessionService.getSession(session.sessionId);
      expect(updated.status).toBe('analyzing');
    });

    it('should throw INVALID_STATE for non-active session', async () => {
      const session = await sessionService.createSession('test-user-14');
      await sessionService.markAsAnalyzing(session.sessionId);

      await expect(
        sessionService.markAsAnalyzing(session.sessionId)
      ).rejects.toHaveProperty('code', ERROR_CODES.INVALID_STATE);
    });
  });
});

describe('CultureDetectionService', () => {
  let sessionService: CultureSessionService;
  let detectionService: CultureDetectionService;

  beforeEach(async () => {
    sessionService = new CultureSessionService();
    detectionService = new CultureDetectionService();
    await sessionService.initialize();
  });

  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(TEST_SESSIONS_DIR, { recursive: true, force: true });
      await fs.rm(TEST_TASTE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('analyzeDialogue', () => {
    it('should analyze dialogue and return taste profile', async () => {
      const session = await sessionService.createSession('test-user-20');

      // Add some dialogue
      await sessionService.addMessage(session.sessionId, 'I am building a web application with React');
      await sessionService.addMessage(session.sessionId, 'I focus on frontend development and clean code');
      await sessionService.addMessage(session.sessionId, 'I value maintainability and simplicity');

      // Analyze
      const result = await detectionService.analyzeDialogue(session.sessionId);

      expect(result.tasteProfile).toBeDefined();
      expect(result.tasteProfile.userId).toBe('test-user-20');
      expect(result.tasteProfile.experience_topology).toBeDefined();
      expect(result.tasteProfile.taste_standards).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.evidenceQuotes).toBeDefined();
      expect(result.cultureLayer).toBeDefined();
      expect(result.tasteDraftId).toBeDefined();
    });

    it('should extract experience topology from dialogue', async () => {
      const session = await sessionService.createSession('test-user-21');

      await sessionService.addMessage(session.sessionId, 'I work on mobile apps with Flutter');
      await sessionService.addMessage(session.sessionId, 'I develop enterprise systems');
      await sessionService.addMessage(session.sessionId, 'I care about test coverage');

      const result = await detectionService.analyzeDialogue(session.sessionId);

      expect(result.tasteProfile.experience_topology.length).toBeGreaterThan(0);
    });

    it('should extract taste standards from dialogue', async () => {
      const session = await sessionService.createSession('test-user-22');

      await sessionService.addMessage(session.sessionId, 'I value clean code and maintainability');
      await sessionService.addMessage(session.sessionId, 'I dislike over-engineered solutions');
      await sessionService.addMessage(session.sessionId, 'I prefer simple designs');

      const result = await detectionService.analyzeDialogue(session.sessionId);

      expect(result.tasteProfile.taste_standards).toBeDefined();
      expect(result.tasteProfile.taste_standards.development).toBeDefined();
    });

    it('should save taste profile to file', async () => {
      const session = await sessionService.createSession('test-user-23');

      await sessionService.addMessage(session.sessionId, 'Web development with React');
      await sessionService.addMessage(session.sessionId, 'I care about performance');
      await sessionService.addMessage(session.sessionId, 'Simple and clean code');

      await detectionService.analyzeDialogue(session.sessionId);

      // Check if profile file was created
      const profilePath = path.join(TEST_TASTE_DIR, 'test-user-23', 'profile.json');
      const exists = await fs.access(profilePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('getTasteDraft', () => {
    it('should return taste draft after analysis', async () => {
      const session = await sessionService.createSession('test-user-24');

      await sessionService.addMessage(session.sessionId, 'Web development');
      await sessionService.addMessage(session.sessionId, 'Frontend');
      await sessionService.addMessage(session.sessionId, 'Clean code');

      await detectionService.analyzeDialogue(session.sessionId);
      const draft = await detectionService.getTasteDraft(session.sessionId);

      expect(draft.tasteProfile).toBeDefined();
      expect(draft.confidence).toBeGreaterThanOrEqual(0);
      expect(draft.evidenceQuotes).toBeDefined();
    });

    it('should throw ANALYSIS_NOT_COMPLETE for incomplete session', async () => {
      const session = await sessionService.createSession('test-user-25');

      await expect(detectionService.getTasteDraft(session.sessionId)).rejects.toHaveProperty(
        'code',
        ERROR_CODES.ANALYSIS_NOT_COMPLETE
      );
    });
  });
});

describe('createUserTasteProfile', () => {
  it('should create a profile with defaults', () => {
    const profile = createUserTasteProfile({ userId: 'test-user' });

    expect(profile.userId).toBe('test-user');
    expect(profile.version).toBe('1.0.0');
    expect(profile.experience_topology).toEqual([]);
    expect(profile.taste_standards).toEqual({});
    expect(profile.tension_position.control_level).toBe(0.5);
    expect(profile.metadata.confidence).toBe(0.5);
  });

  it('should create a profile with custom values', () => {
    const profile = createUserTasteProfile({
      userId: 'test-user-2',
      projectId: 'project-1',
      experience_topology: ['web-development'],
      taste_standards: {
        development: {
          positive_vibes: ['clean code'],
          negative_vibes: ['complexity'],
        },
      },
      tension_position: {
        control_level: 0.7,
      },
      confidence: 0.8,
    });

    expect(profile.projectId).toBe('project-1');
    expect(profile.experience_topology).toEqual(['web-development']);
    expect(profile.taste_standards.development.positive_vibes).toEqual(['clean code']);
    expect(profile.tension_position.control_level).toBe(0.7);
    expect(profile.metadata.confidence).toBe(0.8);
  });
});
