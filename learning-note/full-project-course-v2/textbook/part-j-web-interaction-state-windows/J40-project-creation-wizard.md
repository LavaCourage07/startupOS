# J40：项目创建向导

## 项目创建的第一种入口

OriginOS 里有两种常见的“创建项目”入口：

1. **向导式**：`ProjectCreationWizard` 弹出一个四步表单，直接收集背景、优先级、工作模式，然后调用后端完成创建。
2. **访谈式**：`InterviewWindow` 通过 AI 对话边聊边生成本体（下一节课讲）。

这节课先读向导式入口。它的代码结构非常典型：一个父组件管理全局状态和步骤流转，每个步骤拆成独立子组件负责单一交互。

## 第一段源码：ProjectCreationWizard 主结构

[packages/web/src/components/project/ProjectCreationWizard.tsx 第 55–126 行](../../../../packages/web/src/components/project/ProjectCreationWizard.tsx#L55)：

```tsx
export default function ProjectCreationWizard({
  isOpen,
  onClose,
  onComplete,
  defaultValues,
}: ProjectCreationWizardProps) {
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [_projectId, setProjectId] = useState<string | null>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardState, setWizardState] = useState<WizardState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [data, setData] = useState<ProjectCreationData>({
    name: defaultValues?.name ?? '',
    background: defaultValues?.background ?? '',
    priorities: defaultValues?.priorities ?? [],
    workMode: defaultValues?.workMode ?? null,
    customDescriptions: defaultValues?.customDescriptions ?? {},
  });

  // Created project
  const [createdProject, setCreatedProject] = useState<{
    id: string;
    name: string;
    path: string;
  } | null>(null);
```

状态可以分成四类：

| 状态 | 用途 |
| --- | --- |
| `sessionId` / `_projectId` | 与后端会话/项目 ID 关联，后续提交答案和完成创建都需要。 |
| `currentStep` / `wizardState` / `error` | 控制 UI 显示哪一步、是否正在创建、是否有错误。 |
| `data` | 用户填写的表单数据，包括自定义描述。 |
| `createdProject` | 创建成功后的项目信息，用于 `SuccessState` 展示和跳转。 |

注意 `_projectId` 变量名带下划线，表示当前组件里只设置、没使用，主要由后端返回后保存，方便调试或后续扩展。

## 第二段源码：启动会话与提交步骤答案

[packages/web/src/components/project/ProjectCreationWizard.tsx 第 90–159 行](../../../../packages/web/src/components/project/ProjectCreationWizard.tsx#L90)：

```tsx
  // Start session
  const startSession = useCallback(async () => {
    try {
      const result = await startProjectCreation({
        userId: 'current-user', // TODO: Get from auth context
        projectName: data.name || undefined,
        defaultValues: {
          background: data.background || undefined,
          priorities: data.priorities.length > 0 ? data.priorities : undefined,
          workMode: data.workMode || undefined,
        },
      });

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to start session');
      }

      setSessionId(result.data.sessionId);
      setProjectId(result.data.projectId);
      setCurrentStep(1);
      setWizardState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setWizardState('error');
    }
  }, [data]);

  // Handle step completion
  const handleStepComplete = useCallback(async (step: number, stepData: Partial<ProjectCreationData>) => {
    setData(prev => ({ ...prev, ...stepData }));

    if (!sessionId) {
      await startSession();
    }

    if (sessionId) {
      try {
        const result = await submitProjectCreationAnswer(sessionId, {
          step,
          answer: {
            type: step === 1 ? 'text' : step === 4 ? 'confirm' : 'choice',
            value: step === 1
              ? stepData.background ?? data.background
              : step === 2
                ? stepData.priorities ?? data.priorities
                : step === 3
                  ? stepData.workMode ?? data.workMode ?? ''
                  : {},
            customDescription: step === 2
              ? stepData.customDescriptions?.priorities
              : step === 3
                ? stepData.customDescriptions?.workMode
                : undefined,
          },
        });

        if (!result.success) {
          throw new Error(result.error?.message || 'Failed to submit answer');
        }

        if (step < 4) {
          setCurrentStep(step + 1);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit answer');
      }
    }
  }, [sessionId, data, startSession]);
```

这里有两个容易忽略的细节：

1. **懒启动会话**：`startSession` 不是组件挂载时调用，而是用户第一次点击“下一步”时才调用。这样如果用户直接关闭弹窗，不会留下空会话。
2. **`sessionId` 的时序**：`handleStepComplete` 先检查 `sessionId`，如果没有就 `await startSession()`。但 `startSession` 内部通过 `setSessionId` 更新状态，React 的状态更新是异步的，所以紧接着的 `if (sessionId)` 在第一次提交时可能还是 `null`。实际代码里这会导致第一次答案没有提交到后端，只在前端推进了步骤。当前实现依赖用户再次点击“下一步”时 `sessionId` 已经存在。

> 这是一个真实的时序缺口。如果你要修复它，可以把 `startSession` 的返回值设计成返回 `sessionId`，而不是依赖组件状态。

## 第三段源码：完成创建与步骤渲染

[packages/web/src/components/project/ProjectCreationWizard.tsx 第 161–238 行](../../../../packages/web/src/components/project/ProjectCreationWizard.tsx#L161)：

```tsx
  const handleComplete = useCallback(async () => {
    if (!sessionId) return;

    setWizardState('creating');
    setError(null);

    try {
      const result = await completeProjectCreation(sessionId, {
        projectName: data.name || 'Untitled Project',
        confirmData: {
          background: data.background,
          priorities: data.priorities,
          workMode: data.workMode ?? undefined,
        },
      });

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to create project');
      }

      setCreatedProject(result.data.project);
      setWizardState('success');

      if (onComplete) {
        onComplete(result.data.project);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setWizardState('error');
    }
  }, [sessionId, data, onComplete]);

  const handleEnterProject = useCallback(() => {
    if (createdProject) {
      window.location.href = createdProject.path;
    }
    handleClose();
  }, [createdProject, handleClose]);
```

完成创建后：

- `wizardState` 变成 `'creating'`，显示 `CreatingState`。
- 成功后变成 `'success'`，显示 `SuccessState`。
- 用户点击“进入项目”直接用 `window.location.href` 跳转（这里不是路由导航，是全页刷新式跳转，因为项目路径可能是外部文件系统路径）。

## 第四段源码：步骤子组件

### StepBackground

[packages/web/src/components/project/wizard/StepBackground.tsx 第 17–78 行](../../../../packages/web/src/components/project/wizard/StepBackground.tsx#L17)：

```tsx
export function StepBackground({
  value,
  onChange,
  onNext,
  onSkip,
  question,
}: StepBackgroundProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
      e.preventDefault();
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {question?.text || '这个项目主要是做什么的？'}
        </h2>
        {question?.hint && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            💡 {question.hint}
          </p>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={question?.placeholder || '例如：给电商网站做库存管理系统...'}
        className="w-full h-32 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-primary/50 resize-none"
        rows={4}
      />
      ...
    </div>
  );
}
```

这是一个典型的受控输入步骤：

- `value` / `onChange` 来自父组件；
- `Enter` 直接下一步（多行文本用 `Shift+Enter` 换行）；
- 问题文本、提示、占位符都可以从 `question` prop 配置，也提供默认值。

### StepPriorities

[packages/web/src/components/project/wizard/StepPriorities.tsx 第 19–174 行](../../../../packages/web/src/components/project/wizard/StepPriorities.tsx#L19)：

```tsx
const DEFAULT_OPTIONS: QuestionOption[] = [
  { value: 'velocity', label: '快速上线', description: '先把功能做出来，后续再优化' },
  { value: 'stability', label: '稳定可靠', description: '代码质量高，减少 bug 和维护成本' },
  { value: 'maintainability', label: '易于维护', description: '结构清晰，方便后续扩展和团队协作' },
];
```

支持多选和自定义描述。当用户聚焦自定义输入框时，会自动把 `custom` 选项加入已选列表。

### StepWorkMode

[packages/web/src/components/project/wizard/StepWorkMode.tsx 第 19–167 行](../../../../packages/web/src/components/project/wizard/StepWorkMode.tsx#L19)：

```tsx
const DEFAULT_OPTIONS: QuestionOption[] = [
  { value: 'solo', label: '我自己开发和维护', icon: '👤', description: '全程自己掌控，AI 辅助具体任务' },
  { value: 'team', label: '和小团队一起协作', icon: '👥', description: '团队成员共同贡献，AI 帮助协调' },
  { value: 'product-owner', label: '交给其他人使用', icon: '🎯', description: '我是产品角色，AI 帮我实现想法' },
];
```

工作模式是单选，同样支持自定义。

### StepConfirm

[packages/web/src/components/project/wizard/StepConfirm.tsx 第 21–208 行](../../../../packages/web/src/components/project/wizard/StepConfirm.tsx#L21)：

```tsx
const WORK_MODE_LABELS: Record<WorkMode, string> = {
  solo: '我自己开发和维护',
  team: '和小团队一起协作',
  'product-owner': '交给其他人使用',
  custom: '自定义模式',
};
```

确认页把前面三步的数据汇总展示，允许直接修改项目名称，也允许点击“修改”回到对应步骤。最终点击“创建项目”调用 `handleComplete`。

## 为什么这样设计

`ProjectCreationWizard` 采用“父组件管状态、子组件管展示”的模式，好处很明显：

- 新增步骤只需增加一个子组件和在 `renderStepContent` 里加一条 `case`。
- 每个步骤的验证、键盘交互、自定义逻辑都在自己文件里，不污染父组件。
- 后端 API 调用统一收敛在父组件，便于做错误处理和加载状态管理。

但也有一个隐患：父组件的状态更新和后端调用是异步串行的，如果步骤推进很快，可能出现 `sessionId` 还没拿到就提交答案的情况。

## 本节小结

- `ProjectCreationWizard` 通过 `currentStep` 驱动四步表单，通过 `wizardState` 控制 idle/creating/success/error 四种全局状态。
- `startProjectCreation` / `submitProjectCreationAnswer` / `completeProjectCreation` 三个 Core 服务构成完整的后端交互链。
- 每一步都是独立子组件：`StepBackground`、`StepPriorities`、`StepWorkMode`、`StepConfirm`，外加 `CreatingState` 和 `SuccessState`。
- 当前实现有一个时序缺口：第一次点击“下一步”时 `sessionId` 可能还没同步到 `handleStepComplete` 的后续判断里。

下一节课进入 AI 访谈式创建入口：`InterviewWindow`。
