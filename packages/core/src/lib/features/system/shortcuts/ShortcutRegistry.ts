/**
 * OS.8: Shortcut Registry
 */

import { ShortcutConfig } from './types';

export class ShortcutRegistry {
  private shortcuts = new Map<string, ShortcutConfig[]>();
  private activeContext: string | null = null;

  register(id: string, config: ShortcutConfig): () => void {
    const key = this.getKey(config);
    const existing = this.shortcuts.get(key) || [];

    const conflict = existing.find(s => s.context === config.context);
    if (conflict) {
      console.warn(`快捷键冲突: ${key} 在 ${config.context}`);
    }

    existing.push(config);
    existing.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    this.shortcuts.set(key, existing);

    return () => this.unregister(key, config);
  }

  private getKey(config: ShortcutConfig): string {
    const parts = [];
    if (config.ctrl) parts.push('ctrl');
    if (config.meta) parts.push('meta');
    if (config.shift) parts.push('shift');
    if (config.alt) parts.push('alt');
    parts.push(config.key.toLowerCase());
    return parts.join('+');
  }

  handle(e: KeyboardEvent): boolean {
    const key = this.getKeyFromEvent(e);
    const shortcuts = this.shortcuts.get(key) || [];

    for (const shortcut of shortcuts) {
      if (shortcut.context && shortcut.context !== this.activeContext) {
        continue;
      }

      shortcut.handler(e);
      return true;
    }

    return false;
  }

  setContext(context: string | null): void {
    this.activeContext = context;
  }

  private getKeyFromEvent(e: KeyboardEvent): string {
    const parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.metaKey) parts.push('meta');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  private unregister(key: string, config: ShortcutConfig): void {
    const shortcuts = this.shortcuts.get(key);
    if (shortcuts) {
      const filtered = shortcuts.filter(s => s !== config);
      this.shortcuts.set(key, filtered);
    }
  }
}

export const shortcutRegistry = new ShortcutRegistry();
