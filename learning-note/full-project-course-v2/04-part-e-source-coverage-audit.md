# Part E 源码范围与全局审查台账

本文是 Part E 的作者侧审查台账，不是教材正文。它解决两个问题：Part E 到底承诺讲哪一段生产系统，以及怎样证明相关源码没有被静默遗漏。

## 1. 范围合同

Part E 的主题是 Pi Agent 基础运行时：一个普通会话怎样获得配置、接收消息、调用工具、流式返回、保存、恢复，并通过测试建立有限证据。

源码不能只分成“写进课程”和“没有写进课程”两类。本台账使用四种状态：

| 状态 | 含义 | 正文要求 |
| --- | --- | --- |
| 直接精读 | 文件或代码窗口承担本 Part 的核心行为 | 必须解释输入、关键状态、分支、输出、失败边界、调用关系和测试证据 |
| 接口说明 | 文件只负责导出或连接，不产生新的业务算法 | 必须说明它导出了什么、为什么没有按业务文件重复精读 |
| 局部引用 | 文件整体属于相邻运行时，但其中一个调用点进入本 Part | 只对进入当前主链的代码窗口负责，并明确其余内容的归属 |
| 延后讲解 | 文件属于 RoleAgent、ProjectAgent、认知系统等后续主题 | 必须写明延后原因，不得用“同目录已覆盖”掩盖 |

“源码完全覆盖”在本教材中的准确含义是：范围内每个生产文件或关键代码窗口都有明确状态，直接精读部分能形成完整调用链，延后部分有可审查的理由。它不等于把同一个文件的每一行抄进正文。

## 2. 七个单元的直接源码责任

| 单元 | 直接精读的生产范围 | 核心教学责任 |
| --- | --- | --- |
| E01—E08 会话心智模型 | `types.ts`、`message.ts`、`display-content.ts`、`core/runtime-history.ts`、`core/agent.ts` 的配置、消息、事件与上下文窗口；`system/prompt.ts`、`system/config.ts` 的基础提示词路径 | 分清窗口、项目、会话、轮次、消息、事件、存储快照和模型上下文；说明两份同名配置接口的差异 |
| E09—E20 客户端、服务端与流式消息 | `client-hooks.ts`、`hooks.ts`、`agent-manager.ts`、会话创建/消息/终止/销毁 API routes、Electron renderer `agent-session.ts`、桌面 `AgentSessionService` 的流式 handler、`stream-event-batcher.ts`、`assistant-stream-state.ts`、`stream-dedupe.ts`、`stream-render-scheduler.ts` | 解释浏览器和运行时分离、HTTP/SSE 与 Electron IPC、恢复顺序、三条流式桥接、批处理、并发归属、终止与销毁差异 |
| E21—E30 会话持久化与恢复 | core `agent-session-service.ts`、`session-store.ts`、`session-restore.ts`、Web 会话详情/摘要/统计 routes、桌面 `AgentSessionService` 的管理 handlers、Hook 恢复窗口 | 区分权威持久化服务与简单本地存储，解释 Web/IPC 边界、入口归属、展示快照、运行时 hydration、竞态和删除语义 |
| E31—E40 Skills | `homeApps.ts`、skills API routes、Agents content Route、Electron `getAgentContent`/`AGENT_CONTENT_GET`、`core/skills.ts`、`core/skills.types.ts`、`SkillDialog.tsx`、`tools/skill-tools.ts`、legacy skill service/executor/launcher | 从产品入口追到技能目录、SKILL.md/Agent.md 解析、Web/Electron fallback、提示词注入、工作目录和嵌套技能；明确 legacy 路径不是同一条链 |
| E41—E55 Tools | `tools/registry.ts`、`context.ts`、`bind-session.ts`、`path-utils.ts` 以及文件、Shell、URL、文档、本体、提问、调度、重试、循环检测和状态映射工具 | 解释“注册、可见、授权、执行”四层边界；逐类讲输入校验、目录限制、副作用、输出截断、失败与测试 |
| E56—E63 稳定性与可观测性 | `error-handler.ts`、`stream-dedupe.ts`、`stream-render-scheduler.ts`、`recent-trace-compression.ts`、completion guard/judge、loop detector、core health、桌面 `process-health-monitor.ts`、notification、upload tracker、runtime working summary | 按故障模型解释恢复，区分 Agent 逻辑健康与 Electron 宿主进程健康，不把局部观测误写成端到端可靠性 |
| E64—E70 测试与端到端验收 | 基础 runtime、store、restore、Hook、prompt、display、skills、tool 与跨边界合同测试；`store.ts`、`server-config.ts`、`system/config.ts`、`runtime-environment.ts`、`test-llm/route.ts` 的生产实现 | 教会读者判断测试证据边界，区分 mock 配置测试与真实网络诊断，并把单元测试、合同测试、集成验证和真实环境验收分层 |

