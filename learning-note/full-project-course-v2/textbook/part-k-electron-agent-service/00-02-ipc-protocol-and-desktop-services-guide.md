# 单元导读二：IPC 协议与桌面服务层

> 本导读不替代正式课。它先建立问题、词汇和学习终点，让读者在进入 K09–K18 源码细节之前知道自己在解决什么。

## 本单元要解决的总问题

renderer 进程（前端 UI）怎样和主进程通信？IPC 协议怎样组织 148 个通道？preload 怎样在 renderer 和主进程之间建立安全桥梁？12 个桌面服务怎样注册和处理请求？

## 本单元要解决的总问题

renderer 进程（前端 UI）怎样和主进程通信？IPC 协议怎样组织 148 个通道？preload 怎样在 renderer 和主进程之间建立安全桥梁？12 个桌面服务怎样注册和处理请求？

## 主线案例

本单元以"用户在桌面版发起一次 Agent 会话"为主线：

```textn用户点击技能卡片
  → K09: renderer 通过 IPC 发送 AGENT_SESSION_CREATE
  → K10: 主进程收到请求，AgentSessionService 处理会话创建
  → K11: 用户发送消息，AGENT_SESSION_MESSAGE_STREAM 触发流式回复
  → K12: 流式事件通过 IPC 返回 renderer，StreamEventBatcher 合并文本
  → K13: SkillService 处理技能列表和执行
  → K14: ProjectService 处理项目 CRUD 和初始化
  → K15: WorkspaceService 处理文件读写和上传
  → K16: CollaborationService 处理多 Agent 协作
  → K17: preload 和 IPC 协议的安全边界
  → K18: 综合复盘
```

## 本单元不讲什么

- **Electron 主进程生命周期**：放在单元一（K01–K08）。
- **Agent Worker 运行时**：放在单元三（K19–K25）。
- **Pi-Tasks 运行时合同**：放在单元四（K26–K30）。

## 源码覆盖台账

| 文件路径 | 类型 | 本单元状态 | 主讲章节 | 教学责任 |
| --- | --- | --- | --- | --- |
| `packages/desktop/src/main/ipc-protocol.ts` | source | 精读 | K09 | IPC 通道定义：148 个通道，按领域分组 |
| `packages/desktop/src/main/preload.ts` | source | 精读 | K17 | Preload 脚本：contextBridge、ipcRenderer 封装、sanitizeIpcArg |
| `packages/desktop/src/main/services/agent-session-service.ts` | source | 精读 | K10-K12 | Agent 会话服务：创建、获取、更新、删除、消息、流式消息、中止 |
| `packages/desktop/src/main/services/skill-service.ts` | source | 精读 | K13 | 技能服务：列表、内容、执行、流式执行、时间线、进化 |
| `packages/desktop/src/main/services/project-service.ts` | source | 精读 | K14 | 项目服务：CRUD、初始化、同步本体、解决方案管理 |
| `packages/desktop/src/main/services/workspace-service.ts` | source | 精读 | K15 | 工作空间服务：解析、文件列表、读写、删除、上传 |
| `packages/desktop/src/main/services/collaboration-service.ts` | source | 精读 | K16 | 协作服务：拓扑、会话、黑板、人工审核 |
| `packages/desktop/src/main/local-fs.ts` | source | 精读 | K15 | 本地文件系统：读写、列表、删除、监听、路径白名单 |
| `packages/desktop/src/main/local-agent-bridge.ts` | source | 精读 | K10 | Agent 桥接：启动、停止、消息、中止、子进程通信 |

## 章节因果链

| 章节 | 接住的问题 | 新引入的对象 | 留下的未解决问题 |
| --- | --- | --- | --- |
| K09 | — | IPC 协议、148 个通道、领域分组 | renderer 怎样调用这些通道？ |
| K10 | K09 的通道调用 | AgentSessionService、会话生命周期 | 流式消息怎样工作？ |
| K11 | K10 的会话创建 | 流式消息、StreamEventBatcher | 技能怎样被调用？ |
| K12 | K11 的流式消息 | 流式事件合并、首次立即刷新 | 项目怎样被管理？ |
| K13 | K12 的流式处理 | SkillService、技能执行 | 文件怎样被读写？ |
| K14 | K13 的技能执行 | ProjectService、项目 CRUD | 工作空间怎样被管理？ |
| K15 | K14 的项目管理 | WorkspaceService、LocalFileSystem | 多 Agent 怎样协作？ |
| K16 | K15 的文件管理 | CollaborationService、多 Agent 协作 | Preload 怎样建立安全桥梁？ |
| K17 | K16 的协作服务 | preload.ts、contextBridge、安全边界 | 整体怎样串起来？ |
| K18 | K09–K17 全部 | 综合复盘、排查地图、口头验收 | → 单元三 |

## 阅读路径

1. 先读本导读，建立 IPC 协议和桌面服务层的整体认知。
2. 按 K09 → K17 顺序阅读正式课，每节课解决主线案例中的一个新问题。
3. K18 是单元小结课（workshop），把分散知识重新组织成系统能力。
4. 遇到源码细节不确定时，回台账查找对应文件和代码窗口。

## 进入 K09 前必须记住的三个判断

1. **IPC 是 renderer 和主进程的唯一通信方式**：renderer 不能直接访问 Node.js API，必须通过 IPC 调用主进程的服务。
2. **IPC 通道名是字符串常量**：`ipc-protocol.ts` 定义了 148 个通道名，按领域分组。拼写错误会导致通信失败。
3. **桌面服务是 IPC handler 的集合**：每个服务在构造函数中注册自己的 handler，处理特定领域的请求。服务之间不直接通信，通过 Core 的业务逻辑层协作。
