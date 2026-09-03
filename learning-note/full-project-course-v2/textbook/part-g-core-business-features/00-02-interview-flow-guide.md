# 单元导读二：小王回答咖啡馆访谈问题时，系统怎么收集信息并生成本体

> 本单元总问题：小王在 OriginOS 里回答三个访谈问题后，系统如何把答案变成项目数据、TASTE 偏好和本体？访谈流程和 Project Agent 访谈有什么区别？

## 0. 本页先读什么

如果只记住一句话，记住这一句：

> **访谈不是聊天，而是结构化信息收集。系统用固定问题模板引导用户，在答案中提取结构化数据，最终驱动项目创建和本体生成。**

## 1. 本单元在讲什么

上一单元（G01–G10）讲的是“项目怎么被创建和持久化”。但项目创建只是第一步，OriginOS 还需要理解用户要做什么，才能提供个性化的 Agent 服务。

这就是访谈（Interview）模块的职责：

- 向用户提出结构化问题（工作领域、工作模式、主要任务）。
- 收集答案并验证。
- 从答案中提取结构化信息（领域、任务、工具偏好）。
- 完成访谈后，自动创建项目、生成 TASTE 偏好、构建初始本体。

OriginOS 中有两套访谈概念，教材必须区分清楚：

| 概念 | 位置 | 用途 | 归属 |
| --- | --- | --- | --- |
| **访谈流程（Interview）** | `packages/core/src/lib/features/interview/` | 结构化问答，收集用户基本信息 | Part G（本单元） |
| **Project Agent 访谈** | `packages/core/src/lib/integrations/pi-agent/project-agent/` | 项目级深度访谈，驱动业务模型构建 | Part F |

本单元只讲前者。Project Agent 访谈会在 Part F 详细展开。

## 2. 本单元的 8 节课

| 课号 | 课题 | 核心问题 |
| --- | --- | --- |
| G11 | 访谈模块的入口与问题流 | `interview/index.ts` 导出了什么？问题列表从哪里来？ |
| G12 | 访谈完成处理器 | `InterviewCompletionHandler` 如何自动创建项目和本体？ |
| G13 | 从答案到项目数据 | `InterviewResult` 如何转换成 `CreateProjectRequest`？ |
| G14 | 访谈问题库 | `interview-questions.ts` 的问题模板与步骤映射 |
| G15 | 本体适配器 | 访谈结果如何对接 `OntologyModel`？ |
| G16 | 失败路径 | 访谈未完成、答案缺失会怎样？ |
| G17 | 与 Part F 的边界 | `lib/features/interview` 和 `lib/integrations/pi-agent/project-agent` 的区别 |
| G18 | 单元小结课 | 画出“问题 → 答案 → 项目 → 本体”的完整调用链 |

## 3. 本单元涉及的源码文件

```
packages/core/src/lib/features/interview/
├── index.ts                    # 公共 API 导出（interview-completion, interview-questions, ontology-adapter）
├── interview-completion.ts     # InterviewCompletionHandler：访谈完成后的自动处理
├── interview-questions.ts      # INTERVIEW_QUESTIONS：问题定义与验证
└── ontology-adapter.ts         # adaptOntologyForDisplay：本体结构转换

packages/core/src/lib/features/ontology/
├── interview.ts              # InterviewService：访谈会话 CRUD
├── types.ts                  # InterviewQuestion, InterviewSession 等类型
└── index.ts                  # 导出 ontology 相关能力（含 interviewService）

packages/core/src/types/interview.ts
└── InterviewResult, InterviewAnswer, InterviewStep, InterviewFlow 等类型

packages/core/src/lib/integrations/pi-agent/project-agent/
├── project-context.ts          # ProjectContext：项目上下文加载
├── project-prompt.ts           # 6 层 System Prompt 构建
├── project-skill-provisioning.ts # 项目默认技能初始化
└── collaboration-prompt.ts     # 多 Agent 协作 7 层 Prompt
```

## 4. 主线案例：小王的咖啡馆访谈

本单元沿用“小王开社区咖啡馆”案例：

1. 小王进入 OriginOS，系统提示“请先完成访谈”。
2. 第一个问题：“你的工作领域是什么？” 小王回答：“餐饮零售，社区咖啡馆。”
3. 第二个问题：“你的工作模式是什么？” 小王回答：“独立经营，雇了 2 个员工。”
4. 第三个问题：“主要任务有哪些？” 小王回答：“采购原料、制作咖啡、服务顾客、管理库存。”
5. 系统根据答案自动创建“社区咖啡馆”项目，生成 TASTE 偏好，构建包含“商品、供应商、客户、订单”等概念的初始本体。

## 5. 关键概念速览

### 5.1 访谈问题（InterviewQuestion）

```ts
interface InterviewQuestion {
  id: string;           // 问题唯一标识
  question: string;     // 问题文本
  placeholder: string; // 占位符
  hint: string;         // 详细提示
  hintShort: string;    // 简短提示
  minLength?: number;   // 最小字符数
  errorMessage?: string; // 错误提示
}
```

### 5.2 访谈结果（InterviewResult）

```ts
interface InterviewResult {
  projectName: string;
  domain: string;
  mode: string;
  tasks: string;
  concepts?: Concept[];
  ontology?: OntologyModel;
  answers?: InterviewAnswer[];
}
```

### 5.3 访谈完成处理（InterviewCompletionHandler）

单例类，负责：
- `generateProjectData`：从访谈结果生成 `CreateProjectRequest`。
- `generateOntologyModel`：从访谈结果生成初始 `OntologyModel`。
- `createProject`：调用项目创建 API。
- `saveOntology`：调用本体保存 API。

### 5.4 与 Project Agent 访谈的区别

| 维度 | `lib/features/interview` | `lib/integrations/pi-agent/project-agent` |
| --- | --- | --- |
| 目的 | 收集用户基本信息，初始化项目 | 深度访谈，构建完整业务模型 |
| 问题数量 | 3 个固定问题 | 动态，可多轮 |
| 输出 | 项目 + TASTE + 初始本体 | 完整业务模型（实体、关系、规则） |
| 触发时机 | 用户首次使用 | 项目创建后，Agent 会话中 |
| 技术实现 | 结构化表单 | LLM 驱动的对话式访谈 |

## 6. 与前后单元的衔接

**上游（单元一 G01–G10）：**
- 项目创建服务提供了项目的物理存在。
- 访谈流程为项目填充了语义内容。

**下游（单元三 G19–G26）：**
- 访谈生成的本体是 `ontology/` feature 的输入。
- `ontology-builder.ts` 会进一步精炼和扩展本体。

**平行（Part F）：**
- `lib/features/interview` 是面向用户的结构化访谈。
- `lib/integrations/pi-agent/project-agent` 是 Agent 驱动的深度访谈。
- 两者互补，不重复。

## 7. 阅读建议

按以下顺序阅读本单元：

1. 先读 G11，理解访谈模块的入口和问题流。
2. 读 G12，理解访谈完成后的自动处理。
3. 读 G13，理解答案如何转换成项目数据。
4. 读 G14，理解问题库的设计。
5. 读 G15，理解本体适配器。
6. 读 G16，理解失败路径。
7. 读 G17，明确与 Part F 的边界。
8. 最后做 G18 工作坊，画出完整调用链。

---

**准备好后，从 G11 开始。**