这张表只是单元责任入口。验收时还要反向检查：每个表中列出的文件是否有正文代码窗口，正文中的每个重要结论是否能回到真实调用点。

## 3. 容易被目录结构掩盖的源码分叉

### 3.1 两份同名配置不是同一合同

[packages/core/src/lib/integrations/pi-agent/types.ts 第 203—239 行](../../packages/core/src/lib/integrations/pi-agent/types.ts#L203) 与 [packages/core/src/lib/integrations/pi-agent/system/config.ts 第 13—43 行](../../packages/core/src/lib/integrations/pi-agent/system/config.ts#L13) 都声明 `OriginOSAgentConfig`，但字段必填性和 `tools` 类型不同。核心 `OriginOSAgent` 实际导入前者。E02 必须直接说明这一事实，不能把配置工厂接口误写成核心类的唯一合同。

### 3.2 两条会话存储路径不是同一个仓库

桌面端 `agent-session-service.ts` 是产品会话持久化主链；`session-store.ts` 是 Pi Agent 目录里的简单 JSON 存储模型。两者都使用“session”一词，但所有权、目录和调用方不同。E21—E30 必须分别讲解，并避免把其中一条的测试结论推广到另一条。

### 3.3 两条流式桥接不能按名称推断等价

会话消息 route 同时包含 dispatcher/runtime bridge 与进程内 bridge。它们的事件来源、最终助手消息补发和内容累积方式不同。E14、E19 和 E20 必须分别说明差异，不得只画一条抽象 SSE 箭头。

### 3.4 Skills 主链与 legacy 执行链并存

SkillDialog 驱动的会话式技能，与 `features/skills` 下的旧式 execution/handler 路径不是同一个生命周期。E31—E40 应明确入口、工作目录、输出目录、会话身份和完成事件分别由谁负责。

### 3.5 Web Route 与 Electron IPC 是并行边界

两端复用 core service，不代表请求形状、事件运输和中断语义天然相同。E14 直接精读 Electron 流式 handler、批处理器和最终消息状态机；E29 对照两端会话管理 handler；E62 区分 core Agent health 与桌面进程健康。验收必须检查每项业务能力在 Web 与 Electron 中分别传了哪些身份字段、产生哪些副作用、返回哪个完成信号。

### 3.6 安全边界必须按真实能力命名

`path.resolve` 与字符串前缀判断属于词法路径边界，不自动解析 symlink 最终目标；选出一个 shell CWD 也不等于完成 sandbox 授权。E44—E48 必须逐工具说明真实路径检查是否存在、起始目录 symlink 是否可进入、写入/删除是否仍有缺口，禁止用“限定在工作目录”概括尚未成立的物理文件系统保证。

## 4. 接口说明与局部引用

下列文件不能因为“没有独立一课”就记为遗漏，也不能因为“已在目录中出现”就算精读完成：

| 文件 | 状态 | 本 Part 的处理方式 |
| --- | --- | --- |
| `client.ts`、`server.ts`、`core/index.ts`、`system/index.ts`、根 `index.ts` | 接口说明 | 在 E70 的公共入口复盘中说明再导出关系；业务算法回到被导出的源文件精读 |
| `persistent-agent-manager.ts` | 局部引用 | E18 只解释 abort route 查询长驻 Agent 的代码窗口；其余生命周期随 RoleAgent/ProjectAgent 延后 |
| `persistent-agent.ts`、`use-persistent-agent.ts` | 延后讲解 | 属于长驻 Agent 的另一套运行路径，不与基础 `usePiAgent` 主链混讲 |
| `memory-consumption.ts` | 延后讲解 | 当前调用方位于 RoleAgent/ProjectAgent prompt 路径 |
| `user-preferences.ts` | 延后讲解并说明接口 | E68 只说明已有测试和调用归属，不宣称基础运行时已经集成 |
| `taste-context.ts` | 局部引用 | E68 说明提示词拼装合同及当前基础主链没有生产调用者这一事实 |
| `taste-generator.ts`、`skill-evolution.ts` | 延后讲解 | 属于风格生成和技能演化主题，不是普通会话必经链 |
| `goal-extension.ts`、`tool-config-loader.ts` | 未接入实现 | 当前源码检索未发现生产调用者；应作为“存在不等于已集成”的例子，而非活跃能力 |
| `mocks/pi-mono-mocks.ts` | 测试基础设施 | 解释 adapter mock 如何限制测试证据，不计作生产能力 |
| Web `_runtime-agent-registry.ts` | 直接精读 | E18 说明 Runtime 进程查找与 HMR 下共享 Map；它是 abort/start/stop 路径的基础设施 |
| 桌面 `AgentSessionService` 第 937—970 行与 Web memory consolidate Route | 延后讲解 | 属于记忆压缩/长驻 Agent 管理；基础会话正文只登记接口存在，不把它写成普通会话必经链 |
| Electron `env.ts`、`ipc-protocol.ts` | 接口说明 | E09 解释环境探测、preload bridge 与 channel 常量；其他非 Agent channel 不属于 Part E |
| Electron `local-agent.ts`、`local-fs.ts`、`window.ts`、`workspace-paths.ts` | 延后讲解 | 属于本地 Agent 启动、文件/窗口/工作空间适配，不是基础会话主链的 transport service |

## 5. 明确延后的目录

以下范围不属于 Part E 的基础运行时承诺：

- `role-agent/**`：角色上下文、状态机、Dream、MemoryTracker 和专用 prompt。
- `project-agent/**` 与 Web `api/agent/projects/[projectId]/{start,messages,abort,stop}`：项目上下文、协作提示、技能供应与 ProjectAgent 专用运行边界。
- `cognitive/**`：知识、实践日志、模式、睡眠计算和认知生命周期。
- `persistent-agent.ts`、`use-persistent-agent.ts`、`memory-consumption.ts` 与 Web `api/agent/memory/consolidate`：长驻 Agent、记忆消费与压缩路径；`persistent-agent-manager.ts` 只有基础 abort 查询窗口在 E18 局部引用。
- `features/agent/**`：产品 Agent 注册、默认值和项目访谈提示等产品业务层能力。
- 与 Pi Agent 基础会话无直接调用关系的 Electron service，如 `agent-project`、auto update、workspace、user registry、collaboration 和普通 project/ontology service；桌面主进程对应的 project/workspace/ontology/collaboration service 同样随各自专题处理。
- 桌面 `console-log-capture.ts`、`daily-log-writer.ts`、`entry-export-service.ts`、`entry-paths.ts`、`native-notification-service.ts` 和 `desktop-scheduler-service.ts`：属于宿主日志、导出、原生通知和桌面调度，不因位于 services 目录就算入基础会话主链。

延后不是删除。后续 Part 建立范围台账时，必须重新接收这些文件，不能永久停留在“以后再讲”。

## 6. 测试覆盖不等于生产覆盖

每节课的证据至少分成三层：

| 层级 | 要回答的问题 | 不能越界声称 |
| --- | --- | --- |
| 源码事实 | 当前函数实际有哪些输入、分支和副作用？ | 不能声称这些分支已运行通过 |
| 自动化测试 | Given/When/Then 实际断言了什么？ | 不能声称没有断言的浏览器、网络、磁盘或模型行为可靠 |
| 真实验收 | 请求是否跨过真实进程、文件系统和供应商边界？ | 不能用一次成功替代并发、失败和恢复场景 |

测试文件中的 mock、fixture 和 harness 也必须列入讲解，但它们只解释证据是怎样制造出来的，不计作独立生产能力。

## 7. 全局复审清单

### 7.1 源码完全覆盖

- [ ] 每个直接相关生产文件都有“直接精读、接口说明、局部引用或延后讲解”状态。
- [ ] 大文件按函数和行段登记，没有用一次链接冒充整文件覆盖。
- [ ] 每条主链都能从调用者走到被调用者，并说明数据怎样变形。
- [ ] 同名类型、并行实现、legacy 路径和未接入文件都已明确分类。
- [ ] 每个重要生产窗口都有测试证据或明确的测试缺口。

### 7.2 讲解深度

- [ ] 每节不只讲“是什么”，还讲“为什么、怎样运行、在哪里停止、失败后怎样表现”。
- [ ] 关键条件分支、默认值、状态写入、异步顺序和副作用均有解释。
- [ ] 图中的每个节点和箭头能回到源码对象，图后有逐项说明。
- [ ] 测试结论严格限制在真实断言范围内。
- [ ] E02、E06 也接受同样审查，不再作为免检样章。

### 7.3 新手友好与正式教材表达

- [ ] 每节先从可观察问题建立直觉，再进入术语和源码。
- [ ] 相似概念使用对照，首次出现的字段解释责任与反例。
- [ ] 代码窗口前说明阅读目标，代码窗口后解释输入、状态、分支和输出。
- [ ] 正文没有写作过程、作者提示、自我评价或“为达标而写”的话。
- [ ] 练习是教学后的验证，不是把尚未讲解的知识反过来考读者。

## 8. 完成判定

Part E 只有在以下三项同时成立后才能宣布完成：

1. 范围台账没有未分类的直接相关生产文件；
2. 七个单元逐节通过源码覆盖、讲解深度和新手友好三项复审；
3. 链接、表格、图片、标题和测试命令经过机械检查，且没有把机械检查写成教学质量证明。

任何一项未完成时，准确状态都应是“仍在审查或改写”，而不是“已经达标”。

## 9. 2026-09-01 全局复审记录

### 9.1 本轮发现并修正的范围缺口

| 缺口 | 修正位置 | 修正后的边界 |
| --- | --- | --- |
| 只讲 Web 流式桥，没有桌面 IPC 主链 | E14、00-02 | 增加 renderer invoke/subscribe、主进程会话校验、事件批处理、最终消息收敛和桌面 abort 差异 |
| 会话管理只比较 Web Routes | E29、00-03 | 对照 Electron list/create/get/update/delete/destroy/statistics/summary handlers 与副作用 |
| Skill 内容只讲普通 Skill API | E35、00-04 | 增加 SkillDialog 的 Agent fallback、Web Agent Route 与 Electron `AGENT_CONTENT_GET` |
| 健康监控只讲 Agent 逻辑状态 | E62、00-06 | 区分 core `HealthMonitor` 与桌面 `ProcessHealthMonitor` 的宿主进程/renderer 证据 |
| 配置测试没有连接真实诊断入口 | E65、00-07 | 增加 `/api/agent/test-llm` 的真实网络副作用、顺序超时、脱敏边界与测试缺口 |

### 9.2 本轮纠正的过度结论

- 配置工厂存在，不等于核心 Agent 已经使用该工厂。
- Skill middleware 计算出 prompt 索引，不等于索引已经注入真实会话。
- 会话 ownership 一致性不是用户认证或权限授权。
- Web helper 的 `{sessionId}` 与 abort Route 的 `{agentId}` 当前不匹配；不能声称服务端已可靠中断。
- Electron abort 当前移除 manager 中的 Agent，不等于显式 `abort()` 并等待底层计算停止。
- `path.resolve/path.relative` 形成的是词法路径边界，不是自动解析 symlink 的真实文件沙箱。
- shell 选出 CWD 不等于完成进程 sandbox；缺少 tool context 时的 fallback 必须单独审查。
- 单元测试、helper 测试和静态源码审查不能替代 Web/Electron/真实模型端到端证据。

### 9.3 正文与结构检查结果

- E01—E70 均包含真实源码链接、失败或边界说明、测试证据/缺口、练习或验收，以及至少一张 Mermaid 图。
- 七个单元导读均包含小黑配图；图、表和正文分别承担记忆、对照和逻辑解释。
- 已清理“教材应怎样写”“写课时怎样覆盖”等作者工作台语句，改成直接面向学习者的事实与判断。
- 本地链接目标、源码行锚点、Markdown 表格列数、代码围栏、E01—E70 标题和数字章节顺序通过机械检查。
- 自动化测试未能启动：当前 workspace 的 `@originos/core` 环境找不到 `vitest`，命令返回 `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "vitest" not found`。因此本轮只记录静态内容检查通过，不把运行时测试写成 Passed。
