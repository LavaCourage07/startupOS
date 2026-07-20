/**
 * CloseButton - 关闭按钮组件
 *
 * 用于模态面板和对话框的关闭按钮
 */

import { X } from "lucide-react";
import { cn } from "@originos/core/lib/utils";

export interface CloseButtonProps {
  /** 点击回调 */
  onClick?: () => void;
  /** 变体 */
  variant?: "default" | "dark" | "light";
  /** 尺寸 */
  size?: "sm" | "md" | "lg";
  /** 自定义类名 */
  className?: string;
}

export function CloseButton({
  onClick,
  variant = "default",
  size = "md",
  className,
}: CloseButtonProps) {
  const variants = {
    default: "bg-gray-600 hover:bg-gray-500 text-gray-300",
    dark: "bg-gray-700 hover:bg-gray-600 text-gray-400",
    light: "bg-gray-200 hover:bg-gray-300 text-gray-600",
  };

  const sizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full flex items-center justify-center transition-colors",
        variants[variant],
        sizes[size],
        className
      )}
      aria-label="关闭"
    >
      <X className={size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-5 h-5" : "w-4 h-4"} />
    </button>
  );
}
