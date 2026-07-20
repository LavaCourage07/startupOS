"use strict";
/**
 * CollaborationRuntimeDeps — external dependency injection interface.
 *
 * Module internal code MUST NOT import from `src/lib/` or `src/components/`.
 * All external services are injected via this interface at construction time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationRuntime = void 0;
// ============================================================================
// CollaborationRuntime — module entry point
// ============================================================================
class CollaborationRuntime {
    constructor(deps) {
        this.deps = deps;
        this.sessions = new Map();
    }
    createSession(session) {
        this.sessions.set(session.id, session);
    }
    getSession(id) {
        return this.sessions.get(id);
    }
    listSessions() {
        return Array.from(this.sessions.values());
    }
}
exports.CollaborationRuntime = CollaborationRuntime;
