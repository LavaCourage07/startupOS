# N01：从首页点击到 SkillDialog 会话准备

## 开篇场景

小林打开 OriginOS，首页上有一排卡片："旅行助手"、"任务管理"、"项目访谈"……他点击了"旅行助手"。几秒钟后，一个对话框弹出，里面显示着旅行助手的说明、参考文件列表，底部有一个输入框。

从用户视角看，这只是"点击→弹出"。但从系统视角看，这次点击触发了一条跨越六层边界的完整链路。本课要追踪的就是这条链路。

## 核心问题

> 从用户点击首页卡片到 SkillDialog 准备好 Agent 会话，中间经过哪些步骤？数据和控制权如何在各层之间传递？

## 1. 直觉与概念阶梯

### 1.1 直觉：点击卡片就像打开一个 App

在手机上点击 App 图标，系统会加载应用、显示界面。OriginOS 的卡片点击类似，但多了一个关键区别：**卡片本身不运行任何业务逻辑，它只是一个配置驱动的入口**。

### 1.2 术语：配置、渲染、事件、路由、服务、会话

| 层级 | 对象 | 职责 | 关键文件 |
|------|------|------|---------|
| 配置 | `HOME_APPS` | 声明卡片存在和属性 | `packages/web/src/config/homeApps.ts` |
| 渲染 | `AppCard` | 根据配置渲染卡片 | `packages/web/src/components/framework/AppCard.tsx` |
| 事件 | `onClick` | 处理点击，分流到不同处理器 | `packages/web/src/app/page.tsx` |
| 路由 | `handleSkillLaunch` | 启动 Skill，打开窗口 | `packages/web/src/components/skills/SkillDialog.tsx` |
| 服务 | `SessionService` | 创建和管理会话 | `packages/core/src/lib/features/agent/session-service.ts` |
| 会话 | `OriginOSAgent` | 初始化 Agent 运行时 | `packages/core/src/lib/integrations/pi-agent/core/agent.ts` |

### 1.3 边界：每一层只负责自己的事情

- **配置层**只声明"这里应该有一个卡片"，不保证卡片点击后一定有响应
- **渲染层**只负责把配置变成可见的 UI，不处理业务逻辑
- **事件层**只负责把用户动作翻译成系统指令，不直接操作数据
- **路由层**只负责把指令转发给正确的服务，不处理服务内部细节
- **服务层**只负责业务逻辑和数据持久化，不关心 UI 状态
- **会话层**只负责 Agent 运行时，不直接响应用户输入

## 2. 图解：入口链路主路径

```mermaid
flowchart TD
    subgraph UI["UI 层"]
        A[用户点击卡片] --> B[AppCard onClick]
        B --> C{app.type}
        C -->|skill| D[handleSkillLaunch]
        C -->|action| E[page action handler]
    end

    subgraph Skill["Skill 层"]
        D --> F[SkillDialog 打开]
        F --> G[GET /api/skills/{name}/content]
        G --> H[SkillLoader]
        H --> I[buildSkillSystemPrompt]
    end

    subgraph Session["会话层"]
        I --> J[POST /api/agent/sessions]
        J --> K[SessionService.createSession]
        K --> L[AgentManager.registerAgent]
        L --> M[OriginOSAgent 初始化]
    end

    M --> N[会话准备就绪]
```

这张图可以分成三段读：

**第一段（UI 层）**：用户点击 `AppCard`，`onClick` 根据 `app.type` 分流。`skill` 类型走 `handleSkillLaunch`，`action` 类型走页面动作处理器。这一步的关键是**分流逻辑**——`type` 字段决定了后续路径完全不同。

**第二段（Skill 层）**：`SkillDialog` 打开后，前端通过 API 获取 Skill 内容，构建系统 Prompt。这一步的关键是**内容加载**——`SKILL.md` 的内容决定了 Agent 知道什么、能做什么。

