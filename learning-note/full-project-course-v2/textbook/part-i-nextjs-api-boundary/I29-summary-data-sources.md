# I29：摘要数据的来源和计算方式

上一节课看了统计数据的来源和计算方式。这节课看摘要数据的来源和计算方式。

## 1. 数据来源

摘要数据来自 `agentSessionService.getSessionSummary(sessionId)`。虽然具体实现属于 Part E/F，但我们可以根据接口设计推断其逻辑。

## 2. 可能的摘要字段

| 字段 | 说明 | 计算方式 |
| --- | --- | --- |
| `sessionId` | 会话 ID | 直接返回 |
| `projectId` | 项目 ID | 从 `projectContext` 中提取 |
| `createdAt` | 创建时间 | 直接返回 |
| `updatedAt` | 更新时间 | 直接返回 |
| `messageCount` | 消息数量 | `messages.length` |
| `lastMessage` | 最后一条消息 | `messages[messages.length - 1]` |
| `status` | 会话状态 | 根据运行时状态推断 |

## 3. 计算方式

### 3.1 消息数量

```typescript
const messageCount = session.messages.length;
```

### 3.2 最后一条消息

```typescript
const lastMessage = session.messages[session.messages.length - 1];
```

### 3.3 会话状态

```typescript
let status = 'idle';
if (session.messages.length > 0) {
  const lastMessage = session.messages[session.messages.length - 1];
  if (lastMessage.role === 'user') {
    status = 'waiting_for_response';
  } else if (lastMessage.role === 'assistant') {
    status = 'completed';
  }
}
```

## 4. 与统计数据的对比

| 维度 | 统计数据 | 摘要数据 |
| --- | --- | --- |
| 范围 | 项目级别 | 会话级别 |
| 计算量 | 大（遍历所有会话） | 小（单个会话） |
| 实时性 | 可能滞后 | 实时 |
| 用途 | 监控、调试 | 快速了解会话概况 |

## 5. 失败路径

### 5.1 会话不存在

返回 404。这是最常见的错误。

### 5.2 消息为空

如果会话没有消息，`messageCount` 为 0，`lastMessage` 为 undefined。

## 6. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| `curl` 调用 summary | 能返回摘要数据 | 数据一定正确 |
| 代码阅读 | 逻辑清晰 | 所有分支都处理 |
| 运行观察 | 能返回结果 | 空会话处理正确 |

## 7. 小实验

不运行项目，回答：

1. 为什么摘要查询比统计查询快？
2. 如果会话没有消息，摘要会返回什么？
3. 摘要数据和统计数据有什么本质区别？

参考答案：

1. 摘要查询只需要查询单个会话，统计查询需要遍历所有会话。
2. `messageCount` 为 0，`lastMessage` 为 undefined 或 null。
3. 摘要数据是单个会话的概览，统计数据是项目的聚合数据。

## 8. 章节收束

本节课深入摘要数据的来源和计算方式：消息数量、最后一条消息、会话状态。摘要查询比统计查询快，因为只需要查询单个会话。

下一节课会看统计和摘要接口的用途和限制。
