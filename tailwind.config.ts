import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // 视觉设计规范颜色
        panel: {
          DEFAULT: "hsl(var(--panel-bg))",
        },
        inputDark: {
          DEFAULT: "hsl(var(--input-bg))",
        },
        "border-subtle": "hsl(var(--border-subtle))",
        "text-primary": "hsl(var(--text-primary))",
        "text-secondary": "hsl(var(--text-secondary))",
        "text-tertiary": "hsl(var(--text-tertiary))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backdropBlur: {
        'acrylic': '20px',
        'acrylic-subtle': '12px',
        'acrylic-strong': '30px',
      },
      backdropSaturate: {
        'acrylic': '180%',
        'acrylic-subtle': '150%',
        'acrylic-strong': '200%',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // 面板滑入动画
        "slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(100%)", opacity: "0" },
        },
        "slide-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-left": {
          "0%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(-100%)", opacity: "0" },
        },
        // 步骤切换滑动
        "step-slide-in": {
          "0%": { transform: "translateX(20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "step-slide-out": {
          "0%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(-20px)", opacity: "0" },
        },
        "step-slide-in-reverse": {
          "0%": { transform: "translateX(-20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "step-slide-out-reverse": {
          "0%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(20px)", opacity: "0" },
        },
        // 错误晃动动画
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-5px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(5px)" },
        },
        // 加载旋转
        "spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        // 进度点脉冲
        "pulse-dot": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
        },
        // Dock 滑入
        "dock-slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        // Dock 从左侧滑入
        "dock-slide-from-left": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        // 图标抖动（长按删除模式）
        "wiggle": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-3deg)" },
          "75%": { transform: "rotate(3deg)" },
        },
        // 删除按钮出现
        "scale-in": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // 动画规格参考交互设计文档
        "slide-up": "slide-up 300ms ease-out",
        "slide-down": "slide-down 300ms ease-in",
        "slide-right": "slide-right 300ms ease-out",
        "slide-left": "slide-left 300ms ease-in",
        "step-slide-in": "step-slide-in 250ms ease-out",
        "step-slide-out": "step-slide-out 250ms ease-out",
        "step-slide-in-reverse": "step-slide-in-reverse 250ms ease-out",
        "step-slide-out-reverse": "step-slide-out-reverse 250ms ease-out",
        "shake": "shake 400ms ease-in-out",
        "spin-slow": "spin 2s linear infinite",
        "spin": "spin 1s linear infinite",
        "pulse-dot": "pulse-dot 150ms ease-in-out",
        "dock-slide-up": "dock-slide-up 400ms ease-out",
        "dock-slide-from-left": "dock-slide-from-left 400ms ease-out",
        "wiggle": "wiggle 300ms ease-in-out infinite",
        "scale-in": "scale-in 150ms ease-out",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
export default config;
