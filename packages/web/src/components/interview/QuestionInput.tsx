/**
 * QuestionInput - 访谈问题输入组件
 *
 * 参考: docs/specs/epic-1/story-1.2/interaction.md
 *
 * 设计规格:
 * - 右侧滑入模态面板: 580×520px
 * - 点状进度指示器 (●○○)
 * - 步骤概览标签
 * - 宽体按钮: 上一步 140×40px, 下一步/完成 140×40px/160×40px
 */

import { useState, useEffect, useRef } from "react";
import { CloseButton } from "@/components/ui/close-button";
import { ProgressDots, StepOverview } from "@/components/ui/progress-dots";
import { Button } from "@/components/ui/button";
import { cn } from "@originos/core/lib/utils";

export interface QuestionInputProps {
  /** 问题文本 */
  question: string;
  /** 占位符文本 */
  placeholder?: string;
  /** 当前答案值 */
  value: string;
  /** 值变化回调 */
  onChange: (value: string) => void;
  /** 下一步/完成回调 */
  onNext: () => void;
  /** 上一步回调 */
  onPrevious?: () => void;
  /** 是否最后一题 */
  isLastQuestion?: boolean;
  /** 是否提交中 */
  isSubmitting?: boolean;
  /** 步骤编号 (1-indexed) */
  stepNumber?: number;
  /** 总步骤数 */
  totalSteps?: number;
  /** 步骤标签列表 */
  stepLabels?: readonly string[];
  /** 已完成步骤 */
  completedSteps?: number[];
  /** 取消回调 */
  onCancel?: () => void;
}

export function QuestionInput({
  question,
  placeholder = "在此输入你的回答...",
  value,
  onChange,
  onNext,
  onPrevious,
  isLastQuestion = false,
  isSubmitting = false,
  stepNumber = 1,
  totalSteps = 3,
  stepLabels = ["步骤 1", "步骤 2", "步骤 3"],
  completedSteps = [],
  onCancel,
}: QuestionInputProps) {
  const [validationError, setValidationError] = useState<string>();
  const [shaking, setShaking] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canNext = value.trim().length > 0;
  const isFirstStep = stepNumber === 1;

  // 自动聚焦
  useEffect(() => {
    if (textareaRef.current && !isSubmitting) {
      textareaRef.current.focus();
    }
  }, [stepNumber, isSubmitting]);

  // 清除错误
  useEffect(() => {
    if (value.trim().length > 0) {
      setValidationError(undefined);
    }
  }, [value]);

  const handleNextClick = () => {
    if (!canNext) {
      setValidationError("请先输入你的答案");
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
    } else {
      setValidationError(undefined);
      onNext();
    }
  };

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-background/60 z-40"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* 模态面板 - 右侧滑入 */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        <div
          className={cn(
            "absolute right-0 top-[60px] w-[580px] h-[520px]",
            "bg-panel rounded-xl shadow-2xl pointer-events-auto",
            "animate-slide-right flex flex-col overflow-hidden"
          )}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="text-base font-semibold text-text-primary">访谈</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                取消
              </button>
              <CloseButton onClick={onCancel} variant="dark" />
            </div>
          </div>

          {/* 分隔线 */}
          <div className="h-px bg-border-subtle mx-5" />

          {/* 进度指示器 */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <ProgressDots
              total={totalSteps}
              current={stepNumber}
              completed={completedSteps}
            />
            <span className="text-xs text-text-secondary">
              步骤 {stepNumber} / {totalSteps}
            </span>
          </div>

          {/* 分隔线 */}
          <div className="h-px bg-border-subtle mx-5" />

          {/* 内容区域 */}
          <div className="flex-1 px-5 pt-5 pb-4 overflow-y-auto">
            {/* 问题标签 */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-primary px-2.5 py-1 rounded-full border border-primary/30">
                问题 {stepNumber}/{totalSteps}
              </span>
            </div>

            {/* 问题 */}
            <h3 className="text-xl font-semibold text-text-primary mb-4">
              {question}
            </h3>

            {/* 提示框 */}
            <div
              className={cn(
                "rounded-lg px-3 py-2 mb-4",
                "bg-blue-500/5 border border-blue-500/20",
                "flex items-start gap-2"
              )}
            >
              <span className="text-blue-400 shrink-0">ℹ️</span>
              <p className="text-sm text-text-secondary">{placeholder}</p>
            </div>

            {/* 输入框 */}
            <div className={cn(shaking && "animate-shake")}>
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder=""
                disabled={isSubmitting}
                rows={6}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5",
                  "bg-inputDark border border-border-subtle",
                  "text-text-primary placeholder:text-tertiary",
                  "resize-y min-h-[120px] max-h-[200px]",
                  "transition-all duration-200",
                  "focus:outline-none focus:border-primary dark:focus:shadow-[0_0_0_3px_rgba(0,217,255,0.2)]",
                  validationError && "border-red-500 dark:focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              />
            </div>

            {/* 错误提示 */}
            {validationError && (
              <p className="text-xs text-red-400 mt-2">{validationError}</p>
            )}
          </div>

          {/* 步骤概览 */}
          <div className="px-5 pb-3">
            <StepOverview
              total={totalSteps}
              current={stepNumber}
              labels={stepLabels}
            />
          </div>

          {/* 分隔线 */}
          <div className="h-px mx-5 bg-border-subtle" />

          {/* 按钮行 */}
          <div className="flex justify-between px-5 py-5">
            {/* 上一步 */}
            <Button
              onClick={onPrevious}
              disabled={isSubmitting || isFirstStep}
              variant="outline"
              className={cn(
                "h-9 px-6 rounded-lg text-sm",
                "border border-border-subtle",
                "text-text-secondary hover:text-text-primary",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              上一步
            </Button>

            {/* 下一步/完成 */}
            <Button
              onClick={handleNextClick}
              disabled={!canNext || isSubmitting}
              className={cn(
                "h-9 rounded-lg text-sm font-medium",
                "bg-primary text-foreground",
                "hover:bg-primary/90",
                !canNext && "opacity-50"
              )}
              style={{ minWidth: isLastQuestion ? "160px" : "140px" }}
            >
              {isSubmitting ? (
                "提交中..."
              ) : isLastQuestion ? (
                "完成访谈"
              ) : (
                "下一步 >"
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
