# 单元导读一：从用户入口到 Agent 会话（N01—N02）

小林已经学完了 Part A~M 的所有课程。现在他打开 OriginOS 首页，看到"旅行助手"卡片，点击后弹出了 SkillDialog。他想理解：从手指点击到 Agent 会话准备就绪，系统内部发生了哪些步骤？数据和控制权如何流动？

## 本单元总问题

> 用户点击首页 Skill 卡片后，系统内部发生了哪些步骤？数据和控制权如何流动？

这个问题看似简单，但涉及 Web UI、配置、路由、状态、Core Service 和 Agent Runtime 多个边界。本单元要帮读者建立一条**可复述、可排查**的完整链路。

## 本页先读什么

如果只记住一句话：

> 首页点击不是一个简单跳转，而是经过"配置→渲染→事件→路由→服务→会话"六层边界的完整链路。

阅读本页可以按下面的顺序：

| 阅读阶段 | 重点问题 | 对应章节 |
|---------|---------|---------|
| 建立总图 | 从点击到会话，中间经过哪些对象？ | 第 1、2 节 |
| 分清边界 | 哪些概念最容易混淆？ | 第 3 节 |
| 对回课程 | 两节课分别补上链路中的哪一段？ | 第 4 节 |
| 查证源码 | 哪些源码在本单元复用，哪些留到后面？ | 第 5 节 |
| 练习排查 | 入口链路异常时，应按什么顺序判断？ | 第 6—7 节 |

## 1. 同一声点击会落在不同层

小林点击"旅行助手"时，系统里同时发生了很多事情。初学者最容易犯的错误，是把这些事情都理解成"点击了一下"。

更准确的说法是：同一声点击会经过不同层，每一层能证明的事情都不同。

| 看到的现象 | 所在层 | 它能证明什么 | 它不能证明什么 |
|-----------|--------|-------------|---------------|
| 首页出现"旅行助手"卡片 | 配置层 | `HOME_APPS` 配置已加载 | 卡片点击后一定有响应 |
| 点击卡片后弹出窗口 | UI 渲染层 | `SkillDialog` 已渲染 | 会话已创建或 Agent 已启动 |
| 请求体带有 `skillName` | 请求层 | 前端知道要加载哪个 Skill | 后端一定能找到该 Skill |
| 返回 `sessionId` | 服务层 | 会话已创建 | Agent 已准备好接收消息 |
| `SkillDialog` 显示技能内容 | 内容层 | `SKILL.md` 已加载 | Prompt 已构建或模型已配置 |

这张表的关键是"能证明什么"和"不能证明什么"的分界。排查入口问题时，从一个现象推出它无法证明的结论，是最常见的误判。

## 2. 入口链路的主路径

下面这张图只回答一个问题：从小林点击"旅行助手"到 Agent 会话准备就绪，中间经过哪些对象？

```mermaid
flowchart TD
    A[用户点击首页卡片] --> B[AppCard onClick]
    B --> C{app.type}
    C -->|skill| D[handleSkillLaunch]
    C -->|action| E[page action handler]
    D --> F[SkillDialog 打开]
    F --> G[GET /api/skills/{name}/content]
    G --> H[SkillLoader 读取 SKILL.md]
    H --> I[buildSkillSystemPrompt]
    I --> J[POST /api/agent/sessions]
    J --> K[SessionService.createSession]
    K --> L[AgentManager.registerAgent]
    L --> M[OriginOSAgent 初始化]
    M --> N[会话准备就绪]
```

可以把它分成三段读。

**第一段是入口**：用户点击发生在 `AppCard` 组件中。`AppCard` 根据 `app.type` 分流：`skill` 类型调用 `handleSkillLaunch`，`action` 类型调用页面动作处理器。这是 UI 层的职责分界。

**第二段是 Skill 加载**：`SkillDialog` 打开后，前端通过 API 获取 Skill 内容，构建系统 Prompt。这一步决定了 Agent 知道什么、能做什么、工作目录在哪里。

**第三段是会话创建**：`POST /api/agent/sessions` 创建会话，`SessionService` 保存会话数据，`AgentManager` 注册 Agent 实例，`OriginOSAgent` 初始化运行时。会话创建成功不代表 Agent 已经开始工作，只代表运行时环境已准备就绪。

## 3. 三组最容易混淆的对象

### 3.1 配置、渲染、事件

| 对象 | 负责什么 | 典型字段 | 常见误解 |
|------|---------|---------|---------|
| `HomeAppConfig` | 声明卡片存在 | `id`, `name`, `type`, `skillName` | 配置存在等于功能可用 |
| `AppCard` | 渲染卡片并处理点击 | `onClick`, `path` | 卡片渲染等于后端已就绪 |
| `handleSkillLaunch` | 启动 Skill 会话 | `skillName`, `projectId` | 启动成功等于 Agent 已工作 |

