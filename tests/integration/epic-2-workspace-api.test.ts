import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3000/api';
const TEST_PROJECT_ID = 'test-workspace-api';
const TEST_FILES_DIR = path.join(process.cwd(), 'data', 'projects', TEST_PROJECT_ID, 'files');

describe('Epic 2: Workspace API Integration Tests', () => {
  beforeAll(async () => {
    // Create test project directory
    await fs.mkdir(TEST_FILES_DIR, { recursive: true });

    // Create test files
    await fs.writeFile(
      path.join(TEST_FILES_DIR, 'test1.md'),
      '# Test File 1\n\nContent 1'
    );
    await fs.writeFile(
      path.join(TEST_FILES_DIR, 'test2.md'),
      '# Test File 2\n\nContent 2'
    );
  });

  afterAll(async () => {
    // Cleanup test files
    try {
      await fs.rm(path.join(process.cwd(), 'data', 'projects', TEST_PROJECT_ID), {
        recursive: true,
        force: true,
      });
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  describe('GET /api/projects/[id]/files', () => {
    it('should list all files in project', async () => {
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.files).toBeInstanceOf(Array);
      expect(result.data.files.length).toBeGreaterThanOrEqual(2);
      expect(result.data.total).toBeGreaterThanOrEqual(2);
    });

    it('should return files sorted by modified time (newest first)', async () => {
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files`);
      const result = await response.json();

      const files = result.data.files;
      if (files.length > 1) {
        expect(files[0].modifiedAt).toBeGreaterThanOrEqual(files[1].modifiedAt);
      }
    });

    it('should include file metadata (name, size, type, extension)', async () => {
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files`);
      const result = await response.json();

      const file = result.data.files[0];
      expect(file).toHaveProperty('id');
      expect(file).toHaveProperty('name');
      expect(file).toHaveProperty('size');
      expect(file).toHaveProperty('type');
      expect(file).toHaveProperty('extension');
      expect(file).toHaveProperty('modifiedAt');
      expect(file).toHaveProperty('createdAt');
    });
  });

  describe('GET /api/projects/[id]/files/[...path]', () => {
    it('should read file content', async () => {
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files/test1.md`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.file).toBeDefined();
      expect(result.data.content).toContain('Test File 1');
    });

    it('should return 404 for non-existent file', async () => {
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files/nonexistent.md`);
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should reject path traversal attempts', async () => {
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files/../../../etc/passwd`);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PATH');
    });
  });

  describe('POST /api/projects/[id]/files', () => {
    it('should create new file', async () => {
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'new-file.md',
          content: '# New File\n\nNew content',
        }),
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('new-file.md');
      expect(result.data.type).toBe('file');
    });

    it('should add .md extension if not provided', async () => {
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'no-extension',
          content: 'Content',
        }),
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data.name).toBe('no-extension.md');
    });

    it('should return 409 for duplicate file name', async () => {
      // Create file first
      await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'duplicate.md', content: 'Content' }),
      });

      // Try to create again
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'duplicate.md', content: 'Content' }),
      });
      const result = await response.json();

      expect(response.status).toBe(409);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_EXISTS');
    });

    it('should return 400 for missing file name', async () => {
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Content' }),
      });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
    });
  });

  describe('PUT /api/projects/[id]/files/[...path]', () => {
    it('should update file content', async () => {
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files/test1.md`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# Updated Content\n\nNew text' }),
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.content).toContain('Updated Content');
    });

    it('should return 400 for missing content', async () => {
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files/test1.md`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
    });
  });

  describe('DELETE /api/projects/[id]/files/[...path]', () => {
    it('should delete file', async () => {
      // Create file to delete
      await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'to-delete.md', content: 'Delete me' }),
      });

      // Delete it
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files/to-delete.md`, {
        method: 'DELETE',
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.deleted).toBe(true);

      // Verify file is gone
      const checkResponse = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files/to-delete.md`);
      expect(checkResponse.status).toBe(404);
    });

    it('should return 404 for non-existent file', async () => {
      const response = await fetch(`${API_BASE}/projects/${TEST_PROJECT_ID}/files/nonexistent.md`, {
        method: 'DELETE',
      });
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
    });
  });
});
