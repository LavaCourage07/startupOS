# 单元导读一：Electron 主进程生命周期

> 本导读不替代正式课。它先建立问题、词汇和学习终点，让读者在进入 K01–K08 源码细节之前知道自己在解决什么。

## 本单元要解决的总问题

用户在桌面双击 OriginOS CE 图标后，Electron 进程是怎样从零启动、准备好数据目录、创建主窗口、注册托盘和快捷键、捕获日志、处理流式事件并监控自身健康的？

这个问题看似只是"打开一个桌面应用"，但它涉及至少六个不同层次的决策：

1. **进程启动**：Electron 主进程在 `app.whenReady()` 之后做了哪些初始化？
2. **路径解析**：打包态和开发态的数据目录为什么不同？Core 路径怎样被注入？
3. **窗口管理**：主窗口、Dock 窗口和子窗口怎样被创建、复用和销毁？
4. **系统插件**：托盘菜单、全局快捷键和自动更新怎样挂在主进程上？
5. **日志系统**：`console.log` 怎样被拦截并分流到桌面日志和 LLM 日志？
6. **健康监控**：主事件循环卡顿、渲染进程崩溃和 Agent 活动怎样被观测？

## 主线案例

本单元以"用户双击图标启动桌面版，发起一次 Agent 会话并观察流式回复"为主线。同一对象——主进程——在每个章节中进入一个新的问题阶段：

```text
双击图标
  → K01: 主进程启动，app.whenReady() 引导
  → K02: 数据根目录确定，Core 路径注入
  → K03: 主窗口创建，renderer 加载
  → K04: 托盘、快捷键、自动更新挂载
  → K05: console 被拦截，日志分流
  → K06: Agent 流式事件被批处理
  → K07: 进程健康被持续监控
  → K08: 综合复盘
```

## 本单元不讲什么

- **IPC 协议和桌面服务层**：放在单元二（K09–K18）。本单元只讲主进程自身的生命周期，不深入 IPC channel 的注册和分发。
- **渲染进程侧适配**：放在单元二。本单元只涉及 `preload.ts` 的存在，不展开 `contextBridge` 的完整 API。
- **Agent Worker 运行时**：放在单元三（K19–K25）。本单元只涉及 Agent 活动被健康监控记录，不涉及 Agent 子进程怎样启动。
- **Pi-Tasks 运行时合同**：放在单元四（K26–K30）。

## 源码覆盖台账

| 文件路径 | 类型 | 本单元状态 | 主讲章节 | 教学责任 |
| --- | --- | --- | --- | --- |
| `packages/desktop/src/main/main.ts` | source | 精读 | K01 | 主进程入口：app 配置、单实例锁、whenReady 引导顺序、服务实例化、before-quit 清理 |
| `packages/desktop/src/main/setup-data-root.ts` | source | 精读 | K02 | 数据根目录注入：打包态 vs 开发态、Core paths 覆写 |
| `packages/desktop/src/main/paths.ts` | source | 精读 | K02 | 桌面端路径工具：monorepoRoot、dataRoot、项目/agents/skills 目录 |
| `packages/desktop/src/main/window-manager.ts` | source | 精读 | K03 | 窗口管理：主窗口、Dock 窗口、子窗口创建/复用/销毁、IPC handler 注册 |
| `packages/desktop/src/main/tray-manager.ts` | source | 精读 | K04 | 系统托盘：图标加载、菜单构建、最近项目、开机自启动 |
| `packages/desktop/src/main/shortcuts.ts` | source | 精读 | K04 | 全局快捷键：CmdOrCtrl+Shift+D（Dock）、CmdOrCtrl+K（Spotlight）、CmdOrCtrl+Shift+O（快速启动） |
| `packages/desktop/src/main/auto-updater.ts` | source | 精读 | K04 | 自动更新：状态机、electron-updater 动态加载、IPC handler、打包态限制 |
| `packages/desktop/src/main/devtools-context-menu.ts` | source | 精读 | K04 | 开发态右键菜单：Inspect Element、Open DevTools、Reload |
| `packages/desktop/src/main/services/console-log-capture.ts` | source | 精读 | K05 | 控制台日志捕获：serializeConsoleArgs、captureConsoleCall、敏感信息脱敏 |
| `packages/desktop/src/main/services/daily-log-writer.ts` | source | 精读 | K05 | 按日日志写入：DailyLogWriter（同步）、BufferedDailyLogWriter（异步缓冲） |
| `packages/desktop/src/main/services/stream-event-batcher.ts` | source | 精读 | K06 | 流式事件批处理：文本合并、32ms 定时刷新、16KB 阈值 |
| `packages/desktop/src/main/services/assistant-stream-state.ts` | source | 精读 | K06 | 助手流式状态：applyAssistantMessageEnd、reconcileFinalStreamContent |
| `packages/desktop/src/main/services/process-health-monitor.ts` | source | 精读 | K07 | 进程健康监控：事件循环卡顿检测、渲染进程 unresponsive/gone 追踪、Agent 活动记录 |
| `packages/desktop/src/main/services/__tests__/console-log-capture.test.ts` | test | 配对精读 | K05 | 日志捕获测试：序列化、脱敏、截断 |
| `packages/desktop/src/main/services/__tests__/daily-log-writer.test.ts` | test | 配对精读 | K05 | 日志写入测试：路径解析、缓冲刷新、dispose |
| `packages/desktop/src/main/services/__tests__/assistant-stream-state.test.ts` | test | 配对精读 | K06 | 助手状态测试：正常结束、失败结束、重复发送 |
| `packages/desktop/src/main/services/__tests__/process-health-monitor.test.ts` | test | 配对精读 | K07 | 健康监控测试：卡顿检测、活动记录、窗口追踪 |