### 3.2 Skill 源目录、工作目录、产物目录

| 目录 | 用途 | 是否只读 | 常见误解 |
|------|------|---------|---------|
| `CLAUDE_SKILL_DIR` | Skill 定义和参考文件 | 是 | 可以写入产物 |
| `agentBaseDir` | Agent 工作目录 | 否 | 与源目录相同 |
| `outputDir` | 产物输出目录 | 否 | 自动创建 |

### 3.3 会话、窗口、运行时

| 对象 | 负责什么 | 典型字段 | 常见误解 |
|------|---------|---------|---------|
| 窗口 (`windowId`) | 当前显示容器 | `windowId`, `zIndex` | 关闭窗口等于删除会话 |
| 会话 (`sessionId`) | 连续消息历史 | `sessionId`, `currentSessionId` | 会话存在等于 Agent 在运行 |
| 运行时 | 当前进程中的 Agent 实例 | `OriginOSAgent` 状态 | 运行时存在等于历史已保存 |

## 4. 两节课连成一条因果链

| 课次 | 本课解决的判断问题 | 复用的 Part | 学完后的判断能力 |
|------|-------------------|------------|----------------|
| N01 | 从首页点击到 SkillDialog 准备好会话，中间经过哪些步骤 | B, J, E | 能追踪"配置→渲染→事件→路由→服务→会话"的完整链路 |
| N02 | 入口链路的各个边界如何排查 | A~E | 能按证据顺序定位入口链路故障，不跳过层级 |

## 5. 复用源码覆盖台账

| 课次 | 复用的生产源码（前序 Part 已精读） | 配对测试 | 本单元只证明什么 |
|------|----------------------------------|---------|---------------|
| N01 | `homeApps.ts` (J), `AppCard.tsx` (J), `page.tsx` (I), `SkillDialog.tsx` (J), `skill.ts` (E), `session-service.ts` (E) | Dock store 测试、Skill export policy 测试 | 入口链路的数据流和边界，不证明 Agent 运行时行为 |
| N02 | 同上 + `appWindowStore.ts` (J), `AppWindowManager.ts` (J) | 窗口管理测试 | 入口链路的故障排查顺序，不证明跨链路一致性 |

本单元相邻但尚未复用的文件：`client-hooks.ts`（会话隔离，Part E 已讲）、`server-config.ts`（服务端配置，Part I 已讲）。它们属于会话运行时和 API 边界，在后续单元中复用。

## 6. 异常排查：入口链路

当小林说"点击旅行助手没反应"时，最稳的排查方式不是直接看 Agent 日志，而是沿着入口链路逐步确认。

```mermaid
flowchart TD
    A[点击无反应] --> B{卡片是否渲染}
    B -->|否| C[检查 HOME_APPS 配置]
    B -->|是| D{点击事件是否触发}
    D -->|否| E[检查 AppCard onClick]
    D -->|是| F{SkillDialog 是否打开}
    F -->|否| G[检查 handleSkillLaunch]
    F -->|是| H{Skill 内容是否加载}
    H -->|否| I[检查 API /skills/{name}/content]
    H -->|是| J{会话是否创建}
    J -->|否| K[检查 POST /api/agent/sessions]
    J -->|是| L[再检查 Agent 运行时和模型]
```

排查口诀：

1. 卡片没出现 → 先看 `HOME_APPS` 配置
2. 点击没反应 → 先看 `AppCard` 事件绑定
3. 窗口没打开 → 先看 `handleSkillLaunch`
4. 内容没加载 → 先看 Skill API 和 `SKILL.md`
5. 会话没创建 → 先看 `session-service`
6. 前面都成立 → 再看 Agent 运行时和模型

## 7. 口头验收

学完 N01—N02 后，不看正文也应能回答下面五个问题：

1. 从 `HOME_APPS` 配置到 `OriginOSAgent` 初始化，中间经过哪些边界？
2. 为什么 `skillName` 和 `id` 不能混用？
3. `CLAUDE_SKILL_DIR`、`agentBaseDir`、`outputDir` 三者的区别是什么？
4. 如果点击卡片后窗口没打开，应该按什么顺序排查？
5. 如果 `SkillDialog` 打开了但内容为空，可能的原因有哪些？

## 8. 进入下一单元

N01—N02 建立的是入口链路的基本地图。下一组课程会继续追踪：会话创建后，消息如何发送，Agent 如何处理，流式事件如何回到 UI。

本单元的结论可以压缩成一句话：

> 入口链路不是"点击→响应"，而是"配置→渲染→事件→路由→服务→会话"六层边界。排查时先确认层级，再判断责任。
