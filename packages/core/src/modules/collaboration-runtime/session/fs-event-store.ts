/**
 * Filesystem EventStore — JSONL append-only persistence.
 *
 * Storage layout:
 *   data/projects/{projectId}/collaboration-sessions/{sessionId}/events.jsonl
 *   data/projects/{projectId}/collaboration-sessions/{sessionId}/events.checkpoint.json
 *
 * Concurrency model:
 *   Each session has its own write queue (Promise chain), so concurrent append()
 *   calls for the same session are serialised. Different sessions run in parallel.
 *   A rejection in one write does NOT poison the queue for subsequent writes.
 *
 * MESSAGE_SENT filtering:
 *   Streaming token fragments (MESSAGE_SENT) are never persisted — they have no
 *   replay value and would bloat the JSONL file. Existing files that contain them
 *   are filtered on read for backward compatibility.
 */

import fs from "fs/promises";
import path from "path";
import type { RuntimeEvent } from "./types";
import type { EventStore } from "./event-store";
import { getDataRoot } from '../../../lib/paths';

interface DataFile {
  version: string;
  createdAt: string;
  updatedAt: string;
  data: unknown;
}

interface CheckpointData {
  cursor: number;
  timestamp: string;
}

const DATA_FILE_VERSION = "1.0.0";
const BASE_DIR = path.join(getDataRoot(), "projects");

export class FsEventStore implements EventStore {
  /** Per-session write queue — serialises concurrent appends for the same session. */
  private readonly writeQueues = new Map<string, Promise<void>>();

  constructor(private baseDir: string = BASE_DIR) {}

  append(event: RuntimeEvent): Promise<void> {
    // Streaming token fragments have no replay value — skip persistence.
    if (event.type === "MESSAGE_SENT") return Promise.resolve();

    const { sessionId } = event;
    const prev = this.writeQueues.get(sessionId) ?? Promise.resolve();

    // Chain the new write onto the tail of the queue.
    // The `.catch(() => {})` on the stored promise prevents a failed write from
    // blocking all subsequent writes for this session.
    const next = prev.then(() => this._doAppend(event));
    this.writeQueues.set(sessionId, next.catch(() => {}));

    // Return the actual promise (with rejection) so callers that await can handle errors.
    return next;
  }

  async read(sessionId: string, cursor?: number): Promise<RuntimeEvent[]> {
    const filePath = path.join(this.sessionDir(sessionId), "events.jsonl");

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content
        .split("\n")
        .filter((line) => line.trim().length > 0);

      const events = lines
        .map((line) => JSON.parse(line) as RuntimeEvent)
        // Filter MESSAGE_SENT for backward-compatibility with existing JSONL files.
        .filter((e) => e.type !== "MESSAGE_SENT");

      if (cursor !== undefined) {
        return events.filter((e) => e.seq > cursor);
      }
      return events;
    } catch {
      return [];
    }
  }

  async checkpoint(sessionId: string, seq: number): Promise<void> {
    const dir = this.sessionDir(sessionId);
    await fs.mkdir(dir, { recursive: true });

    const checkpointPath = path.join(dir, "events.checkpoint.json");
    const now = new Date().toISOString();

    // Check if checkpoint already exists (for createdAt preservation)
    let createdAt = now;
    try {
      const existing = await fs.readFile(checkpointPath, "utf-8");
      const parsed = JSON.parse(existing) as DataFile;
      createdAt = parsed.createdAt;
    } catch {
      // File doesn't exist, use current time
    }

    const dataFile: DataFile = {
      version: DATA_FILE_VERSION,
      createdAt,
      updatedAt: now,
      data: {
        cursor: seq,
        timestamp: now,
      } satisfies CheckpointData,
    };

    await fs.writeFile(checkpointPath, JSON.stringify(dataFile, null, 2) + "\n", "utf-8");
  }

  async list(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _doAppend(event: RuntimeEvent): Promise<void> {
    const dir = this.sessionDir(event.sessionId);
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify(event) + "\n";
    await fs.appendFile(path.join(dir, "events.jsonl"), line, "utf-8");
  }

  private sessionDir(sessionId: string): string {
    return path.join(this.baseDir, sessionId);
  }
}
