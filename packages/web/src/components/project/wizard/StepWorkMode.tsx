/**
 * Story C.5: Step 3 - Work Mode Selection
 */

'use client';

import { WorkMode, Question, QuestionOption } from '@originos/core/types';

interface StepWorkModeProps {
  value: WorkMode | null;
  customValue?: string;
  onChange: (value: WorkMode, custom?: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  question?: Question;
}

const DEFAULT_OPTIONS: QuestionOption[] = [
  {
    value: 'solo',
    label: '我自己开发和维护',
    icon: '👤',
    description: '全程自己掌控，AI 辅助具体任务',
  },
  {
    value: 'team',
    label: '和小团队一起协作',
    icon: '👥',
    description: '团队成员共同贡献，AI 帮助协调',
  },
  {
    value: 'product-owner',
    label: '交给其他人使用',
    icon: '🎯',
    description: '我是产品角色，AI 帮我实现想法',
  },
];

export function StepWorkMode({
  value,
  customValue,
  onChange,
  onNext,
  onBack,
  onSkip,
  question,
}: StepWorkModeProps) {
  const options = question?.options || DEFAULT_OPTIONS;
  const allowCustom = question?.allowCustom ?? true;

  const handleSelect = (optionValue: string) => {
    onChange(optionValue as WorkMode, optionValue === 'custom' ? customValue : undefined);
  };

  const handleCustomChange = (val: string) => {
    onChange('custom' as WorkMode, val);
  };

  return (
    <div className="space-y-6">
      {/* Question */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {question?.text || '你希望怎么使用这个项目？'}
        </h2>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              value === option.value
                ? 'border-primary bg-primary/10'
                : 'border-white/20 hover:border-white/40 bg-white/5'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                  value === option.value
                    ? 'border-primary bg-primary'
                    : 'border-white/40'
                }`}
              >
                {value === option.value && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {option.icon && <span className="text-lg">{option.icon}</span>}
                  <span className="font-medium text-white">{option.label}</span>
                </div>
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
                  value === 'custom'
                    ? 'border-primary bg-primary'
                    : 'border-white/40'
                }`}
              >
                {value === 'custom' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚙️</span>
                  <span className="font-medium text-white">其他模式</span>
                </div>
                <input
                  type="text"
                  value={customValue || ''}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  onFocus={() => {
                    if (value !== 'custom') {
                      onChange('custom' as WorkMode, customValue);
                    }
                  }}
                  placeholder="描述你的工作模式..."
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
