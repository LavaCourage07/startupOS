# J44：访谈界面子组件

## 旧版访谈的五个 UI 面

`ProjectInterview` 把每个状态交给一个独立子组件渲染。这节课读这五个子组件：

- `WelcomeScreen`：欢迎弹窗，说明访谈价值。
- `QuestionInput`：问题输入面板，带进度点和步骤概览。
- `GeneratingState`：生成中的加载与进度条。
- `OntologyPreview`：本体预览，展示生成的结构。
- `OntologyEditor`：本体编辑，支持增删改节点。

## 第一段源码：WelcomeScreen 的模态结构

[packages/web/src/components/interview/WelcomeScreen.tsx 第 29–197 行](../../../../packages/web/src/components/interview/WelcomeScreen.tsx#L29)：

```tsx
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
          ...
        </div>
      </div>
    </>
  );
}
```

`WelcomeScreen` 是一个全屏模态：

- 底层遮罩 `z-40`，点击可取消；
- 内容面板 `z-50`，`pointer-events-auto` 确保按钮可点；
- 宽度最大 560px，带 `animate-slide-up` 从底部滑入动画。

注意这里用的是 `fixed inset-0` 而不是窗口管理器。`ProjectInterview` 是一个独立页面组件（`app/interview/page.tsx` 引入），所以它的弹窗直接用 CSS 全屏定位，不走 `AppWindowManager`。

## 第二段源码：WelcomeScreen 的信息架构

[packages/web/src/components/interview/WelcomeScreen.tsx 第 70–149 行](../../../../packages/web/src/components/interview/WelcomeScreen.tsx#L70)：

```tsx
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
    <span className="text-sm text-text-secondary">项目访谈快速建模</span>
  </div>
  ...
</div>

{/* 本体说明卡片 */}
<div className="px-6 mb-5">
  <div className="rounded-lg bg-muted/50 p-4 space-y-2">
    <h3 className="text-sm font-medium text-text-primary">什么是项目本体？</h3>
    <p className="text-xs text-text-secondary leading-relaxed">
      本体定义了项目的核心概念、关系和结构...
    </p>
  </div>
</div>

{/* 访谈步骤 */}
<div className="px-6 mb-5">
  <h3 className="text-sm font-medium text-text-primary mb-2">
    我们会问 3 个简单问题：
  </h3>
  ...
</div>
```

`WelcomeScreen` 的信息层次很清晰：

1. 标题 + 价值主张；
2. 三个特性（快速建模、图谱可视化、自然对话）；
3. 本体概念科普；
4. 三个问题预告；
5. 时间预估；
6. 操作按钮。

这是引导用户接受访谈的经典结构：先讲价值，再降低预期（只有 3 个问题、5 分钟）。

## 第三段源码：QuestionInput 的右侧滑入面板

[packages/web/src/components/interview/QuestionInput.tsx 第 95–112 行](../../../../packages/web/src/components/interview/QuestionInput.tsx#L95)：

```tsx
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
```

`QuestionInput` 不是居中模态，而是右侧滑入面板：

- 固定宽度 580px，高度 520px；
- 顶部距离菜单栏 60px；
- `animate-slide-right` 从右侧滑入。

这种设计让访谈感觉像是一个“侧边工作区”，而不是打断当前任务的弹窗。

## 第四段源码：进度指示与步骤概览

[packages/web/src/components/interview/QuestionInput.tsx 第 130–205 行](../../../../packages/web/src/components/interview/QuestionInput.tsx#L130)：

```tsx
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

{/* ... */}

{/* 步骤概览 */}
<div className="px-5 pb-3">
  <StepOverview
    total={totalSteps}
    current={stepNumber}
    labels={stepLabels}
  />
</div>
```

`QuestionInput` 同时展示两种进度：

- `ProgressDots`：顶部点状进度，直观显示当前在第几步；
- `StepOverview`：底部步骤标签，显示每一步的名称。

两个组件都来自 `@/components/ui/progress-dots`，属于通用 UI 组件，不只用于访谈。

## 第五段源码：输入验证与抖动反馈

[packages/web/src/components/interview/QuestionInput.tsx 第 63–93 行](../../../../packages/web/src/components/interview/QuestionInput.tsx#L63)：

```tsx
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
```

`QuestionInput` 的验证很简单：非空校验。

- 当 `value` 为空时点击下一步，显示错误文字，并给 textarea 加 `animate-shake` 抖动动画；
- 自动聚焦 textarea，让用户进入下一步后可以直接输入；
- 用户开始输入后自动清除错误。

## 第六段源码：GeneratingState 的进度动画

[packages/web/src/components/interview/GeneratingState.tsx 第 27–145 行](../../../../packages/web/src/components/interview/GeneratingState.tsx#L27)：

```tsx
export function GeneratingState({
  message = "正在生成本体结构...",
  progress = 60,
  error,
  onCancel,
}: GeneratingStateProps) {
  return (
    <>
      {/* 模态面板 */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        <div
          className={cn(
            "absolute right-0 top-[60px] w-[580px] h-[520px]",
            "bg-panel rounded-xl shadow-2xl flex flex-col",
            "pointer-events-auto animate-slide-right"
          )}
        >
          ...
          {error ? (
            /* 错误状态 */
            <div className="text-center space-y-4">
              ...
              <button onClick={onCancel}>重试</button>
            </div>
          ) : (
            /* 加载中状态 */
            <>
              <div className="relative mb-6">
                <div className={cn("w-16 h-16 rounded-full", "border-[3px] border-t-primary ... animate-spin")} />
              </div>
              <h3>{message}</h3>
              <div className="w-full mb-3">
                <div className="h-2 rounded-full bg-input-dark overflow-hidden">
                  <div style={{ width: `${progress}%` }} />
                </div>
              </div>
              <p>正在分析您的访谈数据...</p>
              <p>这可能需要 3-5 秒</p>
              <div>即将为您生成：1 个领域层、2-3 个概念对象、对应关系</div>
            </>
          )}
```

`GeneratingState` 除了旋转加载器和进度条，还在底部预告即将生成的内容。这种“内容预览”能让用户感知等待是有价值的。

错误状态时，加载器变成警告图标，并提供“重试”按钮。

## 第七段源码：OntologyPreview 的结构展示

[packages/web/src/components/interview/OntologyPreview.tsx 第 52–99 行](../../../../packages/web/src/components/interview/OntologyPreview.tsx#L52)：

```tsx
export function OntologyPreview({ ontology, onConfirm, onEdit }: OntologyPreviewProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-3xl shadow-xl max-h-[90vh] flex flex-col">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Check className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl text-foreground">本体模型已生成！</CardTitle>
              <CardDescription>我们已根据你的回答生成了一个项目本体</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 overflow-y-auto flex-1">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <h3 className="font-semibold text-lg text-foreground">{ontology.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{ontology.description}</p>
          </div>
          <div className="space-y-3">
            <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              结构 ({ontology.nodes.length} 顶级项)
            </h4>
            <div className="space-y-2 p-4 rounded-lg border bg-card">
              {ontology.nodes.map((node) => (
                <OntologyNodeItem key={node.id} node={node} />
              ))}
            </div>
          </div>
          <div className="flex gap-4 pt-4 border-t">
            <Button onClick={onEdit} variant="outline">编辑本体</Button>
            <Button onClick={onConfirm}>确认并继续</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

`OntologyPreview` 用 `Card` 展示生成的本体：

- 顶部成功图标 + 标题；
- 中间本体名称和描述；
- 下方递归展示 `OntologyNodeItem`；
- 底部“编辑本体”和“确认并继续”两个按钮。

`OntologyNodeItem` 根据 `node.type` 显示不同图标和标签，类型到图标的映射写死在组件里。

## 第八段源码：OntologyNodeItem 的递归展示

[packages/web/src/components/interview/OntologyPreview.tsx 第 12–49 行](../../../../packages/web/src/components/interview/OntologyPreview.tsx#L12)：

```tsx
function OntologyNodeItem({ node, level = 0 }: { node: OntologyNode; level?: number }) {
  const typeLabels: Record<OntologyNode["type"], string> = {
    entity: "实体",
    class: "类",
    property: "属性",
    relationship: "关系",
    rule: "规则",
  };

  const typeIcons: Record<OntologyNode["type"], JSX.Element> = {
    entity: <Box className="w-4 h-4 text-primary" />,
    class: <Folder className="w-4 h-4 text-blue-500" />,
    property: <FileText className="w-4 h-4 text-teal-500" />,
    relationship: <GitBranch className="w-4 h-4 text-purple-500" />,
    rule: <FileText className="w-4 h-4 text-orange-500" />,
  };

  return (
    <div className="space-y-2" style={{ marginLeft: `${level * 24}px` }}>
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
        {typeIcons[node.type]}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{node.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {typeLabels[node.type]}
            </span>
          </div>
          {node.description && (
            <p className="text-sm text-muted-foreground mt-1">{node.description}</p>
          )}
        </div>
      </div>
      {node.children?.map((child) => (
        <OntologyNodeItem key={child.id} node={child} level={level + 1} />
      ))}
    </div>
  );
}
```

递归组件的关键：

- `level` 控制 `marginLeft`，形成层级缩进；
- `node.children` 存在时继续渲染 `OntologyNodeItem`；
- 图标和标签用 `Record` 映射，类型安全。

## 第九段源码：OntologyEditor 的递归编辑

[packages/web/src/components/interview/OntologyEditor.tsx 第 166–187 行](../../../../packages/web/src/components/interview/OntologyEditor.tsx#L166)：

```tsx
export function OntologyEditor({ ontology, onSave, onCancel }: OntologyEditorProps) {
  const [editedOntology, setEditedOntology] = useState<OntologyModel>({ ...ontology });
  const [_editingNodeId, _setEditingNodeId] = useState<string | null>(null);

  const handleUpdateNode = (nodeId: string, updates: Partial<OntologyNode>) => {
    const updateNodeRecursive = (nodes: OntologyNode[]): OntologyNode[] => {
      return nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, ...updates };
        }
        if (node.children) {
          return { ...node, children: updateNodeRecursive(node.children) };
        }
        return node;
      });
    };

    setEditedOntology({
      ...editedOntology,
      nodes: updateNodeRecursive(editedOntology.nodes),
    });
  };
```

`OntologyEditor` 的核心是三个递归函数：

- `updateNodeRecursive`：按 ID 找到节点并更新；
- `deleteNodeRecursive`：按 ID 删除节点；
- `addNodeRecursive`：按 parentId 添加子节点。

每次修改都生成新的 `editedOntology` state，点保存时才调用 `onSave` 传回父组件。

## 第十段源码：OntologyNodeEditor 的编辑态切换

[packages/web/src/components/interview/OntologyEditor.tsx 第 31–55 行](../../../../packages/web/src/components/interview/OntologyEditor.tsx#L31)：

```tsx
function OntologyNodeEditor({
  node,
  level = 0,
  onUpdate,
  onDelete,
  onAddChild,
}: {
  node: EditingNode;
  level?: number;
  onUpdate: (nodeId: string, updates: Partial<OntologyNode>) => void;
  onDelete: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    name: node.name,
    description: node.description || "",
    type: node.type,
  });

  const handleSave = () => {
    onUpdate(node.id, editValues);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValues({ name: node.name, description: node.description || "", type: node.type });
    setIsEditing(false);
  };
```

每个节点有两种状态：

- 展示态：显示名称、类型标签、描述，鼠标悬停显示编辑/添加/删除按钮；
- 编辑态：显示表单，可修改名称、类型、描述。

`type` 用原生 `select` 而不是 shadcn 的 `Select`，这在 Tailwind + shadcn 项目里很常见，但需要注意原生 select 的样式跨平台一致性。

## 本节小结

- `WelcomeScreen` 是居中模态，用价值主张 + 问题预告引导用户开始访谈。
- `QuestionInput` 是右侧滑入面板，有点状进度、步骤概览、自动聚焦和抖动验证。
- `GeneratingState` 展示旋转加载器、进度条、内容预览和错误重试。
- `OntologyPreview` 用递归 `OntologyNodeItem` 展示生成的本体结构。
- `OntologyEditor` 用递归编辑组件实现节点增删改，保存时才把完整本体传回父组件。

下一节课读 `OntologyGraph` 和 `businessModelToOntology`，看 Canvas 力导向图如何把数据结构画出来。
