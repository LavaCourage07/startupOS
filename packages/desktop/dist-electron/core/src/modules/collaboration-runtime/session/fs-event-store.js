"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FsEventStore = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const paths_1 = require("../../../lib/paths");
const DATA_FILE_VERSION = "1.0.0";
const BASE_DIR = path_1.default.join((0, paths_1.getDataRoot)(), "projects");
class FsEventStore {
    constructor(baseDir = BASE_DIR) {
        this.baseDir = baseDir;
        /** Per-session write queue — serialises concurrent appends for the same session. */
        this.writeQueues = new Map();
    }
    append(event) {
        // Streaming token fragments have no replay value — skip persistence.
        if (event.type === "MESSAGE_SENT")
            return Promise.resolve();
        const { sessionId } = event;
        const prev = this.writeQueues.get(sessionId) ?? Promise.resolve();
        // Chain the new write onto the tail of the queue.
        // The `.catch(() => {})` on the stored promise prevents a failed write from
        // blocking all subsequent writes for this session.
        const next = prev.then(() => this._doAppend(event));
        this.writeQueues.set(sessionId, next.catch(() => { }));
        // Return the actual promise (with rejection) so callers that await can handle errors.
        return next;
    }
    async read(sessionId, cursor) {
        const filePath = path_1.default.join(this.sessionDir(sessionId), "events.jsonl");
        try {
            const content = await promises_1.default.readFile(filePath, "utf-8");
            const lines = content
                .split("\n")
                .filter((line) => line.trim().length > 0);
            const events = lines
                .map((line) => JSON.parse(line))
                // Filter MESSAGE_SENT for backward-compatibility with existing JSONL files.
                .filter((e) => e.type !== "MESSAGE_SENT");
            if (cursor !== undefined) {
                return events.filter((e) => e.seq > cursor);
            }
            return events;
        }
        catch {
            return [];
        }
    }
    async checkpoint(sessionId, seq) {
        const dir = this.sessionDir(sessionId);
        await promises_1.default.mkdir(dir, { recursive: true });
        const checkpointPath = path_1.default.join(dir, "events.checkpoint.json");
        const now = new Date().toISOString();
        // Check if checkpoint already exists (for createdAt preservation)
        let createdAt = now;
        try {
            const existing = await promises_1.default.readFile(checkpointPath, "utf-8");
            const parsed = JSON.parse(existing);
            createdAt = parsed.createdAt;
        }
        catch {
            // File doesn't exist, use current time
        }
        const dataFile = {
            version: DATA_FILE_VERSION,
            createdAt,
            updatedAt: now,
            data: {
                cursor: seq,
                timestamp: now,
            },
        };
        await promises_1.default.writeFile(checkpointPath, JSON.stringify(dataFile, null, 2) + "\n", "utf-8");
    }
    async list() {
        try {
            const entries = await promises_1.default.readdir(this.baseDir, { withFileTypes: true });
            return entries
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name);
        }
        catch {
            return [];
        }
    }
    // ── Private ────────────────────────────────────────────────────────────────
    async _doAppend(event) {
        const dir = this.sessionDir(event.sessionId);
        await promises_1.default.mkdir(dir, { recursive: true });
        const line = JSON.stringify(event) + "\n";
        await promises_1.default.appendFile(path_1.default.join(dir, "events.jsonl"), line, "utf-8");
    }
    sessionDir(sessionId) {
        return path_1.default.join(this.baseDir, sessionId);
    }
}
exports.FsEventStore = FsEventStore;
