# I16：POST /api/agent/abort：如何中断正在进行的操作

前四节课追踪了消息从发送到 SSE 流式响应的完整链路。这节课看一个特殊的接口：`POST /api/agent/abort`，用于中断正在进行的 Agent 操作。当小林点击"停止"按钮时，浏览器会调用这个接口。

## 1. 请求体包含什么

典型的请求体：

```json
{
  "agentId": "project-p1"
}
```

`agentId` 的格式：

- Project Agent: `"project-{projectId}"`
- Skill Agent: `"project-{skillId}"` 或直接用 `skillId`

## 2. Route Handler 的实现

打开 `app/api/agent/abort/route.ts`（第 21–109 行）：

```ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const agentId: string = body?.agentId;

    if (!agentId) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'agentId is required' },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (USE_RUNTIME_MODE) {
      // 1. 直接通过 agentId 从 spawner 查找
      const spawner = getGlobalSpawner();
      const proc = spawner.get(agentId);
      if (proc) {
        await proc.abort();
        console.log(`[API] Aborted agent via spawner: ${agentId}`);
      } else {
        // 2. 尝试从 registry 查找（projectId 映射）
        const projectId = agentId.replace(/^project-/, '');
        const registered = getRuntimeAgent(projectId);
        if (registered?.process) {
          await registered.process.abort();
          console.log(`[API] Aborted agent via registry: ${agentId}`);
        } else {
          // 3. 兜底：遍历所有运行中的 spawner 进程，匹配 projectId
          const allProcs = spawner.list();
          const match = allProcs.find(p => p.id === agentId || p.id.endsWith(agentId));
          if (match) {
            await match.abort();
            console.log(`[API] Aborted agent via spawner scan: ${agentId}`);
          } else {
            console.log(`[API] Agent not found for abort: ${agentId}, treating as already stopped`);
          }
        }
      }
    } else {
      // In-process 模式
      const agent = persistentAgentManager.getAgent(agentId);
      if (agent) {
        const innerAgent = agent.getAgent();
        if (innerAgent) {
          innerAgent.abort();
          // 等待 agent 变为空闲状态（最多 5 秒）
          try {
            await Promise.race([
              innerAgent.waitForIdle(),
              new Promise(resolve => setTimeout(resolve, 5000)),
            ]);
          } catch {
            // ignore timeout
          }
          console.log(`[API] Aborted in-process agent: ${agentId}`);
        }
      } else {
        console.log(`[API] In-process agent not found: ${agentId}`);
      }
    }

    return NextResponse.json<ApiResponse<null>>(
      {
        success: true,
        data: null,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    // ... 500 处理
  }
}
```

## 3. 三层兜底策略

Abort 路由和 Destroy 路由类似，都有三层兜底策略：

```mermaid
flowchart TD
    A[Abort 请求] --> B{USE_RUNTIME_MODE?}
    B -->|是| C[Runtime 模式]
    B -->|否| D[In-process 模式]
    C --> E[第一层：spawner.get(agentId)]
    E -->|未找到| F[第二层：getRuntimeAgent(projectId)]
    F -->|未找到| G[第三层：spawner.list() 遍历匹配]
    D --> H[persistentAgentManager.getAgent(agentId)]
    H -->|未找到| I[返回 200]
```

### 3.1 Runtime 模式的三层兜底

| 层数 | 查找方式 | 适用场景 |
| --- | --- | --- |
| 第一层 | `spawner.get(agentId)` | agentId 就是子进程 ID |
| 第二层 | `getRuntimeAgent(projectId)` | agentId 是 `project-{id}` 格式 |
| 第三层 | `spawner.list()` 遍历 | agentId 是子进程 ID 的后缀 |

### 3.2 In-process 模式的处理

In-process 模式相对简单：

1. `persistentAgentManager.getAgent(agentId)` 获取 Agent 实例。
2. `agent.getAgent()` 获取内部 Agent。
3. `innerAgent.abort()` 发送中断信号。
4. `waitForIdle()` 等待 Agent 变为空闲状态（最多 5 秒）。

## 4. Abort 与 Destroy 的区别

| 维度 | Abort | Destroy |
| --- | --- | --- |
| HTTP 路径 | `POST /api/agent/abort` | `POST /sessions/{id}/destroy` |
| 作用对象 | 正在进行的 LLM 调用 | Agent 运行时实例 |
| 数据影响 | 无 | 无 |
| 运行时影响 | 中断当前操作 | 销毁整个实例 |
| 典型调用场景 | 用户点击"停止" | 窗口关闭 |
| 能否恢复 | 能（实例仍在） | 不能（实例已销毁） |

## 5. 失败路径

### 5.1 Agent 未找到

如果三层兜底都未找到 Agent，路由仍然返回 200。这是因为"Agent 未找到"可能意味着 Agent 已经被中断或从未启动，这不是一个错误状态。

### 5.2 Abort 后实例仍在运行

`abort()` 只是发送中断信号，Agent 可能不会立即停止。特别是如果 LLM 调用已经发出，可能需要等待响应返回后才能中断。

### 5.3 In-process 模式等待超时

`waitForIdle()` 最多等待 5 秒。如果 Agent 在 5 秒内没有变为空闲状态，超时会被忽略，但 Agent 可能仍在运行。

## 6. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| `curl` 调用 abort | 能返回 200 | Agent 一定被中断 |
| 运行观察 | 能看到 abort 日志 | LLM 调用一定停止 |
| 代码阅读 | 三层兜底逻辑清晰 | 所有场景都覆盖 |

## 7. 小实验

不运行项目，回答：

1. 为什么 Abort 路由在 Agent 未找到时仍然返回 200，而不是 404？
2. `abort()` 和 `destroy()` 有什么区别？
3. In-process 模式下，为什么需要 `waitForIdle()`？

参考答案：

1. "Agent 未找到"可能意味着 Agent 已经被中断或从未启动，这不是一个错误状态。返回 200 表示"abort 操作已完成"（无论是否实际中断）。
2. `abort()` 中断当前操作，实例仍在。`destroy()` 销毁实例，实例不再可用。
3. `waitForIdle()` 确保 Agent 在中断信号发送后有时间清理状态。如果立即返回，Agent 可能仍在处理中。

## 8. 章节收束

本节课看了 `POST /api/agent/abort` 的实现：通过三层兜底策略找到 Agent 并发送中断信号。Abort 和 Destroy 的区别在于：Abort 中断当前操作（实例保留），Destroy 销毁实例（操作自然停止）。

下一节课是 Unit 3 的总结工作坊，会把 I12–I16 的知识整合成一张排查地图。
