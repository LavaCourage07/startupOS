# 单元导读三：Agent Worker 与运行时适配

> 本导读不替代正式课。它先建立问题、词汇和学习终点，让读者在进入 K19–K25 源码细节之前知道自己在解决什么。

## 本单元要解决的总问题

Agent 怎样在桌面版中运行？`LocalAgentBridge` 怎样启动子进程？Agent Worker 怎样通过 stdio 和主进程通信？`agent-worker-runtime-deps.ts` 怎样确保运行时依赖被正确打包？

## 本单元要解决的总问题

Agent 怎样在桌面版中运行？`LocalAgentBridge` 怎样启动子进程？Agent Worker 怎样通过 stdio 和主进程通信？`agent-worker-runtime-deps.ts` 怎样确保运行时依赖被正确打包？

## 主线案例

本单元以"Agent 在桌面版中的运行生命周期"为主线：

```textn用户点击技能卡片
  → K19: LocalAgentBridge 启动 Agent Worker 子进程
  → K20: Agent Worker 通过 stdio 和主进程通信
  → K21: agent-worker-runtime-deps.ts 确保运行时依赖被正确打包
  → K22: Agent 会话创建和初始化
  → K23: Agent 消息发送和接收
  → K24: Agent 中止和销毁
  → K25: 综合复盘
```

## 本单元不讲什么

- **Electron 主进程生命周期**：放在单元一（K01–K08）。
- **IPC 协议和桌面服务层**：放在单元二（K09–K18）。
- **Pi-Tasks 运行时合同**：放在单元四（K26–K30）。

## 源码覆盖台账

| 文件路径 | 类型 | 本单元状态 | 主讲章节 | 教学责任 |
| --- | --- | --- | --- | --- |
| `packages/desktop/src/main/local-agent-bridge.ts` | source | 精读 | K19-K24 | Agent 桥接：启动、停止、消息、中止、子进程通信 |
| `packages/desktop/src/main/agent-worker-runtime-deps.ts` | source | 精读 | K21 | 运行时依赖：确保 Core 模块被正确打包 |
| `packages/desktop/src/main/services/agent-session-service.ts` | source | 精读 | K22-K24 | Agent 会话服务：创建、消息、中止 |

## 章节因果链

| 章节 | 接住的问题 | 新引入的对象 | 留下的未解决问题 |
| --- | --- | --- | --- |
| K19 | — | LocalAgentBridge、Agent Worker 子进程 | Agent Worker 怎样和主进程通信？ |
| K20 | K19 的子进程启动 | stdio 通信、JSON 协议 | 运行时依赖怎样被正确打包？ |
| K21 | K20 的通信协议 | agent-worker-runtime-deps.ts、动态导入 | Agent 会话怎样创建？ |
| K22 | K21 的依赖打包 | Agent 会话创建、初始化 | Agent 消息怎样发送？ |
| K23 | K22 的会话创建 | Agent 消息发送、接收 | Agent 怎样中止和销毁？ |
| K24 | K23 的消息发送 | Agent 中止、销毁、清理 | 整体怎样串起来？ |
| K25 | K19–K24 全部 | 综合复盘、排查地图、口头验收 | → 单元四 |

## 阅读路径

1. 先读本导读，建立 Agent Worker 和运行时适配的整体认知。
2. 按 K19 → K24 顺序阅读正式课，每节课解决主线案例中的一个新问题。
3. K25 是单元小结课（workshop），把分散知识重新组织成系统能力。
4. 遇到源码细节不确定时，回台账查找对应文件和代码窗口。

## 进入 K19 前必须记住的三个判断

1. **Agent Worker 是子进程**：Agent 在独立的子进程中运行，通过 stdio 和主进程通信。
2. **LocalAgentBridge 管理 Agent 生命周期**：启动、停止、消息发送、中止、销毁。
3. **运行时依赖需要显式导入**：`agent-worker-runtime-deps.ts` 确保 Core 模块被正确打包到桌面版中。
