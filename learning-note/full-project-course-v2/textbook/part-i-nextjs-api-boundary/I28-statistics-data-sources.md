# I28：统计数据的来源和计算方式

前两节课看了统计查询和摘要查询的 Route Handler。这节课深入统计数据的来源和计算方式。

## 1. 数据来源

统计数据来自 `agentSessionService.getProjectStatistics(projectId)`。虽然具体实现属于 Part E/F，但我们可以根据接口设计推断其逻辑。

## 2. 可能的统计字段

| 字段 | 说明 | 计算方式 |
| --- | --- | --- |
| `sessionCount` | 会话数量 | 统计项目下的会话数 |
| `messageCount` | 消息数量 | 统计所有会话的消息总数 |
| `toolCallCount` | 工具调用次数 | 统计消息中的工具调用次数 |
| `averageResponseTime` | 平均响应时间 | 计算消息发送和回复的时间差 |
| `lastActivity` | 最后活动时间 | 取最后一条消息的时间 |

## 3. 计算方式

### 3.1 会话数量

```typescript
const sessions = await agentSessionService.listSessions(projectId);
const sessionCount = sessions.length;
```

### 3.2 消息数量

```typescript
let messageCount = 0;
for (const session of sessions) {
  messageCount += session.messages.length;
}
```

### 3.3 工具调用次数

```typescript
let toolCallCount = 0;
for (const session of sessions) {
  for (const message of session.messages) {
    if (message.toolResults) {
      toolCallCount += message.toolResults.length;
    }
  }
}
```

### 3.4 平均响应时间

```typescript
let totalResponseTime = 0;
let responseCount = 0;
for (const session of sessions) {
  for (let i = 1; i < session.messages.length; i++) {
    const prev = session.messages[i - 1];
    const curr = session.messages[i];
    if (prev.role === 'user' && curr.role === 'assistant') {
      const diff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
      totalResponseTime += diff;
      responseCount++;
    }
  }
}
const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;
```

## 4. 性能考虑

统计查询可能涉及大量数据，需要考虑性能：

1. **缓存**：统计结果可以缓存，避免重复计算。
2. **分页**：如果会话数量很多，需要分页查询。
3. **异步计算**：统计可以在后台异步计算，前端轮询结果。

## 5. 失败路径

### 5.1 数据量大

如果项目下有大量会话，统计查询可能很慢。当前实现没有分页或缓存。

### 5.2 数据不一致

如果会话数据在统计过程中被修改，结果可能不一致。当前实现没有事务保护。

## 6. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| `curl` 调用 statistics | 能返回统计数据 | 数据一定正确 |
| 代码阅读 | 逻辑清晰 | 性能一定满足 |
| 运行观察 | 能返回结果 | 大数据量下性能 |

## 7. 小实验

不运行项目，回答：

1. 为什么统计查询可能比摘要查询慢？
2. 如果项目下有 1000 个会话，每个会话有 100 条消息，统计查询需要遍历多少条消息？
3. 如何优化统计查询的性能？

参考答案：

1. 统计查询需要遍历所有会话和消息，计算量大。摘要查询只需要查询单个会话。
2. 1000 * 100 = 100,000 条消息。
3. 缓存、分页、异步计算、索引。

## 8. 章节收束

本节课深入统计数据的来源和计算方式：会话数量、消息数量、工具调用次数、平均响应时间。统计查询可能涉及大量数据，需要考虑性能优化。

下一节课会看摘要数据的来源和计算方式。
