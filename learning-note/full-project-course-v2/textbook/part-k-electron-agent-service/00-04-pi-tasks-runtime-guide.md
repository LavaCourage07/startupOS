# 单元导读四：Pi-Tasks 运行时合同与 Service 层

> 本导读不替代正式课。它先建立问题、词汇和学习终点，让读者在进入 K26–K30 源码细节之前知道自己在解决什么。

## 本单元要解决的总问题

Pi-Tasks 怎样定义和运行任务？`CollaborationService` 怎样处理多 Agent 协作？`WorkspaceService` 怎样处理文件上传和路径安全？

## 本单元要解决的总问题

Pi-Tasks 怎样定义和运行任务？`CollaborationService` 怎样处理多 Agent 协作？`WorkspaceService` 怎样处理文件上传和路径安全？

## 主线案例

本单元以"多 Agent 协作任务执行"为主线：

```textn用户发起协作任务
  → K26: CollaborationService 创建协作会话
  → K27: CollaborationService 获取拓扑和执行会话
  → K28: CollaborationService 发送消息到 Supervisor
  → K29: WorkspaceService 处理文件上传和路径安全
  → K30: 综合复盘
```

## 本单元不讲什么

- **Electron 主进程生命周期**：放在单元一（K01–K08）。
- **IPC 协议和桌面服务层**：放在单元二（K09–K18）。
- **Agent Worker 和运行时适配**：放在单元三（K19–K25）。

## 源码覆盖台账

| 文件路径 | 类型 | 本单元状态 | 主讲章节 | 教学责任 |
| --- | --- | --- | --- | --- |
| `packages/desktop/src/main/services/collaboration-service.ts` | source | 精读 | K26-K28 | 协作服务：拓扑、会话、黑板、人工审核 |
| `packages/desktop/src/main/services/workspace-service.ts` | source | 精读 | K29 | 工作空间服务：解析、文件列表、读写、删除、上传 |

## 章节因果链

| 章节 | 接住的问题 | 新引入的对象 | 留下的未解决问题 |
| --- | --- | --- | --- |
| K26 | — | CollaborationService、动态导入 Facade | 协作会话怎样创建？ |
| K27 | K26 的 Facade | 拓扑获取、会话执行 | 怎样发送消息到 Supervisor？ |
| K28 | K27 的会话执行 | 消息发送、LLM 配置 | 文件怎样上传？ |
| K29 | K28 的消息发送 | WorkspaceService、路径安全 | 整体怎样串起来？ |
| K30 | K26–K29 全部 | 综合复盘、排查地图、口头验收 | — |

## 阅读路径

1. 先读本导读，建立 Pi-Tasks 运行时合同和 Service 层的整体认知。
2. 按 K26 → K29 顺序阅读正式课，每节课解决主线案例中的一个新问题。
3. K30 是单元小结课（workshop），把分散知识重新组织成系统能力。
4. 遇到源码细节不确定时，回台账查找对应文件和代码窗口。

## 进入 K26 前必须记住的三个判断

1. **CollaborationService 使用动态导入**：`getFacade()` 延迟加载 `collaboration-runtime` 模块，避免启动时加载大量代码。
2. **WorkspaceService 使用路径白名单**：`assertAllowed()` 确保只能访问允许的目录，防止路径遍历攻击。
3. **文件上传限制 500MB**：`MAX_UPLOAD_FILE_SIZE` 防止大文件上传导致内存溢出。
