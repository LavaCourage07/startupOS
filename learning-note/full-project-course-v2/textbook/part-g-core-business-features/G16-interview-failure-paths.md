# G16：访谈流程的失败路径——未完成、缺失与异常

> 本课核心问题：访谈流程中，用户在哪个环节可能失败？系统是怎么处理的？有哪些失败路径没有被测试覆盖？

## 1. 开篇场景：小王的访谈出问题了

小王正在回答访谈问题，突然出现了几种情况：

1. **访谈未完成**：小王回答到一半，关闭了浏览器。下次打开时，访谈进度还在吗？
2. **答案缺失**：小王只回答了第一个问题就点击“完成”。系统会怎么处理？
3. **API 调用失败**：网络断了，`createProject` 请求发不出去。用户的答案会丢失吗？
4. **本体保存成功但项目创建失败**：系统已经生成了本体，但项目创建时出错。会留下“孤儿本体”吗？

本课就来梳理访谈流程中的所有失败路径。

## 2. 失败路径总览

访谈流程的失败路径可以分为四类：

| 类别 | 场景 | 处理方式 | 风险 |
| --- | --- | --- | --- |
| **用户中断** | 关闭浏览器、刷新页面 | 依赖会话持久化 | 答案可能丢失 |
| **数据缺失** | 必填字段为空、答案不完整 | 前端验证 + 后端 fallback | 信息质量下降 |
| **API 失败** | 网络中断、服务不可用 | try/catch + 错误返回 | 事务不一致 |
| **部分成功** | 本体保存成功但项目创建失败 | 无回滚机制 | 孤儿数据 |

## 3. 用户中断：访谈未完成

### 3.1 问题

小王回答到第二个问题时关闭了浏览器。下次打开 OriginOS，他需要重新回答吗？

### 3.2 当前实现

`InterviewCompletionHandler` 不管理访谈进度。它只处理“访谈完成”这一瞬间：

```ts
async handleInterviewCompletion(data: InterviewResult, options = {}): Promise<...> {
  // 只处理完成的访谈，不管理中间状态
}
```

这意味着：**访谈进度管理在前端**。前端需要自行保存用户的答案（如 localStorage、sessionStorage 或后端会话）。

### 3.3 风险

- 如果前端没有实现进度保存，用户刷新页面后需要重新回答。
- 如果前端保存了进度但没有同步到后端，换设备后进度丢失。
- `InterviewResult` 类型中没有 `progress` 或 `status` 字段，不支持部分完成的访谈。

### 3.4 改进建议

```ts
// 在 InterviewResult 中增加进度字段
interface InterviewResult {
  // ...existing fields
  progress?: {
    currentStep: number;
    totalSteps: number;
    answers: Record<string, string>;
  };
}
```

## 4. 数据缺失：必填字段为空

### 4.1 `validateInterviewResult`

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

### 4.2 验证范围

`validateInterviewResult` 只检查两个字段：
- `projectName`：项目名称不能为空。
- `domain`：工作领域不能为空。

**不检查的字段：**
- `mode`：工作模式（可以为空）。
- `tasks`：主要任务（可以为空）。
- `concepts`：识别出的概念（可选）。
- `ontology`：生成的本体（可选）。
- `answers`：原始答案（可选）。

### 4.3 风险

如果 `mode` 为空：
- `generateProjectData` 的描述会变成 `"基于 {domain} 领域创建的项目， 模式。主要任务：{tasks}"`。
- 语法不通，但不会报错。

如果 `tasks` 为空：
- `extractTaskConcepts` 会返回一个默认任务节点。
- 本体中会包含一个“默认任务”节点。

### 4.4 改进建议

```ts
// 增加对 mode 和 tasks 的验证
if (!data.mode || data.mode.trim().length === 0) {
  errors.push("工作模式不能为空");
}

if (!data.tasks || data.tasks.trim().length === 0) {
  errors.push("主要任务不能为空");
}
```

## 5. API 失败：网络中断与服务不可用

### 5.1 `handleInterviewCompletion` 的错误处理

```ts
try {
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

  return { project, ontologyId, error: undefined };
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
```

