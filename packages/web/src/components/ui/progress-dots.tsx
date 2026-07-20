/**
 * ProgressDots - 点状进度指示器组件
 *
 * 参考: docs/specs/epic-1/story-1.2/interaction.md
 *
 * 视觉规格:
 * - 未访问: 空心圆 12px, #4B5563
 * - 当前: 实心圆 16px, #00D9FF, 脉冲动画
 * - 已完成: 实心圆 12px, #00D9FF
 * - 连接线: 2px/3px, 150ms 颜色过渡
 */

import { cn } from "@originos/core/lib/utils";

export interface ProgressDotsProps {
  /** 总步骤数 */
  total: number;
  /** 当前步骤 (1-indexed) */
  current: number;
  /** 已完成的步骤列表 (1-indexed) */
  completed?: number[];
  /** 自定义类名 */
  className?: string;
}

export function ProgressDots({
  total,
  current,
  completed = [],
  className,
}: ProgressDotsProps) {
  const dots = Array.from({ length: total }, (_, i) => i + 1);

  const getDotState = (step: number): "previous" | "current" | "next" => {
    if (step === current) return "current";
    if (step < current) return "previous";
    return "next";
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {dots.map((step, index) => (
        <div key={step} className="flex items-center">
          {/* 连接线 (非第一个点) */}
          {index > 0 && (
            <div
              className={cn(
                "w-6 h-[2px] -mr-1 -ml-1 transition-colors duration-150",
                step <= current || completed.includes(step)
                  ? "bg-primary"
                  : "bg-gray-600"
              )}
              aria-hidden="true"
            />
          )}

          {/* 进度点 */}
          <div className="relative">
            {/* 外层光晕 (当前步骤) */}
            {getDotState(step) === "current" && (
              <div className="absolute inset-0 -m-1 rounded-full bg-primary/20 animate-pulse-dot" />
            )}

            <div
              className={cn(
                "rounded-full transition-all duration-150",
                getDotState(step) === "current"
                  ? "w-4 h-4 bg-primary dark:shadow-[0_0_8px_rgba(0,217,255,0.5)]"
                  : getDotState(step) === "previous"
                    ? "w-3 h-3 bg-primary"
                    : "w-3 h-3 border-2 border-gray-600 bg-transparent"
              )}
              aria-label={
                getDotState(step) === "current"
                  ? `当前步骤 ${step} / ${total}`
                  : undefined
              }
              aria-current={getDotState(step) === "current" ? "step" : undefined}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 步骤概览组件 (用于底部显示步骤名称)
 */
export interface StepOverviewProps {
  /** 总步骤数 */
  total: number;
  /** 当前步骤 (1-indexed) */
  current: number;
  /** 步骤标签列表 */
  labels: readonly string[];
  /** 自定义类名 */
  className?: string;
}

export function StepOverview({
  total,
  current,
  labels,
  className,
}: StepOverviewProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="text-xs text-tertiary">步骤概览：</span>
      {labels.slice(0, total).map((label, index) => {
        const step = index + 1;
        const isCompleted = step < current;
        const isCurrent = step === current;

        return (
          <div key={step} className="flex items-center gap-1.5">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                isCurrent || isCompleted
                  ? "bg-primary"
                  : "border border-gray-600 bg-transparent opacity-50"
              )}
            />
            <span
              className={cn(
                "text-xs",
                isCurrent
                  ? "text-primary"
                  : isCompleted
                    ? "text-primary"
                    : "text-secondary opacity-50"
              )}
            >
              {label}
              {isCompleted && " ✓"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
