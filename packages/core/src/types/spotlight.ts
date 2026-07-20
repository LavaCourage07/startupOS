/**
 * OS.4: Spotlight Types
 */

export enum SpotlightItemType {
  APP = 'app',
  COMMAND = 'command',
  AGENT = 'agent',
}

export interface SpotlightItem {
  id: string;
  type: SpotlightItemType;
  title: string;
  subtitle?: string;
  icon: string;
  shortcut?: string;
  action: () => void | Promise<void>;
  keywords?: string[];
  metadata?: Record<string, unknown>;
}

export interface SpotlightState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  results: SpotlightItem[];
  items: SpotlightItem[];

  // Actions
  open: () => void;
  toggle: () => void;
  close: () => void;
  setQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;
  setResults: (results: SpotlightItem[]) => void;
  setItems: (items: SpotlightItem[]) => void;
  executeSelected: () => void;
  selectNext: () => void;
  selectPrevious: () => void;
}
