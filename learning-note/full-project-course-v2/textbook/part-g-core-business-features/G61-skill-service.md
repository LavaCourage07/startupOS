# G61：SkillService——技能是怎么被加载和执行的

> 本课核心问题：`SkillService` 是怎么加载技能、创建会话、执行技能的？

## 1. 开篇场景：小王想创建一个任务

小王在 OriginOS 中输入："帮我创建一个任务：完成项目文档"。

系统需要：
1. 识别这是一个任务管理技能请求。
2. 加载任务管理技能。
3. 创建技能执行会话。
4. 执行技能，创建任务。

## 2. 两种设计策略

### 2.1 简单函数调用

```ts
function createTask(title: string) {
  // 直接创建任务
}
```

缺点：无法扩展，每个技能都需要单独处理。

### 2.2 统一的 SkillService

```ts
class SkillService {
  async startSkillExecution(request: StartSkillExecutionRequest): Promise<SkillExecutionResult> {
    // 1. 加载技能
    // 2. 创建会话
    // 3. 执行技能
  }
}
```

OriginOS 选择了**统一的 SkillService**。

## 3. 源码精读：`service.ts`

打开 [packages/core/src/lib/features/skills/service.ts](../../../../packages/core/src/lib/features/skills/service.ts)。

### 3.1 SkillService 类定义

```ts
export class SkillService {
  private skillRegistry: SkillRegistry;
  private skillRouter: SkillRouter;
  private skillExecutor: SkillExecutor;
  private agentManager: AgentManager;
  private sessionStore: SessionStore;

  constructor(deps: SkillServiceDeps) {
    this.skillRegistry = deps.skillRegistry;
    this.skillRouter = deps.skillRouter;
    this.skillExecutor = deps.skillExecutor;
    this.agentManager = deps.agentManager;
    this.sessionStore = deps.sessionStore;
  }
}
```

对应源码位置：[packages/core/src/lib/features/skills/service.ts 第 1—50 行](../../../../packages/core/src/lib/features/skills/service.ts#L1-L50)。

### 3.2 加载技能列表

```ts
async listSkills(request: ListSkillsRequest): Promise<ListSkillsResult> {
  const skills = await this.skillRegistry.list();
  
  // Filter by scope if provided
  let filtered = skills;
  if (request.scope) {
    filtered = skills.filter(skill => skill.metadata.scope === request.scope);
  }
  
  // Filter by tags if provided
  if (request.tags && request.tags.length > 0) {
    filtered = filtered.filter(skill => 
      request.tags!.some(tag => skill.metadata.tags?.includes(tag))
    );
  }
  
  return {
    skills: filtered.map(skill => ({
      name: skill.metadata.name,
      description: skill.metadata.description,
      scope: skill.metadata.scope,
      tags: skill.metadata.tags,
      version: skill.metadata.version,
    })),
    total: filtered.length,
  };
}
```

对应源码位置：[packages/core/src/lib/features/skills/service.ts 第 51—120 行](../../../../packages/core/src/lib/features/skills/service.ts#L51-L120)。

### 3.3 开始技能执行

```ts
async startSkillExecution(request: StartSkillExecutionRequest): Promise<SkillExecutionResult> {
  // 1. 查找技能
  const skill = await this.skillRegistry.get(request.skillName);
  if (!skill) {
    return {
      success: false,
      error: {
        code: 'SKILL_NOT_FOUND',
        message: `找不到技能: ${request.skillName}`,
      },
    };
  }

  // 2. 创建会话
  const session = await this.sessionStore.create({
    skillName: request.skillName,
    userId: request.userId,
    context: request.context,
  });

  // 3. 加载技能处理器
  const handler = await this.loadSkillHandler(skill);

  // 4. 执行技能
  const result = await this.skillExecutor.execute({
    skill,
    handler,
    session,
    input: request.input,
  });

  return {
    success: true,
    sessionId: session.id,
    result,
  };
}
```

对应源码位置：[packages/core/src/lib/features/skills/service.ts 第 121—250 行](../../../../packages/core/src/lib/features/skills/service.ts#L121-L250)。

## 4. 图解：SkillService 架构

```
┌─────────────────────────────────────┐
│           SkillService              │
├─────────────────────────────────────┤
│  ┌─────────────  ┌─────────────┐  │
│  │ SkillRegistry│  │ SkillRouter │  │
│  └─────────────┘  └─────────────┘  │
│  ┌─────────────  ┌─────────────┐  │
│  │SkillExecutor│  │ AgentManager│  │
│  └─────────────┘  └─────────────┘  │
│  ┌─────────────┐                   │
│  │ SessionStore│                   │
│  └─────────────┘                   │
└─────────────────────────────────────┘
```

## 5. 设计亮点

### 5.1 依赖注入

```ts
interface SkillServiceDeps {
  skillRegistry: SkillRegistry;
  skillRouter: SkillRouter;
  skillExecutor: SkillExecutor;
  agentManager: AgentManager;
  sessionStore: SessionStore;
}
```

### 5.2 错误处理

```ts
if (!skill) {
  return {
    success: false,
    error: {
      code: 'SKILL_NOT_FOUND',
      message: `找不到技能: ${request.skillName}`,
    },
  };
}
```

## 6. 测试证据与缺口

### 已覆盖

- `SkillService` 没有直接测试。

### 缺口

- `listSkills` 没有测试。
- `startSkillExecution` 没有测试。
- 错误处理没有测试。

## 7. 小实验：列出技能

```ts
import { SkillService } from '@originos/core/lib/features/skills';

const service = new SkillService({
  skillRegistry: new DefaultSkillRegistry(),
  skillRouter: new DefaultSkillRouter(),
  skillExecutor: new SkillExecutor(),
  agentManager: new AgentManager(),
  sessionStore: new SessionStore(),
});

const result = await service.listSkills({ scope: 'bundled' });
console.log(result.skills);
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `SkillService` 依赖哪些组件？
2. `listSkills` 支持哪些过滤条件？
3. `startSkillExecution` 的流程是什么？
4. 如果技能找不到，返回什么错误？

## 9. 章节收束

本课的核心认知是 **`SkillService` 通过依赖注入组合了 SkillRegistry、SkillRouter、SkillExecutor、AgentManager 和 SessionStore，提供统一的技能加载和执行入口**。

我们看到的几个关键设计：

- **依赖注入**：通过构造函数注入依赖。
- **统一入口**：`listSkills` 和 `startSkillExecution` 提供统一 API。
- **错误处理**：返回结构化的错误信息。
- **无测试**：没有直接测试覆盖。

下一课（G62）我们会深入 `SkillService` 的执行流程，了解从加载到完成的完整过程。
