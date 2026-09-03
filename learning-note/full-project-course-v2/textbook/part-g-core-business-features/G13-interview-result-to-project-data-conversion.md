# G13：从答案到项目数据——`InterviewResult` 到 `CreateProjectRequest` 的转换

> 本课核心问题：`InterviewCompletionHandler` 把访谈答案变成项目数据时，字段是怎么一一映射的？中间有哪些信息丢失和格式转换？

## 1. 开篇场景：小王的答案变成项目文件

小王回答完三个问题后，系统需要创建项目。但访谈答案和项目数据是两种完全不同的格式：

**访谈答案（InterviewResult）：**
```ts
{
  projectName: "社区咖啡馆",
  domain: "餐饮零售，社区咖啡馆",
  mode: "独立经营，雇了 2 个员工",
  tasks: "采购原料、制作咖啡、服务顾客、管理库存"
}
```

**项目数据（CreateProjectRequest）：**
```ts
{
  name: "社区咖啡馆",
  description: "基于餐饮零售，社区咖啡馆领域创建的项目，独立经营，雇了 2 个员工模式。主要任务：采购原料、制作咖啡、服务顾客、管理库存",
  domain: "餐饮零售，社区咖啡馆",
  type: "generic",
  userId: "current-user"
}
```

这个转换过程是怎么完成的？哪些字段被保留了，哪些被合并了，哪些被丢弃了？

## 2. 两种数据转换策略

### 2.1 直接映射

每个访谈字段对应一个项目字段：

```ts
const createRequest: CreateProjectRequest = {
  name: data.projectName,
  description: data.mode,
  domain: data.domain,
  type: inferType(data.domain),
};
```

优点：简单直观，字段对应关系清晰。
缺点：信息可能丢失，比如 `tasks` 被完全忽略。

### 2.2 模板合成

访谈字段被合成为一个描述字符串：

```ts
const description = template(data);
// "基于 {domain} 领域创建的项目，{mode} 模式。主要任务：{tasks}"
```

优点：所有信息都被保留。
缺点：描述字符串的结构是固定的，不够灵活。

OriginOS 选择了**模板合成**，但保留了直接映射的灵活性（通过 `options.projectDescriptionTemplate`）。

## 3. 源码精读：`generateProjectData`

打开 [packages/core/src/lib/features/interview/interview-completion.ts](../../../../packages/core/src/lib/features/interview/interview-completion.ts)。

### 3.1 入口方法

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

### 3.2 字段映射表

| InterviewResult 字段 | CreateProjectRequest 字段 | 转换方式 |
| --- | --- | --- |
| `projectName` | `name` | 直接使用，为空时 fallback 为 `${domain} 项目` |
| `domain` | `domain` | 直接传递 |
| `mode` + `tasks` | `description` | 通过模板函数合成 |
| `domain` | `type` | 通过关键词映射推断 |
| 无 | `userId` | 硬编码 `"current-user"` |

注意：**`mode` 和 `tasks` 不对应任何项目字段**，它们只出现在 `description` 中。

### 3.3 默认描述模板

```ts
private defaultDescriptionTemplate = (data: InterviewResult): string => {
  return `基于 ${data.domain} 领域创建的项目，${data.mode} 模式。主要任务：${data.tasks}`;
};
```