## 章节因果链

| 章节 | 接住的问题 | 新引入的对象 | 留下的未解决问题 |
| --- | --- | --- | --- |
| K01 | — | `main.ts`、`app.whenReady()`、单实例锁 | 数据目录在哪里？ |
| K02 | K01 的 userData 路径 | `setup-data-root.ts`、`paths.ts`、打包态 vs 开发态 | 窗口怎样被创建？ |
| K03 | K02 的数据路径 | `window-manager.ts`、主窗口、Dock 窗口、子窗口 | 关闭窗口后发生了什么？ |
| K04 | K03 的窗口生命周期 | `tray-manager.ts`、`shortcuts.ts`、`auto-updater.ts`、`devtools-context-menu.ts` | 日志怎样被记录？ |
| K05 | K04 的日志需求 | `console-log-capture.ts`、`daily-log-writer.ts`、敏感信息脱敏 | 流式事件怎样被处理？ |
| K06 | K05 的日志 → 流式场景 | `stream-event-batcher.ts`、`assistant-stream-state.ts`、文本合并 | 子进程挂了怎么办？ |
| K07 | K06 的流式状态 | `process-health-monitor.ts`、事件循环检测、渲染进程崩溃追踪 | 整体怎样串起来？ |
| K08 | K01–K07 全部 | 综合复盘、排查地图、口头验收 | → 单元二 |

## 阅读路径

1. 先读本导读，建立六个层次的问题意识。
2. 按 K01 → K07 顺序阅读正式课，每节课解决主线案例中的一个新问题。
3. K08 是单元小结课（workshop），把分散知识重新组织成系统能力。即使暂时忘记前面细节，也能通过 K08 重建整体地图。
4. 遇到源码细节不确定时，回台账查找对应文件和代码窗口。

## 进入 K01 前必须记住的三个判断

1. **Electron 主进程是桌面版的"总调度"**：它决定数据在哪里、窗口怎样创建、日志怎样记录、健康怎样监控。所有桌面版能力都从 `main.ts` 的 `app.whenReady()` 开始。
2. **打包态和开发态的路径解析完全不同**：开发态使用 monorepo 根目录的 `data/`，打包态使用 `app.getPath('userData')/data`。`setup-data-root.ts` 必须在所有其他模块之前导入，否则 Core 路径会解析错误。
3. **桌面版不是"Web 版加了个壳"**：它有独立的日志系统、流式事件批处理、进程健康监控和自动更新机制。这些能力在 Web 版中不存在或由不同模块承担。
