# G12：访谈完成处理器如何自动创建项目和本体

> 本课核心问题：当小王回答完三个访谈问题后，`InterviewCompletionHandler` 如何把答案变成项目文件和本体数据？它调用了哪些外部服务？失败时怎么处理？

## 1. 开篇场景：小王点击“完成访谈”

小王回答完三个问题：
- 工作领域：餐饮零售，社区咖啡馆
- 工作模式：独立经营，雇了 2 个员工
- 主要任务：采购原料、制作咖啡、服务顾客、管理库存

他点击“完成访谈”。系统显示：
- 正在创建项目...
- 正在生成本体...
- 项目“社区咖啡馆”创建成功！

这个“一键完成”的背后，`InterviewCompletionHandler` 做了哪些事？

## 2. 两种完成策略

### 2.1 前端驱动

前端收集完答案后，直接调用多个 API：

```ts
await createProject({ name, description, domain });
await saveOntology({ projectId, ontology });
await generateTASTE({ projectId, answers });
```

优点：前端控制流程，灵活。
缺点：前端需要知道后端的所有接口，耦合度高。

### 2.2 后端聚合

前端只发一个请求，后端统一处理：

```ts
const result = await interviewCompletionHandler.handleInterviewCompletion(data);
```

优点：前端简单，后端可以原子化处理。
缺点：后端逻辑复杂，需要处理多个外部依赖。

OriginOS 选择了**后端聚合**。`InterviewCompletionHandler` 是一个单例类，封装了访谈完成后的全部处理逻辑。

## 3. 源码精读：`InterviewCompletionHandler`

打开 [packages/core/src/lib/features/interview/interview-completion.ts](../../../../packages/core/src/lib/features/interview/interview-completion.ts)。

### 3.1 单例模式

```ts
export class InterviewCompletionHandler {
  private static instance: InterviewCompletionHandler;

  private constructor() {}

  static getInstance(): InterviewCompletionHandler {
    if (!InterviewCompletionHandler.instance) {
      InterviewCompletionHandler.instance = new InterviewCompletionHandler();
    }
    return InterviewCompletionHandler.instance;
  }
}

export const interviewCompletionHandler = InterviewCompletionHandler.getInstance();
```