对应源码位置：[packages/core/src/lib/features/interview/interview-completion.ts 第 214—254 行](../../../../packages/core/src/lib/features/interview/interview-completion.ts#L214-L254)。

### 5.2 错误处理分析

`handleInterviewCompletion` 使用了一个大的 `try/catch`：
- 任何步骤抛出错误，都会被 `catch` 捕获。
- 返回 `{ project: null, ontologyId: undefined, error: errorMessage }`。

这意味着：
- **无法区分错误类型**：是本体保存失败还是项目创建失败？调用方不知道。
- **无法部分恢复**：如果本体保存成功但项目创建失败，`catch` 会吞掉 `ontologyId`，调用方拿不到。
- **没有重试机制**：网络瞬断时直接失败，不会自动重试。

### 5.3 改进建议

```ts
// 更细粒度的错误处理
async handleInterviewCompletion(data: InterviewResult, options = {}): Promise<...> {
  const projectData = this.generateProjectData(data, options);
  const ontologyModel = this.generateOntologyModel(data);

  let ontologyId: string | undefined;
  let ontologyError: string | undefined;

  if (options.autoSaveOntology !== false) {
    try {
      ontologyId = await this.saveOntology(ontologyModel);
    } catch (error) {
      ontologyError = error instanceof Error ? error.message : '保存本体失败';
      // 不抛错，继续尝试创建项目
    }
  }

  let project: Project | null = null;
  let projectError: string | undefined;

  if (options.autoCreateProject !== false) {
    try {
      const createRequest: CreateProjectRequest = { ...projectData, ontologyId };
      project = await this.createProject(createRequest);
    } catch (error) {
      projectError = error instanceof Error ? error.message : '创建项目失败';
    }
  }

  return {
    project,
    ontologyId,
    error: projectError || ontologyError,
    details: { ontologyError, projectError },
  };
}
```

## 6. 部分成功：孤儿本体

### 6.1 问题描述

```ts
let ontologyId: string | undefined;
if (options.autoSaveOntology !== false) {
  ontologyId = await this.saveOntology(ontologyModel);  // 成功
}

let project: Project | null = null;
if (options.autoCreateProject !== false) {
  project = await this.createProject(createRequest);  // 失败
}
```

如果：
1. `saveOntology` 成功，返回 `ontologyId`。
2. `createProject` 失败，抛出错误。

那么 `catch` 会捕获错误，返回 `{ project: null, ontologyId: undefined, error: ... }`。

但此时**本体已经保存在数据库中了**，只是调用方拿不到 `ontologyId`。这就形成了一个“孤儿本体”——存在于数据库中，但没有被任何项目引用。

### 6.2 风险

- 数据库中会积累大量无用的本体数据。
- 占用存储空间。
- 无法通过正常业务逻辑访问到这些本体。

### 6.3 改进建议

```ts
// 方案一：事务机制（需要数据库支持）
async handleInterviewCompletion(data: InterviewResult): Promise<...> {
  const tx = await db.beginTransaction();
  try {
    const ontologyId = await this.saveOntology(ontologyModel, { transaction: tx });
    const project = await this.createProject(createRequest, { transaction: tx });
    await tx.commit();
    return { project, ontologyId };
  } catch (error) {
    await tx.rollback();
    return { project: null, ontologyId: undefined, error: ... };
  }
}

// 方案二：补偿机制（适用于文件系统存储）
async handleInterviewCompletion(data: InterviewResult): Promise<...> {
  let ontologyId: string | undefined;

  try {
    ontologyId = await this.saveOntology(ontologyModel);
  } catch (error) {
    return { project: null, ontologyId: undefined, error: '保存本体失败' };
  }

  try {
    const project = await this.createProject({ ...projectData, ontologyId });
    return { project, ontologyId };
  } catch (error) {
    // 项目创建失败，删除已保存的本体
    await this.deleteOntology(ontologyId);
    return { project: null, ontologyId: undefined, error: '创建项目失败' };
  }
}
```

## 7. 图解：失败路径全景

```mermaid
flowchart TD
    User([小王]) -->|开始访谈| Start[访谈开始]
    Start -->|回答问题| Answer[提交答案]

    Answer -->|验证失败| VA[validateAnswer]
    VA -->|返回错误| ShowErr[显示错误提示]
    ShowErr --> Answer

    Answer -->|验证通过| Save[保存答案]
    Save -->|还有更多问题| Next[getNextQuestionId]
    Next --> Answer

    Save -->|最后一个问题| Complete[点击完成]
    Complete -->|调用| HC[handleInterviewCompletion]

    HC -->|生成数据| Gen[generateProjectData + generateOntologyModel]
    Gen -->|保存本体| SO[saveOntology]

    SO -->|失败| Err1[返回 error: 保存本体失败]
    SO -->|成功| ontologyId[ontologyId]

    ontologyId -->|创建项目| CP[createProject]
    CP -->|失败| Err2[孤儿本体!]
    CP -->|成功| Success[返回 { project, ontologyId }]

    Err1 -->|catch| Catch1[返回 { project: null, error }]
    Err2 -->|catch| Catch2[返回 { project: null, error }]
    Catch2 -.->|本体已保存| Orphan[(孤儿本体)]
```

## 8. 测试证据与缺口

### 已覆盖

- 访谈流程的失败路径没有直接单元测试。
- `handleInterviewCompletion` 的 `catch` 分支没有测试。

### 缺口

- 网络中断时 `saveOntology` 失败的处理没有测试。
- 本体保存成功但项目创建失败的场景没有测试。
- `validateInterviewResult` 对各种缺失字段的处理没有测试。
- 部分成功场景（孤儿本体）没有测试。
- 重试机制没有实现，也没有测试。

## 9. 小实验：验证失败路径

### 步骤一：验证必填字段

```ts
import { interviewCompletionHandler } from '@originos/core/lib/features/interview';

// projectName 为空
const result1 = interviewCompletionHandler.validateInterviewResult({
  projectName: '',
  domain: '餐饮零售',
  mode: '独立经营',
  tasks: '采购原料',
});
console.log(result1.valid);   // false
console.log(result1.errors);  // ["项目名称不能为空"]

// domain 为空
const result2 = interviewCompletionHandler.validateInterviewResult({
  projectName: '社区咖啡馆',
  domain: '',
  mode: '独立经营',
  tasks: '采购原料',
});
console.log(result2.valid);   // false
console.log(result2.errors);  // ["工作领域不能为空"]

// mode 和 tasks 为空（验证通过）
const result3 = interviewCompletionHandler.validateInterviewResult({
  projectName: '社区咖啡馆',
  domain: '餐饮零售',
  mode: '',
  tasks: '',
});
console.log(result3.valid);   // true
console.log(result3.errors);  // []
```

### 步骤二：模拟 API 失败

```ts
// 由于 saveOntology 和 createProject 是私有方法，
// 实际测试需要 mock 外部依赖
// 这里展示概念性的测试思路

// 测试 saveOntology 失败
test('should handle ontology save failure', async () => {
  vi.mocked(generateOntology).mockRejectedValue(new Error('Network error'));

  const result = await interviewCompletionHandler.handleInterviewCompletion({
    projectName: 'Test',
    domain: 'Test',
    mode: 'Test',
    tasks: 'Test',
  });

  expect(result.project).toBeNull();
  expect(result.ontologyId).toBeUndefined();
  expect(result.error).toContain('Network error');
});
```

### 实验结论

失败路径的处理是访谈流程的薄弱环节。特别是部分成功场景（孤儿本体），需要事务或补偿机制来保证数据一致性。

## 10. 口头验收

读完本课后，应能不看书稿回答：

1. 访谈流程中有哪四类失败路径？
2. `validateInterviewResult` 检查了哪些字段？没检查哪些字段？
3. 如果本体保存成功但项目创建失败，会发生什么？为什么？
4. `handleInterviewCompletion` 的 `try/catch` 有什么缺点？
5. 如果要避免“孤儿本体”，可以怎么做？

## 11. 章节收束

本课的核心认知是：**访谈流程的失败处理是“粗粒度”的——一个大 `try/catch` 捕获所有错误，无法区分错误类型，无法部分恢复，更无法避免孤儿数据**。

我们看到的几个关键问题：

- **用户中断**：访谈进度管理在前端，后端不保存中间状态。
- **数据缺失**：`validateInterviewResult` 只检查 `projectName` 和 `domain`，`mode` 和 `tasks` 可以为空。
- **API 失败**：一个大 `try/catch` 捕获所有错误，调用方无法区分错误类型。
- **部分成功**：本体保存成功但项目创建失败时，会形成“孤儿本体”。
- **无事务机制**：没有回滚或补偿机制来保证数据一致性。

下一课（G17）我们会讨论 `lib/features/interview` 和 `lib/integrations/pi-agent/project-agent` 的边界，明确两套访谈系统的区别。
