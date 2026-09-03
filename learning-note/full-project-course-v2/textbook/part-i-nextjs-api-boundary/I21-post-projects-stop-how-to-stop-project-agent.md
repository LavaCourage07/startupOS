# I21：POST /api/agent/projects/{projectId}/stop：如何停止项目级 Agent

上一节课看了项目级 Agent 的状态查询。这节课看停止：`POST /api/agent/projects/{projectId}/stop`。当小林关闭项目窗口或点击"停止"时，浏览器会调用这个接口。

## 1. 请求体包含什么

典型的请求体：

```json
{
  "sessionId": "project-p1"
}
```

`sessionId` 默认为 `"project-{projectId}"`。

## 2. Route Handler 的实现

打开 `app/api/agent/projects/[projectId]/stop/route.ts`（第 14–74 行）：

```ts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const sessionId: string = body?.sessionId ?? `project-${projectId}`;

    console.log(`[API] Stopping agent for project: ${projectId}`);

    // Runtime 模式：通过 spawner 的 destroy 保证子进程被彻底清理
    const agentId = sessionId;
    const spawner = getGlobalSpawner();
    const existing = spawner.get(agentId);
    if (existing) {
      console.log(`[API] Runtime mode: Destroying subprocess for project ${projectId}`);
      await spawner.destroy(agentId);
      console.log(`[API] Runtime mode: subprocess destroyed for ${projectId}`);
      // 也从注册表移除
      removeRuntimeAgent(projectId);
      return NextResponse.json<ApiResponse<{ projectId: string }>>(
        { success: true, data: { projectId }, timestamp: new Date().toISOString() },
        { status: 200 }
      );
    }
    // 注册表中可能有残留
    const runtimeEntry = getRuntimeAgent(projectId);
    if (runtimeEntry) {
      console.log(`[API] Runtime mode: Stopping subprocess from registry for project ${projectId}`);
      await runtimeEntry.process.shutdown();
      removeRuntimeAgent(projectId);
      return NextResponse.json<ApiResponse<{ projectId: string }>>(
        { success: true, data: { projectId }, timestamp: new Date().toISOString() },
        { status: 200 }
      );
    }

    // In-process 模式：停止持久化 Agent
    await persistentAgentManager.stopAgent(projectId);

    return NextResponse.json<ApiResponse<{ projectId: string }>>(
      { success: true, data: { projectId }, timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error) {
    // ... 500 处理
  }
}
```

## 3. Runtime 模式的停止逻辑

### 3.1 两层兜底

| 层数 | 查找方式 | 适用场景 |
| --- | --- | --- |
| 第一层 | `spawner.get(agentId)` | agentId 就是子进程 ID |
| 第二层 | `getRuntimeAgent(projectId)` | 注册表中有残留 |

### 3.2 清理步骤

```mermaid
flowchart TD
    A[POST /projects/{id}/stop] --> B{Runtime 模式?}
    B -->|是| C[spawner.get(agentId)]
    C -->|找到| D[spawner.destroy(agentId)]
    D --> E[removeRuntimeAgent(projectId)]
    C -->|未找到| F[getRuntimeAgent(projectId)]
    F -->|找到| G[process.shutdown]
    G --> E
    F -->|未找到| H[返回 200]
    B -->|否| I[persistentAgentManager.stopAgent(projectId)]
```

关键点：

1. **`spawner.destroy`**：销毁子进程。
2. **`removeRuntimeAgent`**：从全局注册表移除引用。
3. **`process.shutdown`**：如果注册表中有残留，调用 shutdown。

## 4. In-process 模式的停止逻辑

In-process 模式相对简单：

```ts
await persistentAgentManager.stopAgent(projectId);
```

`persistentAgentManager.stopAgent` 的职责：

1. 找到 Agent 实例。
2. 停止 Agent 的运行时。
3. 清理资源。

具体实现属于 Part E/F。

## 5. Stop 与 Destroy 的对比

| 维度 | Stop | Destroy |
| --- | --- | --- |
| HTTP 路径 | `/api/agent/projects/{id}/stop` | `/api/agent/sessions/{id}/destroy` |
| 作用对象 | 项目级 Agent | 会话级 Agent |
| 数据影响 | 无 | 无 |
| 运行时影响 | 停止实例 | 销毁实例 |
| 能否恢复 | 能（重新 start） | 能（重新创建会话） |
| 典型场景 | 项目窗口关闭 | 会话窗口关闭 |

## 6. 失败路径

### 6.1 子进程已不存在

如果 `spawner.get(agentId)` 返回 undefined，但注册表中仍有残留，会走第二层兜底。如果两层都未找到，返回 200（不是错误，因为目标已经达成）。

### 6.2 注册表残留

如果 `spawner.destroy` 成功但 `removeRuntimeAgent` 失败，注册表中会残留引用。这会导致后续查询状态时出现不一致。

### 6.3 In-process 模式未停止

如果 `persistentAgentManager.stopAgent` 失败，Agent 实例可能仍在运行。但 Route Handler 已经返回 200，客户端可能误以为已经停止。

## 7. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| `curl` 调用 stop | 能返回 200 | 子进程一定被停止 |
| 检查 globalThis.__runtimeAgents | 注册表被清理 | 子进程资源一定释放 |
| 运行观察 | 日志显示 destroy | 所有错误分支都处理 |

## 8. 小实验

不运行项目，回答：

1. 为什么 Stop 路由有两层兜底，而 Destroy 路由有三层？
2. 如果 `spawner.destroy` 成功但 `removeRuntimeAgent` 失败，会有什么后果？
3. Stop 和 Abort 有什么区别？

参考答案：

1. Stop 路由只处理项目级 Agent，场景更简单。Destroy 路由需要处理会话级和项目级，场景更复杂。
2. 注册表中会残留引用，后续查询状态时可能返回"运行中"，但实际上子进程已不存在。
3. Stop 停止实例（保留实例，可重新启动）。Abort 中断当前操作（实例仍在运行）。

## 9. 章节收束

本节课看了 `POST /api/agent/projects/{projectId}/stop` 的实现：两层兜底、子进程销毁、注册表清理。Stop 和 Destroy 的区别在于作用对象和层级。

下一节课会看项目级 Agent 的中断：`POST /api/agent/projects/{projectId}/abort`。
