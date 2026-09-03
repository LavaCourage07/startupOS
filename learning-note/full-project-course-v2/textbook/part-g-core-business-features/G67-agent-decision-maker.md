# G67：AgentDecisionMaker——意图是怎么被检测的

> 本课核心问题：`AgentDecisionMaker` 是怎么检测用户意图并选择技能的？

## 1. 开篇场景：小王输入不同指令

小王输入：
- "创建任务" → 意图：CREATE_PROJECT
- "查询项目" → 意图：QUERY_INFO
- "随便聊聊" → 意图：CHAT_GENERAL

系统需要识别意图并选择合适技能。

## 2. 两种检测策略

### 2.1 精确匹配

```ts
if (input === '创建任务') return 'CREATE_PROJECT';
if (input === '查询项目') return 'QUERY_INFO';
```

缺点：无法处理同义词和变体。

### 2.2 关键词匹配

```ts
const keywords = {
  CREATE_PROJECT: ['创建', '新建', 'create'],
  QUERY_INFO: ['查询', '搜索', 'query'],
  CHAT_GENERAL: ['聊聊', '聊天', 'chat'],
};
```

OriginOS 选择了**关键词匹配**。

## 3. 源码精读：`decision.ts`

打开 [packages/core/src/lib/features/skills/decision.ts](../../../../packages/core/src/lib/features/skills/decision.ts)。

### 3.1 意图枚举

```ts
enum Intent {
  CREATE_PROJECT = 'CREATE_PROJECT',
  EDIT_ONTOLOGY = 'EDIT_ONTOLOGY',
  MANAGE_TASKS = 'MANAGE_TASKS',
  QUERY_INFO = 'QUERY_INFO',
  CHAT_GENERAL = 'CHAT_GENERAL',
}
```

