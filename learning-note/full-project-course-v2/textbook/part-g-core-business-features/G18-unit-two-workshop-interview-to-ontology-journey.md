# G18：单元小结课——画出"问题 → 答案 → 项目 → 本体"的完整调用链

> 本课核心问题：从 G11 到 G17，我们已经把访谈流程拆成了七节课。现在请你脱离源码，把"小王回答访谈问题 → 项目创建 → 本体生成"的完整旅程画出来，并标出每个关键节点的责任方、数据格式、失败路径和测试缺口。

## 1. 开篇场景：七节课之后，小王的访谈终于完成了

让我们回到小王的视角：

1. 小王打开 OriginOS，系统弹出三个问题。
2. 第一个问题："你的工作领域是什么？" 小王回答："餐饮零售，社区咖啡馆。"
3. 第二个问题："你的工作模式是什么？" 小王回答："独立经营，雇了 2 个员工。"
4. 第三个问题："主要任务有哪些？" 小王回答："采购原料、制作咖啡、服务顾客、管理库存。"
5. 小王点击"完成访谈"。
6. 系统显示"正在创建项目..."、"正在生成本体..."
7. 项目"社区咖啡馆"创建成功！

这个看似简单的流程，背后涉及多个文件、多个服务、多种数据格式。

本单元小结课的任务，就是**把这条线从头到尾画清楚**。

## 2. 概念阶梯回顾

### 2.1 从直觉到术语

| 直觉说法 | 专业术语 | 对应源码 |
| --- | --- | --- |
| "系统问了三个问题" | 静态问题列表（`INTERVIEW_QUESTIONS`） | `interview/interview-questions.ts` |
| "小王回答完问题" | 访谈结果（`InterviewResult`） | `types/interview.ts` |
| "点击完成后自动创建项目" | 访谈完成处理器（`InterviewCompletionHandler`） | `interview/interview-completion.ts` |
| "项目数据从哪来" | `generateProjectData` | `interview/interview-completion.ts` |
| "本体数据从哪来" | `generateOntologyModel` | `interview/interview-completion.ts` |
| "本体怎么展示" | 本体适配器（`adaptOntologyForDisplay`） | `interview/ontology-adapter.ts` |
| "两套访谈系统" | `lib/features/interview` vs `lib/integrations/pi-agent/project-agent` | 见 G17 |

### 2.2 关键边界

本单元反复强调的边界：

- **`lib/features/interview` 只管结构化访谈，不管 Agent 访谈。**
- **`InterviewService`（会话管理）在 `ontology` feature 里，不在 `interview` feature 里。**
- **`InterviewCompletionHandler` 是单例，但无事务机制。**
- **本体适配器忽略了 `instances` 层。**
- **两套访谈系统是互补关系，不是替代关系。**

## 3. 完整调用链图解

```mermaid
flowchart TD
    User([小王]) -->|开始访谈| Start[前端组件加载]
    Start -->|导入| IQ[INTERVIEW_QUESTIONS]
    IQ -->|显示问题 1| Q1["work-domain: 你的工作领域是什么？"]

    User -->|输入答案| A1["餐饮零售，社区咖啡馆"]
    A1 -->|调用| VA1[validateAnswer]
    VA1 -->|有效| Save1[保存答案]
    VA1 -->|无效| Err1[显示错误提示]
    Err1 --> A1
    Save1 -->|获取下一个| NQ1[getNextQuestionId]
    NQ1 --> Q2["work-mode: 你的工作模式是什么？"]

    User -->|输入答案| A2["独立经营，雇了 2 个员工"]
    A2 -->|调用| VA2[validateAnswer]
    VA2 -->|有效| Save2[保存答案]
    Save2 -->|获取下一个| NQ2[getNextQuestionId]
    NQ2 --> Q3["main-tasks: 主要任务有哪些？"]

    User -->|输入答案| A3["采购原料、制作咖啡、服务顾客、管理库存"]
    A3 -->|调用| VA3[validateAnswer]
    VA3 -->|有效| Save3[保存答案]
    Save3 -->|没有更多问题| Complete[触发 InterviewCompletionHandler]

    Complete -->|调用| HC[handleInterviewCompletion]
    HC -->|生成| PD[generateProjectData]
    HC -->|生成| OM[generateOntologyModel]

    PD -->|字段映射| CPR[CreateProjectRequest]
    CPR -->|包含| PN[项目名称: 社区咖啡馆]
    CPR -->|包含| PT[项目类型: generic]
    CPR -->|包含| PDESC[项目描述: 基于餐饮零售...]

    OM -->|节点生成| ON[OntologyNode[]]
    ON -->|包含| Domain[领域节点: 餐饮零售]
    ON -->|包含| Tasks[任务节点: 采购原料/制作咖啡/服务顾客/管理库存]

    OM -->|保存本体| SO[saveOntology]
    CPR -->|创建项目| CP[createProject]

    SO -->|返回| OID[ontologyId]
    CP -->|返回| Project[Project 对象]

    HC -->|返回| Result[{ project, ontologyId }]

    Result -->|展示| OA[adaptOntologyForDisplay]
    OA -->|转换| Display[前端展示 OntologyModel]
```

