/**
 * OS.8: Shortcut System Types
 */

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (e: KeyboardEvent) => void;
  priority?: number;
  context?: string;
}
