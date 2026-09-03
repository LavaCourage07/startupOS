# N03：从会话创建到 SSE 流式渲染

## 开篇场景

小林在 SkillDialog 里输入："帮我规划一个五天的旅行行程。"点击发送后，输入框下方出现了一个小圆点在转动，几秒钟后，文字开始逐段出现在对话框里。

从用户视角看，这只是"输入→等待→看到回复"。但从系统视角看，这条消息触发了一条跨越浏览器、HTTP、Core Service、Agent Runtime、SSE Stream 和 UI 渲染的完整链路。本课要追踪的就是这条链路。

## 核心问题

> 从用户发送消息到文字逐段出现在对话框，中间经过哪些步骤？数据和控制权如何在各层之间传递？

## 1. 直觉与概念阶梯

### 1.1 直觉：发送消息就像发微信

在微信里发送消息后，对方收到、回复，文字出现在对话框里。OriginOS 的消息发送类似，但多了一个关键区别：**消息不是一次性返回完整回复，而是通过流式事件逐段推送**。

### 1.2 术语：请求、处理、流式、渲染

| 层级 | 对象 | 职责 | 关键文件 |
|------|------|------|---------|
| 请求 | `POST /api/agent/sessions/{id}/messages` | 发送消息到服务端 | `packages/web/src/app/api/agent/sessions/[sessionId]/messages/route.ts` |
| 处理 | `OriginOSAgent.sendMessage` | 处理消息，调用模型 | `packages/core/src/lib/integrations/pi-agent/core/agent.ts` |
| 流式 | SSE Stream | 分块推送模型响应 | `packages/core/src/lib/integrations/pi-agent/core/agent.ts` |
| 渲染 | `SkillDialog` 状态更新 | 逐段渲染文字 | `packages/web/src/components/skills/SkillDialog.tsx` |

### 1.3 边界：每一层只负责自己的事情

- **请求层**只负责把消息发送到服务端，不保证服务端一定处理成功
- **处理层**只负责调用模型和处理响应，不保证流式事件一定到达前端
- **流式层**只负责分块推送数据，不保证前端一定正确渲染
- **渲染层**只负责更新 UI，不保证用户一定看到完整回复

## 2. 图解：流式链路主路径

```mermaid
flowchart TD
    subgraph Request["请求层"]
        A[用户输入消息] --> B[SkillDialog 发送]
        B --> C[POST /api/agent/sessions/{id}/messages]
    end

    subgraph Process["处理层"]
        C --> D[API Route 解析请求]
        D --> E[SessionService 获取会话]
        E --> F[AgentManager 获取 Agent]
        F --> G[OriginOSAgent.sendMessage]
    end

    subgraph Stream["流式层"]
        G --> H[LLM 流式响应]
        H --> I[SSE 事件推送]
    end

    subgraph Render["渲染层"]
        I --> J[前端接收 SSE 事件]
        J --> K[UI 逐段渲染]
        K --> L[用户看到回复]
    end
```

这张图可以分成四段读：

**第一段（请求层）**：用户点击发送后，`SkillDialog` 通过 `POST` 请求发送消息。请求体包含 `sessionId` 和消息内容。这一步的关键是**请求身份**——`sessionId` 决定了消息属于哪段会话。

**第二段（处理层）**：API Route 解析请求，`SessionService` 获取会话数据，`AgentManager` 获取 Agent 实例，`OriginOSAgent` 调用 `sendMessage`。这一步的关键是**运行时绑定**——Agent 实例必须与会话绑定，不能串会话。

**第三段（流式层）**：`OriginOSAgent` 调用 LLM，接收流式响应，转换为 SSE 事件，推送给前端。这一步的关键是**事件流**——不是一次性返回，而是持续推送。

**第四段（渲染层）**：前端接收 SSE 事件，更新 UI 状态，逐段渲染文字。这一步的关键是**状态管理**——`uiState` 是即时状态，不等于持久化事实。

## 3. 源码精读

### 3.1 请求层：API Route

