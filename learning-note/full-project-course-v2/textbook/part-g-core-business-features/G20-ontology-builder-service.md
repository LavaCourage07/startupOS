# G20：本体构建服务——`OntologyService.generateFromInterview` 如何从访谈生成本体

> 本课核心问题：`OntologyService` 是怎么把访谈答案转换成完整本体的？生成流程有哪些步骤？每个步骤做了什么？

## 1. 开篇场景：小王的答案变成知识骨架

小王回答完三个问题后，系统开始生成本体：

1. 从"餐饮零售，社区咖啡馆"提取 **Domain**。
2. 从"采购原料、制作咖啡、服务顾客、管理库存"提取 **Concept**。
3. 为每个 Concept 建立 **Relation**（contains、dependency）。

这个"从文本到结构"的过程，就是 `OntologyService.generateFromInterview` 的职责。

## 2. 两种生成策略

### 2.1 基于规则

```ts
function generateOntology(answers: InterviewAnswers): Ontology {
  const domain = extractDomain(answers.work_domain);
  const concepts = extractConcepts(answers.main_tasks);
  const relations = generateRelations(domain, concepts);
  return { domain, concepts, relations, ... };
}
```

优点：
- 快速，不依赖外部服务。
- 结果可预测。
- 成本低。

缺点：
- 无法理解语义。
- 只能处理固定模式。
- 无法处理复杂场景。

### 2.2 基于 LLM

```ts
async function generateOntologyWithLLM(answers: InterviewAnswers): Promise<Ontology> {
  const prompt = buildPrompt(answers);
  const result = await llm.generate(prompt);
  return parseOntology(result);
}
```

优点：
- 可以理解语义。
- 能处理复杂场景。
- 结果更智能。

缺点：
- 慢（秒级）。
- 成本高（每次调用都收费）。
- 结果不可完全预测。

OriginOS 选择了**基于规则**的生成策略。`OntologyService.generateFromInterview` 是纯本地逻辑，不依赖 LLM。

## 3. 源码精读：`OntologyService.generateFromInterview`

打开 [packages/core/src/lib/features/ontology/ontology-builder.ts](../../../../packages/core/src/lib/features/ontology/ontology-builder.ts)。

### 3.1 入口方法

```ts
async generateFromInterview(
  interview: InterviewSession,
): Promise<OntologyGenerationResult> {
  const startTime = Date.now();

  const answers = interview.answers;
  const projectId = interview.projectId;

  // Extract key information from interview answers
  const workDomain = this.getAnswer(answers, 'work_domain');
  const workMode = this.getAnswer(answers, 'work_mode');
  const mainTasks = this.getAnswer(answers, 'main_tasks');
  const toolsUsed = this.getAnswer(answers, 'tools_used');
  const goals = this.getAnswer(answers, 'goals');

  // Generate domain
  const domain: Domain = this.generateDomain(workDomain, workMode);

  // Generate concepts from main tasks and tools
  const concepts = this.generateConcepts(
    domain.id,
    mainTasks,
    toolsUsed,
    goals,
  );

  // Generate relations
  const relations = this.generateInitialRelations(domain, concepts);

  // Create ontology
  const ontology: Ontology = {
    id: uuidv4(),
    projectId,
    name: `${workDomain} Ontology`,
    domains: [domain],
    concepts,
    instances: [],
    relations,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save ontology
  await this.saveOntology(ontology);

  const generationTime = Date.now() - startTime;

  const result: OntologyGenerationResult = {
    ontology,
    generationTime,
    source: 'interview',
  };

  return result;
}
```

