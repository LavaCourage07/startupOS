# J43：旧版访谈流程与 Skill 版访谈

## 三条并存的访谈路径

OriginOS 里至少有三套项目访谈实现：

1. `ProjectInterview` + `interviewStore`：旧版独立页面访谈，状态机驱动，问题固定为三个。
2. `SkillInterview`：基于 `agent-session` 服务的轻量 Skill 访谈。
3. `InterviewWindow`：新版左右分栏实时预览（J41–J42 已讲）。

这节课读前两条，理解它们与新版的差异，以及为什么项目里会并存多套实现。

## 第一段源码：interviewStore 的状态设计

[packages/web/src/store/interviewStore.ts 第 9–70 行](../../../../packages/web/src/store/interviewStore.ts#L9)：

```tsx
interface InterviewStore {
  // Current state of the interview
  state: InterviewState;

  // Progress tracking
  currentStep: number;
  totalSteps: number;
  answers: InterviewAnswer[];

  // Interview data
  interviewData: Partial<InterviewData>;

  // Ontology data
  ontology: OntologyModel | null;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions
  setState: (state: InterviewState) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;

  setAnswer: (questionId: string, question: string, answer: string) => void;
  updateAnswer: (questionId: string, answer: string) => void;

  setInterviewData: (data: Partial<InterviewData>) => void;
  setOntology: (ontology: OntologyModel) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  reset: () => void;
}
```

`interviewStore` 是一个 Web 包专属的 Zustand store，管理旧版访谈的全部状态。它的字段可以分成五组：

| 分组 | 字段 | 说明 |
| --- | --- | --- |
| 流程状态 | `state` | `welcome` / `interviewing` / `generating` / `preview` / `editing` / `completed` |
| 进度 | `currentStep` / `totalSteps` / `answers` | 当前问题、总问题数、已回答问题 |
| 访谈元数据 | `interviewData` | 后端返回的 interviewId / projectId 等 |
| 产物 | `ontology` | 生成的本体模型 |
| UI 状态 | `isLoading` / `error` | 加载和错误提示 |

> 注意 `interviewStore` 放在 `packages/web/src/store/`，而不是 `packages/core/src/`。这说明旧版访谈是 Web 包独占功能，没有抽到 Core。

## 第二段源码：setAnswer 的替换式更新

[packages/web/src/store/interviewStore.ts 第 89–95 行](../../../../packages/web/src/store/interviewStore.ts#L89)：

```tsx
  setAnswer: (questionId, question, answer) =>
    set((state) => ({
      answers: [
        ...state.answers.filter((a) => a.questionId !== questionId),
        { questionId, question, answer, timestamp: Date.now() },
      ],
    })),
```

`setAnswer` 不是直接追加，而是先过滤掉同 `questionId` 的旧答案，再追加新答案。这样用户回退修改时不会留下重复记录。

`updateAnswer` 则是原地更新，保留原有时间戳：

```tsx
  updateAnswer: (questionId, answer) =>
    set((state) => ({
      answers: state.answers.map((a) =>
        a.questionId === questionId ? { ...a, answer } : a
      ),
    })),
```

两个 action 的语义差异：

- `setAnswer`：首次回答或覆盖回答（会刷新时间戳）。
- `updateAnswer`：静默修改已有回答（保留时间戳）。

## 第三段源码：ProjectInterview 的六状态切换

[packages/web/src/components/interview/ProjectInterview.tsx 第 34–65 行](../../../../packages/web/src/components/interview/ProjectInterview.tsx#L34)：

```tsx
export function ProjectInterview() {
  const {
    state,
    currentStep,
    totalSteps,
    answers,
    isLoading,
    setAnswer,
    setState,
    nextStep,
    previousStep,
    setLoading,
    setOntology,
    error,
    setError,
  } = useInterviewStore();

  const [localAnswer, setLocalAnswer] = useState("");
  const [generationMessage, setGenerationMessage] = useState("正在生成本体结构...");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [interviewData, setInterviewData] = useState({ interviewId: '', projectId: '' });
```

`ProjectInterview` 本身不保存流程状态，只保存本地 UI 状态：

- `localAnswer`：当前问题的输入框内容；
- `generationMessage` / `generationProgress`：生成中的动画文字和进度；
- `interviewData`：后端返回的 interviewId 和 projectId。

流程状态全部交给 `useInterviewStore`，保证刷新页面后可以恢复。

## 第四段源码：启动访谈与降级策略

[packages/web/src/components/interview/ProjectInterview.tsx 第 67–86 行](../../../../packages/web/src/components/interview/ProjectInterview.tsx#L67)：

```tsx
  const handleStart = async () => {
    // Create a project ID for the interview
    const projectId = `proj-${Date.now()}`;

    // Create interview session with backend
    try {
      const result = await createInterview({ projectId, skipOptionalQuestions: false });
      if (result.success) {
        const data = result.data as { id: string };
        setInterviewData({ interviewId: data.id, projectId });
      }
    } catch (error) {
      console.error('Failed to create interview session:', error);
      // Continue anyway - use local IDs
      const tempInterviewId = `int-${Date.now()}`;
      setInterviewData({ interviewId: tempInterviewId, projectId });
    }

    setState("interviewing");
  };
```

`handleStart` 尝试调用后端 `createInterview`，如果失败就用本地生成的 ID 继续。这是一种“尽力而为”的降级策略，确保用户即使离线或后端出错，也能继续体验。

## 第五段源码：问题推进与完成

[packages/web/src/components/interview/ProjectInterview.tsx 第 104–132 行](../../../../packages/web/src/components/interview/ProjectInterview.tsx#L104)：

```tsx
  const handleNext = () => {
    const currentQuestion = INTERVIEW_QUESTIONS[currentStep];
    if (!currentQuestion) return;

    setAnswer(currentQuestion.id, currentQuestion.question, localAnswer);

    const nextQuestionId = getNextQuestionId(currentQuestion.id);

    if (nextQuestionId) {
      nextStep();
      setLocalAnswer("");
    } else {
      handleFinishInterview();
    }
  };

  const handlePrevious = () => {
    const currentQuestion = INTERVIEW_QUESTIONS[currentStep];
    if (!currentQuestion) return;

    const prevQuestionId = getPreviousQuestionId(currentQuestion.id);

    // 保存当前答案
    setAnswer(currentQuestion.id, currentQuestion.question, localAnswer);

    if (prevQuestionId) {
      previousStep();
    }
  };
```

问题推进依赖 Core 里的 `INTERVIEW_QUESTIONS` 数组和 `getNextQuestionId` / `getPreviousQuestionId` 工具函数。每点一次“下一步”：

1. 先保存当前答案到 store；
2. 查询是否还有下一个问题；
3. 有就 `nextStep()`，没有就进入 `handleFinishInterview()`。

回退时也会保存当前答案，避免用户修改后回退导致改动丢失。

## 第六段源码：生成阶段的后端调用与 mock 降级

[packages/web/src/components/interview/ProjectInterview.tsx 第 134–245 行](../../../../packages/web/src/components/interview/ProjectInterview.tsx#L134)：

```tsx
  const handleFinishInterview = async () => {
    setState("generating");
    setLoading(true);
    setGenerationMessage("正在生成本体结构...");
    setGenerationProgress(0);

    try {
      const messages = [
        { msg: "正在保存访谈数据...", progress: 20 },
        { msg: "正在分析您的访谈数据...", progress: 40 },
        { msg: "正在提取核心概念...", progress: 60 },
        { msg: "正在生成本体结构...", progress: 80 },
        { msg: "正在完成您的模型...", progress: 95 },
      ];

      const domainAnswer = answers.find((a: InterviewAnswer) => a.questionId === "work-domain")?.answer;
      const modeAnswer = answers.find((a: InterviewAnswer) => a.questionId === "work-mode")?.answer;
      const tasksAnswer = answers.find((a: InterviewAnswer) => a.questionId === "main-tasks")?.answer;

      if (interviewData.interviewId) {
        try {
          for (const item of messages) {
            setGenerationMessage(item.msg);
            setGenerationProgress(item.progress);
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          const answersMap: Record<string, string> = {};
          answers.forEach(a => {
            answersMap[a.questionId] = a.answer;
          });

          await submitInterviewAnswer(interviewData.interviewId, answers[answers.length - 1]?.questionId || '', answers[answers.length - 1]?.answer || '');
          await completeInterview(interviewData.interviewId);

          const ontologyResult = await generateOntology({
            interviewId: interviewData.interviewId,
            projectId: interviewData.projectId,
          });

          if (ontologyResult.success && ontologyResult.data) {
            const generatedOntology = (ontologyResult.data as { ontology: Ontology }).ontology;
            setGenerationProgress(100);
            setOntology(adaptOntologyForDisplay(generatedOntology));
            setState("preview");
            setLoading(false);
            return;
          }
        } catch (apiError) {
          console.error('Backend API failed, falling back to mock:', apiError);
        }
      }

      // Fallback: Generate mock ontology if backend fails
      const nodes: OntologyNode[] = [
        {
          id: "domain",
          name: "工作领域",
          type: "entity",
          description: domainAnswer || "工作领域",
          children: [...]
        },
        ...
      ];
      ...
      setOntology(mockOntology);
      setState("preview");
      setLoading(false);
    } catch (err) {
      setError("生成本体失败，请重试。");
      setLoading(false);
    }
  };
```

生成阶段有三个特点：

1. **进度动画是前端模拟的**：`messages` 数组 + `setTimeout` 制造 20%→40%→...→95% 的进度条，真正的后端调用在最后才发生。
2. **只提交最后一个答案**：`submitInterviewAnswer` 调用时只传了 `answers[answers.length - 1]`，说明后端可能只需要最新答案，或者前面的答案已经在每步保存了。
3. **后端失败后有 mock 降级**：如果 `generateOntology` 失败，就用用户的三个答案拼一个最小本体，保证界面不会卡死。

> 这种“前端动画 + 后端兜底 + mock 降级”是早期 MVP 常见策略，但长远看应该让进度反映真实后端阶段。

## 第七段源码：状态到子组件的映射

[packages/web/src/components/interview/ProjectInterview.tsx 第 271–345 行](../../../../packages/web/src/components/interview/ProjectInterview.tsx#L271)：

```tsx
  // Welcome 状态
  if (state === "welcome") {
    return (
      <WelcomeScreen
        onStart={handleStart}
        onLater={handleLater}
        onSkip={handleSkip}
        onCancel={handleSkip}
      />
    );
  }

  // Interviewing 状态
  if (state === "interviewing") {
    const currentQuestion = INTERVIEW_QUESTIONS[currentStep];
    if (!currentQuestion) return null;

    return (
      <QuestionInput
        question={currentQuestion.question}
        placeholder={currentQuestion.hintShort}
        value={localAnswer}
        onChange={setLocalAnswer}
        onNext={handleNext}
        onPrevious={currentStep > 0 ? handlePrevious : undefined}
        isLastQuestion={currentStep === totalSteps - 1}
        isSubmitting={isLoading}
        stepNumber={currentStep + 1}
        totalSteps={totalSteps}
        stepLabels={STEP_LABELS}
        completedSteps={completedSteps}
        onCancel={handleCancel}
      />
    );
  }

  // Generating 状态
  if (state === "generating") {
    return (
      <GeneratingState
        message={generationMessage}
        progress={generationProgress}
        error={error || undefined}
        onCancel={() => setState("interviewing")}
      />
    );
  }

  // Preview 状态
  if (state === "preview") {
    const ontology = useInterviewStore.getState().ontology;
    if (ontology) {
      return (
        <OntologyPreview
          ontology={ontology}
          onConfirm={handleConfirm}
          onEdit={handleEdit}
        />
      );
    }
  }
```

`ProjectInterview` 的渲染部分就是一张“状态 → 子组件”的映射表。每个状态都有独立的 UI 子组件，父组件只负责传回调和状态。

注意 preview/editing 阶段直接用 `useInterviewStore.getState().ontology` 读取，而不是用 hook 返回的 `ontology`。这是 Zustand 的一个特性：可以直接访问 store 当前值，但这样读出来的值不会触发重新渲染。不过这两个状态切换到的时候，`ontology` 已经设置好了，所以问题不大。

## 第八段源码：SkillInterview 的独立会话

[packages/web/src/components/interview/SkillInterview.tsx 第 25–74 行](../../../../packages/web/src/components/interview/SkillInterview.tsx#L25)：

```tsx
export function SkillInterview({ projectId, onComplete, onCancel }: SkillInterviewProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize agent session with project-interview skill
  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      setIsInitializing(true);

      const sessionData = await createAgentSession({
        projectId: projectId || `temp-${Date.now()}`,
        projectName: '新项目',
        agentType: 'project-interview',
        systemPrompt: '你是一个项目访谈助手，负责引导用户完成项目访谈流程。',
      });

      if (!sessionData.success || !sessionData.data) {
        throw new Error('Failed to create session');
      }

      setSessionId(sessionData.data.sessionId);
      await sendMessage('开始访谈', sessionData.data.sessionId, true);
    } catch (error) {
      console.error('Failed to initialize session:', error);
      setMessages([{
        role: 'assistant',
        content: '抱歉，初始化访谈失败。请刷新页面重试。',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsInitializing(false);
    }
  };
```

`SkillInterview` 是一个更轻量的实现：

- 不依赖 `interviewStore`，全部用本地 `useState`；
- 直接调用 `createAgentSession` 和 `sendAgentMessage`；
- 自己手写消息列表和输入框，不使用 `ChatMessageList` / `ChatInputBar`；
- 通过 `metadata.interviewComplete` 判断是否完成。

它的 system prompt 是硬编码字符串，说明这是一个临时过渡组件，没有接入完整的 skill 内容加载流程。

## 第九段源码：useProjectInitialization 的动态 skill 导入

[packages/web/src/hooks/useProjectInitialization.ts 第 16–55 行](../../../../packages/web/src/hooks/useProjectInitialization.ts#L16)：

```tsx
export function useProjectInitialization() {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openWindow } = useAppWindowManager();

  const startInitialization = useCallback(async (projectName: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Import and initialize skill dynamically (works in both client and server)
      const { projectInitializationSkill } = await import('@originos/core/lib/features/skills/project-initialization');
      const agentSession = await projectInitializationSkill.initialize({
        projectName,
      });

      setSession(agentSession);

      // Open Agent dialog window
      openWindow({
        id: `window-${agentSession.sessionId}`,
        type: 'agent',
        title: `初始化项目: ${projectName}`,
        content: {
          type: 'component',
          component: AgentDialogContent,
          props: {
            agentType: 'project-initialization',
            sessionId: agentSession.sessionId,
            title: `初始化项目: ${projectName}`,
          },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize project');
    } finally {
      setIsLoading(false);
    }
  }, [openWindow]);
```

`useProjectInitialization` 是一个 Web 包 Hook，封装了“项目初始化 skill → Agent 会话 → 打开窗口”的完整流程：

1. 动态导入 Core 里的 `projectInitializationSkill`；
2. 调用 `initialize({ projectName })` 创建 Agent 会话；
3. 用 `useAppWindowManager().openWindow` 打开一个类型为 `agent` 的窗口；
4. 窗口内容挂载 `AgentDialogContent`，并传入 `agentType` 和 `sessionId`。

> 动态导入 `projectInitializationSkill` 有两重用意：一是可能为了代码分割，二是这个 skill 可能依赖客户端环境，服务端渲染时不能直接 import。

## 本节小结

- 旧版 `ProjectInterview` 是一个六状态状态机，依赖 `interviewStore` 管理流程状态和答案。
- `interviewStore` 放在 Web 包，说明旧版访谈是 Web 独占实现。
- `ProjectInterview` 在生成阶段用前端动画模拟进度，后端失败后有 mock 本体降级。
- `SkillInterview` 是更轻量的过渡实现，直接调用 `agent-session` 服务，手写消息列表。
- `useProjectInitialization` 把 Core skill、Agent 会话和窗口打开串成一条可复用的 Hook。

三套实现并存说明项目访谈功能还在演化中：旧版表单访谈、`SkillInterview` 过渡方案、`InterviewWindow` 新版左右分栏方案。读代码时要注意每个组件使用的底层 API 不同，不要混用。

下一节课读旧版访谈的子组件：`WelcomeScreen`、`QuestionInput`、`GeneratingState`、`OntologyPreview`、`OntologyEditor`。
