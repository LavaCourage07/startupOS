/**
 * OS.4: Spotlight Main Component
 */
/* eslint-disable react/function-component-definition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable import/order */

'use client';

import { useEffect } from 'react';
import { useSpotlight } from '@/hooks/useSpotlight';
import { useSpotlightSearch } from '@/hooks/useSpotlightSearch';
import { useSpotlightStore } from '@/store/spotlightStore';
import type { SpotlightItem } from '@originos/core/types';

import SpotlightResults from './SpotlightResults';
import SpotlightSearch from './SpotlightSearch';

interface SpotlightProps {
  items?: SpotlightItem[];
}

export default function Spotlight({ items: providedItems }: SpotlightProps = {}) {
  const { isOpen, close } = useSpotlight();
  const items = useSpotlightStore((state) => state.items);
  const setItems = useSpotlightStore((state) => state.setItems);

  useEffect(() => {
    if (providedItems) {
      setItems(providedItems);
    }
  }, [providedItems, setItems]);

  useSpotlightSearch(items);

  // Return invisible placeholder when closed to keep component mounted
  // This ensures useGlobalShortcut listeners remain active
  if (!isOpen) {
    return <div className="hidden" aria-hidden="true" />;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={close}
    >
      <div
        className="w-full max-w-2xl bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <SpotlightSearch />
        <div className="border-t border-white/20" />
        <SpotlightResults />
      </div>
    </div>
  );
}