## 4. 节点责任表

| 步骤 | 负责人 | 输入 | 输出 | 关键设计决策 |
| --- | --- | --- | --- | --- |
| 显示问题 | `INTERVIEW_QUESTIONS` | 无 | `InterviewQuestion[]` | 静态列表，`readonly` + `as const` |
| 步骤导航 | `getNextQuestionId` / `getPreviousQuestionId` | `currentId` | `string \| null` | 纯函数，基于索引 |
| 答案验证 | `validateAnswer` | `questionId`, `answer` | `{ valid, error }` | 只检查长度，不检查语义 |
| 生成项目数据 | `generateProjectData` | `InterviewResult` | `CreateProjectRequest` | 字段映射 + 模板合成 |
| 推断项目类型 | 关键词子串匹配 | `domain` | `type` | 默认 `generic` |
| 生成本体模型 | `generateOntologyModel` | `InterviewResult` | `OntologyModel` | 两个根节点：领域 + 任务 |
| 提取任务概念 | `extractTaskConcepts` | `tasks` 字符串 | `OntologyNode[]` | 按逗号等分隔符拆分 |
| 保存本体 | `saveOntology` | `OntologyModel` | `ontologyId` | 调用外部 API |
| 创建项目 | `createProject` | `CreateProjectRequest` | `Project` | 调用外部 API |
| 本体展示 | `adaptOntologyForDisplay` | `Ontology` | `OntologyModel` | 忽略 `instances` 层 |

## 5. 数据格式转换链

```
用户输入
  ↓
InterviewResult {
  projectName: "社区咖啡馆",
  domain: "餐饮零售，社区咖啡馆",
  mode: "独立经营，雇了 2 个员工",
  tasks: "采购原料、制作咖啡、服务顾客、管理库存"
}
  ↓
CreateProjectRequest {
  name: "社区咖啡馆",
  description: "基于 餐饮零售... 模式。主要任务：...",
  domain: "餐饮零售，社区咖啡馆",
  type: "generic",
  userId: "current-user"
}
  ↓
OntologyModel {
  id: "ontology-...",
  name: "社区咖啡馆 本体",
  nodes: [
    { id: "domain-...", name: "领域", type: "entity", children: [...] },
    { id: "tasks-...", name: "任务", type: "entity", children: [...] }
  ]
}
  ↓
Project { id, name, description, domain, type, ... }
```

## 6. 失败路径复盘

### 6.1 访谈阶段

| 失败场景 | 抛出错误 | 后果 |
| --- | --- | --- |
| 答案为空 | `validateAnswer` 返回错误 | 前端显示错误提示 |
| 答案长度不足 | `validateAnswer` 返回错误 | 前端显示错误提示 |
| 问题 ID 不存在 | `validateAnswer` 返回"无效的问题" | 前端显示错误提示 |
| 用户中断 | 无（前端未保存进度） | 答案丢失 |

### 6.2 访谈完成处理阶段

| 失败场景 | 处理方式 | 风险 |
| --- | --- | --- |
| `projectName` 为空 | fallback 为 `${domain} 项目` | 项目名可能不友好 |
| `domain` 为空 | `projectType` 默认 `generic` | 类型信息缺失 |
| 项目类型推断失败 | 默认 `generic` | 类型信息缺失 |
| 本体保存失败 | `catch` 捕获，返回 error | 项目也创建不了 |
| 项目创建失败 | `catch` 捕获，返回 error | 形成"孤儿本体" |
| 事务不一致 | 无回滚机制 | 数据不完整 |

### 6.3 本体展示阶段

| 失败场景 | 处理方式 | 风险 |
| --- | --- | --- |
| `instances` 层被忽略 | 无处理 | 实例数据丢失 |
| `concept.type` 不匹配 | 类型断言 | 运行时类型错误 |
| 空 `domains` | 返回空 `nodes` | 前端展示空树 |

## 7. 测试覆盖复盘

