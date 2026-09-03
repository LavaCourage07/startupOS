# G02：一次项目创建会话里到底存了什么

> 本课核心问题：`ProjectCreationSession` 有哪些字段？`data` 和 `extractedData` 为什么要分开？状态字段如何控制流程推进？

## 1. 接上节课：小王已经回答了第一题

上节课讲到，小王点击“创建项目”后，系统先创建了一个 `ProjectCreationSession`，并返回第 1 个问题。小王回答后，系统调用 `submitAnswer` 保存答案。

这节课我们要打开这个会话对象，看看它里面到底存了什么。只有理解它的结构，才能解释：

- 为什么用户关闭窗口后能恢复？
- 为什么系统能从回答中“提取”出 TASTE 和本体的输入？
- 为什么 `currentStep` 和 `status` 是两个不同的字段？

## 2. 会话对象的总体结构

`ProjectCreationSession` 的类型定义在 [packages/core/src/types/project-creation.ts](../../../../packages/core/src/types/project-creation.ts)。

它的核心字段可以分成四组：

```ts
{
  // 1. 身份信息
  sessionId: string;      // 本次创建流程的临时 ID
  projectId: string;      // 最终项目的稳定 ID
  userId: string;         // 创建者

  // 2. 流程控制状态
  status: 'active' | 'completed' | 'expired' | 'failed';
  currentStep: number;    // 当前在第几步（1-4）
  maxSteps: number;       // 总步数（默认 4）

  // 3. 用户原始答案
  data: {
    name: string | null;
    background: string | null;
    priorities: string[];
    workMode: WorkMode | null;
    customDescriptions: { priorities?: string; workMode?: string };
  };

  // 4. 系统提取的派生信息
  extractedData: {
    experience_topology: string[];
    context_features?: { domain; task_type; tech_stack; discourse_system };
    taste_standards: Record<string, { positive_vibes; negative_vibes }>;
    tension_position: { control_level; trust_level; intervention_threshold } | null;
    symbiosis_boundary: { delegated_domains; reserved_domains; contextual_triggers; control_level } | null;
  };
}
```

