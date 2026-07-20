/**
 * Story C.5: Step 1 - Project Background
 */

'use client';

import { Question } from '@originos/core/types';

interface StepBackgroundProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onSkip: () => void;
  question?: Question;
}

export function StepBackground({
  value,
  onChange,
  onNext,
  onSkip,
  question,
}: StepBackgroundProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
      e.preventDefault();
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      {/* Question */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {question?.text || '这个项目主要是做什么的？'}
        </h2>
        {question?.hint && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            💡 {question.hint}
          </p>
        )}
      </div>

      {/* Input */}
      <div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={question?.placeholder || '例如：给电商网站做库存管理系统...'}
          className="w-full h-32 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          rows={4}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {value.length} 字符
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4">
        <button
          onClick={onSkip}
          className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          跳过此步
        </button>
        <button
          onClick={onNext}
          disabled={!value.trim()}
          className="px-6 py-2 bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          下一步 →
        </button>
      </div>
    </div>
  );
}