[packages/web/src/app/api/agent/sessions/[sessionId]/messages/route.ts 第 1—100 行](../../../../packages/web/src/app/api/agent/sessions/[sessionId]/messages/route.ts#L1)

```typescript
// 简化示意
export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  // 1. 解析请求
  const { content } = await request.json();
  const { sessionId } = params;

  // 2. 获取会话
  const session = await sessionService.getSession(sessionId);
  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

  // 3. 获取 Agent
  const agent = await agentManager.getAgent(sessionId);
  if (!agent) {
    return new Response('Agent not found', { status: 404 });
  }

  // 4. 创建 SSE 响应
  const stream = new ReadableStream({
    start(controller) {
      // 5. 发送消息并监听流式事件
      agent.sendMessage(content, {
        onTextDelta: (delta) => {
          controller.enqueue(`data: ${JSON.stringify({ type: 'text_delta', delta })}

`);
        },
        onDone: () => {
          controller.close();
        },
      });
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

**输入**：`Request` 对象，包含 `sessionId` 和消息内容。
**状态**：无持久状态，只处理单次请求。
**分支**：会话不存在、Agent 不存在、流式事件处理。
**输出**：SSE 流式响应。

**关键设计**：API Route 是**边界层**，负责请求解析、身份验证和响应映射。它不处理业务逻辑，而是委托给 `SessionService` 和 `AgentManager`。

### 3.2 处理层：OriginOSAgent.sendMessage

[packages/core/src/lib/integrations/pi-agent/core/agent.ts 第 100—300 行](../../../../packages/core/src/lib/integrations/pi-agent/core/agent.ts#L100)

```typescript
// 简化示意
export class OriginOSAgent {
  async sendMessage(content: string, callbacks: MessageCallbacks) {
    // 1. 添加用户消息到历史
    this.history.push({ role: 'user', content });

    // 2. 调用 LLM
    const stream = await this.llm.chat.completions.create({
      messages: this.history,
      stream: true,
    });

    // 3. 处理流式响应
    let assistantContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      assistantContent += delta;
      callbacks.onTextDelta(delta);
    }

    // 4. 添加助手消息到历史
    this.history.push({ role: 'assistant', content: assistantContent });

    // 5. 保存会话
    await this.saveSession();

    callbacks.onDone();
  }
}
```

**输入**：消息内容和回调函数。
**状态**：消息历史、Agent 状态。
**分支**：流式响应处理、历史保存。
**输出**：流式事件和持久化历史。

**关键设计**：`OriginOSAgent` 是**运行时层**，负责消息处理、模型调用和历史管理。它通过回调函数与上层解耦，不直接操作 UI。

### 3.3 流式层：SSE 事件

SSE（Server-Sent Events）是一种服务端向客户端推送事件的协议。它的特点是：

- **单向推送**：服务端可以主动推送数据到客户端
- **基于 HTTP**：使用标准 HTTP 协议，不需要 WebSocket
- **文本格式**：数据以文本格式传输，易于解析

SSE 事件格式：

```
data: {"type": "text_delta", "delta": "Hello"}

data: {"type": "text_delta", "delta": " World"}

data: {"type": "done"}