对应源码位置：[packages/core/src/types/project-creation.ts 第 82—121 行](../../../../packages/core/src/types/project-creation.ts#L82-L121)。

## 3. 身份字段：sessionId 与 projectId

这两个 ID 在 G01 已经讲过，这里再强调它们的区别。

| 字段 | 格式 | 生命周期 | 用途 |
| --- | --- | --- | --- |
| `sessionId` | `pc_{uuid}` | 创建流程期间 | 定位临时会话文件 |
| `projectId` | `proj_{uuid}` | 项目整个生命周期 | 定位项目目录、关联本体、TASTE 等 |

关键设计：`projectId` 在 `startSession` 时就生成，而不是在 `completeCreation` 时。这样做的好处是：

- 会话阶段产生的所有派生文件（如 TASTE、本体的草稿）都可以预先用 `projectId` 组织路径。
- 完成创建时不需要再分配 ID，避免了“会话里的路径”和“最终项目的路径”不一致。

但也要注意到风险：如果同一个会话被重复完成（虽然当前代码会检查 `status !== 'active'`），`projectId` 不变意味着可能会覆盖已有项目。当前实现通过状态检查防止这一点。

## 4. 流程控制字段：status 与 currentStep

### 4.1 status

`status` 是会话的生命周期状态，有四个取值：

| 状态 | 含义 | 允许的操作 |
| --- | --- | --- |
| `active` | 创建流程进行中 | 提交答案、完成创建 |
| `completed` | 已完成，项目已生成 | 只读 |
| `expired` | 会话过期 | 只读 |
| `failed` | 创建失败 | 只读 |

`submitAnswer` 和 `completeCreation` 都会检查 `status === 'active'`。这是防止对已结束会话继续操作的第一道防线。

### 4.2 currentStep 与 maxSteps

`currentStep` 表示用户当前应该回答第几步，`maxSteps` 表示总共有几步（默认 4）。

`submitAnswer` 中有一个重要检查：

```ts
if (session.currentStep !== request.step) {
  throw new Error('INVALID_STEP');
}
```

对应源码位置：[packages/core/src/lib/features/project/project-creation-service.ts 第 158—160 行](../../../../packages/core/src/lib/features/project/project-creation-service.ts#L158-L160)。

这个检查保证：用户只能提交当前步骤的答案，不能跳过步骤，也不能重复提交上一步。这是一种**乐观的顺序控制**：系统不强制用户必须按顺序浏览问题，但提交答案时必须按顺序。

## 5. 数据分工：data 与 extractedData

这是本课最重要的概念。`data` 和 `extractedData` 的分离，体现了“用户原始输入”与“系统派生理解”的解耦。

### 5.1 data：用户说了什么

`data` 保存用户直接提供的内容：

- `name`：项目名称（可能在完成时最终确认）。
- `background`：项目背景描述。
- `priorities`：用户选择的核心关注点。
- `workMode`：用户选择的工作模式。
- `customDescriptions`：用户对某些选项的自定义说明。

这些数据的特点是：**忠于用户输入，便于回显和修改**。

### 5.2 extractedData：系统理解了什么

`extractedData` 是系统从 `data` 中解析出的结构化信息，供后续流程使用：

| 字段 | 来源 | 用途 |
| --- | --- | --- |
| `experience_topology` | 从 `background` 提取关键词 | 生成 TASTE、判断项目经验领域 |
| `context_features` | 从 `background` 提取领域、任务类型、技术栈 | 生成本体、选择默认配置 |
| `taste_standards` | 从 `priorities` 和自定义描述提取 | 生成项目 TASTE 配置 |
| `tension_position` | 从 `priorities` 提取 | 判断用户偏好控制还是信任 Agent |
| `symbiosis_boundary` | 从 `workMode` 提取 | 判断人与 Agent 的分工边界 |

### 5.3 为什么要分开？

假设小王回答第 1 题：

> “我想在小区楼下开一家精品咖啡馆，主营手冲咖啡和轻食。”

`data.background` 保存的就是这句话原文。而 `extractedData.context_features.domain` 可能被解析为 `food-and-beverage`，`tech_stack` 可能为空（因为描述里没有技术词汇）。

分开的好处：

1. **可回显**：UI 显示“你之前填写的内容”时，直接读 `data`。
2. **可修改**：如果小王修改了背景描述，系统可以重新提取 `extractedData`。
3. **可解释**：系统后续行为（如生成了什么本体）可以追溯到 `extractedData`，再追溯到 `data`。
4. **可测试**：可以单独测试“提取逻辑”是否正确，而不依赖完整创建流程。

## 6. 提取逻辑：`processAnswer` 做了什么？

[packages/core/src/lib/features/project/project-creation-service.ts 第 179—232 行](../../../../packages/core/src/lib/features/project/project-creation-service.ts#L179-L232) 的 `processAnswer` 根据当前步骤，更新 `data` 并填充 `extractedData`。

### 6.1 第 1 步：背景描述

```ts
case 1:
  if (answer.type === 'text' && typeof answer.value === 'string') {
    session.data.background = answer.value;
    session.extractedData.experience_topology = this.extractExperienceTopology(answer.value);
    session.extractedData.context_features = this.extractContextFeatures(answer.value);
  }
  break;
```

对应源码位置：[packages/core/src/lib/features/project/project-creation-service.ts 第 186—195 行](../../../../packages/core/src/lib/features/project/project-creation-service.ts#L186-L195)。

这一步从文本中提取两类信息：

- `experience_topology`：经验拓扑，例如 `web-development`、`ecommerce` 等关键词。
- `context_features`：上下文特征，包括领域、任务类型、技术栈、话语体系。

注意：当前 `extractExperienceTopology` 和 `extractContextFeatures` 主要面向技术类项目（见 [第 336—398 行](../../../../packages/core/src/lib/features/project/project-creation-service.ts#L336-L398) 的正则规则）。对于“社区咖啡馆”这样的非技术项目，提取结果可能比较粗糙，甚至落入默认值。这是当前实现的一个边界，不是通用 NLP 解析。

### 6.2 第 2 步：优先级

```ts
case 2:
  if (answer.type === 'choice' && Array.isArray(answer.value)) {
    session.data.priorities = answer.value;
    if (answer.customDescription) {
      session.data.customDescriptions.priorities = answer.customDescription;
    }
    session.extractedData.taste_standards = this.extractTasteStandards(
      answer.value,
      answer.customDescription
    );
    session.extractedData.tension_position = this.extractTensionPosition(
      answer.value,
      answer.customDescription
    );
  }
  break;
```

对应源码位置：[packages/core/src/lib/features/project/project-creation-service.ts 第 197—215 行](../../../../packages/core/src/lib/features/project/project-creation-service.ts#L197-L215)。

这一步从用户选择的优先级中，提取出：

- `taste_standards`：TASTE 标准，描述用户喜欢什么、不喜欢什么。
- `tension_position`：张力位置，描述用户在“控制”与“信任 Agent”之间的偏好。

### 6.3 第 3 步：工作模式

```ts
case 3:
  if (answer.type === 'choice' && typeof answer.value === 'string') {
    session.data.workMode = answer.value as 'solo' | 'team' | 'product-owner' | 'custom';
    // ...
    session.extractedData.symbiosis_boundary = this.extractSymbiosisBoundary(
      answer.value,
      answer.customDescription
    );
  }
  break;
```

对应源码位置：[packages/core/src/lib/features/project/project-creation-service.ts 第 217—230 行](../../../../packages/core/src/lib/features/project/project-creation-service.ts#L217-L230)。

这一步提取 `symbiosis_boundary`：用户愿意把哪些领域交给 Agent，哪些领域保留给自己。

## 7. 时间戳与错误字段

会话还包含几个辅助字段：

| 字段 | 用途 |
| --- | --- |
| `createdAt` | 会话创建时间 |
| `updatedAt` | 每次保存时更新 |
| `completedAt` | 完成创建时记录 |
| `expiresAt` | 会话过期时间（当前实现中生成，但未看到主动清理逻辑） |
| `error` | 如果创建失败，记录错误码和消息 |

`error` 字段的存在说明：系统预留了失败记录能力。但当前 `completeCreation` 中并没有设置 `status = 'failed'` 的路径，失败时直接抛异常。所以 `error` 字段更多是预留结构，而非当前活跃路径。

## 8. 失败路径与边界

### 8.1 提取失败不会阻止流程

如果 `extractExperienceTopology` 没有匹配到任何关键词，它会回退到 `['general-development']`（见 [第 361—366 行](../../../../packages/core/src/lib/features/project/project-creation-service.ts#L361-L366)）。这说明提取逻辑是“尽力而为”，不会因为解析失败就中断创建流程。

### 8.2 自定义描述不参与所有提取

`customDescriptions.priorities` 和 `customDescriptions.workMode` 被保存到 `data`，但并非所有提取函数都使用它们。具体使用方式需要看 `extractTasteStandards`、`extractTensionPosition`、`extractSymbiosisBoundary` 的实现。如果自定义描述没有被充分利用，可能是当前实现的缺口。

### 8.3 答案类型不匹配会静默跳过

`processAnswer` 的每一步都有 `if (answer.type === ...)` 检查。如果类型不匹配，对应的 `case` 不会修改任何数据，但也不会抛错。这意味着：如果前端传了错误类型的答案，系统会“静默跳过”，用户可能以为答案已保存，实际上没有。

## 9. 测试证据与缺口

### 已覆盖

- `ProjectCreationSessionSchema` 的 Zod 类型定义本身没有单元测试，但它被 `getSession` 使用（[第 116 行](../../../../packages/core/src/lib/features/project/project-creation-service.ts#L116)），任何不符合 schema 的会话文件都会解析失败。

### 缺口

- 没有测试验证 `data` 和 `extractedData` 的分离是否按预期工作。
- 没有测试验证 `processAnswer` 在每一步是否正确更新 `extractedData`。
- 没有测试验证答案类型不匹配时的行为。
- 没有测试验证 `expiresAt` 是否真正生效。

### 可执行的验证

你可以用以下纸面推演验证结构理解：

1. 给定一个 `background` 文本，列出 `data.background` 和 `extractedData.experience_topology` 的预期值。
2. 给定一组 `priorities`，列出 `data.priorities` 和 `extractedData.taste_standards` 的预期形状。
3. 模拟 `currentStep = 2` 时提交 `step = 1` 的答案，确认会抛 `INVALID_STEP`。

## 10. 小实验：画出小王的会话状态

假设小王回答完第 2 题，会话状态应该类似：

```ts
{
  sessionId: "pc_abc123",
  projectId: "proj_def456",
  userId: "user-xiaowang",
  status: "active",
  currentStep: 3,
  maxSteps: 4,
  data: {
    name: null,
    background: "想在小区楼下开一家精品咖啡馆，主营手冲咖啡和轻食",
    priorities: ["成本控制", "出品稳定", "客户体验"],
    workMode: null,
    customDescriptions: {
      priorities: "我最在意性价比和稳定出品",
    },
  },
  extractedData: {
    experience_topology: ["general-development"],
    context_features: {
      domain: "general",
      task_type: "general",
      tech_stack: [],
      discourse_system: "business",
    },
    taste_standards: {
      "成本控制": { positive_vibes: ["..."], negative_vibes: ["..."] },
      // ...
    },
    tension_position: { control_level: 0.7, trust_level: 0.3, intervention_threshold: 0.5 },
    symbiosis_boundary: null,
  },
}
```

这个实验的重点不是值是否精确，而是理解：**`data` 保存小王说了什么，`extractedData` 保存系统从中理解了什么**。

## 11. 口头验收

读完本课后，应能不看书稿回答：

1. `ProjectCreationSession` 的字段可以分成哪四组？每组举一个字段。
2. `data.background` 和 `extractedData.context_features.domain` 有什么区别？为什么要分开存？
3. `status` 和 `currentStep` 各自控制什么？举一个只改其中一个、不改另一个的场景。
4. 如果小王提交第 2 题答案时，`answer.type` 是 `'text'` 而不是 `'choice'`，会发生什么？
5. `extractExperienceTopology` 没有匹配到关键词时会返回什么？这体现了什么设计取舍？

## 12. 章节收束

本课的核心认知是：**`ProjectCreationSession` 是一个结构化的“流程状态容器”，它同时保存用户原始输入和系统派生理解，并用 `status` / `currentStep` 控制流程**。

`data` 与 `extractedData` 的分离，让 OriginOS 既能忠于用户输入，又能为后续 TASTE、本体、项目初始化提供结构化材料。

下一课（G03）会离开创建会话，进入 `ProjectService`，看一个已创建的项目实体如何被长期保存和读取。
