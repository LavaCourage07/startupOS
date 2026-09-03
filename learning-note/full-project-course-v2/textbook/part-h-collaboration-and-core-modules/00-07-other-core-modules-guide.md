# 单元导读七：其他 Core Modules

## 单元总问题

Scheduler、Neural Channel、View Manager、View Reconciler、MCP in Browser 这些模块分别解决什么问题？它们与 Core 业务层和 Web 层的边界在哪里？

## 为什么现在学这个单元

前六个单元已经覆盖了 Part H 的两大核心主题：Collaboration Runtime 和 Memory Core。但 `packages/core/src/modules/` 下还有五个相对独立的模块，它们各自解决不同的问题：

- **Scheduler**：让 OriginOS 能够按计划执行动作（例如定时同步旅行行程）。
- **Neural Channel**：让宿主应用和子应用之间能够跨 frame/context 通信。
- **View Manager**：管理视图生命周期。
- **View Reconciler**：协调不同微前端方案（iframe、qiankun、micro-app）的渲染。
- **MCP in Browser**：在浏览器 tab 之间实现 Model Context Protocol 的 server/client/transport。

这些模块目前文件数不多，文档质量参差不齐（例如 Neural Channel 的 README 还含 TODO），因此本单元以源码为准，重点讲清楚每个模块的边界、核心对象和与相邻层的交互点。到本单元结束，你应该能画出 Part H 各模块与 Part E/F/G/I/J 的完整边界地图。

## 主线案例在本单元的推进

小林的旅行协作结果需要与 Web 界面交互：

1. **Scheduler**：系统设置一个定时任务，每天早上 8 点检查酒店价格变动。
2. **Neural Channel**：旅行规划窗口作为一个 iframe/sub-app，通过 Neural Channel 与主应用通信状态。
3. **View Manager**：主应用注册并管理旅行规划视图的打开、关闭和生命周期。
4. **View Reconciler**：当旅行规划视图使用 qiankun 或 micro-app 方案嵌入时，View Reconciler 负责协调渲染边界。
5. **MCP in Browser**：浏览器内的一个 MCP server 暴露旅行知识库查询能力，另一个 tab 的 MCP client 通过 transport 调用它。

到本单元结束时，你应该能：说明每个模块解决什么问题、它们的输入输出是什么、与 Web 层和 Core 业务层的边界在哪里。

## 范围边界

### 本单元讲什么

- `packages/core/src/modules/scheduler/**`：定时任务调度。
- `packages/core/src/modules/neural-channel/src/**`：跨 frame 通信。
- `packages/core/src/modules/view-manager/src/**`：视图生命周期管理。
- `packages/core/src/modules/view-reconciler/src/**`：微前端协调。
- `packages/core/src/modules/mcp-in-browser/src/**`：浏览器内 MCP。

### 本单元不讲什么

- 这些模块被 Web 层具体如何调用（Part I / Part J）。
- Electron 侧如何使用 View Manager / Neural Channel（Part K）。
- 微前端框架（qiankun、micro-app）的深层原理（超出项目源码范围）。
- MCP 协议的全局规范细节（以项目实现为准）。

## 单元课程表

