# J07：背景、Acrylic、视觉层如何渲染

## 首页的深色桌面不是一张图片

小林看到 OriginOS 首页时，背景是深蓝色渐变、网格线、几处彩色光晕。这些视觉效果不是来自单张背景图，而是由 `page.tsx` 里的内联样式和 `globals.css` 里的 CSS 变量共同决定。

这节课要区分两个层面：

1. **背景组件层**：`components/os/Background/` 提供可复用的背景系统（纯色、图片、粒子）。
2. **全局样式层**：`styles/globals.css` 提供 Tailwind 主题变量、Dark/Light 模式、Acrylic/动画系统、Electron 原生窗口适配。

然后我们还要回答一个实际问题：当前生产路径的 `page.tsx` 为什么没有使用 `Background` 组件？

## 第一段源码：Background 组件的分发

[packages/web/src/components/os/Background/index.tsx](../../../../packages/web/src/components/os/Background/index.tsx) 是一个轻量分发器：

```tsx
interface BackgroundProps {
  config: BackgroundConfig;
  className?: string;
}

export default function Background({ config, className = '' }: BackgroundProps) {
  return (
    <div className={`absolute inset-0 -z-10 ${className}`}>
      {config.type === 'solid' && <SolidColor color={config.color || '#0A0A0A'} />}
      {config.type === 'image' && (
        <>
          <ImageBackground imageUrl={config.imageUrl} />
          {config.particlesEnabled && <Particles />}
        </>
      )}
      {config.type === 'particles' && <Particles />}
    </div>
  );
}
```

它根据 `config.type` 分发到三个子组件：

| 类型 | 子组件 | 用途 |
| --- | --- | --- |
| `solid` | `SolidColor` | 单一颜色背景 |
| `image` | `ImageBackground` + 可选 `Particles` | 图片背景，可叠加粒子 |
| `particles` | `Particles` | 纯粒子动画背景 |

`BackgroundConfig` 来自 `@originos/core/types`，说明背景类型是跨包共享的类型合同。

## 第二段源码：粒子背景的实现

[packages/web/src/components/os/Background/Particles.tsx](../../../../packages/web/src/components/os/Background/Particles.tsx) 用 Canvas 2D 实现粒子动画：

```ts
export default function Particles({
  count = 50,
  color = 'rgba(255, 255, 255, 0.3)',
  size = 2,
  speed = 0.5,
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const particles = [];
    const resizeCanvas = () => { ... };
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((particle) => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
        ctx.fill();
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < 0 || particle.x > canvas.width) particle.vx = -particle.vx;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy = -particle.vy;
      });
      animationFrameId = requestAnimationFrame(draw);
    };
    ...
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [count, color, size, speed]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
}
```

粒子背景的要点：

- 使用 `requestAnimationFrame` 做动画循环。
- 粒子碰到边界反弹。
- 组件卸载时取消动画帧和 resize 监听，避免内存泄漏。
- `pointer-events-none` 保证背景不拦截鼠标事件。

这个实现适合“演示/氛围”用途，但不适合数据可视化场景。如果粒子数量很大，CPU 开销会增加。

## 第三段源码：page.tsx 的内联背景

