/**
 * EventStore interface — abstract event persistence.
 */

import type { RuntimeEvent } from "./types";

export interface EventStore {
  /** Append an event to the store (append-only, immutable) */
  append(event: RuntimeEvent): Promise<void>;

  /**
   * Read events for a session.
   * If cursor is provided, returns only events with seq > cursor (incremental read).
   */
  read(sessionId: string, cursor?: number): Promise<RuntimeEvent[]>;

  /** Save a checkpoint so incremental reads know where to resume from */
  checkpoint(sessionId: string, seq: number): Promise<void>;

  /** List all session IDs in the store */
  list(): Promise<string[]>;
}
