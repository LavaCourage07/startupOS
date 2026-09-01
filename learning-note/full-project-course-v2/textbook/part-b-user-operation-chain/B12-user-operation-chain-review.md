# B12：Part B 复盘：完整链路认知地图与故障排查

## 一个连续案例的完整变化

从 B01 到 B11，我们追踪了一次真实用户动作：在首页点击「头脑风暴」卡片。这个案例经历了以下变化：

1. 首页配置把入口描述为 `type: 'skill'`、`skillName: 'bmad-brainstorming'`。
2. `AppCard` 触发点击，把控制权交给 `HomePage`。
3. `HomePage` 调用 `handleSkillLaunch`，生成窗口 id 和元数据。
4. `AppWindowManager` 创建窗口，并在关闭时注入 Agent 销毁和记忆整理回调。
5. `SkillDialog` 加载技能内容、构建系统提示词、生成稳定 session id。
6. `usePiAgent.initialize` 跨越 HTTP/IPC 边界创建会话。
7. `agentSessionService` 把会话保存到磁盘 JSON。
8. 用户发送消息时，API route 校验所有权、恢复运行时、追加消息。
9. 模型回复通过 SSE/IPC 事件流返回，经过去重和调度渲染到窗口。
10. Agent 调用工具时，产物写入 `outputDir`，会话历史继续保存。
11. 关闭窗口时，运行时实例被清理，记忆被整理，但会话 JSON 仍保留。

这条链路不是一次性读完的，而是每一章只解决一个边界问题。本章把它们重新组织成一张地图。

## 总体认知图

```mermaid
flowchart TB
    Home[首页 HOME_APPS] --> Card[AppCard 触发 onClick]
    Card --> Page[HomePage handleSkillLaunch]
    Page --> WM[AppWindowManager 创建窗口]
    WM --> Dialog[SkillDialog 准备材料]
    Dialog --> Load[loadSkillContent]
    Dialog --> Prompt[buildSkillSystemPrompt]
    Dialog --> Init[usePiAgent.initialize]
    Init --> API1[/api/agent/sessions]
    API1 --> Service[agentSessionService 持久化]
    Service --> Disk1[会话 JSON]
    Dialog --> User[用户发送消息]
    User --> API2[/api/agent/sessions/{id}/messages]
    API2 --> Restore[AgentManager 恢复运行时]
    API2 --> AddMsg[agentSessionService.addMessage]
    AddMsg --> Disk1
    Restore --> Stream[OriginOSAgent 生成流式回复]
    Stream --> Dedupe[stream-dedupe]
    Dedupe --> Scheduler[stream-render-scheduler]
    Scheduler --> UI[ChatMessageList 更新]
    Stream --> Tools[工具调用 file-tools / bash-tools]
    Tools --> Disk2[产物文件 outputDir]
    WM --> Close[窗口关闭]
    Close --> Destroy[destroyAgentSession]
    Close --> Consolidate[consolidateMemory]
```

这张图不是调用顺序，而是责任地图。每个节点代表一个稳定的责任边界，箭头表示数据或控制权的移交方向。

## 核心判断

学完 Part B 后，你应该带着这句核心判断进入 Part C/E：

> 一次用户点击会穿过多个边界，每个边界只做自己这一层的翻译、校验或持久化；不能把 UI 现象直接等同于运行时状态，也不能把运行时状态直接等同于磁盘持久化。

这句话可以拆成五条具体含义：

1. **首页入口是配置**：`name` 不等于 `skillName`，卡片只触发事件。
2. **页面层负责翻译**：把配置变成窗口配置，窗口 id 不等于 session id。
3. **窗口是生命周期边界**：关闭窗口触发清理，但不删除会话 JSON。
4. **HTTP/IPC 是权限边界**：浏览器不能直接创建会话或写文件，必须通过 API/IPC。
5. **流式事件不是单一 JSON**：事件需要桥接、去重、调度，abort 后旧事件必须丢弃。

## 关键区分卡

| 概念 | 是什么 | 不能误认为 |
|------|--------|-----------|
| `app.id` | React 列表 key | 窗口 id / session id |
| 窗口 id | `skill-${skillName}` | 已持久化的会话 |
| session id | 会话在存储层的标识 | 窗口视觉标题 |
| `name` | 卡片展示文案 | 技能代码 |
| `skillName` | 技能代码 | 窗口标题 |
| `baseDir` | Skill 只读源目录 | 可写工作目录 |
| `workingDir` | Agent CWD + 认知文件 | 产物输出目录 |
| `outputDir` | 产物输出目录 | 技能源目录 |
| `isInitialized` | React 客户端状态 | 磁盘会话已创建 |
| `destroyAgentSession` | 清理运行时实例 | 删除会话 JSON |
| `consolidateMemory` | 整理长期记忆 | 保存会话历史 |