**第三段（会话层）**：`POST /api/agent/sessions` 创建会话，`SessionService` 保存会话数据，`AgentManager` 注册 Agent 实例，`OriginOSAgent` 初始化运行时。这一步的关键是**环境准备**——会话创建成功不代表 Agent 已经开始工作，只代表运行时环境已准备就绪。

## 3. 源码精读

### 3.1 配置层：HOME_APPS

[packages/web/src/config/homeApps.ts 第 1—30 行](../../../../packages/web/src/config/homeApps.ts#L1)

```typescript
// 简化示意
export const HOME_APPS: HomeAppConfig[] = [
  {
    id: 'travel-assistant',
    name: '旅行助手',
    description: '帮你规划旅行行程',
    icon: 'Plane',
    color: 'blue',
    type: 'skill',
    skillName: 'travel-assistant',
  },
  // ...
];
```

**输入**：一个配置数组，每个元素描述一个卡片的属性。
**状态**：配置是静态的，运行时不会变化。
**分支**：`type` 字段决定分流——`skill` 或 `action`。
**输出**：`HomeAppConfig[]` 数组，被 `page.tsx` 消费。

**关键字段**：
- `id`：卡片的唯一标识，用于 Dock 去重和恢复
- `name`：展示名称，可以修改
- `type`：分流类型，`skill` 或 `action`
- `skillName`：`skill` 类型时的实际技能标识，**不能**用 `name` 替代

**常见误解**：`name` 是展示文本，`skillName` 是技能标识。如果把展示 `name` 当成 `skillName`，会导致 Skill 加载失败。

### 3.2 渲染层：AppCard

[packages/web/src/components/framework/AppCard.tsx 第 1—100 行](../../../../packages/web/src/components/framework/AppCard.tsx#L1)

```typescript
// 简化示意
export function AppCard({ app, onClick }: AppCardProps) {
  return (
    <div onClick={() => onClick(app)}>
      <Icon name={app.icon} />
      <span>{app.name}</span>
    </div>
  );
}
```

**输入**：`HomeAppConfig` 对象和 `onClick` 回调。
**状态**：组件无内部状态，纯展示。
**分支**：无分支，只负责渲染。
**输出**：渲染后的卡片 UI。

**关键设计**：`AppCard` 是**纯展示组件**，不处理任何业务逻辑。点击事件通过 `onClick` 回调交给父组件处理。这种设计让 `AppCard` 可以被复用，也便于测试。

### 3.3 事件层：page.tsx 分流

[packages/web/src/app/page.tsx 第 1400—1450 行](../../../../packages/web/src/app/page.tsx#L1400)

```typescript
// 简化示意
function handleAppClick(app: HomeAppConfig) {
  if (app.type === 'skill') {
    handleSkillLaunch(app.skillName!, app.name);
  } else if (app.type === 'action') {
    handleAction(app.action!);
  }
}
```

**输入**：`HomeAppConfig` 对象。
**状态**：无持久状态，只处理单次点击。
**分支**：根据 `type` 字段分流到 `handleSkillLaunch` 或 `handleAction`。
**输出**：调用对应的处理器。

**关键设计**：分流逻辑显式、可预测。`skill` 类型必须有 `skillName`，`action` 类型必须有 `action`。如果配置缺失，会在运行时报错。

### 3.4 路由层：handleSkillLaunch

[packages/web/src/components/skills/SkillDialog.tsx 第 1—200 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L1)

```typescript
// 简化示意
async function handleSkillLaunch(skillName: string, displayName: string) {
  // 1. 打开 SkillDialog
  openDialog(skillName, displayName);

  // 2. 加载 Skill 内容
  const content = await fetchSkillContent(skillName);

  // 3. 构建系统 Prompt
  const systemPrompt = buildSkillSystemPrompt(content);

  // 4. 创建会话
  const session = await createSession({
    skillName,
    systemPrompt,
    // ...
  });

  return session;
}
```

**输入**：`skillName`（技能标识）和 `displayName`（展示名称）。
**状态**：`SkillDialog` 的打开状态、加载状态、内容状态。
**分支**：加载成功/失败、创建成功/失败。
**输出**：会话对象或错误。

**关键设计**：`handleSkillLaunch` 是**编排函数**，负责协调多个步骤：打开对话框、加载内容、构建 Prompt、创建会话。每个步骤都有独立的错误处理。

### 3.5 服务层：SessionService

[packages/core/src/lib/features/agent/session-service.ts 第 1—100 行](../../../../packages/core/src/lib/features/agent/session-service.ts#L1)

```typescript
// 简化示意
export class SessionService {
  async createSession(config: SessionConfig): Promise<AgentSession> {
    // 1. 生成 sessionId
    const sessionId = generateId();

    // 2. 创建会话数据
    const session: AgentSession = {
      id: sessionId,
      // ...
    };

    // 3. 保存到存储
    await this.store.save(session);

    return session;
  }
}
```

**输入**：`SessionConfig` 对象，包含 `skillName`、`systemPrompt` 等。
**状态**：会话数据持久化到存储。
**分支**：生成 ID、创建数据、保存存储，每一步都可能失败。
**输出**：`AgentSession` 对象。

**关键设计**：`SessionService` 是**业务逻辑层**，负责会话的生命周期管理。它不直接操作 UI，也不直接调用模型 API，而是通过 `AgentManager` 委托给 Agent 运行时。

### 3.6 会话层：OriginOSAgent

[packages/core/src/lib/integrations/pi-agent/core/agent.ts 第 1—100 行](../../../../packages/core/src/lib/integrations/pi-agent/core/agent.ts#L1)

```typescript
// 简化示意
export class OriginOSAgent {
  constructor(config: AgentConfig) {
    // 1. 初始化模型配置
    this.llmConfig = config.llmConfig;

    // 2. 初始化工具集
    this.tools = config.tools;

    // 3. 初始化历史
    this.history = [];

    // 4. 初始化状态
    this.status = 'idle';
  }
}
```

**输入**：`AgentConfig` 对象，包含 `llmConfig`、`tools`、`systemPrompt` 等。
**状态**：Agent 的运行时状态（idle、thinking、error 等）。
**分支**：初始化成功/失败。
**输出**：Agent 实例。

**关键设计**：`OriginOSAgent` 是**运行时层**，负责 Agent 的实际工作。初始化时只准备环境，不立即开始工作。真正的消息处理在后续调用 `sendMessage` 时触发。

## 4. 调用链和数据流

### 4.1 正向追踪

```text
用户点击
  → AppCard.onClick(app)
    → page.tsx handleAppClick(app)
      → handleSkillLaunch(skillName, displayName)
        → SkillDialog.open(skillName, displayName)
          → fetchSkillContent(skillName)
            → GET /api/skills/{name}/content
              → SkillLoader.read(skillName)
                → buildSkillSystemPrompt(content)
          → createSession({ skillName, systemPrompt })
            → POST /api/agent/sessions
              → SessionService.createSession(config)
                → AgentManager.registerAgent(session)
                  → OriginOSAgent.initialize(config)
```

### 4.2 数据变化

| 步骤 | 数据变化 |
|------|---------|
| 用户点击 | 无数据变化，只有用户事件 |
| AppCard.onClick | 传递 `HomeAppConfig` 对象 |
| handleSkillLaunch | 接收 `skillName` 和 `displayName` |
| fetchSkillContent | 返回 `SkillContent` 对象 |
| buildSkillSystemPrompt | 返回 `systemPrompt` 字符串 |
| createSession | 返回 `AgentSession` 对象，含 `sessionId` |
| AgentManager.registerAgent | 注册 Agent 实例，返回 `agentId` |
| OriginOSAgent.initialize | 初始化运行时状态 |

## 5. 失败路径与边界

### 5.1 配置缺失

**场景**：`HOME_APPS` 中配置了 `type: 'skill'` 但没有 `skillName`。

**后果**：`handleSkillLaunch` 调用时 `skillName` 为 `undefined`，导致 `fetchSkillContent` 请求失败。

**排查**：检查 `homeApps.ts` 中对应项的 `skillName` 字段。

### 5.2 Skill 内容加载失败

**场景**：`skillName` 对应的 `SKILL.md` 文件不存在或格式错误。

**后果**：`fetchSkillContent` 返回 404 或解析错误，`SkillDialog` 显示内容为空或错误提示。

**排查**：检查 `templates/skills/{skillName}/SKILL.md` 是否存在，格式是否正确。

### 5.3 会话创建失败

**场景**：`SessionService.createSession` 时存储层失败（磁盘满、权限不足等）。

**后果**：`createSession` 抛出错误，`SkillDialog` 显示创建失败。

**排查**：检查存储层日志，确认磁盘空间和权限。

### 5.4 Agent 初始化失败

**场景**：`OriginOSAgent` 初始化时模型配置错误（API Key 缺失、模型不可用等）。

**后果**：Agent 实例创建失败，但会话已创建。用户发送消息时会报错。

**排查**：检查模型配置，确认 API Key 和模型可用性。

## 6. 测试证据

### 6.1 已有测试

| 测试文件 | 测试内容 | 证明什么 | 未证明什么 |
|---------|---------|---------|-----------|
| `packages/web/src/store/__tests__/dockStore.test.ts` | Dock 去重和恢复 | 卡片 ID 稳定性 | 卡片点击后的完整链路 |
| `packages/web/src/components/skills/__tests__/skill-export-policy.test.ts` | Skill 导出策略 | Skill 内容加载 | Skill 内容解析和 Prompt 构建 |
| `packages/core/src/lib/features/skills/__tests__/service.test.ts` | Skill 服务 | Skill 查找和加载 | Skill 内容到 Prompt 的转换 |
| `packages/core/src/lib/features/services/launcher/__tests__/skill-launcher.test.ts` | Skill Launcher | Launcher 路径解析 | 端到端会话创建 |

### 6.2 测试缺口

- 首页点击到 SkillDialog 打开的端到端测试
- Skill 内容加载失败时的错误处理测试
- 会话创建失败时的 UI 状态测试
- Agent 初始化失败时的回退策略测试

## 7. 小实验

### 实验 1：追踪一次点击

1. 打开浏览器开发者工具，Network 面板
2. 点击首页"旅行助手"卡片
3. 观察请求顺序：`/api/skills/travel-assistant/content` → `/api/agent/sessions`
4. 记录每个请求的 Request 和 Response

### 实验 2：模拟配置错误

1. 在 `homeApps.ts` 中，把某个 `skill` 类型的 `skillName` 改成不存在的值
2. 刷新页面，点击该卡片
3. 观察错误信息，定位到 `fetchSkillContent`
4. 恢复配置，验证正常

### 实验 3：断点调试

1. 在 `page.tsx` 的 `handleAppClick` 处设置断点
2. 在 `SkillDialog.tsx` 的 `handleSkillLaunch` 处设置断点
3. 在 `session-service.ts` 的 `createSession` 处设置断点
4. 点击卡片，逐步执行，观察数据变化

## 8. 口头验收

学完本课后，不看正文也应能回答下面五个问题：

1. 从用户点击到 Agent 初始化，中间经过哪些层？每层的关键对象是什么？
2. 为什么 `id`、`name`、`skillName` 不能混用？
3. `handleSkillLaunch` 是编排函数还是业务函数？它协调了哪些步骤？
4. 如果点击卡片后窗口没打开，应该检查哪些文件？
5. 如果 `SkillDialog` 打开了但内容为空，可能的原因有哪些？

## 9. 章节收束

本课追踪了从首页点击到 Agent 会话准备的完整链路。关键结论是：**入口链路不是"点击→响应"，而是跨越六层边界的完整过程**。每一层只负责自己的事情，层与层之间通过明确的接口和数据合同传递控制权。

下一课（N02）会做单元小结，把这条链路的知识组织成**可复用的排查框架**，并建立入口链路的故障诊断能力。