| 能力 | 测试位置 | 覆盖状态 |
| --- | --- | --- |
| `INTERVIEW_QUESTIONS` 字段完整性 | 无 | ❌ 未覆盖 |
| `getNextQuestionId` / `getPreviousQuestionId` | 无 | ❌ 未覆盖 |
| `validateAnswer` 各种分支 | 无 | ❌ 未覆盖 |
| `DEFAULT_ANSWERS` / `DEFAULT_STEP_STATES` | 无 | ❌ 未覆盖 |
| `InterviewCompletionHandler` | 无 | ❌ 未覆盖 |
| `generateProjectData` 字段映射 | 无 | ❌ 未覆盖 |
| `generateOntologyModel` 节点结构 | 无 | ❌ 未覆盖 |
| `extractTaskConcepts` 分隔符处理 | 无 | ❌ 未覆盖 |
| `adaptOntologyForDisplay` | 无 | ❌ 未覆盖 |
| 失败路径（网络中断、部分成功） | 无 | ❌ 未覆盖 |

## 8. 工作坊练习

### 练习一：画出调用链

请拿一张纸或打开一个白板工具，不看书稿，画出以下调用链：

1. 小王打开 OriginOS，看到第一个问题。
2. 小王回答三个问题。
3. 系统验证答案。
4. 小王点击"完成访谈"。
5. 系统生成项目数据和本体模型。
6. 系统保存本体、创建项目。
7. 前端展示本体图谱。

要求：
- 每个箭头标注调用的函数/方法名。
- 每个节点标注输入和输出的数据格式。
- 在每个节点旁边写出一个可能的失败场景。

### 练习二：找出信息丢失

请对比 `InterviewResult` 和 `CreateProjectRequest`，列出至少三处信息丢失或转换：

| 维度 | InterviewResult | CreateProjectRequest | 变化 |
| --- | --- | --- | --- |
| `mode` | `"独立经营"` | 合并到 `description` | 无法单独提取 |
| `tasks` | `"采购原料、制作咖啡"` | 合并到 `description` | 无法单独提取 |
| `concepts` | `Concept[]` | 未使用 | 完全丢失 |
| `ontology` | `OntologyModel` | 未使用 | 完全丢失（但单独处理） |
| `answers` | `InterviewAnswer[]` | 未使用 | 完全丢失 |

### 练习三：设计改进方案

假设你要改进访谈流程，你会优先改进哪一点？请说明理由。

参考答案（不唯一）：

1. **增加事务机制**
   - 理由：避免"孤儿本体"，保证数据一致性。
   - 方案：在 `handleInterviewCompletion` 中增加补偿机制，项目创建失败时删除已保存的本体。

2. **完善 `validateInterviewResult`**
   - 理由：当前只检查 `projectName` 和 `domain`，`mode` 和 `tasks` 可以为空。
   - 方案：增加对 `mode` 和 `tasks` 的验证。

3. **增加访谈进度保存**
   - 理由：用户中断后需要重新回答，体验差。
   - 方案：前端将进度保存到 localStorage，或后端增加访谈会话管理。

## 9. 口头验收

完成本单元后，应能不看书稿回答：

1. 从"小王看到第一个问题"到"项目创建成功"，中间经历了哪几个主要阶段？每个阶段由哪个模块负责？
2. `InterviewResult` 的哪些字段被使用了？哪些被丢弃了？
3. `InterviewCompletionHandler` 有哪些设计缺陷？怎么改进？
4. `lib/features/interview` 和 `lib/integrations/pi-agent/project-agent` 有什么区别？
5. 如果要给访谈流程补测试，你会优先补哪一块？为什么？

## 10. 章节收束

本单元（G11—G18）围绕"小王回答访谈问题"这一业务场景，拆解了 OriginOS 的访谈流程。

我们学到的核心认知：

- **访谈流程是结构化的**：`INTERVIEW_QUESTIONS` 定义了固定问题，步骤导航和答案验证都是纯函数。
- **访谈完成是自动化的**：`InterviewCompletionHandler` 把答案转换成项目数据和本体模型。
- **数据转换有信息丢失**：`mode` 和 `tasks` 被合并到 `description`，`concepts` 和 `answers` 被丢弃。
- **项目类型推断是启发式的**：基于关键词子串匹配，默认 `generic`。
- **本体模型是树形的**：包含"领域"和"任务"两个根节点，任务按逗号等分隔符拆分。
- **适配器忽略了实例层**：`instances` 数据在转换过程中丢失。
- **失败处理是粗粒度的**：一个大 `try/catch` 捕获所有错误，无法区分错误类型，无法避免孤儿数据。
- **两套访谈系统是互补的**：结构化访谈负责初始化，Agent 访谈负责深度理解。
- **测试覆盖薄弱**：访谈流程的所有模块都没有单元测试。

下一单元（G19—G26）我们将进入**本体构建系统**，看看系统如何从小王的访谈结果构建出完整的本体图谱。

---

**本单元到此结束。**
