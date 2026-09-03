# I22：POST /api/agent/projects/{projectId}/abort：如何中断项目级 Agent

上一节课看了项目级 Agent 的停止。这节课看中断：`POST /api/agent/projects/{projectId}/abort`。当小林点击"停止"按钮时，浏览器会调用这个接口。Abort 和 Stop 的区别在于：Abort 中断当前操作，实例保留；Stop 停止实例，实例不再可用。

## 1. 请求体包含什么

典型的请求体：

```json
{
  "sessionId": "project-p1"
}
```

`sessionId` 默认为 `"project-{projectId}"`。

## 2. Route Handler 的实现

打开 `app/api/agent/projects/[projectId]/abort/route.ts`（第 17–100 行）：

```ts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const sessionId: string = body?.sessionId ?? `project-${projectId}`;

    if (USE_RUNTIME_MODE) {
      // Runtime 模式：通过子进程 abort
      const agentId = sessionId;
      const spawner = getGlobalSpawner();
      const proc = spawner.get(agentId);
      if (proc) {
        await proc.abort();
        console.log(`[API] Aborted agent via spawner for project: ${projectId}`);
      } else {
        // 也检查注册表
        const registered = getRuntimeAgent(projectId);
        if (registered?.process) {
          await registered.process.abort();
          console.log(`[API] Aborted agent via registry for project: ${projectId}`);
        } else {
          // Agent 不在 spawner 或 registry 中，说明已经被清理或从未启动
          // 视为成功，避免前端报错
          console.log(`[API] Agent not found in spawner/registry for project: ${projectId}, treating as already stopped`);
        }
      }
    } else {
      // In-process 模式
      const agent = persistentAgentManager.getAgent(projectId);
      if (!agent) {
        return NextResponse.json<ApiResponse<unknown>>(
          {
            success: false,
            error: { code: 'AGENT_NOT_RUNNING', message: 'No agent running for this project' },
            timestamp: new Date().toISOString(),
          },
          { status: 404 }
        );
      }

      const innerAgent = agent.getAgent();
      if (!innerAgent) {
        return NextResponse.json<ApiResponse<unknown>>(
          {
            success: false,
            error: { code: 'AGENT_NOT_AVAILABLE', message: 'Agent instance not available' },
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        );
      }

      innerAgent.abort();
    }

    console.log(`[API] Aborted agent for project: ${projectId}`);

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

## 3. Runtime 模式的中断逻辑

### 3.1 两层兜底

| 层数 | 查找方式 | 适用场景 |
| --- | --- | --- |
| 第一层 | `spawner.get(agentId)` | agentId 就是子进程 ID |
| 第二层 | `getRuntimeAgent(projectId)` | 注册表中有残留 |

### 3.2 与会话级 Abort 的对比

| 维度 | 项目级 Abort | 会话级 Abort |
| --- | --- | --- |
| HTTP 路径 | `/api/agent/projects/{id}/abort` | `/api/agent/abort` |
| 查找方式 | `spawner.get` + `getRuntimeAgent` | `spawner.get` + `getRuntimeAgent` + `spawner.list` |
| 返回 404 | In-process 模式下返回 | 不返回，始终返回 200 |
| 典型场景 | 项目窗口点击停止 | 通用中断 |

项目级 Abort 比会话级 Abort 少了一层兜底（没有 `spawner.list`），因为项目级 Agent 的 ID 更规范（`project-{id}`）。

## 4. In-process 模式的中断逻辑

In-process 模式相对复杂：

1. `persistentAgentManager.getAgent(projectId)` 获取 Agent 实例。
2. 如果未找到，返回 404。
3. `agent.getAgent()` 获取内部 Agent。
4. 如果未找到，返回 500。
5. `innerAgent.abort()` 发送中断信号。

与会话级 Abort 的区别：

| 维度 | 项目级 Abort | 会话级 Abort |
| --- | --- | --- |
| 管理器 | `persistentAgentManager` | `persistentAgentManager` |
| 等待空闲 | 否 | 是（最多 5 秒） |
| 返回 404 | 是 | 否 |

## 5. Abort 与 Stop 的对比

| 维度 | Abort | Stop |
| --- | --- | --- |
| HTTP 路径 | `/api/agent/projects/{id}/abort` | `/api/agent/projects/{id}/stop` |
| 作用对象 | 当前操作 | 实例本身 |
| 实例保留 | 是 | 否 |
| 能否继续发消息 | 能 | 不能（需要重新 start） |
| 典型场景 | 用户点击停止 | 项目窗口关闭 |

## 6. 失败路径

### 6.1 子进程已不存在

Runtime 模式下，如果两层兜底都未找到子进程，视为成功（已经停止）。In-process 模式下，返回 404。

### 6.2 中断后操作仍在继续

`abort()` 只是发送中断信号，Agent 可能不会立即停止。特别是如果 LLM 调用已经发出，可能需要等待响应返回后才能中断。

### 6.3 In-process 模式下实例不可用

如果 `agent.getAgent()` 返回 undefined，返回 500。这通常意味着内部状态不一致。

## 7. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| `curl` 调用 abort | 能返回 200 | Agent 一定被中断 |
| 运行观察 | 能看到 abort 日志 | LLM 调用一定停止 |
| 代码阅读 | 两层兜底逻辑清晰 | 所有错误分支都处理 |

## 8. 小实验

不运行项目，回答：

1. 为什么项目级 Abort 比会话级 Abort 少了一层兜底？
2. Abort 后能否继续发送消息？为什么？
3. In-process 模式下，为什么 `agent.getAgent()` 可能返回 undefined？

参考答案：

1. 项目级 Agent 的 ID 更规范（`project-{id}`），不需要模糊匹配。
2. 能。Abort 只中断当前操作，实例仍在运行。
3. 可能 Agent 实例已创建但内部 Agent 未初始化完成，或内部状态不一致。

## 9. 章节收束

本节课看了 `POST /api/agent/projects/{projectId}/abort` 的实现：两层兜底、中断信号、实例保留。Abort 和 Stop 的区别在于：Abort 中断当前操作（实例保留），Stop 停止实例（实例不再可用）。

下一节课会看项目级 Agent 的 Runtime 模式消息发送：`sendRuntimeMessage` 和 `createRuntimeEventStream` 的项目级版本。
