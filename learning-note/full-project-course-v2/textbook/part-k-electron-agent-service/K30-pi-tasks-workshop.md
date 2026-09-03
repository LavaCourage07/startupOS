# K30 · Pi-Tasks 运行时合同与 Service 层综合工作坊

> **课号** K30 · **轨道** T13 · **类型** 单元小结课（workshop） · **预计阅读** 35 分钟

---

## 本课要回答的问题

K26–K29 分别讲了 CollaborationService 动态 Facade、拓扑获取、会话执行、消息发送和 WorkspaceService 文件上传。但这些知识是分散的。当用户报告"协作任务失败"或"文件上传失败"时，怎样从整体视角定位问题？

## 主线复盘

### 多 Agent 协作任务执行完整链路

```text
用户发起协作任务
  │
  ├─ K26: CollaborationService 创建会话
  │   ├─ getFacade() 动态导入
  │   ├─ createSession()
  │   └─ 返回会话信息
  │
  ├─ K27: 获取拓扑和执行会话
  │   ├─ loadProjectTopology()
  │   ├─ executeSession()
  │   └─ getBlackboardState()
  │
  ├─ K28: 发送消息到 Supervisor
  │   ├─ sendMessageToSupervisor()
  │   ├─ persistRuntimeLLMConfig()
  │   └─ 返回结果
  │
  └─ K29: WorkspaceService 处理文件上传
      ├─ assertAllowed() 路径白名单
      ├─ decodeUploadContent() 解码内容
      └─ 写入文件
```

## 系统能力地图

### 能力一：多 Agent 协作

| 能力 | 关键文件 | 核心机制 |
| --- | --- | --- |
| 动态导入 | `collaboration-service.ts` | `getFacade()` |
| 会话创建 | `collaboration-service.ts` | `createSession()` |
| 拓扑获取 | `collaboration-service.ts` | `loadProjectTopology()` |
| 会话执行 | `collaboration-service.ts` | `executeSession()` |
| 消息发送 | `collaboration-service.ts` | `sendMessageToSupervisor()` |
| 事件转发 | `collaboration-service.ts` | `addElectronForwarder()` |

### 能力二：文件管理

| 能力 | 关键文件 | 核心机制 |
| --- | --- | --- |
| 路径白名单 | `workspace-service.ts` | `assertAllowed()` |
| 文件上传 | `workspace-service.ts` | `decodeUploadContent()`、500MB 限制 |
| 路径解析 | `workspace-service.ts` | `resolveProjectDir()` |

## 排查地图

### 故障 1：协作任务失败

**可能原因：**

1. **Facade 加载失败**：`getFacade()` 抛出异常。
2. **会话创建失败**：参数无效或 LLM 配置错误。
3. **拓扑不存在**：项目没有拓扑数据。
4. **执行失败**：会话执行过程中出错。

**排查步骤：**

1. 检查 `collaboration-service.ts` 的日志。
2. 检查 `getFacade()` 是否成功。
3. 检查 `createSession()` 的返回值。
4. 检查 `loadProjectTopology()` 的返回值。

### 故障 2：文件上传失败

**可能原因：**

1. **路径不在白名单**：`assertAllowed()` 抛出 `FORBIDDEN` 错误。
2. **文件超过 500MB**：`MAX_UPLOAD_FILE_SIZE` 限制。
3. **解码失败**：`decodeUploadContent()` 抛出异常。

**排查步骤：**

1. 检查请求路径是否在白名单内。
2. 检查文件大小是否超过 500MB。
3. 检查文件内容格式是否正确。

### 故障 3：消息发送失败

**可能原因：**

1. **参数缺失**：`sessionId` 或 `message` 缺失。
2. **Supervisor 未响应**：`sendMessageToSupervisor()` 超时。
3. **LLM 配置错误**：`persistRuntimeLLMConfig()` 失败。

**排查步骤：**

1. 检查请求参数。
2. 检查 `sendMessageToSupervisor()` 的返回值。
3. 检查 LLM 配置。

## 综合练习

### 练习 1：场景分析

用户报告："我发起协作任务后，没有任何反应。"

根据排查地图，列出可能的原因和排查步骤。

<details>
<summary>参考答案</summary>

**可能原因：**

1. Facade 加载失败。
2. 会话创建失败。
3. 拓扑不存在。

**排查步骤：**

1. 检查 `collaboration-service.ts` 的日志。
2. 检查 `getFacade()` 是否成功。
3. 检查 `createSession()` 的返回值。

</details>

### 练习 2：设计决策

回答以下问题：

1. 为什么 `CollaborationService` 使用动态导入？
2. 为什么 `WorkspaceService` 使用路径白名单？
3. 为什么文件上传限制 500MB？

<details>
<summary>参考答案</summary>

1. `collaboration-runtime` 是重量级模块，动态导入延迟加载，减少启动时间。

2. 防止路径遍历攻击，确保只能访问允许的目录。

3. 防止大文件上传导致内存溢出或磁盘空间不足。

</details>

## 口头验收

完成本课后，你应该能用 90 秒口头描述整个多 Agent 协作任务执行链路：

> "用户发起协作任务后，`CollaborationService` 的 `getFacade()` 动态导入 `collaboration-runtime` 模块。`createSession()` 创建会话，`loadProjectTopology()` 获取拓扑，`executeSession()` 执行会话。`sendMessageToSupervisor()` 发送消息到 Supervisor，`persistRuntimeLLMConfig()` 持久化 LLM 配置。`WorkspaceService` 的 `assertAllowed()` 检查路径白名单，`decodeUploadContent()` 解码上传内容，限制 500MB。事件通过 `addElectronForwarder()` 转发到所有窗口。"

## Part K 完成

恭喜完成 Part K 的学习。你已经掌握了 Electron、Agent 和 Service 的完整知识，包括：

- **单元一**：Electron 主进程生命周期（K01–K08）
- **单元二**：IPC 协议与桌面服务层（K09–K18）
- **单元三**：Agent Worker 与运行时适配（K19–K25）
- **单元四**：Pi-Tasks 运行时合同与 Service 层（K26–K30）

你已经了解了：

- Electron 主进程的启动、路径解析、窗口管理、系统插件、日志系统、流式批处理和进程健康监控
- IPC 协议的 148 个通道、Agent 会话生命周期、流式消息、StreamEventBatcher、SkillService、ProjectService、WorkspaceService、CollaborationService 和 Preload 脚本
- Agent Worker 的启动、通信、运行时依赖、会话创建、消息处理和中止销毁
- Pi-Tasks 的动态 Facade、拓扑获取、会话执行、消息发送和文件上传

下一步是 Part L：部署与运维。