对应源码位置：[packages/core/src/lib/features/interview/interview-completion.ts 第 46—50 行](../../../../packages/core/src/lib/features/interview/interview-completion.ts#L46-L50)。

对于小王的答案，生成的描述是：

> "基于 餐饮零售，社区咖啡馆 领域创建的项目，独立经营，雇了 2 个员工 模式。主要任务：采购原料、制作咖啡、服务顾客、管理库存"

### 3.4 项目类型映射

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

映射逻辑：
- 遍历映射表的每个关键词。
- 如果 `domain` 包含该关键词，使用对应的类型值。
- 只取第一个匹配的。
- 如果没有匹配的，默认 `"generic"`。

对于小王的“餐饮零售，社区咖啡馆”：
- 不包含“软件开发”、“产品设计”等关键词。
- 所以 `projectType = "generic"`。

## 4. 源码精读：`InterviewResult` 类型

打开 [packages/core/src/types/interview.ts](../../../../packages/core/src/types/interview.ts)。

```ts
export interface InterviewResult {
  projectName: string;
  domain: string;
  mode: string;
  tasks: string;
  concepts?: Concept[];
  ontology?: OntologyModel;
  answers?: InterviewAnswer[];
}
```

对应源码位置：[packages/core/src/types/interview.ts 第 56—91 行](../../../../packages/core/src/types/interview.ts#L56-L91)。

`InterviewResult` 包含 7 个字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `projectName` | `string` | ✅ | 项目名称 |
| `domain` | `string` | ✅ | 工作领域 |
| `mode` | `string` | ✅ | 工作模式 |
| `tasks` | `string` | ✅ | 主要任务 |
| `concepts` | `Concept[]` | ❌ | 识别出的概念（可选） |
| `ontology` | `OntologyModel` | ❌ | 生成的本体（可选） |
| `answers` | `InterviewAnswer[]` | ❌ | 原始答案（可选） |

注意：`concepts`、`ontology`、`answers` 都是可选的。这意味着：
- 如果前端已经做了概念提取，可以直接传入 `concepts`。
- 如果前端已经生成了本体，可以直接传入 `ontology`。
- `answers` 是原始答案记录，用于追溯。

但在 `generateProjectData` 中，这三个可选字段**都没有被使用**。项目数据只依赖 `projectName`、`domain`、`mode`、`tasks` 四个必填字段。

## 5. 源码精读：`CreateProjectRequest` 类型

打开 [packages/core/src/types/project.ts](../../../../packages/core/src/types/project.ts)（假设路径）。

```ts
export interface CreateProjectRequest {
  name: string;
  description?: string;
  domain?: string;
  type?: string;
  userId?: string;
}
```

注意：`CreateProjectRequest` 的字段大多是可选的，但 `generateProjectData` 会确保所有字段都有值（除了 `description` 理论上也可以为空，但模板函数总会返回一个字符串）。

## 6. 信息丢失分析

### 6.1 哪些信息被保留了？

- **项目名称**：直接映射到 `name`。
- **工作领域**：直接映射到 `domain`，同时用于推断 `type`。
- **工作模式**：出现在 `description` 中。
- **主要任务**：出现在 `description` 中。

### 6.2 哪些信息被合并了？

- **`mode` 和 `tasks`**：被合并到 `description` 中，无法单独提取。
- **`domain`**：既作为 `domain` 字段，又作为 `description` 的一部分。

### 6.3 哪些信息被丢弃了？

- **`concepts`**：如果前端提供了概念列表，`generateProjectData` 不使用它。
- **`ontology`**：如果前端提供了本体，`generateProjectData` 不使用它（但 `handleInterviewCompletion` 会单独处理）。
- **`answers`**：原始答案记录被完全忽略。

这意味着：即使前端做了复杂的概念提取和本体生成，项目创建时只用到最基础的四个字段。

## 7. 失败路径与边界

### 7.1 `projectName` 为空

```ts
const projectName =
  data.projectName && data.projectName.trim()
    ? data.projectName
    : `${data.domain} 项目`;
```

如果 `projectName` 为空，fallback 为 `${domain} 项目`。但如果 `domain` 也为空，项目名会变成 `" 项目"`（前面有一个空格）。

### 7.2 `domain` 为空

```ts
for (const [key, type] of Object.entries(typeMapping)) {
  if (data.domain.includes(key)) {
```

如果 `domain` 为空，`data.domain.includes(key)` 对所有关键词都返回 `false`，`projectType` 保持 `"generic"`。

### 7.3 `mode` 或 `tasks` 为空

```ts
return `基于 ${data.domain} 领域创建的项目，${data.mode} 模式。主要任务：${data.tasks}`;
```

如果 `mode` 或 `tasks` 为空，描述会变成：

> "基于 餐饮零售 领域创建的项目， 模式。主要任务："

这虽然语法不通，但不会报错。

### 7.4 自定义模板函数

```ts
const template = options.projectDescriptionTemplate || this.defaultDescriptionTemplate;
```

如果调用方提供了自定义模板函数，可以完全控制 `description` 的格式。但如果模板函数抛错，整个 `generateProjectData` 会失败。

## 8. 测试证据与缺口

### 已覆盖

- `generateProjectData` 没有直接单元测试。
- 字段映射的各种组合没有自动化断言。
- 自定义模板函数的错误处理没有测试。

### 缺口

- `projectName` 为空时的 fallback 逻辑没有测试。
- `domain` 为空时的类型推断没有测试。
- `mode` 和 `tasks` 为空时的描述生成没有测试。
- 项目类型映射的各种关键词组合没有测试。
- 自定义模板函数的注入和错误处理没有测试。

## 9. 小实验：验证字段映射

### 步骤一：基本映射

```ts
import { interviewCompletionHandler } from '@originos/core/lib/features/interview';

const result = await interviewCompletionHandler.handleInterviewCompletion({
  projectName: '社区咖啡馆',
  domain: '餐饮零售，社区咖啡馆',
  mode: '独立经营',
  tasks: '采购原料、制作咖啡',
}, { autoCreateProject: false, autoSaveOntology: false });

// result.project 为 null，因为 autoCreateProject=false
// 但 projectData 已经生成（内部逻辑）
```

### 步骤二：验证描述生成

```ts
// 假设我们能直接调用 generateProjectData
const projectData = interviewCompletionHandler['generateProjectData']({
  projectName: '社区咖啡馆',
  domain: '餐饮零售',
  mode: '独立经营',
  tasks: '采购原料',
});

console.log(projectData.description);
// "基于 餐饮零售 领域创建的项目，独立经营 模式。主要任务：采购原料"
```

### 步骤三：验证类型推断

```ts
const projectData1 = interviewCompletionHandler['generateProjectData']({
  projectName: 'Test',
  domain: '软件开发',
  mode: '团队协作',
  tasks: '编码',
});
console.log(projectData1.type); // "software"

const projectData2 = interviewCompletionHandler['generateProjectData']({
  projectName: 'Test',
  domain: '餐饮零售',
  mode: '独立经营',
  tasks: '采购',
});
console.log(projectData2.type); // "generic"
```

### 实验结论

字段映射逻辑简单直接，但缺乏自动化测试。特别是类型推断和描述生成，需要覆盖各种输入组合。

## 10. 口头验收

读完本课后，应能不看书稿回答：

1. `InterviewResult` 的 7 个字段中，哪些被 `generateProjectData` 使用了？哪些被丢弃了？
2. `description` 是怎么生成的？默认模板是什么格式？
3. 项目类型是怎么从 `domain` 推断出来的？如果推断失败，默认值是什么？
4. 如果 `projectName` 为空，系统会怎么处理？
5. 如果调用方提供了自定义模板函数，会发生什么？如果模板函数抛错呢？

## 11. 章节收束

本课的核心认知是：**`InterviewResult` 到 `CreateProjectRequest` 的转换是一个“信息筛选和合成”的过程——四个必填字段被保留和合并，三个可选字段被完全忽略，项目类型通过关键词子串匹配推断**。

我们看到的几个关键设计：

- **字段映射是单向的**：访谈数据 → 项目数据，不可反向推导。
- **描述是合成的**：`mode` 和 `tasks` 被合并到 `description` 中，无法单独提取。
- **类型推断是启发式的**：基于关键词子串匹配，不是精确的语义分析。
- **可选字段被忽略**：`concepts`、`ontology`、`answers` 在项目创建阶段不被使用。
- **fallback 逻辑存在但未经测试**：`projectName` 为空、`domain` 为空等边界情况。

下一课（G14）我们会深入 `interview-questions.ts`，看看问题库是怎么设计的，以及步骤导航和答案验证的实现细节。
