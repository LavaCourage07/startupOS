/**
 * Story C.5: Step 2 - Project Priorities
 */

'use client';

import { Question, QuestionOption } from '@originos/core/types';

interface StepPrioritiesProps {
  selected: string[];
  customValue?: string;
  onChange: (selected: string[], custom?: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  question?: Question;
}

const DEFAULT_OPTIONS: QuestionOption[] = [
  { value: 'velocity', label: '快速上线', description: '先把功能做出来，后续再优化' },
  { value: 'stability', label: '稳定可靠', description: '代码质量高，减少 bug 和维护成本' },
  { value: 'maintainability', label: '易于维护', description: '结构清晰，方便后续扩展和团队协作' },
];

export function StepPriorities({
  selected,
  customValue,
  onChange,
  onNext,
  onBack,
  onSkip,
  question,
}: StepPrioritiesProps) {
  const options = question?.options || DEFAULT_OPTIONS;
  const allowMultiple = question?.allowMultiple ?? true;
  const allowCustom = question?.allowCustom ?? true;

  const handleToggle = (value: string) => {
    if (allowMultiple) {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    } else {
      onChange([value]);
    }
  };

  const handleCustomChange = (value: string) => {
    onChange(selected, value);
  };

  const isSelected = (value: string) => selected.includes(value);

  return (
    <div className="space-y-6">
      {/* Question */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {question?.text || '这个项目最重要的是什么？'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          💡 可以多选，但建议选最核心的 1-2 个
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleToggle(option.value)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              isSelected(option.value)
                ? 'border-primary bg-primary/10'
                : 'border-white/20 hover:border-white/40 bg-white/5'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                  isSelected(option.value)
                    ? 'border-primary bg-primary'
                    : 'border-white/40'
                }`}
              >
                {isSelected(option.value) && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div>
                <div className="font-medium text-white">{option.label}</div>
                {option.description && (
                  <div className="text-sm text-gray-400 mt-0.5">{option.description}</div>
                )}
              </div>
            </div>
          </button>
        ))}

        {/* Custom option */}
        {allowCustom && (
          <div className="p-4 rounded-lg border-2 border-white/20 bg-white/5">
            <div className="flex items-start gap-3">
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                  selected.includes('custom')
                    ? 'border-primary bg-primary'
                    : 'border-white/40'
                }`}
              >
                {selected.includes('custom') && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">其他（自定义描述）</div>
                <input
                  type="text"
                  value={customValue || ''}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  onFocus={() => {
                    if (!selected.includes('custom')) {
                      onChange([...selected, 'custom'], customValue);
                    }
                  }}
                  placeholder="描述你的优先级..."
                  className="w-full mt-2 px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            ← 上一步
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            跳过此步
          </button>
        </div>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors"
        >
          下一步 →
        </button>
      </div>
    </div>
  );
}
