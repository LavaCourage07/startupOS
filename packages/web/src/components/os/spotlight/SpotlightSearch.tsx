/**
 * OS.4: Spotlight Search Input Component
 */
/* eslint-disable react/function-component-definition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable import/order */

'use client';

import * as React from 'react';

import { useSpotlightStore } from '@/store/spotlightStore';

export default function SpotlightSearch() {
  const { query, setQuery } = useSpotlightStore();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="搜索应用、项目、Agent、技能..."
      className="w-full bg-transparent px-5 py-4 text-lg text-white outline-none placeholder-white/50"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
    />
  );
}