对应源码位置：[packages/core/src/lib/features/interview/interview-completion.ts 第 32—42 行](../../../../packages/core/src/lib/features/interview/interview-completion.ts#L32-L42)、[第 277 行](../../../../packages/core/src/lib/features/interview/interview-completion.ts#L277)。

和 `ProjectService` 一样，`InterviewCompletionHandler` 也是单例。整个应用生命周期中只有一个实例。

### 3.2 入口方法：`handleInterviewCompletion`

```ts
async handleInterviewCompletion(
  data: InterviewResult,
  options: InterviewCompletionOptions = {}
): Promise<InterviewCompletionResult> {
  try {
    console.log("开始处理访谈完成");

    const projectData = this.generateProjectData(data, options);
    const ontologyModel = this.generateOntologyModel(data);

    let ontologyId: string | undefined;
    if (options.autoSaveOntology !== false) {
      ontologyId = await this.saveOntology(ontologyModel);
    }

    let project: Project | null = null;
    if (options.autoCreateProject !== false) {
      const createRequest: CreateProjectRequest = {
        ...projectData,
        ontologyId,
      };
      project = await this.createProject(createRequest);
    }

    return {
      project,
      ontologyId,
      error: undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "处理访谈完成时出错";
    console.error("处理访谈完成失败:", error);

    return {
      project: null,
      ontologyId: undefined,
      error: errorMessage,
    };
  }
}
```

对应源码位置：[packages/core/src/lib/features/interview/interview-completion.ts 第 214—254 行](../../../../packages/core/src/lib/features/interview/interview-completion.ts#L214-L254)。

入口方法的流程：
1. 从访谈结果生成项目数据。
2. 从访谈结果生成本体模型。
3. 如果 `autoSaveOntology !== false`，保存本体。
4. 如果 `autoCreateProject !== false`，创建项目（传入本体 ID）。
5. 返回 `{ project, ontologyId, error }`。

注意：`autoSaveOntology` 和 `autoCreateProject` 默认都是 `true`，但可以通过 `options` 关闭。这支持了“只生成数据不保存”的测试场景。

### 3.3 生成项目数据

```ts
private generateProjectData(
  data: InterviewResult,
  options: InterviewCompletionOptions = {}
): CreateProjectRequest {
  const template = options.projectDescriptionTemplate || this.defaultDescriptionTemplate;
  const typeMapping = options.projectTypeMapping || this.defaultProjectTypeMapping;

  let projectType = "generic";
  for (const [key, type] of Object.entries(typeMapping)) {
    if (data.domain.includes(key)) {
      projectType = type;
      break;
    }
  }

  const projectName =
    data.projectName && data.projectName.trim()
      ? data.projectName
      : `${data.domain} 项目`;

  return {
    name: projectName,
    description: template(data),
    domain: data.domain,
    type: projectType,
    userId: "current-user",
  };
}
```

对应源码位置：[packages/core/src/lib/features/interview/interview-completion.ts 第 63—90 行](../../../../packages/core/src/lib/features/interview/interview-completion.ts#L63-L90)。

关键逻辑：
- **项目名称**：如果用户提供了 `projectName`，就用用户的；否则用 `${domain} 项目`。
- **项目类型**：通过关键词匹配 `defaultProjectTypeMapping`：
  - "软件开发" → `software`
  - "产品设计" → `design`
  - "数据分析" → `analytics`
  - ...
  - 不匹配 → `generic`
- **项目描述**：通过模板函数生成，默认格式是：
  > "基于 {domain} 领域创建的项目，{mode} 模式。主要任务：{tasks}"

### 3.4 默认项目类型映射

```ts
private defaultProjectTypeMapping: Record<string, string> = {
  软件开发: "software",
  产品设计: "design",
  数据分析: "analytics",
  市场营销: "marketing",
  教育培训: "education",
  投资分析: "investment",
  项目管理: "management",
  "其他": "generic",
};
```

对应源码位置：[packages/core/src/lib/features/interview/interview-completion.ts 第 52—61 行](../../../../packages/core/src/lib/features/interview/interview-completion.ts#L52-L61)。

注意：
- 映射表是中文关键词 → 英文类型值。
- 匹配方式是 `data.domain.includes(key)`，即**子串匹配**，不是精确匹配。
- 如果 `domain` 包含多个关键词，只取第一个匹配的。

对于小王的“餐饮零售，社区咖啡馆”：
- 不包含“软件开发”、“产品设计”等关键词。
- 所以 `projectType = "generic"`。

### 3.5 生成本体模型

```ts
private generateOntologyModel(data: InterviewResult): OntologyModel {
  if (data.ontology) {
    return data.ontology;
  }

  const now = Date.now();
  const ontologyId = `ontology-${now}`;

  const concepts: OntologyNode[] = [
    {
      id: `domain-${now}`,
      name: "领域",
      type: "entity",
      description: data.domain || "未知领域",
      children: [
        {
          id: `mode-${now}`,
          name: "工作模式",
          type: "class",
          description: data.mode || "未知模式",
        },
      ],
    },
    {
      id: `tasks-${now}`,
      name: "任务",
      type: "entity",
      description: "主要工作任务",
      children: this.extractTaskConcepts(data.tasks),
    },
  ];

  // ...

  return {
    id: ontologyId,
    name: data.projectName || `${data.domain} 本体`,
    description: `基于访谈 "${data.domain}" 生成的初始本体`,
    nodes: concepts,
    createdAt: now,
  };
}
```

对应源码位置：[packages/core/src/lib/features/interview/interview-completion.ts 第 92—142 行](../../../../packages/core/src/lib/features/interview/interview-completion.ts#L92-L142)。

本体生成逻辑：
- 如果 `data.ontology` 已经存在（比如前端已经生成了），直接返回。
- 否则，创建一个包含两个根节点的本体：
  - **领域节点**：包含“工作模式”子节点。
  - **任务节点**：包含从 `tasks` 字段提取的子节点。

### 3.6 提取任务概念

```ts
private extractTaskConcepts(tasks: string): OntologyNode[] {
  if (!tasks || tasks.trim().length === 0) {
    return [
      {
        id: `task-default-${Date.now()}`,
        name: "默认任务",
        type: "class",
        description: "待定义的任务",
      },
    ];
  }

  const taskList = tasks
    .split(/[,，、；;]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (taskList.length === 0) {
    return [
      {
        id: `task-default-${Date.now()}`,
        name: tasks || "任务",
        type: "class",
        description: "主要任务",
      },
    ];
  }

  return taskList.map((task, index) => ({
    id: `task-${Date.now()}-${index}`,
    name: task.length > 20 ? task.substring(0, 20) + "..." : task,
    type: "class",
    description: task,
  }));
}
```

对应源码位置：[packages/core/src/lib/features/interview/interview-completion.ts 第 144—178 行](../../../../packages/core/src/lib/features/interview/interview-completion.ts#L144-L178)。

任务提取逻辑：
- 按逗号、中文逗号、顿号、分号等分隔符拆分任务字符串。
- 如果拆分后为空，返回一个“默认任务”。
- 每个任务生成一个 `OntologyNode`，ID 基于时间戳。
- 任务名称超过 20 字符会被截断并加 `...`。

对于小王的“采购原料、制作咖啡、服务顾客、管理库存”：
- 拆成 4 个任务。
- 每个任务生成一个 `class` 类型的节点。

### 3.7 保存本体和创建项目

```ts
private async saveOntology(ontologyModel: OntologyModel): Promise<string> {
  const result = await generateOntology({
    projectId: ontologyModel.id,
    answers: {
      work_domain: ontologyModel.name,
    },
  });

  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to save ontology');
  }

  const data = result.data as { ontology?: { id: string } } | undefined;
  if (data?.ontology?.id) {
    return data.ontology.id;
  }

  return ontologyModel.id;
}

private async createProject(createRequest: CreateProjectRequest): Promise<Project> {
  const result = await createProject(createRequest);
  if (result.success) {
    return result.data as Project;
  }
  throw new Error(result.error?.message || 'Failed to create project');
}
```

对应源码位置：[packages/core/src/lib/features/interview/interview-completion.ts 第 180—212 行](../../../../packages/core/src/lib/features/interview/interview-completion.ts#L180-L212)。

注意：
- `saveOntology` 和 `createProject` 调用的是 `lib/integrations/electron/services/` 下的 API 封装函数。
- 这些函数在 Electron 环境下走 IPC，在 Web 环境下走 HTTP。
- 如果 API 调用失败，会抛出错误，被 `handleInterviewCompletion` 的 `catch` 捕获。

## 4. 图解：访谈完成处理流程

```mermaid
flowchart TD
    User([小王]) -->|回答完问题| Complete[点击“完成访谈”]
    Complete -->|调用| Handler[InterviewCompletionHandler.handleInterviewCompletion]
    Handler -->|生成| PD[项目数据]
    Handler -->|生成| OM[本体模型]
    PD -->|包含| PN[项目名称: 社区咖啡馆]
    PD -->|包含| PT[项目类型: generic]
    PD -->|包含| PDESC[项目描述: 基于餐饮零售...]
    OM -->|包含| Domain[领域节点: 餐饮零售]
    OM -->|包含| Tasks[任务节点: 采购原料/制作咖啡/服务顾客/管理库存]
    OM -->|saveOntology| API1[generateOntology API]
    PD -->|createProject| API2[createProject API]
    API1 -->|返回| OID[ontologyId]
    API2 -->|返回| Project[Project 对象]
    Handler -->|返回| Result[{ project, ontologyId }]
```

## 5. 关键类型

| 类型 | 定义位置 | 说明 |
| --- | --- | --- |
| `InterviewCompletionOptions` | `interview-completion.ts` | 完成选项（autoCreateProject, autoSaveOntology 等） |
| `InterviewCompletionResult` | `interview-completion.ts` | 完成结果（project, ontologyId, error） |
| `InterviewResult` | `types/interview.ts` | 访谈结果（domain, mode, tasks 等） |
| `CreateProjectRequest` | `types/project.ts` | 创建项目请求 |
| `OntologyModel` | `types/interview.ts` | 本体模型 |

## 6. 失败路径与边界

### 6.1 项目类型映射失败

如果 `domain` 不包含任何映射表中的关键词，`projectType` 默认为 `"generic"`。这不是错误，但会导致项目类型信息缺失。

### 6.2 本体 ID 冲突

```ts
const ontologyId = `ontology-${now}`;
```

`ontologyId` 基于 `Date.now()`，如果在同一毫秒内创建多个本体，可能会冲突。虽然概率极低，但在高并发场景下是可能的。

### 6.3 任务拆分失败

```ts
const taskList = tasks.split(/[,，、；;]/);
```

如果用户输入的任务包含其他分隔符（如“和”、“以及”），拆分会失败，所有任务被当成一个整体。

### 6.4 API 调用失败

```ts
const result = await generateOntology({...});
if (!result.success) {
  throw new Error(...);
}
```

如果 `generateOntology` 或 `createProject` 失败，整个 `handleInterviewCompletion` 会失败，返回 `{ project: null, ontologyId: undefined, error: ... }`。

但没有事务机制：如果本体保存成功但项目创建失败，会留下一个“孤儿本体”。

### 6.5 验证访谈结果

```ts
validateInterviewResult(data: InterviewResult): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.projectName || data.projectName.trim().length === 0) {
    errors.push("项目名称不能为空");
  }

  if (!data.domain || data.domain.trim().length === 0) {
    errors.push("工作领域不能为空");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

对应源码位置：[packages/core/src/lib/features/interview/interview-completion.ts 第 256—274 行](../../../../packages/core/src/lib/features/interview/interview-completion.ts#L256-L274)。

`validateInterviewResult` 只检查 `projectName` 和 `domain`，不检查 `mode` 和 `tasks`。这意味着即使用户没有回答“工作模式”和“主要任务”，验证也会通过。

## 7. 测试证据与缺口

### 已覆盖

- `InterviewCompletionHandler` 没有直接单元测试。
- `generateProjectData` 的字段生成没有自动化断言。
- `generateOntologyModel` 的节点结构没有测试。
- `extractTaskConcepts` 的分隔符处理没有测试。

### 缺口

- 项目类型映射的各种关键词组合没有测试。
- 本体 ID 冲突没有测试。
- 任务拆分对各种分隔符的支持没有测试。
- API 调用失败时的回滚机制没有测试。
- `validateInterviewResult` 对缺失字段的处理没有测试。

## 8. 小实验：验证访谈完成处理

### 步骤一：构造访谈结果

```ts
import { interviewCompletionHandler } from '@originos/core/lib/features/interview';

const result = await interviewCompletionHandler.handleInterviewCompletion({
  projectName: '社区咖啡馆',
  domain: '餐饮零售，社区咖啡馆',
  mode: '独立经营，雇了 2 个员工',
  tasks: '采购原料、制作咖啡、服务顾客、管理库存',
});

console.log(result.project?.name);    // "社区咖啡馆"
console.log(result.project?.type);    // "generic"
console.log(result.ontologyId);        // "ontology-..."
```

### 步骤二：验证项目类型映射

```ts
const result2 = await interviewCompletionHandler.handleInterviewCompletion({
  projectName: '电商网站',
  domain: '软件开发，电商平台',
  mode: '团队协作',
  tasks: '需求分析、代码开发、测试部署',
});

console.log(result2.project?.type);   // "software"
```

### 步骤三：验证任务拆分

```ts
const result3 = interviewCompletionHandler['extractTaskConcepts']('采购原料、制作咖啡');
console.log(result3.length);           // 2
console.log(result3[0].name);          // "采购原料"
```

### 实验结论

访谈完成处理器的逻辑是清晰的，但缺乏自动化测试。特别是项目类型映射和任务拆分，需要覆盖各种输入组合。

## 9. 口头验收

读完本课后，应能不看书稿回答：

1. `InterviewCompletionHandler.handleInterviewCompletion` 做了哪四件事？
2. 项目类型是怎么从 `domain` 推断出来的？如果推断失败，默认值是什么？
3. `generateOntologyModel` 生成了哪些节点？任务是怎么被拆分的？
4. 如果本体保存成功但项目创建失败，会发生什么？为什么？
5. `validateInterviewResult` 检查了哪些字段？没检查哪些字段？

## 10. 章节收束

本课的核心认知是：**`InterviewCompletionHandler` 是访谈流程的“收尾人”，它把用户的回答转换成结构化的项目数据和本体模型，但这个过程缺乏事务保证，且项目类型推断和任务拆分都有改进空间**。

我们看到的几个关键设计：

- 单例模式，全局统一处理访谈完成。
- 支持 `autoCreateProject` 和 `autoSaveOntology` 选项，灵活控制行为。
- 项目类型通过关键词子串匹配推断，默认 `generic`。
- 本体模型包含“领域”和“任务”两个根节点。
- 任务按逗号等分隔符拆分，超过 20 字符截断。
- 没有事务机制，可能出现“孤儿本体”。

下一课（G13）我们会深入 `InterviewResult` 到 `CreateProjectRequest` 的转换过程，看看数据是怎么一步步被映射的。
