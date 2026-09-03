# J42：CUIDialogPanel、ArtifactDisplayPanel 与 ResizableLayout

## 左右分栏：把通用 UI 拼成业务视图

`InterviewWindow` 内部不是一个大组件把所有 UI 都写完，而是拆成三块：

1. `CUIDialogPanel`：左侧对话区，负责聊天、附件、工具执行帧。
2. `ArtifactDisplayPanel`：右侧业务模型区，负责按阶段展示空态/收集中/生成中/预览态。
3. `ResizableLayout`：左右分栏容器，提供可拖拽的分割线。

这节课读这三块，理解 OriginOS 如何把通用 `ChatMessageList` / `ChatInputBar` 拼出特定的业务界面。

## 第一段源码：CUIDialogPanel 的输入组合

[packages/web/src/components/interview/CUIDialogPanel.tsx 第 37–97 行](../../../../packages/web/src/components/interview/CUIDialogPanel.tsx#L37)：

```tsx
export function CUIDialogPanel({
  sessionId: _sessionId,
  messages,
  isLoading,
  currentStep: _currentStep,
  totalSteps: _totalSteps,
  canGoBack: _canGoBack,
  toolExecutions,
  onSendMessage,
  onGoBack: _onGoBack,
  uploadBasePath,
  onStop,
  isGenerating,
}: CUIDialogPanelProps) {
```

`CUIDialogPanel` 的 props 故意设计得很宽：

- `messages` / `isLoading` / `isGenerating`：展示消息和状态。
- `onSendMessage` / `onStop`：发送和停止。
- `toolExecutions`：工具执行帧，显示 Agent 正在做什么。
- `uploadBasePath`：如果提供，就显示附件上传按钮。
- `sessionId` / `currentStep` / `totalSteps` / `canGoBack` / `onGoBack`：当前版本里已经通过父组件处理，所以加下划线表示“已解构但不使用”。

这种“宽接口、部分弃用”的设计常见于快速迭代期。父组件传进来，子组件先保留 props 接口，后续需要时再启用。

## 第二段源码：附件与消息发送的缝合

[packages/web/src/components/interview/CUIDialogPanel.tsx 第 72–97 行](../../../../packages/web/src/components/interview/CUIDialogPanel.tsx#L72)：

```tsx
  const handleUpload = useFileUpload({
    basePath: uploadBasePath ?? '',
    onUploaded: handleFileUploaded,
    onError: handleFileError,
    onStateChange: handleUploadStateChange,
  });

  const handleRemoveFile = useCallback((index: number) => {
    if (index === -1) {
      setUploadError(null);
      return;
    }
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Wrap onSendMessage to include attachment info when sending, then clear chips
  const wrappedSendMessage = useCallback((content: string) => {
    if (uploadedFiles.length > 0) {
      const fileNames = uploadedFiles.map(f => f.name).join('、');
      const fileHint = `[附件: ${fileNames}]\n${content}`;
      setUploadedFiles([]);
      onSendMessage(fileHint);
    } else {
      onSendMessage(content);
    }
  }, [uploadedFiles, onSendMessage]);
```

`CUIDialogPanel` 把附件上传和消息发送缝合在一起：

1. `useFileUpload` 负责把文件上传到 `uploadBasePath`。
2. 上传成功后，文件以 chip 形式显示在 `ChatInputBar` 里。
3. 用户点击发送时，`wrappedSendMessage` 把文件名拼接成 `[附件: xxx]` 前缀，塞进用户消息内容。
4. 发送成功后清空 `uploadedFiles`。

> 注意：这里没有把文件内容或文件路径直接传给 LLM，而是只传了文件名文本。如果后续要让 Agent 真正读取文件内容，需要在 system prompt 或工具调用里补充附件路径。

## 第三段源码：工具执行帧的可见性管理

[packages/web/src/components/interview/CUIDialogPanel.tsx 第 99–143 行](../../../../packages/web/src/components/interview/CUIDialogPanel.tsx#L99)：

```tsx
  // 同步 toolExecutions，新增工具时加入可见集合
  useEffect(() => {
    if (!toolExecutions || toolExecutions.length === 0) {
      setVisibleToolIds(new Set());
      return;
    }
    const newIds = new Set(visibleToolIds);
    for (const tool of toolExecutions) {
      newIds.add(tool.id);
    }
    setVisibleToolIds(newIds);
  }, [toolExecutions]);

  // 工具执行完成后 1.5s 自动从可见集合中移除
  const pendingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!toolExecutions || toolExecutions.length === 0) return;

    const completedTools = toolExecutions.filter(
      t => t.status === 'completed' || t.status === 'error'
    );

    for (const tool of completedTools) {
      if (visibleToolIds.has(tool.id) && !pendingTimersRef.current.has(tool.id)) {
        const timer = setTimeout(() => {
          setVisibleToolIds(prev => {
            const next = new Set(prev);
            next.delete(tool.id);
            return next;
          });
          pendingTimersRef.current.delete(tool.id);
        }, 1500);
        pendingTimersRef.current.set(tool.id, timer);
      }
    }
  }, [toolExecutions, visibleToolIds]);
```

`ChatMessageList` 会接收 `toolExecutions` 并在消息气泡旁边展示工具卡片。`CUIDialogPanel` 不希望所有历史工具都一直显示，于是做了一个“可见集合”：

- 新工具进来时立刻加入可见集合；
- 工具完成或出错后 1.5 秒再移出可见集合；
- 组件卸载时清理所有定时器。

这样既能让用户看到 Agent 正在执行什么，又不会在对话里堆满已完成的工具卡片。

## 第四段源码：ResizableLayout 的拖拽实现

[packages/web/src/components/interview/ResizableLayout.tsx 第 19–95 行](../../../../packages/web/src/components/interview/ResizableLayout.tsx#L19)：

```tsx
export function ResizableLayout({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 400,
  minLeftWidth = 300,
  maxLeftWidth = 800,
  className = '',
}: ResizableLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle drag resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;

      // Clamp width between min and max
      const clampedWidth = Math.max(
        minLeftWidth,
        Math.min(maxLeftWidth, newWidth)
      );

      setLeftWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minLeftWidth, maxLeftWidth]);
```

这是一个典型的左右分栏实现：

1. `leftPanel` 和 `rightPanel` 都是 `React.ReactNode`；
2. 左侧宽度用 `leftWidth` state 控制，默认 400px，最小 300px，最大 800px；
3. 中间分割线监听 `onMouseDown`，进入拖拽状态；
4. 拖拽期间在 `document` 上监听 `mousemove` / `mouseup`，计算鼠标相对容器左侧的偏移；
5. 松开鼠标时移除全局监听。

> 这里没有把宽度持久化到 localStorage，也没有支持触摸设备。如果后续要支持移动端，需要补充 `touchstart` / `touchmove` / `touchend` 事件。

## 第五段源码：ArtifactDisplayPanel 的四种阶段

[packages/web/src/components/interview/ArtifactDisplayPanel.tsx 第 66–105 行](../../../../packages/web/src/components/interview/ArtifactDisplayPanel.tsx#L66)：

```tsx
export function ArtifactDisplayPanel({
  mode,
  answers: _answers = {},
  ontology,
  generationMessage = '正在生成业务模型...',
  onCreateProject,
  isCreatingProject = false,
  onEntityClick,
  selectedEntity,
  activeTab = '图谱',
  onTabChange,
}: ArtifactDisplayPanelProps) {
  console.log('[ArtifactDisplayPanel] render', {
    mode,
    hasOntology: Boolean(ontology),
    nodesCount: ontology?.nodes.length ?? 0,
    activeTab,
  });
  return (
    <div className="flex flex-col h-full bg-transparent">
      <PanelHeader mode={mode} />
      <div className="flex-1 overflow-y-auto">
        {mode === 'empty' && <EmptyState />}
        {mode === 'collecting' && <CollectingState ontology={ontology} onEntityClick={onEntityClick} selectedEntity={selectedEntity} />}
        {mode === 'generating' && <GeneratingState message={generationMessage} />}
        {mode === 'preview' && ontology && (
          <PreviewState
            ontology={ontology}
            onCreateProject={onCreateProject}
            isCreatingProject={isCreatingProject}
            onEntityClick={onEntityClick}
            selectedEntity={selectedEntity}
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
        )}
      </div>
    </div>
  );
}
```

`ArtifactDisplayPanel` 完全由 `mode` 驱动：

| 阶段 | 含义 | UI |
| --- | --- | --- |
| `empty` | 还没有任何业务模型 | 空态插画 + 提示文字 |
| `collecting` | Agent 正在从对话中提取概念 | 顶部脉冲徽章 + 下方实体卡片 |
| `generating` | 正在把收集到的概念整理成本体 | 加载动画 + 提示文字 |
| `preview` | 模型已生成，可查看/创建项目 | Tabs（图谱/实体/关系/规则）+ 创建按钮 |

每个阶段都是独立子组件，父组件只负责传 `mode` 和 `ontology`。

## 第六段源码：collecting 阶段的模型预览

[packages/web/src/components/interview/ArtifactDisplayPanel.tsx 第 121–162 行](../../../../packages/web/src/components/interview/ArtifactDisplayPanel.tsx#L121)：

```tsx
function CollectingState({ ontology, onEntityClick, selectedEntity }: {
  ontology?: OntologyModel | null;
  onEntityClick?: (entityName: string) => void;
  selectedEntity?: string;
}) {
  const entities = ontology?.nodes.filter((n) => n.type === 'entity' || n.type === 'class') ?? [];

  return (
    <div className="p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <span className="text-xs text-gray-500">正在从对话中提取业务概念</span>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-gray-700 border border-primary/20 animate-pulse">
          正在分析...
        </span>
      </div>

      {/* 图谱视图 */}
      <div className="flex-1 min-h-[400px] bg-white/30 rounded-xl border border-white/40 overflow-hidden">
        <OntologyGraph ontology={ontology} onEntityClick={onEntityClick} selectedEntity={selectedEntity} />
      </div>

      {/* 实体列表 */}
      {entities.length > 0 && (
        <div className="mt-4 space-y-2 shrink-0">
          <p className="text-xs text-gray-500 font-medium">已识别的实体 ({entities.length})</p>
          {entities.slice(0, 5).map((node) => (
            <EntityCard key={node.id} node={node} compact />
          ))}
          {entities.length > 5 && (
            <p className="text-xs text-gray-400">... 还有 {entities.length - 5} 个实体</p>
          )}
        </div>
      )}
```

`CollectingState` 同时展示图谱和实体列表：

- 上方是 `OntologyGraph` Canvas 力导向图；
- 下方是最多 5 个紧凑版 `EntityCard`，超出显示“还有 N 个”。

注意 `OntologyGraph` 在 `collecting` 和 `preview` 两个阶段都会用到，只是容器大小和缩放不同。

## 第七段源码：preview 阶段的 Tab 切换

[packages/web/src/components/interview/ArtifactDisplayPanel.tsx 第 215–237 行](../../../../packages/web/src/components/interview/ArtifactDisplayPanel.tsx#L215)：

```tsx
function PreviewState({ ontology, onCreateProject, isCreatingProject, onEntityClick, selectedEntity, activeTab, onTabChange }: {
  ontology: OntologyModel;
  onCreateProject?: () => void;
  isCreatingProject?: boolean;
  onEntityClick?: (entityName: string) => void;
  selectedEntity?: string;
  activeTab?: '图谱' | '实体' | '关系' | '规则';
  onTabChange?: (tab: '图谱' | '实体' | '关系' | '规则') => void;
}) {
  const [localActiveTab, setLocalActiveTab] = useState<'图谱' | '实体' | '关系' | '规则'>(activeTab || '图谱');

  // Sync with parent tab when it changes
  useEffect(() => {
    if (activeTab && activeTab !== localActiveTab) {
      setLocalActiveTab(activeTab);
    }
  }, [activeTab, localActiveTab]);

  // Notify parent of tab changes
  const handleTabChange = (tab: '图谱' | '实体' | '关系' | '规则') => {
    setLocalActiveTab(tab);
    onTabChange?.(tab);
  };
```

`PreviewState` 采用“受控 + 内部 state”双保险：

- 默认用 `activeTab` prop；
- 内部维护 `localActiveTab`，点击 Tab 时先更新本地再通知父组件；
- `useEffect` 保证父组件传入的 `activeTab` 变化时能同步回来。

这种模式在需要“子组件也能独立操作”的场景很常见，但要注意不要在 `useEffect` 里产生无限循环。这里判断条件是 `activeTab !== localActiveTab`，不会循环。

## 第八段源码：实体/关系/规则卡片

[packages/web/src/components/interview/ArtifactDisplayPanel.tsx 第 164–197 行](../../../../packages/web/src/components/interview/ArtifactDisplayPanel.tsx#L164)：

```tsx
function EntityCard({ node, compact = false, selectedEntity }: { node: OntologyNode; compact?: boolean; selectedEntity?: string }) {
  const props = node.children?.filter((c) => c.type === 'property') ?? [];
  console.log(`[EntityCard] Rendering "${node.name}":`, {
    hasChildren: !!node.children,
    childrenLength: node.children?.length || 0,
    propsLength: props.length,
    children: node.children
  });
  return (
    <div className={`bg-white/60 border border-white/40 rounded-lg overflow-hidden border-l-2 border-l-primary transition-all ${
      selectedEntity === node.name ? 'ring-2 ring-primary ring-offset-2' : ''
    } ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <p className={`text-sm font-medium text-gray-900 ${compact ? 'text-xs' : ''}`}>{node.name}</p>
      {!compact && node.description && (
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{node.description}</p>
      )}
      {props.length > 0 && (
        <div className={`flex flex-wrap gap-1 ${compact ? 'mt-1' : 'mt-2'}`}>
          {props.slice(0, compact ? 2 : undefined).map((p) => (
            <span
              key={p.id}
              className="text-xs px-2 py-0.5 rounded bg-white/40 text-gray-600 border border-white/40"
            >
              {p.name}
            </span>
          ))}
          {compact && props.length > 2 && (
            <span className="text-xs text-gray-400">+{props.length - 2}</span>
          )}
        </div>
      )}
    </div>
  );
}
```

`EntityCard` 支持 `compact` 模式：

- 紧凑模式只显示实体名 + 最多 2 个属性标签；
- 完整模式显示描述 + 全部属性。

`RelationshipCard` 会把 `name` 按 `→` 拆分，左侧显示 from，右侧显示 to，并尝试从 `description` 里提取基数（cardinality）。

## 本节小结

- `CUIDialogPanel` 是左侧对话区的薄封装，把 `ChatMessageList`、`ChatInputBar`、附件上传、工具执行帧组合起来。
- 附件发送采用“文件名拼进消息文本”的轻量方案，Agent 要真正读取文件还需配合工具或 prompt。
- `ResizableLayout` 用鼠标事件实现左右分栏，宽度受限在 `minLeftWidth` 和 `maxLeftWidth` 之间。
- `ArtifactDisplayPanel` 按 `empty/collecting/generating/preview` 四种阶段展示业务模型，每个阶段独立子组件。
- `PreviewState` 用 Tabs 切分图谱/实体/关系/规则，并把创建项目按钮放在底部。

下一节课读旧版访谈流程 `ProjectInterview`、`interviewStore`、以及 `SkillInterview` 和 `useProjectInitialization`。
