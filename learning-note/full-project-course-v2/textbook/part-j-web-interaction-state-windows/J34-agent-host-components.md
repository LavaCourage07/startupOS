# J34：agent-host 组件

## 独立宿主页面的 Agent 会话

`agent-dialog` 里的组件服务于窗口内嵌的 Agent 会话；`agent-host` 则服务于独立宿主页面（例如全屏 Agent 页面或弹窗宿主）。这里的实现相对独立，代码路径也更简单。

## 第一段源码：AgentDialog

[packages/web/src/components/os/agent-host/AgentDialog.tsx 第 24–112 行](../../../../packages/web/src/components/os/agent-host/AgentDialog.tsx#L24)：

```ts
export default function AgentDialog({ agentId, isOpen, onClose }: AgentDialogProps) {
  const agent = useAgentRegistryStore((state) => state.agents[agentId]);

  if (!agent) return null;

  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: `你好！我是 ${agent.displayName}。有什么我可以帮助你的吗？` },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const initResponse = await createAgentSession({
          projectName: '对话项目',
          projectId: `agent-${agent.id}-${Date.now()}`,
        });

        if (initResponse.success) {
          currentSessionId = (initResponse.data as { sessionId: string }).sessionId;
          setSessionId(currentSessionId);
        } else {
          throw new Error(initResponse.error?.message || 'Failed to create session');
        }
      }

      const messageData = await sendAgentMessage({
        sessionId: currentSessionId,
        content: message,
      });

      if (messageData.success) {
        const data = messageData.data as { assistantMessage?: { id: string; content: string; timestamp?: number } };
        if (data.assistantMessage) {
          setMessages((prev) => [
            ...prev,
            {
              id: data.assistantMessage!.id,
              role: 'assistant',
              content: data.assistantMessage!.content,
              timestamp: data.assistantMessage!.timestamp,
            },
          ]);
        }
      } else {
        throw new Error(messageData.error?.message || 'Failed to send message');
      }
    } catch (error) {
      console.error(`[${agent.displayName}] 发送消息失败:`, error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: '抱歉，发送消息时出现错误。请稍后再试。',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };
```

`agent-host/AgentDialog` 是一个更“传统”的对话弹窗：

- 自己维护 `messages`、`isLoading`、`sessionId` 状态；
- 首次发送时调用 `createAgentSession` 创建会话；
- 之后调用 `sendAgentMessage` 发送消息；
- 收到回复后追加到 `messages`；
- 错误时显示固定错误文案。

它不使用 `usePiAgent`，而是直接调用 Core 的 `agent-session` 服务。这让它适合简单的独立弹窗场景，但不支持流式输出、历史恢复、工具执行展示等高级功能。

## 第二段源码：AcrylicDialog 容器

[packages/web/src/components/os/agent-host/AgentDialog.tsx 第 114–205 行](../../../../packages/web/src/components/os/agent-host/AgentDialog.tsx#L114)：

```tsx
return (
  <AcrylicDialog
    isOpen={isOpen}
    onClose={onClose}
    title={agent.displayName}
    size="lg"
    variant="standard"
    mode="nonModal"
  >
    <div className="flex flex-col h-full min-h-[300px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                msg.role === 'assistant'
                  ? 'bg-white/20 text-white'
                  : 'bg-primary text-white border border-primary/50'
              }`}
            >
              <div className="text-sm">{msg.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/20 text-white rounded-2xl px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/20 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            autoFocus
            placeholder={`向 ${agent.displayName} 发送消息...`}
            className="..."
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputRef.current?.value.trim()) {
                handleSendMessage(inputRef.current.value);
                if (inputRef.current) inputRef.current.value = '';
              }
            }}
          />
          <button
            disabled={isLoading}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (inputRef.current?.value.trim()) {
                handleSendMessage(inputRef.current.value);
                if (inputRef.current) inputRef.current.value = '';
              }
            }}
            className="..."
          >
            {isLoading ? '发送中...' : '发送'}
          </button>
        </div>
      </div>

      <div className="mt-2 text-xs text-white/50">
        {agent.status === AgentStatus.RUNNING ? (
          <span className="text-green-400">● 已连接</span>
        ) : (
          <span className="text-gray-400">○ 已离线</span>
        )}
        {' · '}
        <span>{agent.displayName}</span>
      </div>
    </div>
  </AcrylicDialog>
);
```

UI 特点：

- 用 `AcrylicDialog` 做毛玻璃弹窗容器；
- 消息气泡左右分布，Assistant 在左、User 在右；
- 加载中用三个跳动圆点表示；
- 输入框使用非受控 `ref`，直接读取 `inputRef.current.value`；
- 底部显示连接状态和 Agent 名称。

## 第三段源码：MessageInput

[packages/web/src/components/os/agent-host/MessageInput.tsx 第 12–48 行](../../../../packages/web/src/components/os/agent-host/MessageInput.tsx#L12)：

```ts
export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || disabled || isSending) return;

    setIsSending(true);
    try {
      await onSend(input);
      setInput('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        disabled={disabled || isSending}
        placeholder="输入消息..."
        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      />
      <button
        onClick={handleSend}
        disabled={disabled || isSending || !input.trim()}
        className="px-4 py-2 rounded-lg bg-blue-500 text-white disabled:opacity-50"
      >
        发送
      </button>
    </div>
  );
}
```

`agent-host/MessageInput` 是受控组件，支持亮色/暗色模式。它自己维护 `isSending` 状态，调用 `onSend` 期间禁用输入和按钮。

## 第四段源码：MessageList

[packages/web/src/components/os/agent-host/MessageList.tsx 第 13–45 行](../../../../packages/web/src/components/os/agent-host/MessageList.tsx#L13)：

```ts
export default function MessageList({ messages }: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current?.scrollTo) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  return (
    <div ref={listRef} className="h-96 overflow-y-auto space-y-4 mb-4">
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] px-4 py-2 rounded-lg ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}
    </div>
  );
}
```

这个 `MessageList` 同样简单：

- 固定高度 `h-96`；
- 用 `listRef.current.scrollTo` 自动滚动到底部；
- 使用索引作为 `key`（ messages 通常只追加，所以可行但不建议）。

## agent-host 与 agent-dialog 的对比

| 维度 | agent-dialog | agent-host |
| --- | --- | --- |
| 主要用途 | 窗口内嵌 Agent 会话 | 独立宿主页面/弹窗 |
| 核心 Hook | `usePiAgent` | 直接调用 `agent-session` 服务 |
| 流式输出 | 支持 | 不支持 |
| 历史恢复 | 支持 | 不支持 |
| 工具执行展示 | 支持 | 不支持 |
| 输入框实现 | `ChatInputBar` / 旧版 `ChatInput` | `MessageInput` |
| 消息列表 | `ChatMessageList` 封装 | 简单自实现 |

两套组件并存的原因：

1. `agent-host` 可能是最早实现的简单版本，保留用于轻量弹窗；
2. `agent-dialog` 是后续基于 `usePiAgent` 的能力增强版，用于主窗口会话。

## 本节小结

- `agent-host/AgentDialog` 用 `AcrylicDialog` 做弹窗容器，自己管理消息和会话状态。
- 它直接调用 `createAgentSession` / `sendAgentMessage`，不使用 `usePiAgent`。
- `MessageInput` 和 `MessageList` 都是轻量实现，适合简单宿主页面。
- `agent-host` 适合不需要流式、历史、工具展示的场景；`agent-dialog` 是主力实现。

下一节课看“思考过程”UI：`ThinkingProcess`、`ThinkingHeader`、`ThinkingContent`、`useThinkingProcess`。
