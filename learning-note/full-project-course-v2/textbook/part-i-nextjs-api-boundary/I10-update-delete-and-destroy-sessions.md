# I10：更新、删除与销毁：三种修改会话的方式

上一节课看了读取接口。这节课看三个修改接口：`PUT` 更新会话、`DELETE` 删除会话数据、`POST /destroy` 销毁运行时实例。它们的名字相似，但语义完全不同，是 Agent 会话管理中最容易混淆的三个操作。

## 1. 更新：PUT /api/agent/sessions/{sessionId}

打开 `app/api/agent/sessions/[sessionId]/route.ts` 的 PUT 处理函数（第 107–157 行）：

```ts
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await _request.json();

    const { searchParams } = new URL(_request.url);
    const projectId = searchParams.get('projectId') || undefined;

    const session = await agentSessionService.updateSession(sessionId, body, projectId);

    if (!session) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: session,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    // ... 500 处理
  }
}
```

PUT 的核心逻辑：

1. **接收任意 body**：`updateSession` 接收整个 body，由 Core Service 决定哪些字段可以更新。
2. **可选 projectId**：用于多项目场景下的会话定位。
3. **404 处理**：如果会话不存在，返回 404 而不是创建新会话。PUT 不应该是"创建或更新"，而是"更新或失败"。

注意这里没有字段校验。`agentSessionService.updateSession` 内部决定哪些字段可更新、哪些忽略。

## 2. 删除：DELETE /api/agent/sessions/{sessionId}

同一个文件的 DELETE 处理函数（第 163–208 行）：

```ts
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;

    const deleted = await agentSessionService.deleteSession(sessionId);

    if (!deleted) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<{ deleted: true }>>(
      {
        success: true,
        data: { deleted: true },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    // ... 500 处理
  }
}
```

DELETE 的核心语义：

1. **删除的是数据，不是运行时**：`agentSessionService.deleteSession` 删除的是 `session.json` 文件，不会停止正在运行的 Agent。
2. **返回 `{ deleted: true }`**：明确告知客户端数据已被删除。
3. **幂等性**：重复删除同一个 sessionId，第一次返回 `{ deleted: true }`，第二次返回 404。这是幂等的。

## 3. 销毁：POST /api/agent/sessions/{sessionId}/destroy 和 POST /api/agent/sessions/destroy

有两个 destroy 路由：

| 路由 | 参数 | 典型调用场景 |
| --- | --- | --- |
| `POST /sessions/{sessionId}/destroy` | URL 中的 `sessionId` | 窗口关闭时，知道具体会话 ID |
| `POST /sessions/destroy` | Body 中的 `sessionId` 或 `projectId` | 通用销毁，可能不知道具体 ID |

### 3.1 带 sessionId 的 destroy

打开 `app/api/agent/sessions/[sessionId]/destroy/route.ts`（第 17–109 行）：

```ts
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;

    console.log('[API /destroy/[sessionId]] Destroying session:', sessionId, 'runtimeMode:', USE_RUNTIME_MODE);

    if (USE_RUNTIME_MODE) {
      // Runtime 模式：通过全局 spawner 清理子进程
      const spawner = getGlobalSpawner();

      // 1. 直接通过 sessionId 查找
      const proc = spawner.get(sessionId);
      if (proc) {
        await spawner.destroy(sessionId);
        return successResponse(sessionId, true);
      }

      // 2. 兜底：遍历所有进程模糊匹配
      const allProcs = spawner.list();
      for (const p of allProcs) {
        if (p.id.includes(sessionId)) {
          await spawner.destroy(p.id);
          return successResponse(sessionId, true);
        }
      }

      // 3. 通过 session DB 查找
      const session = await agentSessionService.getSession(sessionId);
      if (session?.projectContext?.projectId) {
        const projId = session.projectContext.projectId;
        const sessions = await agentSessionService.listSessions(projId);
        if (sessions.length > 0) {
          const latestUuid = sessions[0]!.sessionId;
          const proc = spawner.get(latestUuid);
          if (proc) {
            await spawner.destroy(latestUuid);
            return successResponse(sessionId, true);
          }
        }
      }

      return successResponse(sessionId, false);
    }

    // In-process 模式
    let removed = await agentManager.finalizeAndRemoveAgent(sessionId);
    // ... 兜底逻辑
    return successResponse(sessionId, removed);
  } catch (error) {
    // ... 500 处理
  }
}
```

### 3.2 不带 sessionId 的 destroy

打开 `app/api/agent/sessions/destroy/route.ts`（第 21–121 行）：

```ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId: string | undefined = body?.sessionId;
    const projectId: string | undefined = body?.projectId;

    // Runtime 模式
    if (USE_RUNTIME_MODE) {
      const spawner = getGlobalSpawner();

      // 1. 优先用 sessionId 直接查找
      if (sessionId) {
        const proc = spawner.get(sessionId);
        if (proc) {
          await spawner.destroy(sessionId);
          return successResponse(sessionId, true);
        }
      }

      // 2. 通过 session DB 查找真实 UUID
      if (sessionId && projectId) {
        const sessions = await agentSessionService.listSessions(projectId);
        if (sessions.length > 0) {
          const latestUuid = sessions[0]!.sessionId;
          const proc = spawner.get(latestUuid);
          if (proc) {
            await spawner.destroy(latestUuid);
            return successResponse(latestUuid, true);
          }
        }
      }

      // 3. 兜底：遍历所有进程模糊匹配
      const allProcs = spawner.list();
      const searchKey = sessionId || projectId;
      for (const proc of allProcs) {
        if (searchKey && proc.id.includes(searchKey)) {
          await spawner.destroy(proc.id);
          return successResponse(proc.id, true);
        }
      }

      return successResponse(sessionId ?? projectId ?? 'unknown', false);
    }

    // In-process 模式
    // ...
  } catch (error) {
    // ...
  }
}
```

## 4. 三种修改操作的对比

```mermaid
flowchart LR
    A[修改会话] --> B[PUT /sessions/{id}]
    A --> C[DELETE /sessions/{id}]
    A --> D[POST /sessions/{id}/destroy]
    B --> E[更新 session.json 字段]
    C --> F[删除 session.json 文件]
    D --> G[停止 Agent 运行时/子进程]
```

| 操作 | HTTP 方法 | 修改对象 | 持久化数据 | 运行时实例 |
| --- | --- | --- | --- | --- |
| **更新** | PUT | 会话字段 | 保留并更新 | 不受影响 |
| **删除** | DELETE | 会话文件 | **删除** | 不受影响（可能残留） |
| **销毁** | POST | 运行时实例 | 保留 | **停止/销毁** |

## 5. 销毁的三层兜底策略

Destroy 路由的核心挑战是：**如何找到要销毁的实例**。因为 sessionId 可能不是 UUID（如技能名），而 runtime 子进程用的是 UUID。

三层兜底策略：

```text
第一层：直接查找
  → spawner.get(sessionId)
  → 如果 sessionId 就是 UUID，直接命中

第二层：Session DB 反向查找
  → agentSessionService.getSession(sessionId)
  → 拿到 projectId → listSessions(projectId)
  → 找到最新的 UUID → spawner.get(latestUuid)

第三层：模糊匹配
  → spawner.list()
  → 遍历所有进程，检查 proc.id.includes(sessionId || projectId)
  → 匹配到就销毁
```

这种设计的原因是：不同入口（skill、project、agent）使用的 sessionId 命名规则不同。Skill 可能用 `skill-{name}`，而 runtime 用 UUID。三层兜底确保各种场景都能清理。

## 6. 失败路径

### 6.1 删除后运行时仍在运行

DELETE 只删除数据，不碰运行时。如果客户端先 DELETE 再尝试用同一个 sessionId 创建新会话，可能会因为旧运行时仍在运行而冲突。

### 6.2 销毁时找不到实例

三层兜底都失败后，destroy 返回 `{ agentDestroyed: false }`。这不一定代表错误——可能实例已经被销毁了。但客户端可能误以为还有残留。

### 6.3 Runtime 模式 vs In-process 模式混淆

如果环境变量 `USE_COLLABORATION_RUNTIME` 配置错误，destroy 可能走错了分支。例如，实际在 runtime 模式，但代码按 in-process 处理，导致子进程泄漏。

## 7. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| `curl` PUT 更新字段 | 字段能被更新 | 所有字段都可更新 |
| `curl` DELETE | 会话文件被删除 | 运行时实例也被停止 |
| `curl` POST destroy | 尝试销毁实例 | 子进程一定被干净终止 |
| 检查文件系统 | session.json 存在/不存在 | 运行时内存一定释放 |

## 8. 小实验

不运行项目，回答：

1. 为什么 DELETE 不返回 204 No Content，而是返回 `{ deleted: true }`？
2. 如果客户端先调用 DELETE，再调用 destroy，会发生什么？反过来呢？
3. 三层兜底策略中，哪一层最不可靠？为什么？

参考答案：

1. 返回 JSON 体保持 API 响应格式一致性（所有接口都返回 `{ success, data, timestamp }`），方便客户端统一处理。204 没有响应体，需要特殊处理分支。
2. 先 DELETE 再 destroy：数据没了，运行时还在（如果之前启动了）。先 destroy 再 DELETE：运行时停了，数据还在，可以正常删除。前者可能导致运行时残留。
3. 第三层（模糊匹配）最不可靠。因为 `includes` 可能匹配到错误的进程（如 `skill-foo` 匹配到 `skill-foobar`），导致误销毁。

## 9. 章节收束

本节课区分了三种修改操作：

- **PUT**：更新数据，保留运行时
- **DELETE**：删除数据，保留运行时
- **POST destroy**：销毁运行时，保留数据

它们组合使用时的典型流程：

```text
窗口关闭时：
  → POST /sessions/{id}/destroy（销毁运行时）
  → 可选：DELETE /sessions/{id}（如果不需要保留历史）

窗口重新打开时：
  → GET /sessions/{id}（恢复会话，如果数据还在）
  → POST /sessions（创建新会话，如果数据被删除了）
```

下一节课是 Unit 2 的总结工作坊，会把 I07–I10 的知识整合成一张排查地图。