[packages/web/src/app/page.tsx 第 1276—1278 行](../../../../packages/web/src/app/page.tsx#L1276) 没有使用 `Background` 组件，而是直接内联了背景：

```tsx
return (
  <div className="relative w-screen h-screen overflow-hidden bg-[#050816]">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.18),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(34,197,94,0.12),transparent_26%),radial-gradient(circle_at_50%_80%,rgba(56,189,248,0.12),transparent_30%)]" />
    <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:32px_32px]" />
    ...
  </div>
);
```

这里用 Tailwind 的任意值语法（例如 `bg-[#050816]`、`[background-size:32px_32px]`）直接写死了：

- 一个深蓝底色 `#050816`；
- 三层径向渐变，制造彩色光晕；
- 一层 32px 网格线，制造科技感。

为什么不用 `Background` 组件？因为 `page.tsx` 的首页需要特定的品牌视觉效果，而 `Background` 组件是为可配置的通用背景设计的。当前首页的背景不可由用户切换，所以直接内联更高效。

但这并不意味着 `Background` 组件无用。它在 `app/desktop/page.tsx` 的 `Desktop.tsx` 中被使用，为另一套桌面提供可切换背景能力。

## 第四段源码：globals.css 的主题系统

[packages/web/src/styles/globals.css](../../../../packages/web/src/styles/globals.css) 是 Web 包的全局样式入口。它先导入 Tailwind 和 Acrylic/动画系统：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import './acrylic.css';
@import './fluent-animations.css';
```

然后定义两套 CSS 变量：`:root`（默认 Dark）和 `.light`（Light）：

```css
:root {
  --background: 214 100% 3%;
  --foreground: 215 20% 90%;
  --card: 220 30% 13%;
  --primary: 217 91% 60%;
  ...
  --panel-bg: 220 30% 13%;
  --text-primary: 215 20% 90%;
  --interactive-bg: 220 30% 20%;
}

.light {
  --background: 210 40% 98%;
  --foreground: 222 84% 5%;
  ...
}
```

这些变量是 Tailwind 主题 color 的底层。例如 `bg-background` 会映射到 `--background`，`text-primary` 会映射到 `--primary`。组件层不需要知道具体色值，只需要使用语义化类名。

## Acrylic 与 Fluent 动画

`globals.css` 导入的两个文件承担更具体的视觉系统：

- `acrylic.css`：定义毛玻璃材质效果（`backdrop-blur`、`bg-white/5`、`border-white/10` 等组合）。
- `fluent-animations.css`：定义 Fluent Design 风格的进入/退出/缩放动画。

这两个文件本身也属于 Part J 的范围，但内容偏样式常量。Unit 6 的“包基础”会再提到它们。J07 只需要知道：首页卡片、窗口、Dock 的毛玻璃效果来自 `acrylic.css`，而不是每个组件自己发明一遍。

## Electron 原生窗口适配

[packages/web/src/styles/globals.css 第 107—120 行](../../../../packages/web/src/styles/globals.css#L107) 有几个 Electron 专用类：

```css
.native-window-surface {
  background: transparent;
}

.native-drag-region {
  -webkit-app-region: drag;
}

.native-no-drag,
.native-no-drag * {
  -webkit-app-region: no-drag;
}
```

- `.native-window-surface`：让 Electron 窗口背景透明，方便自定义圆角/阴影。
- `.native-drag-region`：标记可被拖拽的标题栏区域。
- `.native-no-drag`：标记不可拖拽的区域（例如按钮）。

这些类在 Web 版本中不会生效，但保留在 `globals.css` 中可以让同一套组件在 Web 和 Desktop 之间复用。

## Dark / Light 切换

当前 `page.tsx` 使用 `bg-[#050816]` 硬编码，不跟随 `.light` 主题。如果用户切换到 Light 模式，首页背景仍然是深蓝。这是当前生产路径的一个局限：`page.tsx` 的内联背景没有接入主题系统。

相比之下，使用 `Background` 组件的 `Desktop.tsx` 如果传入 `config.type: 'solid'` 和 `color: 'var(--background)'`，就能跟随主题切换。

## 本节小结

- `Background` 组件是可配置背景系统，支持 `solid`、`image`、`particles` 三种类型。
- 当前生产路径的 `page.tsx` 使用内联 Tailwind 任意值实现固定背景，不经过 `Background` 组件。
- `Particles` 使用 Canvas 2D + `requestAnimationFrame`，卸载时清理动画帧和事件监听。
- `globals.css` 定义 Dark/Light 两套 CSS 变量，导入 Acrylic 和 Fluent 动画系统。
- `.native-window-surface`、`.native-drag-region`、`.native-no-drag` 为 Electron 原生窗口提供样式支持。
- `page.tsx` 的硬编码背景当前不跟随 Light 主题，是使用内联样式的一个副作用。

下一节课，我们将回到 `page.tsx` 的状态层，看项目、Agent、技能列表如何加载、如何刷新、如何响应删除事件。
