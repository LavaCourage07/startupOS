# J35：ThinkingProcess 思考过程 UI

## 让用户看到 Agent“在想什么”

除了最终回复，OriginOS 还把 Agent 的推理过程展示出来：`ThinkingProcess` 是容器，`ThinkingHeader` 负责折叠/展开头部，`ThinkingContent` 负责渲染内容，`useThinkingProcess` 管理展开状态和偏好。

## 第一段源码：useThinkingProcess

[packages/web/src/hooks/useThinkingProcess.ts 第 26–93 行](../../../../packages/web/src/hooks/useThinkingProcess.ts#L26)：

```ts
const DEFAULT_PREFERENCE: ThinkingPreference = {
  displayMode: 'user-choice',
  autoExpandStreaming: false,
  showToolCalls: true,
  showConfidence: false,
};

export function useThinkingProcess(
  initialThinking?: ThinkingData,
  userPreference?: Partial<ThinkingPreference>
): UseThinkingProcessResult {
  const preference = { ...DEFAULT_PREFERENCE, ...userPreference };
  const [thinking, setThinking] = useState<ThinkingData | null>(initialThinking || null);

  const shouldAutoExpand =
    preference.displayMode === 'always-show' ||
    (preference.autoExpandStreaming && thinking?.status === 'in-progress');

  const [isExpanded, setIsExpanded] = useState(shouldAutoExpand);

  const toggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const expand = useCallback(() => {
    if (preference.displayMode !== 'always-hide') {
      setIsExpanded(true);
    }
  }, [preference]);

  const collapse = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const updateThinking = useCallback((content: string, status: ThinkingData['status']) => {
    setThinking(prev => ({
      content,
      status,
      steps: prev?.steps,
      signature: prev?.signature,
      error: status === 'error' ? prev?.error : undefined,
    }));

    if (preference.autoExpandStreaming && status === 'in-progress' && !isExpanded) {
      setIsExpanded(true);
    }
  }, [preference.autoExpandStreaming, isExpanded]);

  return {
    thinking,
    isExpanded: preference.displayMode !== 'always-hide' && isExpanded,
    preference,
    toggle,
    expand,
    collapse,
    updateThinking,
  };
}
```

这个 Hook 的要点：

- `DEFAULT_PREFERENCE` 提供默认偏好：`user-choice`（用户控制展开）、不自动展开流式、展示工具调用、不展示置信度。
- `isExpanded` 的初始值由 `shouldAutoExpand` 决定。
- `updateThinking` 更新内容时保留 `steps` 和 `signature`，只在状态变为 error 时保留/设置错误。
- 如果偏好是 `always-hide`，则返回的 `isExpanded` 始终为 false。

## 第二段源码：ThinkingProcess 容器

[packages/web/src/components/os/cui/thinking/ThinkingProcess.tsx 第 25–92 行](../../../../packages/web/src/components/os/cui/thinking/ThinkingProcess.tsx#L25)：

```tsx
export function ThinkingProcess({
  thinking,
  preference,
  onToggle,
  className = '',
  error,
}: ThinkingProcessProps) {
  const thinkingWithError = thinking
    ? { ...thinking, error: error || thinking.error }
    : null;

  const {
    isExpanded,
    preference: finalPreference,
    toggle,
  } = useThinkingProcess(thinkingWithError ?? undefined, preference);

  const handleToggle = () => {
    toggle();
    onToggle?.(!isExpanded);
  };

  if (!thinkingWithError) {
    return null;
  }

  const isStreaming = thinkingWithError.status === 'in-progress';
  const hasError = thinkingWithError.status === 'error';

  return (
    <div
      className={`cui-thinking-process cui-thinking-process--${isExpanded ? 'expanded' : 'collapsed'} ${
        hasError ? 'cui-thinking-process--error' : ''
      } ${isStreaming ? 'cui-thinking-process--streaming' : ''} ${className}`}
      role="region"
      aria-label="AI 推理过程"
      aria-live="polite"
    >
      {hasError && thinkingWithError.error && (
        <div className="cui-thinking__error">
          <span className="cui-thinking__error-icon">⚠️</span>
          <span className="cui-thinking__error-text">{thinkingWithError.error}</span>
        </div>
      )}

      <ThinkingHeader
        isExpanded={isExpanded}
        isStreaming={isStreaming && !hasError}
        onClick={handleToggle}
        stepCount={thinkingWithError.steps?.length}
      />

      <div
        className={`cui-thinking__content-wrapper ${isExpanded ? 'cui-thinking__content-wrapper--visible' : ''}`}
      >
        {isExpanded && thinkingWithError.content && (
          <ThinkingContent
            content={thinkingWithError.content}
            isStreaming={isStreaming && !hasError}
            preference={finalPreference}
          />
        )}
      </div>
      {/* style jsx ... */}
    </div>
  );
}
```

容器的职责：

1. 合并外部 `error` 和 `thinking.error`；
2. 调用 `useThinkingProcess` 拿到展开状态和偏好；
3. 根据 `status` 计算 `isStreaming` 和 `hasError`；
4. 渲染错误提示、头部、内容区；
5. 使用 `styled-jsx` 定义展开/流式/错误的样式动画。

注意 `aria-live="polite"` 让屏幕阅读器在思考内容更新时友好播报。

## 第三段源码：ThinkingHeader

[packages/web/src/components/os/cui/thinking/ThinkingHeader.tsx 第 23–57 行](../../../../packages/web/src/components/os/cui/thinking/ThinkingHeader.tsx#L23)：

```tsx
export function ThinkingHeader({
  isExpanded,
  isStreaming,
  onClick,
  className = '',
  stepCount,
}: ThinkingHeaderProps) {
  return (
    <button
      className={`cui-thinking-header ${isExpanded ? 'cui-thinking-header--expanded' : ''} ${className}`}
      onClick={onClick}
      type="button"
      aria-expanded={isExpanded}
      aria-controls="thinking-content"
    >
      <div className="cui-thinking-header__left">
        <span className="cui-thinking-header__icon" aria-hidden="true">🧠</span>
        <span className="cui-thinking-header__title">
          {isStreaming ? (
            <>
              思考中
              <StreamingDots />
            </>
          ) : (
            `推理过程${stepCount !== undefined ? ` (${stepCount}步骤)` : ''}`
          )}
        </span>
      </div>

      {!isStreaming && (
        <span className="cui-thinking-header__toggle" aria-hidden="true">
          {isExpanded ? '▲' : '▼'}
        </span>
      )}
      {/* style jsx ... */}
    </button>
  );
}
```

头部是一个按钮：

- 流式中时显示“思考中” + 跳动小点，不显示展开箭头；
- 非流式时显示“推理过程”和步骤数，并显示展开/收起箭头。

`aria-expanded` 和 `aria-controls` 让可访问性工具知道这个按钮控制哪个内容区。

## 第四段源码：ThinkingContent

[packages/web/src/components/os/cui/thinking/ThinkingContent.tsx 第 21–67 行](../../../../packages/web/src/components/os/cui/thinking/ThinkingContent.tsx#L21)：

```tsx
export function ThinkingContent({
  content,
  isStreaming,
  className = '',
}: ThinkingContentProps) {
  const renderContent = () => {
    return content.split('\n').map((line, idx) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return null;

      return (
        <p key={idx} className="cui-thinking__paragraph">
          {trimmedLine}
        </p>
      );
    });
  };

  const renderToolCalls = () => {
    // TODO: 实现 tool calls 可视化（P1）
    return null;
  };

  return (
    <div
      id="thinking-content"
      className={`cui-thinking-content ${isStreaming ? 'cui-thinking-content--streaming' : ''} ${className}`}
      role="log"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="cui-thinking__markdown">
        {content ? renderContent() : <p className="cui-thinking__empty">等待推理内容...</p>}
      </div>

      {renderToolCalls()}

      {isStreaming && content && (
        <span className="cui-thinking__cursor" aria-hidden="true" />
      )}
      {/* style jsx ... */}
    </div>
  );
}
```

`ThinkingContent` 把思考内容按行渲染成段落，流式时末尾加一个闪烁光标。`renderToolCalls` 目前留空，是后续扩展点。

## 本节小结

- `useThinkingProcess` 管理思考内容的展开/收起状态和偏好。
- `ThinkingProcess` 是容器，合并错误信息，根据 status 切换流式/错误样式。
- `ThinkingHeader` 显示“思考中”或“推理过程”，并作为折叠按钮。
- `ThinkingContent` 按行渲染内容，流式时展示闪烁光标。
- 整个组件支持 `displayMode` 偏好：始终展示、用户控制、始终隐藏。

下一节课看 Agent 生命周期 Hooks：`useAgent`、`useAgentLifecycle`。
