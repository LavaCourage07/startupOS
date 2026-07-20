/**
 * GeneratingState - 生成加载状态组件
 *
 * 参考: docs/specs/epic-1/story-1.2/assets/wireframes/interview-panel-loading.svg
 *
 * 设计规格:
 * - 右侧模态面板: 580×520px
 * - 旋转加载动画
 * - 进度条
 * - 预览即将生成的内容
 */

import { CloseButton } from "@/components/ui/close-button";
import { cn } from "@originos/core/lib/utils";

export interface GeneratingStateProps {
  /** 当前加载消息 */
  message?: string;
  /** 进度百分比 (0-100) */
  progress?: number;
  /** 是否显示错误 */
  error?: string;
  /** 取消回调 */
  onCancel?: () => void;
}

export function GeneratingState({
  message = "正在生成本体结构...",
  progress = 60,
  error,
  onCancel,
}: GeneratingStateProps) {
  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-background/60 z-40"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* 模态面板 */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        <div
          className={cn(
            "absolute right-0 top-[60px] w-[580px] h-[520px]",
            "bg-panel rounded-xl shadow-2xl flex flex-col",
            "pointer-events-auto animate-slide-right"
          )}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="text-base font-semibold text-text-primary">访谈</h2>
            {onCancel && <CloseButton onClick={onCancel} variant="dark" />}
          </div>

          {/* 分隔线 */}
          <div className="h-px bg-border-subtle" />

          {/* 内容区域 */}
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-6">
            {/* 旋转加载器 */}
            {error ? (
              /* 错误状态 */
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                  <span className="text-3xl">⚠️</span>
                </div>
                <h3 className="text-xl font-semibold text-red-400">生成失败</h3>
                <p className="text-text-secondary text-sm">{error}</p>
                <button
                  onClick={onCancel}
                  className="mt-4 px-4 py-2 rounded-lg bg-primary text-foreground text-sm font-medium hover:bg-primary/90"
                >
                  重试
                </button>
              </div>
            ) : (
              /* 加载中状态 */
              <>
                {/* 旋转圆环 */}
                <div className="relative mb-6">
                  <div
                    className={cn(
                      "w-16 h-16 rounded-full",
                      "border-[3px] border-t-primary border-r-transparent border-b-transparent border-l-transparent",
                      "animate-spin"
                    )}
                  />
                </div>

                {/* 加载文本 */}
                <h3 className="text-xl font-medium text-text-primary mb-3">
                  {message}
                </h3>

                {/* 进度条 */}
                <div className="w-full mb-3">
                  <div className="h-2 rounded-full bg-input-dark overflow-hidden">
                    <div
                      className={cn(
                        "h-full bg-primary transition-all duration-500"
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-text-secondary text-center">
                  正在分析您的访谈数据...
                </p>

                {/* 预估时间 */}
                <p className="text-xs text-text-tertiary text-center mb-8">
                  这可能需要 3-5 秒
                </p>

                {/* 预览 */}
                <div className="w-full rounded-lg bg-input-dark/50 p-4 border border-border-subtle/50">
                  <p className="text-xs text-text-secondary mb-4">
                    即将为您生成：
                  </p>
                  <div className="space-y-2 text-xs text-text-tertiary">
                    <div className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-text-tertiary" />
                      <span>1 个领域层</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-text-tertiary" />
                      <span>2-3 个概念对象</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-text-tertiary" />
                      <span>对应关系</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
