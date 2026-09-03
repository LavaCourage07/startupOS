# J06：新用户引导和设置状态如何联动

## 小林第一次看到桌面引导

小林第一次打开 OriginOS，屏幕中央弹出一个深色遮罩，高亮右上角的设置按钮，提示他先配置 LLM。这就是 `DesktopOnboarding`。它不是一张静态欢迎图，而是一个分步骤的交互式引导：模型配置 → 桌面总览 → Dock → 项目 → 内置应用 → Agent → 技能 → 随时重看。

这节课要回答：

1. 系统怎么知道这是小林第一次打开，从而显示引导？
2. 引导的每一步如何高亮页面上的真实元素？
3. 小林点击“跳过”后，系统如何记住不再显示？
4. 设置状态（settingsStore）与引导状态是什么关系？

## 第一段源码：引导显示条件

[packages/web/src/app/page.tsx 第 486—528 行](../../../../packages/web/src/app/page.tsx#L486) 控制引导是否出现：

```ts
const [showDesktopOnboarding, setShowDesktopOnboarding] = React.useState(false);

React.useEffect(() => {
  const loadUserConfig = async () => {
    try {
      const response = await fetch('/api/user-config');
      if (response.ok) {
        const result = await response.json();
        const config = result.data || result;
        const showOnboarding = config.preferences?.showOnboarding ?? true;
        if (showOnboarding) {
          const timer = window.setTimeout(() => setShowDesktopOnboarding(true), 650);
          return () => window.clearTimeout(timer);
        }
      }
    } catch (error) {
      // Fallback: show onboarding if config load fails
      const timer = window.setTimeout(() => setShowDesktopOnboarding(true), 650);
      return () => window.clearTimeout(timer);
    }
  };
  void loadUserConfig();
}, []);
```

关键点：

- 引导状态存在服务端 `/api/user-config` 的 `preferences.showOnboarding` 字段里。
- 如果 `showOnboarding` 为 `undefined`，默认显示引导（`?? true`）。
- 加载成功后延迟 650ms 再弹出，避免页面还没渲染完就遮罩。
- 如果 API 失败，也默认显示引导，保证新用户不会被静默跳过。

这意味着：清空浏览器数据或换一个环境，引导会重新出现；只有显式把 `showOnboarding` 设为 `false` 并保存到服务端，引导才会永久关闭。

## 第二段源码：关闭时保存状态

[packages/web/src/app/page.tsx 第 530—547 行](../../../../packages/web/src/app/page.tsx#L530) 处理“跳过”或“开始使用”时的保存：

```ts
const handleDismissOnboarding = React.useCallback(async () => {
  try {
    const response = await fetch('/api/user-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferences: { showOnboarding: false }
      }),
    });
    if (!response.ok) {
      console.error('[DesktopOnboarding] Failed to save onboarding status');
    }
  } catch (error) {
    console.error('[DesktopOnboarding] Error saving onboarding status:', error);
  }
}, []);
```

这里只保存 `preferences.showOnboarding: false`，不保存 LLM 配置。LLM 配置由 `SettingsDialog` 内部通过 `settingsStore` 保存。这种分工是合理的：引导状态属于“用户偏好”，LLM 配置属于“系统设置”。

注意 `handleDismissOnboarding` 没有修改本地 `showDesktopOnboarding`。它只负责持久化。`DesktopOnboarding` 组件内部会调用 `onDismiss` 再调用 `onClose` 来关闭自身。

## 第三段源码：DesktopOnboarding 的引导和步骤

[packages/web/src/components/os/DesktopOnboarding.tsx 第 57—143 行](../../../../packages/web/src/components/os/DesktopOnboarding.tsx#L57) 定义了 8 个引导步骤：

```ts
const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'llm-settings',
    eyebrow: '第一步：模型配置',
    title: '先配置要使用的大模型',
    description: 'OriginOS 不再预置默认模型。...',
    cue: '如果模型没配好，后面的 Agent、技能和多 Agent 协作都无法稳定运行。...',
    selector: '[data-tour="settings-button"]',
    placement: 'left',
    icon: Settings,
  },
  ...
  {
    id: 'dock',
    eyebrow: 'Dock 区',
    title: 'Dock 是启动、切换和返回现场的位置',
    description: '...',
    cue: '...',
    virtualTarget: 'dock',
    placement: 'right',
    icon: MousePointer2,
  },
  ...
];
```

每一步包含：

- `selector`：要高亮的真实 DOM 元素（通过 `data-tour` 属性定位）。
- `virtualTarget: 'dock'`：Dock 是动态定位的，不能靠 selector，需要特殊计算。
- `placement`：提示气泡出现在高亮区域的哪一侧。
- `icon`、`eyebrow`、`title`、`description`、`cue`：提示气泡里的内容。

这个设计把“内容”和“定位”分离。内容由步骤配置决定，定位由 `findTarget` 和 `getBubbleStyle` 计算。

## 第四段源码：高亮区域计算

[packages/web/src/components/os/DesktopOnboarding.tsx 第 175—234 行](../../../../packages/web/src/components/os/DesktopOnboarding.tsx#L175) 计算每一步的目标位置：

```ts
function findGuideElement(step: GuideStep): Element | null {
  const target = step.selector ? document.querySelector(step.selector) : null;
  const fallback = !target && step.fallbackSelector ? document.querySelector(step.fallbackSelector) : null;
  return target ?? fallback;
}

function findTarget(step: GuideStep, isElectron: boolean, dockSide: DockSide): HighlightRect {
  if (step.virtualTarget === 'dock') {
    return getVirtualDockRect(isElectron, dockSide);
  }
  const element = findGuideElement(step);
  if (!element) {
    return {
      left: Math.max(16, window.innerWidth / 2 - 260),
      top: Math.max(72, window.innerHeight / 2 - 160),
      width: Math.min(520, window.innerWidth - 32),
      height: 280,
    };
  }
  return getPaddedRect(element.getBoundingClientRect());
}
```

逻辑很清晰：

1. 如果有 `virtualTarget: 'dock'`，根据 `isElectron` 和 `dockSide` 计算 Dock 的虚拟位置。
2. 否则用 `selector` 查找 DOM 元素，找不到就用 fallback selector。
3. 如果都失败，退回到屏幕中央一个固定区域。

fallback 机制很重要，因为引导运行时页面可能还没完全渲染，或者某些 `data-tour` 元素被条件隐藏。没有 fallback，引导就会定位到 `(0,0)` 或报错。

## 第五段源码：settingsStore 与 LLM 配置

`settingsStore` 是 Zustand store，位于 [packages/web/src/store/settingsStore.ts](../../../../packages/web/src/store/settingsStore.ts)。J06 只关心它与引导的关系，完整实现留到 Unit 6 再精读。这里提取关键结构：

```ts
export interface LLMSettings {
  provider: LLMProviderType;
  anthropic: ProviderConfig;
  openai: ProviderConfig;
}

interface SettingsState {
  llm: LLMSettings;
  preferences: UserPreferences;
  saveLLMSettings: (settings: LLMSettings) => void;
  getEffectiveConfig: () => ProviderConfig & { provider: LLMProviderType };
  loadFromServer: () => Promise<void>;
}
```

`hasConfiguredLLM` 函数检查 anthropic 或 openai 的配置是否可用：

```ts
export function hasConfiguredLLM(settings: LLMSettings): boolean {
  return hasUsableProviderConfig(settings.anthropic) || hasUsableProviderConfig(settings.openai);
}
```

这个函数在 `page.tsx` 里用于决定：

- 顶部栏是否显示 LLM 未配置警告；
- `DesktopOnboarding` 第一步是否显示“已检测到可用 LLM 配置”。

注意 `settingsStore` 自己也会调用 `/api/user-config`（通过 `getUserConfig`/`setUserConfig`），而 `page.tsx` 也直接调用 `/api/user-config` 读取 `showOnboarding`。两者访问的是同一个后端接口，但读取的字段不同。这是当前实现中一个轻微的重复：引导状态由页面直接管理，LLM 配置由 store 管理。

## 引导与 Electron Dock 的联动

[packages/web/src/components/os/DesktopOnboarding.tsx 第 295—312 行](../../../../packages/web/src/components/os/DesktopOnboarding.tsx#L295) 有两条 useEffect：

```ts
React.useEffect(() => {
  if (!detectElectron()) return;
  const highlighted = open && currentStep.id === 'dock';
  void getIpcRenderer().invoke('dock:guide-highlight', highlighted, { side: dockSide });
  return () => { ... };
}, [currentStep.id, dockSide, open]);

React.useEffect(() => {
  const highlighted = open && currentStep.id === 'dock';
  window.dispatchEvent(new CustomEvent('dock:guide-highlight-local', { detail: { highlighted } }));
  ...
}, [currentStep.id, open]);
```

当引导到 Dock 步骤时：

- 在 Electron 环境，通过 IPC 通知原生 Dock 窗口高亮展开。
- 在 Web 环境，通过自定义事件通知 `page.tsx` 里的 `Dock` 组件高亮。

这说明 `DesktopOnboarding` 不仅是一个遮罩层，还需要与 Dock 的状态同步。Unit 3 会详细讲 Dock。

## 本节小结

- 引导是否显示由 `/api/user-config` 的 `preferences.showOnboarding` 决定，默认值为 `true`。
- 引导内容用 `GUIDE_STEPS` 数组配置，每一步通过 `selector` 或 `virtualTarget` 定位页面元素。
- 关闭引导时只把 `showOnboarding: false` 保存到服务端，不影响 LLM 配置。
- `settingsStore` 管理 LLM 配置和语言偏好，`hasConfiguredLLM` 决定第一步的状态提示。
- 引导与 Dock 有 Electron IPC 和 Web 自定义事件两条联动路径。
- `settingsStore` 的完整实现、持久化策略、凭证规范化逻辑属于 Unit 6。

下一节课，我们将离开状态层，去看首页的视觉层：背景组件 `Background` 和全局样式 `globals.css`，理解深色桌面、Acrylic 效果、Tailwind 主题变量是如何组织的。
