/**
 * OS.4: Spotlight Store (Zustand)
 */

import { create } from 'zustand';
import type { SpotlightState, SpotlightItem } from '@originos/core/types';

export const useSpotlightStore = create<SpotlightState>((set, get) => ({
  isOpen: false,
  query: '',
  selectedIndex: 0,
  results: [],
  items: [],

  open: () => set({ isOpen: true, query: '', selectedIndex: 0 }),

  toggle: () => {
    const { isOpen } = get();
    if (isOpen) {
      set({ isOpen: false, query: '', selectedIndex: 0, results: [] });
      return;
    }
    set({ isOpen: true, query: '', selectedIndex: 0 });
  },

  close: () => set({ isOpen: false, query: '', selectedIndex: 0, results: [] }),

  setQuery: (query: string) => set({ query, selectedIndex: 0 }),

  setSelectedIndex: (index: number) => set({ selectedIndex: index }),

  setResults: (results: SpotlightItem[]) => set({ results, selectedIndex: 0 }),

  setItems: (items: SpotlightItem[]) => set({ items }),

  executeSelected: async () => {
    const { results, selectedIndex } = get();
    const selected = results[selectedIndex];
    if (selected) {
      await selected.action();
      get().close();
    }
  },

  selectNext: () => {
    const { selectedIndex, results } = get();
    if (results.length > 0) {
      set({ selectedIndex: (selectedIndex + 1) % results.length });
    }
  },

  selectPrevious: () => {
    const { selectedIndex, results } = get();
    if (results.length > 0) {
      set({ selectedIndex: selectedIndex === 0 ? results.length - 1 : selectedIndex - 1 });
    }
  },
}));