对应源码位置：[packages/core/src/lib/features/ontology/ontology-builder.ts 第 31—86 行](../../../../packages/core/src/lib/features/ontology/ontology-builder.ts#L31-L86)。

### 3.2 生成流程

```
generateFromInterview
  ├─ 提取答案（workDomain, workMode, mainTasks, toolsUsed, goals）
  ├─ generateDomain(workDomain, workMode)
  │    └─ 返回 Domain 对象
  ├─ generateConcepts(domainId, mainTasks, toolsUsed, goals)
  │    ├─ parseTasks(mainTasks) → task Concepts
  │    ├─ parseTools(toolsUsed) → tool Concepts
  │    ├─ parseGoals(goals) → goal Concepts
  │    └─ 确保最少 2 个 Concept
  ├─ generateInitialRelations(domain, concepts)
  │    ├─ Domain contains 每个 Concept
  │    └─ 任务之间有 dependency 关系
  ├─ 组装 Ontology 对象
  ├─ saveOntology(ontology)
  └─ 返回 OntologyGenerationResult
```

### 3.3 提取答案

```ts
const workDomain = this.getAnswer(answers, 'work_domain');
const workMode = this.getAnswer(answers, 'work_mode');
const mainTasks = this.getAnswer(answers, 'main_tasks');
const toolsUsed = this.getAnswer(answers, 'tools_used');
const goals = this.getAnswer(answers, 'goals');
```

`getAnswer` 方法：

```ts
private getAnswer(
  answers: Record<string, any>,
  questionId: string,
): string {
  const answerData = answers[questionId];
  if (!answerData) return '';

  const answer = answerData.answer;
  return Array.isArray(answer) ? answer.join(', ') : (answer || '');
}
```

对应源码位置：[packages/core/src/lib/features/ontology/ontology-builder.ts 第 692—701 行](../../../../packages/core/src/lib/features/ontology/ontology-builder.ts#L692-L701)。

注意：
- 如果答案不存在，返回空字符串。
- 如果答案是数组，用 `, ` 连接成字符串。
- 这意味着多选答案会被合并成逗号分隔的字符串。

### 3.4 生成 Domain

```ts
private generateDomain(workDomain: string, workMode: string): Domain {
  return {
    id: uuidv4(),
    name: workDomain || 'My Project',
    description: `Project for ${workDomain} working in ${workMode} mode`,
    icon: '🔷',
    color: '#3b82f6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
```

对应源码位置：[packages/core/src/lib/features/ontology/ontology-builder.ts 第 501—511 行](../../../../packages/core/src/lib/features/ontology/ontology-builder.ts#L501-L511)。

对于小王的答案：
- `name`: "餐饮零售，社区咖啡馆"
- `description`: "Project for 餐饮零售，社区咖啡馆 working in 独立经营 mode"
- `icon`: "🔷"（硬编码）
- `color`: "#3b82f6"（硬编码，Tailwind blue-500）

注意：
- `icon` 和 `color` 是硬编码的，所有 Domain 都一样。
- `description` 是英文格式，没有本地化。

### 3.5 生成 Concepts

```ts
private generateConcepts(
  domainId: string,
  mainTasks: string,
  toolsUsed: string | string[] | undefined,
  goals: string | undefined,
): Concept[] {
  const concepts: Concept[] = [];
  const now = new Date().toISOString();

  // Parse main tasks into concepts
  if (mainTasks) {
    const taskItems = this.parseTasks(mainTasks);
    taskItems.forEach((task) => {
      concepts.push({
        id: uuidv4(),
        domainId,
        name: task.name,
        type: 'task',
        attributes: {
          priority: task.priority,
          category: task.category,
        },
        description: task.description,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  // Generate tool concepts
  if (toolsUsed) {
    const tools = Array.isArray(toolsUsed) ? toolsUsed : [toolsUsed];
    tools.forEach((tool) => {
      if (tool && tool !== '其他') {
        concepts.push({
          id: uuidv4(),
          domainId,
          name: tool,
          type: 'tool',
          attributes: { category: 'workspace' },
          createdAt: now,
          updatedAt: now,
        });
      }
    });
  }

  // Generate goal concepts
  if (goals) {
    const goalItems = this.parseGoals(goals);
    goalItems.forEach((goal) => {
      concepts.push({
        id: uuidv4(),
        domainId,
        name: goal.name,
        type: 'goal',
        attributes: { status: 'pending' },
        description: goal.description,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  // Ensure minimum 2 concepts
  if (concepts.length < 2) {
    concepts.push(
      {
        id: uuidv4(),
        domainId,
        name: '日常工作',
        type: 'routine',
        attributes: {},
        description: '日常工作任务和流程',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        domainId,
        name: '项目管理',
        type: 'management',
        attributes: {},
        description: '项目相关的管理活动',
        createdAt: now,
        updatedAt: now,
      },
    );
  }

  return concepts;
}
```

对应源码位置：[packages/core/src/lib/features/ontology/ontology-builder.ts 第 516—611 行](../../../../packages/core/src/lib/features/ontology/ontology-builder.ts#L516-L611)。

生成逻辑：
1. **任务概念**：从 `mainTasks` 解析，每个任务生成一个 `type: 'task'` 的 Concept。
2. **工具概念**：从 `toolsUsed` 解析，每个工具生成一个 `type: 'tool'` 的 Concept（跳过"其他"）。
3. **目标概念**：从 `goals` 解析，每个目标生成一个 `type: 'goal'` 的 Concept。
4. **兜底**：如果总数少于 2 个，添加"日常工作"和"项目管理"两个默认 Concept。

### 3.6 解析任务

```ts
private parseTasks(input: string): Array<{
  name: string;
  priority: string;
  category: string;
  description: string;
}> {
  const lines = input
    .split(/[\n,;，；]/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  return lines.slice(0, 5).map((line, index) => ({
    name: line.substring(0, 30),
    priority: index === 0 ? 'high' : 'medium',
    category: 'general',
    description: line,
  }));
}
```

对应源码位置：[packages/core/src/lib/features/ontology/ontology-builder.ts 第 651—669 行](../../../../packages/core/src/lib/features/ontology/ontology-builder.ts#L651-L669)。

解析逻辑：
- 按换行符、逗号、分号等分隔符拆分。
- 最多取前 5 个任务。
- 第一个任务的 `priority` 是 `'high'`，其余是 `'medium'`。
- 任务名称超过 30 字符会被截断。

对于小王的"采购原料、制作咖啡、服务顾客、管理库存"：
- 拆成 4 个任务。
- 第一个任务（采购原料）priority 为 `'high'`。
- 其余 priority 为 `'medium'`。

### 3.7 生成关系

```ts
private generateInitialRelations(
  domain: Domain,
  concepts: Concept[],
): Relation[] {
  const relations: Relation[] = [];

  // Domain contains all concepts
  concepts.forEach((concept) => {
    relations.push({
      id: uuidv4(),
      sourceId: domain.id,
      targetId: concept.id,
      type: 'contains',
      createdAt: new Date().toISOString(),
    });
  });

  // Generate task dependencies if tasks exist
  const taskConcepts = concepts.filter(c => c.type === 'task');
  for (let i = 0; i < taskConcepts.length - 1; i++) {
    relations.push({
      id: uuidv4(),
      sourceId: taskConcepts[i]!.id,
      targetId: taskConcepts[i + 1]!.id,
      type: 'dependency',
      createdAt: new Date().toISOString(),
    });
  }

  return relations;
}
```

对应源码位置：[packages/core/src/lib/features/ontology/ontology-builder.ts 第 616—646 行](../../../../packages/core/src/lib/features/ontology/ontology-builder.ts#L616-L646)。

生成逻辑：
1. **contains**：Domain 包含每个 Concept。
2. **dependency**：相邻的 task Concept 之间有依赖关系。

对于小王的 4 个任务：
- 4 个 `contains` 关系（Domain → 每个任务）。
- 3 个 `dependency` 关系（任务1 → 任务2 → 任务3 → 任务4）。

## 4. 图解：本体生成流程

```mermaid
flowchart TD
    subgraph Input["访谈答案"]
        A1[work_domain: "餐饮零售，社区咖啡馆"]
        A2[work_mode: "独立经营"]
        A3[main_tasks: "采购原料、制作咖啡、服务顾客、管理库存"]
        A4[tools_used: "咖啡机、POS系统"]
        A5[goals: "提供优质咖啡服务"]
    end

    subgraph Process["OntologyService.generateFromInterview"]
        P1[generateDomain]
        P2[generateConcepts]
        P3[generateInitialRelations]
    end

    subgraph Output["生成的本体"]
        D1[Domain: "餐饮零售，社区咖啡馆"]
        C1[Concept: "采购原料" type=task]
        C2[Concept: "制作咖啡" type=task]
        C3[Concept: "服务顾客" type=task]
        C4[Concept: "管理库存" type=task]
        C5[Concept: "咖啡机" type=tool]
        C6[Concept: "POS系统" type=tool]
        C7[Concept: "提供优质咖啡服务" type=goal]
        R1[Relation: Domain contains 每个 Concept]
        R2[Relation: 任务1 dependency 任务2]
        R3[Relation: 任务2 dependency 任务3]
        R4[Relation: 任务3 dependency 任务4]
    end

    A1 --> P1
    A2 --> P1
    A3 --> P2
    A4 --> P2
    A5 --> P2
    P1 --> D1
    P2 --> C1
    P2 --> C2
    P2 --> C3
    P2 --> C4
    P2 --> C5
    P2 --> C6
    P2 --> C7
    D1 --> P3
    C1 --> P3
    C2 --> P3
    C3 --> P3
    C4 --> P3
    P3 --> R1
    P3 --> R2
    P3 --> R3
    P3 --> R4
```

## 5. 关键类型

| 类型 | 定义位置 | 说明 |
| --- | --- | --- |
| `OntologyGenerationResult` | `types/ontology.ts` | 生成结果（ontology, generationTime, source） |
| `InterviewSession` | `ontology/types.ts` | 访谈会话（含 answers） |
| `Ontology` | `types/ontology.ts` | 完整本体结构 |
| `Domain` | `types/ontology.ts` | 领域定义 |
| `Concept` | `types/ontology.ts` | 概念定义 |
| `Relation` | `types/ontology.ts` | 关系定义 |

## 6. 失败路径与边界

### 6.1 答案为空

```ts
const workDomain = this.getAnswer(answers, 'work_domain'); // 返回 ''
```

如果 `work_domain` 为空，`generateDomain` 会使用 `'My Project'` 作为 fallback。

### 6.2 任务为空

```ts
if (mainTasks) {
  const taskItems = this.parseTasks(mainTasks);
  // ...
}
```

如果 `mainTasks` 为空，不会生成 task Concept。但兜底逻辑会添加"日常工作"和"项目管理"。

### 6.3 任务超过 5 个

```ts
return lines.slice(0, 5).map(...);
```

如果任务超过 5 个，只取前 5 个。多余的任务被丢弃。

### 6.4 工具为"其他"

```ts
if (tool && tool !== '其他') {
  // 生成 tool Concept
}
```

"其他"选项被跳过，不会生成 Concept。

### 6.5 没有 task Concept

```ts
const taskConcepts = concepts.filter(c => c.type === 'task');
for (let i = 0; i < taskConcepts.length - 1; i++) {
```

如果没有 task Concept，`taskConcepts.length - 1` 为 `-1`，循环不会执行。不会报错，但也不会生成 dependency 关系。

## 7. 测试证据与缺口

### 已覆盖

- `OntologyService.generateFromInterview` 没有直接单元测试。
- `generateDomain`、`generateConcepts`、`generateInitialRelations` 都没有测试。

### 缺口

- 各种答案组合（空答案、部分答案、完整答案）没有测试。
- 任务超过 5 个的截断逻辑没有测试。
- 工具为"其他"的跳过逻辑没有测试。
- 没有 task Concept 时的 dependency 生成没有测试。
- `saveOntology` 的持久化逻辑没有测试。

## 8. 小实验：验证本体生成

### 步骤一：构造访谈会话

```ts
import { ontologyService } from '@originos/core/lib/features/ontology';

const interview = {
  id: 'int-1',
  projectId: 'proj-1',
  questions: [],
  answers: {
    work_domain: { questionId: 'work_domain', answer: '餐饮零售，社区咖啡馆', timestamp: Date.now() },
    work_mode: { questionId: 'work_mode', answer: '独立经营', timestamp: Date.now() },
    main_tasks: { questionId: 'main_tasks', answer: '采购原料、制作咖啡、服务顾客、管理库存', timestamp: Date.now() },
  },
  currentQuestionIndex: 0,
  status: 'completed',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const result = await ontologyService.generateFromInterview(interview);
console.log(result.ontology.name);           // "餐饮零售，社区咖啡馆 Ontology"
console.log(result.ontology.domains.length);   // 1
console.log(result.ontology.concepts.length);  // 4
console.log(result.ontology.relations.length);  // 7 (4 contains + 3 dependency)
console.log(result.generationTime);            // 毫秒数
console.log(result.source);                    // "interview"
```

### 步骤二：验证任务解析

```ts
// 假设能直接调用 parseTasks
const tasks = ontologyService['parseTasks']('采购原料、制作咖啡、服务顾客');
console.log(tasks.length);        // 3
console.log(tasks[0].name);       // "采购原料"
console.log(tasks[0].priority);    // "high"
console.log(tasks[1].priority);    // "medium"
```

### 步骤三：验证空答案

```ts
const emptyInterview = {
  ...interview,
  answers: {},
};

const result2 = await ontologyService.generateFromInterview(emptyInterview);
console.log(result2.ontology.domains[0].name);    // "My Project" (fallback)
console.log(result2.ontology.concepts.length);    // 2 (兜底)
console.log(result2.ontology.concepts[0].name);   // "日常工作"
console.log(result2.ontology.concepts[1].name);   // "项目管理"
```

### 实验结论

本体生成逻辑清晰，但缺乏自动化测试。特别是边界情况（空答案、超过 5 个任务、没有 task）需要覆盖。

## 9. 口头验收

读完本课后，应能不看书稿回答：

1. `generateFromInterview` 的完整流程是什么？
2. `generateDomain` 生成的 Domain 有哪些字段？哪些字段是硬编码的？
3. `generateConcepts` 从哪些答案中提取 Concept？分别生成什么 type？
4. `parseTasks` 最多取几个任务？第一个任务的 priority 是什么？
5. `generateInitialRelations` 生成了哪两种关系？

## 10. 章节收束

本课的核心认知是：**`OntologyService.generateFromInterview` 是一个基于规则的本体生成器，它从访谈答案中提取 Domain、Concept 和 Relation，生成结构化的本体。生成过程快速、可预测，但缺乏语义理解能力**。

我们看到的几个关键设计：

- **基于规则**：纯本地逻辑，不依赖 LLM。
- **三层结构**：Domain → Concept → Relation。
- **多源提取**：从 tasks、tools、goals 三个来源提取 Concept。
- **任务解析**：按分隔符拆分，最多取 5 个，第一个 priority 为 high。
- **关系生成**：Domain contains 每个 Concept，相邻 task 有 dependency。
- **兜底机制**：如果 Concept 少于 2 个，添加默认值。
- **无测试覆盖**：所有生成逻辑都没有自动化测试。

下一课（G21）我们会深入 `generateDomain`，看看领域生成的细节。