## 排查地图

当遇到一个现象时，先按层定位，再进入该层源码：

| 现象 | 先看哪一层 | 典型入口 |
|------|-----------|----------|
| 卡片没显示 | 首页配置层 | `packages/web/src/config/homeApps.ts` |
| 点击卡片没反应 | 页面编排层 | `packages/web/src/app/page.tsx` 中 `HOME_APPS.map` |
| 窗口没打开 | 窗口服务层 | `packages/web/src/services/AppWindowManager.ts` |
| 窗口开了但欢迎语不对 | SkillDialog 准备层 | `packages/web/src/components/skills/SkillDialog.tsx` |
| 技能内容加载失败 | 技能服务层 | `packages/core/src/lib/features/skills/service.ts` |
| 会话创建失败 | 会话 API 层 | `packages/web/src/app/api/agent/sessions/route.ts` |
| 发送消息报错 404 | 会话持久化层 | `packages/core/src/lib/features/agent/session-service.ts` |
| 发送消息报错 403 | 所有权校验层 | `packages/core/src/lib/integrations/pi-agent/session-restore.ts` |
| 模型不回复或回复慢 | Agent 运行时层 | `packages/core/src/lib/integrations/pi-agent/agent-manager.ts` |
| 回复重复或卡顿 | 流式处理层 | `packages/core/src/lib/integrations/pi-agent/stream-dedupe.ts`、`stream-render-scheduler.ts` |
| 产物文件没生成 | 工具执行层 | `packages/core/src/lib/integrations/pi-agent/tools/file-tools.ts`、`bash-tools.ts` |
| 关闭窗口后历史丢失 | 会话持久化层 | `packages/core/src/lib/features/agent/session-service.ts` |

## 源码覆盖台账

| 文件路径 | 状态 | 主讲章节 | 教学责任 |
|----------|------|----------|----------|
| `packages/web/src/config/homeApps.ts` | 直接精读 | B01 | 首页入口分类与字段含义 |
| `packages/web/src/components/framework/AppCard.tsx` | 直接精读 | B01 | 卡片只触发 onClick |
| `packages/web/src/app/page.tsx` | 直接精读 | B02 | handleSkillLaunch、HOME_APPS.map |
| `packages/web/src/services/AppWindowManager.ts` | 直接精读 | B03 | 窗口生命周期与关闭回调注入 |
| `packages/web/src/store/appWindowStore.ts` | 背景引用 | B03 | 窗口状态管理 |
| `packages/web/src/components/skills/SkillDialog.tsx` | 直接精读 | B04、B06 | 技能加载、prompt 构建、初始化调用 |
| `packages/core/src/lib/integrations/electron/services/skill.ts` | 局部引用 | B05 | Web/Electron 技能适配 |
| `packages/web/src/app/api/skills/route.ts` | 直接精读 | B05 | 技能列表 API |
| `packages/web/src/app/api/skills/[name]/content/route.ts` | 直接精读 | B05 | 技能内容 API 的 raw/json 分叉 |
| `packages/core/src/lib/features/skills/service.ts` | 直接精读 | B05 | 技能过滤、目录解析 |
| `packages/core/src/lib/integrations/pi-agent/client-hooks.ts` | 直接精读 | B07、B09 | initializeSession、sendMessageStream、SSE 解析 |
| `packages/core/src/lib/integrations/electron/services/agent-session.ts` | 局部引用 | B07、B08、B10 | Web/Electron 会话适配 |
| `packages/web/src/app/api/agent/sessions/route.ts` | 直接精读 | B07 | 会话创建 API |
| `packages/core/src/lib/features/agent/session-service.ts` | 直接精读 | B07、B08、B10、B11 | 会话持久化、消息追加 |
| `packages/core/src/lib/integrations/pi-agent/agent-manager.ts` | 局部引用 | B08、B11 | 运行时恢复、工具上下文注入 |
| `packages/core/src/lib/integrations/pi-agent/session-restore.ts` | 局部引用 | B08 | 所有权校验 |
| `packages/web/src/app/api/agent/sessions/[sessionId]/messages/route.ts` | 直接精读 | B08、B09 | 消息接收、流式桥接 |
| `packages/core/src/lib/integrations/pi-agent/core/agent.ts` | 延后讲解 | B09 | 只引用事件入口，内部留给 Part E |
| `packages/core/src/lib/integrations/pi-agent/stream-dedupe.ts` | 直接精读 | B09 | 流式去重 |
| `packages/core/src/lib/integrations/pi-agent/stream-render-scheduler.ts` | 直接精读 | B09 | 渲染调度 |
| `packages/core/src/lib/integrations/pi-agent/tools/context.ts` | 直接精读 | B11 | 工具执行上下文 |
| `packages/core/src/lib/integrations/pi-agent/tools/file-tools.ts` | 局部引用 | B11 | 文件写入路径约束 |
| `packages/core/src/lib/integrations/pi-agent/tools/bash-tools.ts` | 局部引用 | B11 | Shell 工作目录约束 |
| `packages/core/src/lib/integrations/pi-agent/tools/path-utils.ts` | 局部引用 | B11 | 路径边界检查 |

