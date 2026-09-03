# J38：技能执行与技能浏览

## 除了对话，还要展示技能的执行进度

OriginOS 的技能系统不只有对话窗口，还有两个辅助 UI：

1. `SkillExecution`：展示一个技能从开始执行到完成的步骤、进度、结果/错误。
2. `SkillBrowser`：展示所有可用技能列表，支持搜索和分类筛选。

这节课还顺带看一个极小的策略文件 `skill-export-policy.ts`。

## 第一段源码：SkillExecution

[packages/web/src/components/skills/SkillExecution.tsx 第 36–224 行](../../../../packages/web/src/components/skills/SkillExecution.tsx#L36)：

```tsx
export function SkillExecution({ execution, isStreaming }: SkillExecutionProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  if (!execution) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500">
        <div className="text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">等待执行...</p>
        </div>
      </div>
    );
  }

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const progress = execution.steps.length > 0
    ? (execution.steps.filter(s => s.status !== 'pending').length / execution.steps.length) * 100
    : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">{getStatusIcon(execution.status)}</div>
          <div>
            <h3 className="font-semibold text-gray-900">{execution.skillName}</h3>
            <p className="text-sm text-gray-500">
              {getStatusText(execution.status)}
              {execution.status === 'running' && isStreaming && (
                <span className="ml-2 text-blue-500">实时更新中...</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        ...
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {execution.steps.map((step, index) => (
          <div key={step.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleStep(step.id)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              ...
            </button>
            {expandedSteps.has(step.id) && (step.output || step.error) && (
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                {step.error ? ... : step.output ? ... : null}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Result / Error */}
      {execution.status === 'completed' && execution.result && (
        <div className="mt-4 p-3 bg-teal-950/20 border border-teal-800/30 rounded-lg">
          ...
        </div>
      )}
      {execution.status === 'failed' && execution.error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          ...
        </div>
      )}
    </div>
  );
}
```

`SkillExecution` 的核心数据结构：

```ts
export type SkillExecution = {
  executionId: string;
  skillName: string;
  status: 'initializing' | 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  steps: SkillExecutionStep[];
  result?: any;
  error?: string;
};
```

每个 `step` 有 `id`、`name`、`status`、起止时间、错误、输出。UI 根据 step 状态显示不同图标，并计算总体进度百分比。结果用 `<pre>` 展示 JSON，错误用红色面板展示。

## 第二段源码：SkillBrowser

[packages/web/src/components/skills/SkillBrowser.tsx 第 26–206 行](../../../../packages/web/src/components/skills/SkillBrowser.tsx#L26)：

```tsx
export function SkillBrowser({ onSkillSelect, onClose }: SkillBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const categories = [
    { id: 'all', name: '全部', icon: BookOpen },
    { id: 'project', name: '项目管理', icon: Settings },
    { id: 'ontology', name: '本体管理', icon: Database },
    { id: 'query', name: '信息查询', icon: Search },
    { id: 'ai', name: 'AI 工具', icon: Zap },
  ];

  const loadSkills = async () => {
    setIsLoading(true);
    try {
      const data = await listAvailableSkills();
      if (data.success && data.data) {
        const skillsList: SkillDefinition[] = (data.data.skills || []).map((skill) => ({
          name: skill.name,
          description: skill.description,
          version: '1.0.0',
          type: 'SIMPLE',
          tags: [skill.source],
        }));
        setSkills(skillsList);
      }
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useState(() => {
    loadSkills();
  });

  const filteredSkills = skills.filter(skill => {
    const matchesSearch = searchQuery === '' ||
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' ||
      skill.tags.some(tag => tag.toLowerCase().includes(selectedCategory.toLowerCase()));

    return matchesSearch && matchesCategory;
  });
```

`SkillBrowser` 是一个典型的列表+搜索+分类组件：

- 调用 `listAvailableSkills()` 加载全部技能；
- 预定义了 5 个分类；
- 按名称/描述搜索，按标签匹配分类；
- 每个技能卡片显示图标、名称、版本、类型、描述、标签。

注意这里用 `useState(() => { loadSkills(); })` 在渲染时触发加载，这种写法虽然能工作，但会每次渲染都触发；通常更推荐用 `useEffect`。这是当前实现的一个细节，阅读时可以留意。

## 第三段源码：skill-export-policy

[packages/web/src/components/skills/skill-export-policy.ts](../../../../packages/web/src/components/skills/skill-export-policy.ts)：

```ts
export function isSkillExportAllowed(systemManaged: boolean | null | undefined): boolean {
  return systemManaged === false;
}
}
```

技能导出策略非常简单：只有非系统管理（`systemManaged === false`）的技能才允许导出。系统内置技能或系统管理的角色 Agent 不能被导出。

`SkillDialog` 的标题栏在渲染导出按钮时会调用它：

```ts
{currentSkill && isSkillExportAllowed(currentSkillSystemManaged) && (
  <EntryExportButton entryType="skill" entryId={currentSkill} />
)}
```

## 本节小结

- `SkillExecution` 用 `executionId + steps` 展示技能执行进度、结果、错误，支持展开单步详情。
- `SkillBrowser` 加载全部可用技能，提供搜索和分类筛选，点击后通过 `onSkillSelect` 回调交给调用方。
- `skill-export-policy.ts` 规定只有 `systemManaged === false` 的技能才允许导出。
- 这三个组件/文件都属于“技能生态”的周边 UI，不直接参与会话，但支撑技能发现、执行可视化和导出权限。

下一节课是 Unit 4 小结课，把 Skill 与 Agent 会话链路串成排查地图。
