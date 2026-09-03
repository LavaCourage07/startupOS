# J51：共享 UI 基础组件

## shadcn/ui 风格的组件库

OriginOS Web 包的 `components/ui/` 目录存放 shadcn/ui 风格的基础组件。这些组件不直接对应业务功能，而是被业务组件反复使用。这节课读九个文件：

- `button.tsx`：按钮，使用 `class-variance-authority`（cva）管理变体
- `card.tsx`：卡片容器，六个子组件
- `textarea.tsx`：多行文本输入
- `progress.tsx`：进度条，基于 Radix UI Progress
- `close-button.tsx`：关闭按钮，三种变体三种尺寸
- `MermaidDiagram.tsx`：Mermaid 图表渲染
- `icon-registry.tsx`：emoji → SVG 图标映射
- `pixel-icons.tsx`：内联 SVG 像素风格图标
- `progress-dots.tsx`：点状步骤进度指示器

## 第一段源码：Button 的 cva 变体

[packages/web/src/components/ui/button.tsx 第 7–34 行](../../../../packages/web/src/components/ui/button.tsx#L7)：

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

`buttonVariants` 用 `cva` 定义两组变体：

| 维度 | 变体 | 说明 |
| --- | --- | --- |
| `variant` | `default` / `destructive` / `outline` / `secondary` / `ghost` / `link` | 六种视觉风格 |
| `size` | `default` / `sm` / `lg` / `icon` | 四种尺寸 |

基础类（第一个参数）是所有按钮共享的：`inline-flex`、`rounded-md`、`focus-visible` 轮廓、`disabled` 半透明。

> `cva` 的好处是类型安全：`variant` 和 `size` 的可选值在 TypeScript 里被严格约束，传错值会编译报错。

## 第二段源码：Button 的 asChild 模式

[packages/web/src/components/ui/button.tsx 第 42–54 行](../../../../packages/web/src/components/ui/button.tsx#L42)：

```tsx
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
```

`asChild` 是 shadcn/ui 的经典模式：

- `asChild = false`（默认）：渲染 `<button>` 元素；
- `asChild = true`：渲染 Radix 的 `<Slot>` 组件，把样式和事件传递给子元素。

这样可以把 Button 的样式应用到 `<a>`、`<Link>` 或其他自定义组件上，而不需要嵌套 DOM。

> `cn()` 是 `clsx` + `tailwind-merge` 的封装，合并 Tailwind 类名时自动处理冲突（如 `bg-red-500` 和 `bg-blue-500` 不会同时出现）。

## 第三段源码：Card 的六个子组件

[packages/web/src/components/ui/card.tsx 第 5–79 行](../../../../packages/web/src/components/ui/card.tsx#L5)：

```tsx
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
  )
);

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
);

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
```

Card 由六个子组件组成：

| 子组件 | 职责 | 关键样式 |
| --- | --- | --- |
| `Card` | 容器 | `rounded-lg border bg-card shadow-sm` |
| `CardHeader` | 头部 | `flex flex-col space-y-1.5 p-6` |
| `CardTitle` | 标题 | `text-2xl font-semibold` |
| `CardDescription` | 描述 | `text-sm text-muted-foreground` |
| `CardContent` | 内容 | `p-6 pt-0` |
| `CardFooter` | 底部 | `flex items-center p-6 pt-0` |

所有子组件都用 `React.forwardRef` 转发 ref，支持外部控制焦点或测量尺寸。

> 颜色使用 CSS 变量（`bg-card`、`text-card-foreground`、`text-muted-foreground`），这些变量在 `globals.css` 里定义，支持明暗主题切换。

## 第四段源码：Textarea 与 Progress

[packages/web/src/components/ui/textarea.tsx 第 8–22 行](../../../../packages/web/src/components/ui/textarea.tsx#L8)：

```tsx
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
```

`Textarea` 是原生 `<textarea>` 的样式封装，最小高度 80px，支持 `placeholder` 颜色、`focus-visible` 轮廓、`disabled` 状态。

[packages/web/src/components/ui/progress.tsx 第 6–24 行](../../../../packages/web/src/components/ui/progress.tsx#L6)：

```tsx
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
```

`Progress` 基于 Radix UI 的 `ProgressPrimitive`：

- 外层 `Root`：高度 16px，圆角，`bg-secondary` 背景；
- 内层 `Indicator`：`bg-primary` 填充，用 `translateX` 控制进度。

> `translateX(-${100 - value}%)` 的计算：`value = 0` 时 `translateX(-100%)` 完全隐藏，`value = 100` 时 `translateX(0%)` 完全显示。

## 第五段源码：CloseButton 的变体与尺寸

[packages/web/src/components/ui/close-button.tsx 第 21–53 行](../../../../packages/web/src/components/ui/close-button.tsx#L21)：

```tsx
export function CloseButton({
  onClick, variant = "default", size = "md", className,
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
      className={cn("rounded-full flex items-center justify-center transition-colors", variants[variant], sizes[size], className)}
      aria-label="关闭"
    >
      <X className={size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-5 h-5" : "w-4 h-4"} />
    </button>
  );
}
```

`CloseButton` 不用 cva，而是用对象映射变体：

| 变体 | 背景色 | 文字色 | 用途 |
| --- | --- | --- | --- |
| `default` | `gray-600` | `gray-300` | 深色背景上的关闭按钮 |
| `dark` | `gray-700` | `gray-400` | 更深的背景 |
| `light` | `gray-200` | `gray-600` | 浅色背景上的关闭按钮 |

尺寸从 `sm`（24px）到 `lg`（40px），图标大小也随之调整。

> `CloseButton` 没有用 `forwardRef`，因为关闭按钮通常不需要外部控制 ref。

## 第六段源码：MermaidDiagram 的渲染与错误处理

[packages/web/src/components/ui/MermaidDiagram.tsx 第 14–73 行](../../../../packages/web/src/components/ui/MermaidDiagram.tsx#L14)：

```tsx
let mermaidInitialized = false;

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'inherit',
      });
      mermaidInitialized = true;
    }
  }, []);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!chart.trim()) return;
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        setSvg(renderedSvg);
        setError('');
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    };
    renderDiagram();
  }, [chart]);

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 my-2 ${className || ''}`}>
        <p className="text-sm text-red-600 font-medium mb-1">Mermaid 渲染错误</p>
        <pre className="text-xs text-red-500 overflow-x-auto">{error}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 my-2 ${className || ''}`}>
        <p className="text-sm text-gray-500">正在渲染图表...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-diagram bg-white/50 border border-gray-200 rounded-lg p-4 my-2 overflow-x-auto ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
```

`MermaidDiagram` 的三种状态：

1. **错误**：红色背景 + 错误信息；
2. **加载中**：灰色背景 + "正在渲染图表..."；
3. **成功**：用 `dangerouslySetInnerHTML` 注入 SVG。

关键设计：

- `mermaidInitialized` 是模块级变量，确保 `mermaid.initialize` 只调用一次；
- 每次 `chart` 变化时重新渲染，用随机 ID 避免 Mermaid 的 ID 冲突；
- `securityLevel: 'loose'` 允许 Mermaid 执行某些不安全操作（如点击事件）。

> `dangerouslySetInnerHTML` 通常应该避免，但 Mermaid 生成的 SVG 是可信的（来自用户输入的 Mermaid 语法，经过 Mermaid 解析器处理），所以这里可以接受。

## 第七段源码：icon-registry 的 emoji → SVG 映射

[packages/web/src/components/ui/icon-registry.tsx 第 16–48 行](../../../../packages/web/src/components/ui/icon-registry.tsx#L16)：

```tsx
import iconGear from '@/styles/icon/a-chilunpixel_huaban1.svg';
import iconSearch from '@/styles/icon/a-fangdajingpixel_huaban1.svg';
import iconMask from '@/styles/icon/a-jiangbeipixel_huaban1.svg';
import iconCalendar from '@/styles/icon/a-rilipixel_huaban1.svg';
import iconLightning from '@/styles/icon/a-shandianpixel_huaban1.svg';
import iconMogu from '@/styles/icon/a-mogu.svg';
import iconWorld from '@/styles/icon/wodeshijie.svg';
import iconGame from '@/styles/icon/xiangsu_youxiji.svg';
import iconChat from '@/styles/icon/xinfengpixel.svg';

const ICON_MAP: Record<string, string> = {
  '⚙️': iconGear,
  '🔍': iconSearch,
  '🕸️': iconMask,
  '📅': iconCalendar,
  '⚡': iconLightning,
  '🎭': iconWorld,
  '🌍': iconMogu,
  '🎮': iconGame,
  '💬': iconChat,
  // Dock shortcuts
  '➕': iconGame,
  '📝': iconChat,
  '🤖': iconGear,
};

export function resolveSvgIcon(icon: string): string | null {
  return ICON_MAP[icon] ?? null;
}

export function AppIcon({ emoji, size = 28, className }: {
  emoji: string; size?: number; className?: string;
}) {
  const svgUrl = ICON_MAP[emoji];
  if (svgUrl) {
    return (
      <img
        src={svgUrl}
        alt={emoji}
        width={size}
        height={size}
        className={`object-contain ${className ?? ''}`}
        style={{ imageRendering: 'pixelated', width: `${size}px`, height: `${size}px` }}
      />
    );
  }
  return <span className={`select-none ${className ?? ''}`} style={{ fontSize: size }}>{emoji}</span>;
}
```

`icon-registry` 把 emoji 映射到像素风格 SVG 文件：

- `resolveSvgIcon`：返回 SVG URL 或 `null`；
- `AppIcon`：如果有 SVG 就渲染 `<img>`（`imageRendering: 'pixelated'` 保持像素风格），否则回退到 emoji 文本。

> SVG 文件通过 webpack 的 `asset/resource` 处理，导入后变成 URL 字符串。`imageRendering: 'pixelated'` 确保缩放时不模糊。

## 第八段源码：pixel-icons 的内联 SVG 图标

[packages/web/src/components/ui/pixel-icons.tsx 第 7–46 行](../../../../packages/web/src/components/ui/pixel-icons.tsx#L7)：

```tsx
const PIXEL = 24; // SVG viewBox size
const BASE_SCALE = 2; // each "pixel" is 2 SVG units = 12x12 pixel grid

function PixelIconSVG({ d, className, size = 32, color = 'currentColor' }: {
  d: string[]; className?: string; size?: number; color?: string;
}) {
  const viewBox = `0 0 ${PIXEL} ${PIXEL}`;
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} style={{ imageRendering: 'pixelated' }}>
      {d.map((path, i) => (
        <path key={i} d={path} fill={color} />
      ))}
    </svg>
  );
}

function px(x: number, y: number, s: number = BASE_SCALE): string {
  return `M${x} ${y}h${s}v${s}h-${s}z`;
}

export function PixelClipboard({ className, size, color }: PixelIconProps) {
  const d = [
    px(6,2), px(8,2), px(10,2), px(12,2), px(14,2), px(16,2),
    px(4,4), px(6,4), px(16,4), px(18,4),
    ...
  ];
  return <PixelIconSVG d={d} className={className} size={size} color={color} />;
}
```

`pixel-icons` 用内联 SVG 路径绘制像素风格图标：

- `PIXEL = 24`：viewBox 大小 24×24；
- `BASE_SCALE = 2`：每个"像素"占 2×2 SVG 单位，实际是 12×12 像素网格；
- `px(x, y, s)` 生成一个矩形路径 `M x y h s v s h-s z`；
- 每个图标是一个 `d` 数组，包含多个矩形路径。

> 与 `icon-registry` 的区别：`icon-registry` 用外部 SVG 文件，`pixel-icons` 用内联 SVG 路径。内联的好处是可以动态改变颜色（`color` prop），外部 SVG 文件做不到。

## 第九段源码：ProgressDots 的三种状态

[packages/web/src/components/ui/progress-dots.tsx 第 26–85 行](../../../../packages/web/src/components/ui/progress-dots.tsx#L26)：

```tsx
export function ProgressDots({ total, current, completed = [], className }: ProgressDotsProps) {
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
                step <= current || completed.includes(step) ? "bg-primary" : "bg-gray-600"
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
              aria-label={getDotState(step) === "current" ? `当前步骤 ${step} / ${total}` : undefined}
              aria-current={getDotState(step) === "current" ? "step" : undefined}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

`ProgressDots` 的三种状态：

| 状态 | 大小 | 样式 | 说明 |
| --- | --- | --- | --- |
| `current` | 16px | `bg-primary` + 脉冲光晕 | 当前步骤，带 `animate-pulse-dot` |
| `previous` | 12px | `bg-primary` | 已完成的步骤 |
| `next` | 12px | `border-2 border-gray-600` 空心 | 未到达的步骤 |

连接线颜色：当前步骤之前用 `bg-primary`，之后用 `bg-gray-600`。

> `aria-current="step"` 和 `aria-label` 提供无障碍支持，屏幕阅读器可以读出"当前步骤 2 / 3"。

## 本节小结

- `Button` 用 `cva` 管理六种变体和四种尺寸，`asChild` 模式支持样式传递。
- `Card` 由六个子组件组成，颜色使用 CSS 变量支持主题切换。
- `Textarea` 和 `Progress` 是原生元素/Radix UI 的样式封装。
- `CloseButton` 用对象映射变体，三种变体三种尺寸。
- `MermaidDiagram` 用 `dangerouslySetInnerHTML` 注入 SVG，模块级变量确保只初始化一次。
- `icon-registry` 把 emoji 映射到外部 SVG 文件，`AppIcon` 回退到 emoji 文本。
- `pixel-icons` 用内联 SVG 路径绘制像素图标，支持动态颜色。
- `ProgressDots` 用三种状态（current/previous/next）表示步骤进度，带无障碍支持。

下一节课读聊天组件：`chat-input-bar`、`chat-message`、`ChatMessageList`、`ChatInput`（molecules）、`MessageList`（molecules）。