## 相邻但未深入的内容

以下主题与 Part B 的链路相关，但不属于本 Part 的讲解范围：

- **Pi Agent runtime 内部事件循环**：`OriginOSAgent` 如何订阅事件、管理工具调用链、处理错误恢复——留给 Part E。
- **具体工具实现细节**：每个工具的参数校验、输出截断、重试策略——留给 Part E 的 Tools 章节。
- **模型上下文裁剪**：`convertToLlm` 如何选择进入模型的消息——留给 Part E。
- **认知系统**：`Memory.md`、实践日志、模式提取的完整机制——留给 Part F。
- **Electron IPC 协议细节**：`IPC_CHANNELS` 的完整定义和主进程处理——留给 Part K。

## 综合实验

给定四个故障现象，分别指出先查哪一层、哪段源码、哪个测试或验证入口：

1. 首页「头脑风暴」卡片显示正常，但点击后没有窗口打开。
2. 窗口打开了，但欢迎语不是头脑风暴的，而是另一个 Skill 的。
3. 用户发送消息后，API 返回 403。
4. 模型回复在窗口中出现了重复文本。
5. 关闭窗口后，重新打开同一 Skill，历史会话没有显示。

参考答案方向：

1. 先查 `HomePage` 的 `HOME_APPS.map` 和 `handleSkillLaunch`。
2. 先查 `SkillDialog` 的 `loadSkillContent` 和 `buildSkillSystemPrompt`。
3. 先查 `session-restore.ts` 的 `assertSessionMessageOwnership` 和请求中的 `entryType/entryId/projectId`。
4. 先查 `stream-dedupe.ts` 的 `getVisibleStreamDelta` 和 `reconcileFinalStreamContent`。
5. 先查 `agentSessionService` 的保存路径和 `listAvailableSkillSessions`。

## 进入 Part C/E 前的口头验收

合上 Part B 后，应能不翻稿回答：

1. 从首页点击「头脑风暴」到窗口打开，经过哪几个系统角色？
2. 窗口 id、session id、`app.id`、`skillName` 分别是什么，有什么不同？
3. 为什么 `SkillDialog` 要构建 `systemPrompt`，而不是直接让用户消息进入模型？
4. 发送消息前，服务端为什么要先做所有权校验和运行时恢复？
5. 流式响应为什么要去重和调度？
6. 关闭窗口后，运行时实例、记忆文件、会话 JSON 分别会怎样？
7. Agent 调用工具写文件时，如何确定可以写到哪里？

能完成这七项，说明你已经能把「一次点击」从现象追踪到源码，并在每个边界停下来解释原因。

## 下一单元预告

Part C 将进入「仓库、构建与边界」：你会看到 `pnpm-workspace.yaml`、TypeScript 配置、Tailwind 入口、测试运行方式如何共同约束项目结构，并为 Part B 中追踪到的代码提供工程基础。

![小黑图：一次点击的完整链路排查](assets/b12-operation-chain-map.png)

*上图意图：小黑手持放大镜，沿着「首页 → 卡片 → 窗口 → SkillDialog → 会话 API → Agent 运行时 → 流式回复 → 工具/产物 → 关闭窗口」的路径逐段检查，每段标注常见故障点和对应源码入口。*