对应源码位置：[packages/core/src/lib/features/skills/decision.ts 第 1—50 行](../../../../packages/core/src/lib/features/skills/decision.ts#L1-L50)。

### 3.2 检测意图

```ts
function detectIntent(input: string): Intent {
  const lowerInput = input.toLowerCase();

  // Check for task management
  if (lowerInput.includes('任务') || lowerInput.includes('task')) {
    return Intent.MANAGE_TASKS;
  }

  // Check for ontology editing
  if (lowerInput.includes('本体') || lowerInput.includes('ontology')) {
    return Intent.EDIT_ONTOLOGY;
  }

  // Check for project creation
  if (lowerInput.includes('创建') || lowerInput.includes('新建') || lowerInput.includes('create')) {
    return Intent.CREATE_PROJECT;
  }

  // Check for queries
  if (lowerInput.includes('查询') || lowerInput.includes('搜索') || lowerInput.includes('query')) {
    return Intent.QUERY_INFO;
  }

  // Default to general chat
  return Intent.CHAT_GENERAL;
}
```

对应源码位置：[packages/core/src/lib/features/skills/decision.ts 第 51—150 行](../../../../packages/core/src/lib/features/skills/decision.ts#L51-L150)。

### 3.3 AgentDecisionMaker 类

```ts
class AgentDecisionMaker {
  private skillRegistry: SkillRegistry;

  constructor(skillRegistry: SkillRegistry) {
    this.skillRegistry = skillRegistry;
  }

  async decide(request: DecisionRequest): Promise<DecisionResult> {
    const intent = detectIntent(request.input);
    const skill = await this.selectSkill(intent, request);

    return {
      intent,
      skill,
      confidence: this.calculateConfidence(intent, request),
    };
  }

  private async selectSkill(intent: Intent, request: DecisionRequest): Promise<LoadedSkill | null> {
    const skills = await this.skillRegistry.list();

    // Map intent to skill
    const intentSkillMap: Record<Intent, string> = {
      [Intent.CREATE_PROJECT]: 'project-creator',
      [Intent.EDIT_ONTOLOGY]: 'ontology-editor',
      [Intent.MANAGE_TASKS]: 'task-manager',
      [Intent.QUERY_INFO]: 'info-query',
      [Intent.CHAT_GENERAL]: 'chat',
    };

    const skillName = intentSkillMap[intent];
    return skills.find(s => s.metadata.name === skillName) || null;
  }

  private calculateConfidence(intent: Intent, request: DecisionRequest): number {
    // Simple confidence based on keyword match strength
    const input = request.input.toLowerCase();
    let score = 0;

    if (input.includes('创建') || input.includes('新建')) score += 0.3;
    if (input.includes('任务')) score += 0.3;
    if (input.includes('查询')) score += 0.3;

    return Math.min(score, 1.0);
  }
}
```

对应源码位置：[packages/core/src/lib/features/skills/decision.ts 第 151—314 行](../../../../packages/core/src/lib/features/skills/decision.ts#L151-L314)。

## 4. 图解：决策流程

```
用户输入: "创建任务"
  │
  ▼
┌──────────────────┐
│ detectIntent()  │
│ 关键词匹配       │
└────────┬─────────┘
         │
         ▼
    ┌─────────┐
    │ MANAGE  │
    │ _TASKS  │
    └────┬────
         │
         ▼
┌──────────────────┐
│ selectSkill()    │
│ 意图→技能映射     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ calculateConfidence│
│ 计算置信度        │
└────────┬─────────┘
         │
         ▼
    DecisionResult
```

## 5. 设计亮点

### 5.1 意图映射

```ts
const intentSkillMap: Record<Intent, string> = {
  [Intent.CREATE_PROJECT]: 'project-creator',
  [Intent.EDIT_ONTOLOGY]: 'ontology-editor',
  [Intent.MANAGE_TASKS]: 'task-manager',
  [Intent.QUERY_INFO]: 'info-query',
  [Intent.CHAT_GENERAL]: 'chat',
};
```

### 5.2 置信度计算

```ts
private calculateConfidence(intent: Intent, request: DecisionRequest): number {
  const input = request.input.toLowerCase();
  let score = 0;

  if (input.includes('创建') || input.includes('新建')) score += 0.3;
  if (input.includes('任务')) score += 0.3;
  if (input.includes('查询')) score += 0.3;

  return Math.min(score, 1.0);
}
```

## 6. 测试证据与缺口

### 已覆盖

- `AgentDecisionMaker` 没有直接测试。

### 缺口

- 意图检测没有测试。
- 技能选择没有测试。
- 置信度计算没有测试。

## 7. 小实验：检测意图

```ts
import { AgentDecisionMaker, detectIntent, Intent } from '@originos/core/lib/features/skills';

// 直接检测意图
console.log(detectIntent('创建任务')); // MANAGE_TASKS
console.log(detectIntent('查询项目')); // QUERY_INFO
console.log(detectIntent('随便聊聊')); // CHAT_GENERAL

// 使用 AgentDecisionMaker
const registry = new DefaultSkillRegistry();
const decisionMaker = new AgentDecisionMaker(registry);

const result = await decisionMaker.decide({
  input: '创建一个新任务',
  context: {},
});

console.log(result.intent); // MANAGE_TASKS
console.log(result.confidence); // > 0
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `detectIntent` 是怎么工作的？
2. `AgentDecisionMaker` 怎么选择技能？
3. 置信度是怎么计算的？
4. 有哪些意图类型？

## 9. 章节收束

本课的核心认知是 **`AgentDecisionMaker` 通过关键词匹配检测意图，然后映射到对应技能，并计算置信度**。

我们看到的几个关键设计：

- **关键词匹配**：简单但有效的意图检测。
- **意图映射**：意图到技能的映射表。
- **置信度计算**：基于关键词匹配强度。
- **无测试**：没有直接测试覆盖。

下一课（G68）是单元小结课，我们会画出"注册 → 路由 → 执行"的完整流程。