```

### 3.4 渲染层：SkillDialog

[packages/web/src/components/skills/SkillDialog.tsx 第 200—400 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L200)

```typescript
// 简化示意
function SkillDialog() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const sendMessage = async (content: string) => {
    // 1. 添加用户消息
    setMessages(prev => [...prev, { role: 'user', content }]);
    setIsThinking(true);

    // 2. 发送请求
    const response = await fetch(`/api/agent/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });

    // 3. 处理 SSE 流
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let assistantContent = '';

    while (true) {
      const { done, value } = await reader?.read() || { done: true };
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'text_delta') {
            assistantContent += event.delta;
            setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: assistantContent }]);
          }
        }
      }
    }

    setIsThinking(false);
  };
}
```

**输入**：用户消息。
**状态**：消息列表、思考状态。
**分支**：请求发送、SSE 事件处理、UI 更新。
**输出**：更新的消息列表。

**关键设计**：`SkillDialog` 是**UI 层**，负责用户交互和状态管理。它通过 `fetch` 发送请求，通过 SSE 接收流式事件，通过 `useState` 更新 UI。

## 4. 调用链和数据流

### 4.1 正向追踪

```text
用户输入
  → SkillDialog.sendMessage(content)
    → POST /api/agent/sessions/{sessionId}/messages
      → API Route 解析请求
        → SessionService.getSession(sessionId)
          → AgentManager.getAgent(sessionId)
            → OriginOSAgent.sendMessage(content)
              → LLM.chat.completions.create({ stream: true })
                → 流式响应
                  → SSE 事件推送
                    → 前端接收 SSE 事件
                      → UI 逐段渲染
```

### 4.2 数据变化

| 步骤 | 数据变化 |
|------|---------|
| 用户输入 | 无数据变化，只有用户事件 |
| SkillDialog.sendMessage | 添加用户消息到 `messages` |
| POST 请求 | 发送 `sessionId` 和 `content` |
| API Route | 解析请求，获取会话和 Agent |
| OriginOSAgent.sendMessage | 添加用户消息到历史，调用 LLM |
| LLM 流式响应 | 返回流式数据 |
| SSE 事件 | 推送 `text_delta` 事件 |
| 前端接收 | 更新 `messages` 和 UI |

## 5. 失败路径与边界

### 5.1 请求失败

**场景**：网络断开或服务器不可用。

**后果**：`fetch` 抛出错误，`SkillDialog` 显示发送失败。

**排查**：检查网络连接和服务器状态。

### 5.2 会话不存在

**场景**：`sessionId` 错误或会话已过期。

**后果**：API Route 返回 404，`SkillDialog` 显示会话不存在。

**排查**：检查 `sessionId` 是否正确，会话是否已创建。

### 5.3 Agent 不存在

**场景**：`AgentManager` 中没有对应的 Agent 实例。

**后果**：API Route 返回 404，`SkillDialog` 显示 Agent 不存在。

**排查**：检查 Agent 是否已注册，是否已初始化。

### 5.4 流式中断

**场景**：SSE 连接断开或 LLM 响应中断。

**后果**：文字显示到一半停止，`SkillDialog` 显示"连接断开"。

**排查**：检查网络连接、LLM 服务状态和 SSE 连接。

### 5.5 渲染错误

**场景**：前端状态管理错误，导致 UI 不更新或重复渲染。

**后果**：文字不显示或重复显示。

**排查**：检查 `useState` 更新逻辑和 React 渲染。

## 6. 测试证据

### 6.1 已有测试

| 测试文件 | 测试内容 | 证明什么 | 未证明什么 |
|---------|---------|---------|-----------|
| `packages/core/src/lib/integrations/pi-agent/__tests__/agent.test.ts` | Agent 消息处理 | 消息发送和历史管理 | 流式响应完整性 |
| `packages/web/src/components/skills/__tests__/SkillDialog.test.tsx` | SkillDialog 渲染 | UI 渲染和状态更新 | 端到端流式链路 |

### 6.2 测试缺口

- 端到端流式链路测试
- SSE 连接断开恢复测试
- 流式中断后的状态一致性测试
- 前端渲染性能测试

## 7. 小实验

### 实验 1：追踪一次消息发送

1. 打开浏览器开发者工具，Network 面板
2. 在 SkillDialog 中输入消息并发送
3. 观察请求：`POST /api/agent/sessions/{sessionId}/messages`
4. 观察 SSE 事件：`text_delta`、`done`
5. 记录每个事件的顺序和内容

### 实验 2：模拟流式中断

1. 在消息发送过程中断开网络
2. 观察 UI 状态：文字显示到一半停止
3. 恢复网络，观察是否自动重连
4. 检查会话历史：是否保存了部分回复

### 实验 3：断点调试

1. 在 `route.ts` 的 `POST` 函数处设置断点
2. 在 `agent.ts` 的 `sendMessage` 处设置断点
3. 在 `SkillDialog.tsx` 的 SSE 处理处设置断点
4. 发送消息，逐步执行，观察数据变化

## 8. 口头验收

学完本课后，不看正文也应能回答下面五个问题：

1. 从用户发送到 UI 渲染，中间经过哪些层？每层的关键对象是什么？
2. 为什么"请求成功"不等于"消息已处理"？
3. SSE 和 WebSocket 的区别是什么？
4. 如果发送后没反应，应该按什么顺序排查？
5. 如果文字出现到一半停止了，可能的原因有哪些？

## 9. 章节收束

本课追踪了从用户发送到 UI 渲染的完整链路。关键结论是：**流式响应不是"发送→回复"，而是经过"请求→处理→流式→渲染"四层边界的连续事件流**。每一层只负责自己的事情，层与层之间通过明确的接口和数据合同传递控制权。

下一课（N04）会做单元小结，把这条链路的知识组织成**可复用的排查框架**，并建立流式链路的故障诊断能力。
