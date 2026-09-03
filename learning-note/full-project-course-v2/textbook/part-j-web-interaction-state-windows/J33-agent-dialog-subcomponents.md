# J33：agent-dialog 子组件

## 输入框、消息列表、状态指示、工具执行帧

`AgentDialogContent` 是编排者，真正渲染会话细节的是几个子组件。这节课看 `ChatInput`、`MessageList`、`StatusIndicator`、`ToolExecutionFrame` 各自负责什么。

## 第一段源码：ChatInput

[packages/web/src/components/os/agent-dialog/ChatInput.tsx 第 8–61 行](../../../../packages/web/src/components/os/agent-dialog/ChatInput.tsx#L8)：

```ts
interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(() => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue('');
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="p-4 border-t border-white/20 dark:border-white/10">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="..."
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="..."
        >
          发送
        </button>
      </div>
    </div>
  );
}
```

这个 `ChatInput` 是 `agent-dialog` 目录下的旧版输入框，功能简单：

- 受控 input；
- 回车发送，Shift+Enter 不处理（单行输入框）；
- 发送后清空；
- `disabled` 时禁止输入和按钮。

注意当前主流程可能已经使用 `ChatInputBar`（来自 `@/components/ui/chat-input-bar`），但这个组件仍可能在一些遗留窗口或测试路径中使用。

## 第二段源码：MessageList

[packages/web/src/components/os/agent-dialog/MessageList.tsx 第 12–36 行](../../../../packages/web/src/components/os/agent-dialog/MessageList.tsx#L12)：

```ts
export interface Message extends ChatMessageItem {
  thinking?: ThinkingData;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  toolExecutions?: ToolExecution[];
  onQuestionAnswer?: (messageIndex: number | string, selectedLabels: string[]) => void;
  answeredQuestions?: Set<number | string>;
}

export default function MessageList({ messages, isLoading, toolExecutions, onQuestionAnswer, answeredQuestions }: MessageListProps) {
  return (
    <ChatMessageList
      messages={messages}
      isLoading={isLoading}
      isThinking={isLoading}
      toolExecutions={toolExecutions}
      onQuestionAnswer={onQuestionAnswer}
      answeredQuestions={answeredQuestions}
    />
  );
  }
```

`MessageList` 是一个薄封装，把 props 透传给共享的 `ChatMessageList`。它扩展了 `ChatMessageItem`，增加了 `thinking` 字段，用于展示 Agent 的思考过程。

`onQuestionAnswer` 和 `answeredQuestions` 用于消息中的“选项按钮”：当 Agent 返回一组可点击选项时，用户点击后通过 `onQuestionAnswer` 回传，并记录到 `answeredQuestions` 避免重复回答。

## 第三段源码：StatusIndicator

[packages/web/src/components/os/agent-dialog/StatusIndicator.tsx 第 8–33 行](../../../../packages/web/src/components/os/agent-dialog/StatusIndicator.tsx#L8)：

```ts
interface StatusIndicatorProps {
  status: AgentStatus;
  isThinking?: boolean;
}

export default function StatusIndicator({ status, isThinking }: StatusIndicatorProps) {
  if (isThinking) {
    return (
      <span className="text-xs text-blue-500 flex items-center gap-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        思考中...
      </span>
    );
  }

  switch (status) {
    case AgentStatus.RUNNING:
      return <span className="text-xs text-teal-400">● 在线</span>;
    case AgentStatus.IDLE:
      return <span className="text-xs text-gray-500">○ 空闲</span>;
    case AgentStatus.ERROR:
      return <span className="text-xs text-red-500">⚠ 错误</span>;
    default:
      return <span className="text-xs text-gray-400">○ 离线</span>;
  }
}
```

`StatusIndicator` 显示 Agent 状态：

- `isThinking` 为 true 时优先显示“思考中...”；
- 否则根据 `AgentStatus` 显示在线/空闲/错误/离线。

它通常放在标题栏 Agent 名称下方，让用户一眼知道当前状态。

## 第四段源码：ToolExecutionFrame

[packages/web/src/components/os/agent-dialog/ToolExecutionFrame.tsx 第 24–87 行](../../../../packages/web/src/components/os/agent-dialog/ToolExecutionFrame.tsx#L24)：

```ts
const TOOL_NAME_CN: Record<string, string> = {
  read_file: '读取文件',
  write_file: '写入文件',
  list_files: '列出目录',
  delete_file: '删除文件',
  query_ontology: '查询本体',
  create_domain: '创建领域',
  create_concept: '创建概念',
  search_ontology: '搜索本体',
  get_current_time: '获取时间',
  get_system_info: '系统信息',
  calculate: '计算',
  get_help: '帮助',
  execute_command: '执行命令',
  send_system_message: '发送系统消息',
};

export default function ToolExecutionFrame({ executions }: ToolExecutionFrameProps) {
  if (executions.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {executions.map((tool) => {
        const isRunning = tool.status === 'running';
        const isCompleted = tool.status === 'completed';
        const isError = tool.status === 'error';
        const cnName = TOOL_NAME_CN[tool.name] || tool.name;

        return (
          <div
            key={tool.id}
            className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-white/40 border border-white/30 text-xs"
          >
            {isRunning && (
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
            )}
            {isCompleted && (
              <CheckCircle className="w-3.5 h-3.5 text-teal-500 shrink-0" />
            )}
            {isError && (
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            )}

            <span className="text-gray-700 font-medium truncate">{cnName}</span>
            {isRunning && (
              <span className="text-gray-400 ml-auto shrink-0">执行中...</span>
            )}

            {isRunning && (
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 to-transparent rounded-full" />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

`ToolExecutionFrame` 展示当前正在执行或已执行的工具：

- `TOOL_NAME_CN` 把英文工具名映射为中文，提升可读性；
- 根据 `status` 显示不同图标和颜色；
- 运行时底部有一条渐变进度线作为视觉反馈。

这些工具执行记录由 `AgentDialogContent` 通过 `subscribe` 监听底层事件后维护，再作为 `toolExecutions` prop 传入 `MessageList`。

## 本节小结

- `ChatInput`：旧版单行输入框，Enter 发送，发送后清空。
- `MessageList`：透传 `ChatMessageList`，扩展 `thinking` 和 `onQuestionAnswer`。
- `StatusIndicator`：优先显示“思考中”，其次按 `AgentStatus` 显示状态。
- `ToolExecutionFrame`：把工具调用事件可视化，支持中文工具名和运行/完成/错误三种状态。

下一节课看 `agent-host` 组件，它们服务于独立宿主页面的 Agent 会话。