| 课号 | 课题 | 核心源码 | 学习目标 |
| --- | --- | --- | --- |
| H42 | Scheduler：定时任务与 SystemToolRunner | `scheduler/scheduler-service.ts`、`scheduler/action-runner.ts`、`scheduler/system-tool-runner.ts`、`scheduler/schedule-store.ts`、`scheduler/types.ts` | 理解任务调度、触发器、运行器边界 |
| H43 | Neural Channel：跨帧通信 | `neural-channel/src/master/manager.ts`、`neural-channel/src/client/client.ts`、`neural-channel/src/message/message.ts`、`neural-channel/src/type.ts` | 理解 Manager/Client、广播/多播、握手 |
| H44 | View Manager：视图生命周期管理 | `view-manager/src/manager.ts`、`view-manager/src/view.ts`、`view-manager/src/index.ts` | 理解 View 对象、Manager 注册与生命周期 |
| H45 | View Reconciler：微前端与 iframe 协调 | `view-reconciler/src/base/reconciler.ts`、`view-reconciler/src/iframe/index.ts`、`view-reconciler/src/qiankun/index.ts`、`view-reconciler/src/mirco-app/index.ts` | 理解多种微前端方案的协调边界 |
| H46 | MCP in Browser：浏览器内的模型上下文协议 | `mcp-in-browser/src/server.ts`、`mcp-in-browser/src/client.ts`、`mcp-in-browser/src/transport/TabClientTransport.ts`、`mcp-in-browser/src/transport/TabServerTransport.ts` | 理解浏览器 tab 间 MCP server/client/transport |
| H47 | 单元小结课：Part H 全局地图与相邻模块 | 复习 H42-H46 及 Part H 全部源码台账 | 能画出 Part H 各模块与 Part E/F/G/I/J 的边界 |

## 源码覆盖台账

### Scheduler

| 文件路径 | 文件类型 | 本单元状态 | 主讲章节 | 代码窗口 | 教学责任 | 配对验证 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/core/src/modules/scheduler/scheduler-service.ts` | source | 精读 | H42 | `SchedulerService`、`computeNextRunAt`、CRUD、runDueTasks | 调度核心 | 可能无直接测试 | 核心文件 |
| `packages/core/src/modules/scheduler/action-runner.ts` | source | 精读 | H42 | `SchedulerActionRunner` | 动作运行器 | 可能无直接测试 | 执行边界 |
| `packages/core/src/modules/scheduler/system-tool-runner.ts` | source | 精读 | H42 | `SystemToolRunner` | 系统工具运行 | 可能无直接测试 | 安全边界 |
| `packages/core/src/modules/scheduler/schedule-store.ts` | source | 精读 | H42 | `ScheduleStore`、JSON 持久化 | 任务存储 | 可能无直接测试 | 持久化 |
| `packages/core/src/modules/scheduler/types.ts` | source | 精读 | H42 | `ScheduledTask`、`ScheduleTrigger`、`SchedulerActionRunner` | 类型合同 | 类型检查 | 类型 |
| `packages/core/src/modules/scheduler/index.ts` | source | 背景引用 | H42 | re-export | 模块入口 | 无 | 入口 |

### Neural Channel

| 文件路径 | 文件类型 | 本单元状态 | 主讲章节 | 代码窗口 | 教学责任 | 配对验证 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/core/src/modules/neural-channel/src/master/manager.ts` | source | 精读 | H43 | `Manager`、setup、register、send/broadcast/multicast | Manager 核心 | 可能无直接测试 | 核心 |
| `packages/core/src/modules/neural-channel/src/master/message-buffer.ts` | source | 背景引用 | H43 | `MessageBuffer` | 消息缓冲 | 可能无直接测试 | 辅助 |
| `packages/core/src/modules/neural-channel/src/client/client.ts` | source | 精读 | H43 | `Client`、handshake、send、on | Client 核心 | 可能无直接测试 | 核心 |
| `packages/core/src/modules/neural-channel/src/message/message.ts` | source | 精读 | H43 | Message 数据结构 | 消息格式 | 可能无直接测试 | 合同 |
| `packages/core/src/modules/neural-channel/src/type.ts` | source | 精读 | H43 | 公共类型 | 类型合同 | 类型检查 | 类型 |
| `packages/core/src/modules/neural-channel/src/utils.ts` | source | 背景引用 | H43 | 工具函数 | 辅助 | 可能无测试 | 辅助 |
| `packages/core/src/modules/neural-channel/src/utils/log.ts` | source | 暂不纳入 | — | 日志 | 辅助 | — | 不独立成课 |
| `packages/core/src/modules/neural-channel/src/index.ts` | source | 背景引用 | H43 | re-export | 模块入口 | 无 | 入口 |
| `packages/core/src/modules/neural-channel/README.md` | doc | 背景引用 | H43 | 模块说明 | 辅助理解 | — | README 含 TODO，以源码为准 |

