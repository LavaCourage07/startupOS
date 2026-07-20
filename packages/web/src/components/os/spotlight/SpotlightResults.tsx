/**
 * OS.4: Spotlight Results Component
 */
/* eslint-disable react/function-component-definition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */

'use client';

import { useSpotlightStore } from '@/store/spotlightStore';
import { SpotlightItemType } from '@originos/core/types';

const TYPE_LABELS: Record<SpotlightItemType, string> = {
  [SpotlightItemType.APP]: '应用',
  [SpotlightItemType.COMMAND]: '命令',
  [SpotlightItemType.AGENT]: 'Agent',
};

export default function SpotlightResults() {
  const { results, selectedIndex, setSelectedIndex, executeSelected } = useSpotlightStore();

  if (results.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-white/50">
        没有匹配结果
      </div>
    );
  }

  const handleClick = (index: number) => {
    setSelectedIndex(index);
    executeSelected();
  };

  return (
    <div className="max-h-96 overflow-y-auto">
      {results.map((item, index) => (
        <div
          key={item.id}
          onClick={() => handleClick(index)}
          className={`flex cursor-pointer items-center gap-3 border-l-2 px-4 py-3 transition-colors ${
            index === selectedIndex
              ? 'bg-white/20 border-blue-400'
              : 'hover:bg-white/10 border-transparent'
          }`}
        >
          <span className="text-2xl">{item.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium text-white">{item.title}</div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/45">
                {TYPE_LABELS[item.type]}
              </span>
            </div>
            {item.subtitle && (
              <div className="text-white/60 text-sm">{item.subtitle}</div>
            )}
          </div>
          {item.shortcut && (
            <div className="text-white/40 text-xs">{item.shortcut}</div>
          )}
        </div>
      ))}
    </div>
  );
}
