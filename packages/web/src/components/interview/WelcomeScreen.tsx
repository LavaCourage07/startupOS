/**
 * WelcomeScreen - 欢迎屏幕组件
 *
 * 参考: docs/specs/epic-1/story-1.1/interaction.md
 *
 * 设计规格:
 * - 560px 宽垂直居中模态，从底部滑入
 * - 三个按钮: 开始访谈 (主)、稍后问问 (次)、跳过 (幽灵)
 * - 特性列表
 * - 本体说明卡片
 */

import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/close-button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@originos/core/lib/utils";

export interface WelcomeScreenProps {
  /** 开始访谈回调 */
  onStart: () => void;
  /** 稍后问问回调 */
  onLater: () => void;
  /** 跳过回调 */
  onSkip: () => void;
  /** 取消回调 */
  onCancel?: () => void;
}

export function WelcomeScreen({
  onStart,
  onLater,
  onSkip,
  onCancel,
}: WelcomeScreenProps) {
  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-background/60 z-40"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* 模态面板 - 垂直居中，从底部滑入 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-[560px] bg-panel rounded-xl shadow-2xl pointer-events-auto animate-slide-up overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h2 className="text-lg font-semibold text-text-primary">访谈</h2>
            <CloseButton onClick={onCancel || onSkip} variant="dark" size="md" />
          </div>

          {/* 分隔线 */}
          <div className="h-px bg-border-subtle mx-6 mb-4" />

          {/* Logo */}
          <div className="px-6 mb-5">
            <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
              <div className="relative">
                {/* 神经网络图标 */}
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <div className="absolute -right-2 top-1 w-1.5 h-1.5 rounded-full bg-primary" />
                <div className="absolute -left-1 top-2 w-1.5 h-1.5 rounded-full bg-primary" />
                <div className="absolute -right-1 top-2 w-1.5 h-1.5 rounded-full bg-primary" />
              </div>
            </div>
          </div>

          {/* 标题和副标题 */}
          <div className="px-6 text-center mb-6">
            <h1 className="text-2xl font-semibold text-text-primary mb-2">
              欢迎使用 OriginOS
            </h1>
            <p className="text-base text-text-secondary">
              AI Native 操作系统，让你的思考和认知具象化为知识资产
            </p>
          </div>

          {/* 特性列表 */}
          <div className="px-6 mb-5 space-y-2">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm text-text-secondary">
                项目访谈快速建模
              </span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm text-text-secondary">
                本体图谱可视化
              </span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm text-text-secondary">
                自然对话交互
              </span>
            </div>
          </div>

          {/* 本体说明卡片 */}
          <div className="px-6 mb-5">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <h3 className="text-sm font-medium text-text-primary">
                什么是项目本体？
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                本体定义了项目的核心概念、关系和结构。它帮助 OriginOS 理解你的工作领域，
                使 AI 驱动的交互更加准确和具有上下文感知能力。
              </p>
            </div>
          </div>

          {/* 访谈步骤 */}
          <div className="px-6 mb-5">
            <h3 className="text-sm font-medium text-text-primary mb-2">
              我们会问 3 个简单问题：
            </h3>
            <div className="space-y-1.5 text-sm text-text-secondary">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium shrink-0">
                  1
                </span>
                <span>你的工作领域是什么？</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium shrink-0">
                  2
                </span>
                <span>你的工作模式是什么？</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium shrink-0">
                  3
                </span>
                <span>主要任务有哪些？</span>
              </div>
            </div>
          </div>

          {/* 时间预估 */}
          <div className="px-6 mb-5">
            <div className="rounded-lg bg-primary/5 p-3 border border-primary/10">
              <p className="text-xs text-text-secondary">
                <span className="font-medium text-primary">预计时间：</span>~5 分钟
              </p>
            </div>
          </div>

          {/* 按钮组 */}
          <div className="px-6 pb-5">
            <div className="flex gap-2">
              {/* 稍后问问 */}
              <Button
                onClick={onLater}
                variant="outline"
                className={cn(
                  "flex-1 h-10 rounded-lg text-sm",
                  "border border-border-subtle",
                  "text-text-secondary hover:text-text-primary",
                  "hover:border-subtle"
                )}
              >
                稍后问问
              </Button>

              {/* 跳过 */}
              <Button
                onClick={onSkip}
                variant="ghost"
                className={cn(
                  "h-10 px-4 rounded-lg text-sm",
                  "text-text-secondary hover:text-text-primary"
                )}
              >
                跳过
              </Button>

              {/* 开始访谈 */}
              <Button
                onClick={onStart}
                className={cn(
                  "flex-1 h-10 rounded-lg text-sm font-medium",
                  "bg-primary text-foreground",
                  "hover:bg-primary/90"
                )}
              >
                开始访谈
                <ArrowRight className="ml-1.5 w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