### View Manager

| 文件路径 | 文件类型 | 本单元状态 | 主讲章节 | 代码窗口 | 教学责任 | 配对验证 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/core/src/modules/view-manager/src/manager.ts` | source | 精读 | H44 | `ViewManager`、register、open、close | 视图管理 | 可能无直接测试 | 核心 |
| `packages/core/src/modules/view-manager/src/view.ts` | source | 精读 | H44 | `View`、生命周期 | 视图对象 | 可能无直接测试 | 核心 |
| `packages/core/src/modules/view-manager/src/index.ts` | source | 背景引用 | H44 | re-export | 模块入口 | 无 | 入口 |
| `packages/core/src/modules/view-manager/README.md` | doc | 背景引用 | H44 | 设计说明 | 辅助 | — | — |
| `packages/core/src/modules/view-manager/History.md` | doc | 暂不纳入 | — | 历史记录 | 背景 | — | 不独立成课 |

### View Reconciler

| 文件路径 | 文件类型 | 本单元状态 | 主讲章节 | 代码窗口 | 教学责任 | 配对验证 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/core/src/modules/view-reconciler/src/base/reconciler.ts` | source | 精读 | H45 | `Reconciler` 基类 | 协调器抽象 | 可能无直接测试 | 核心 |
| `packages/core/src/modules/view-reconciler/src/iframe/index.ts` | source | 精读 | H45 | iframe 协调实现 | iframe 方案 | 可能无直接测试 | 方案一 |
| `packages/core/src/modules/view-reconciler/src/qiankun/index.ts` | source | 精读 | H45 | qiankun 协调实现 | qiankun 方案 | 可能无直接测试 | 方案二 |
| `packages/core/src/modules/view-reconciler/src/mirco-app/index.ts` | source | 精读 | H45 | micro-app 协调实现 | micro-app 方案 | 可能无直接测试 | 方案三 |
| `packages/core/src/modules/view-reconciler/src/message/index.ts` | source | 背景引用 | H45 | 消息协议 | 协调通信 | 可能无直接测试 | 辅助 |
| `packages/core/src/modules/view-reconciler/src/utils/index.ts` | source | 背景引用 | H45 | 工具函数 | 辅助 | 可能无测试 | 辅助 |
| `packages/core/src/modules/view-reconciler/src/index.ts` | source | 背景引用 | H45 | re-export | 模块入口 | 无 | 入口 |
| `packages/core/src/modules/view-reconciler/README.md` | doc | 背景引用 | H45 | 设计说明 | 辅助 | — | — |

### MCP in Browser

| 文件路径 | 文件类型 | 本单元状态 | 主讲章节 | 代码窗口 | 教学责任 | 配对验证 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/core/src/modules/mcp-in-browser/src/server.ts` | source | 精读 | H46 | MCP Server 实现 | 浏览器内 server | 可能无直接测试 | 核心 |
| `packages/core/src/modules/mcp-in-browser/src/client.ts` | source | 精读 | H46 | MCP Client 实现 | 浏览器内 client | 可能无直接测试 | 核心 |
| `packages/core/src/modules/mcp-in-browser/src/transport/TabClientTransport.ts` | source | 精读 | H46 | tab 间 client transport | 跨 tab 传输 | 可能无直接测试 | 关键 |
| `packages/core/src/modules/mcp-in-browser/src/transport/TabServerTransport.ts` | source | 精读 | H46 | tab 间 server transport | 跨 tab 传输 | 可能无直接测试 | 关键 |
| `packages/core/src/modules/mcp-in-browser/src/transport/index.ts` | source | 背景引用 | H46 | re-export | transport 入口 | 无 | 入口 |
| `packages/core/src/modules/mcp-in-browser/src/shared/type.ts` | source | 精读 | H46 | 共享类型 | 类型合同 | 类型检查 | 类型 |
| `packages/core/src/modules/mcp-in-browser/src/decorator/index.ts` | source | 背景引用 | H46 | 装饰器 | 工具注册辅助 | 可能无测试 | 辅助 |
| `packages/core/src/modules/mcp-in-browser/src/index.ts` | source | 背景引用 | H46 | re-export | 模块入口 | 无 | 入口 |
| `packages/core/src/modules/mcp-in-browser/README.md` | doc | 背景引用 | H46 | 模块说明 | 辅助 | — | — |

### 配置/构建文件（不独立成课）

| 文件路径 | 文件类型 | 本单元状态 | 主讲章节 | 代码窗口 | 教学责任 | 配对验证 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/core/src/modules/scheduler/index.ts` | source | 背景引用 | H42 | re-export | 入口 | 无 | — |
| `packages/core/src/modules/neural-channel/package.json` | config | 暂不纳入 | — | 包配置 | 包边界 | — | 不独立成课 |
| `packages/core/src/modules/neural-channel/tsconfig.json` | config | 暂不纳入 | — | TS 配置 | 包边界 | — | 不独立成课 |
| `packages/core/src/modules/neural-channel/.gitignore` | config | 暂不纳入 | — | gitignore | 包边界 | — | 不独立成课 |
| `packages/core/src/modules/view-manager/package.json` | config | 暂不纳入 | — | 包配置 | 包边界 | — | 不独立成课 |
| `packages/core/src/modules/view-manager/tsconfig.json` | config | 暂不纳入 | — | TS 配置 | 包边界 | — | 不独立成课 |
| `packages/core/src/modules/view-reconciler/package.json` | config | 暂不纳入 | — | 包配置 | 包边界 | — | 不独立成课 |
| `packages/core/src/modules/view-reconciler/tsconfig.json` | config | 暂不纳入 | — | TS 配置 | 包边界 | — | 不独立成课 |
| `packages/core/src/modules/mcp-in-browser/package.json` | config | 暂不纳入 | — | 包配置 | 包边界 | — | 不独立成课 |
| `packages/core/src/modules/mcp-in-browser/tsconfig.json` | config | 暂不纳入 | — | TS 配置 | 包边界 | — | 不独立成课 |

## 关键概念预告

| 概念 | 通俗直觉 | 准确含义 | 不能误认为 |
| --- | --- | --- | --- |
| Scheduler | 闹钟+任务清单 | 按计划触发任务，支持 once/interval/cron | 事件总线 |
| Neural Channel | 跨房间对讲机 | 宿主应用与子应用之间的跨 frame 通信通道 | 普通 postMessage |
| View Manager | 窗口管理员 | 管理 View 的注册、打开、关闭和生命周期 | 路由管理器 |
| View Reconciler | 容器适配器 | 协调 iframe/qiankun/micro-app 多种嵌入方案 | 渲染引擎 |
| MCP in Browser | 浏览器内的工具协议 | 在 tab 之间实现 Model Context Protocol | 后端 API |

## 单元小结课目标（H47）

读完 H47 后，读者应能不看源码回答：

1. Scheduler 的三种触发器（once/interval/cron）各自适合什么场景？
2. Neural Channel 的 Manager 和 Client 分别运行在哪种上下文？
3. View Manager 中的 `View` 对象包含哪些生命周期状态？
4. View Reconciler 为什么要区分 iframe、qiankun、micro-app 三种实现？
5. MCP in Browser 的 server/client/transport 各承担什么职责？
6. Part H 的七个模块与 Part E/F/G/I/J 之间的数据流向是什么？

## 与后续 Part 的衔接

Part H 结束后：

- **Part I** 会讲 Next.js API Routes 如何调用 Part H 的 facade。
- **Part J** 会讲 Web React 组件如何消费 Part H 的 UI 模块和事件流。
- **Part K** 会讲 Electron Desktop 如何复用 Core 模块能力。

Part H 的任务是让读者先建立 Core 模块的完整地图，后续 Part 再分别从 Web、Desktop、API 等入口展开。
