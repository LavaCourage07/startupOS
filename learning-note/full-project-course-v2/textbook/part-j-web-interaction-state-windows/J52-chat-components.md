# J52：聊天组件

## 两套聊天体系

Web 包里有两套聊天组件：

| 层级 | 组件 | 文件 | 说明 |
| --- | --- | --- | --- |
| `components/ui/` | `ChatInputBar`、`ChatMessage`、`MarkdownContent`、`ChatMessageList` | `chat-input-bar.tsx`、`chat-message.tsx`、`chat/ChatMessageList.tsx` | 较新，支持附件、AskUserQuestion、Mermaid |
| `components/molecules/` | `ChatInput`、`MessageList` | `ChatInput.tsx`、`MessageList.tsx` | 较老，纯文本，简单自动滚动 |

这节课先读新的三件套，再读老的两件套，最后比较差异。

---

## 第一段源码：ChatInputBar 的附件与停止按钮

[packages/web/src/components/ui/chat-input-bar.tsx 第 7–32 行](../../../../packages/web/src/components/ui/chat-input-bar.tsx#L7)：

```tsx
export interface UploadedFileDisplay {
  name: string;
  path?: string;
  size: number;
}

interface ChatInputBarProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onUpload?: () => void;
  className?: string;
  onStop?: () => void;
  isGenerating?: boolean;
  lightBg?: boolean;
  uploadedFiles?: UploadedFileDisplay[];
  onRemoveFile?: (index: number) => void;
  uploadError?: string | null;
  uploading?: boolean;
}
```

`ChatInputBar` 的 Props 分四组：

| 分组 | Props | 说明 |
| --- | --- | --- |
| 基础 | `onSubmit`、`disabled`、`placeholder`、`className` | 输入和提交 |
| 附件 | `onUpload`、`uploadedFiles`、`onRemoveFile`、`uploadError`、`uploading` | 文件上传生命周期 |
| 生成控制 | `onStop`、`isGenerating` | 停止按钮 |
| 主题 | `lightBg` | 浅色/深色背景变体 |

> `UploadedFileDisplay` 只有 `name`、`path`、`size` 三个字段，不包含文件内容。文件内容通过 `onUpload` 回调在外部处理。

## 第二段源码：ChatInputBar 的布局与交互

[packages/web/src/components/ui/chat-input-bar.tsx 第 82–175 行](../../../../packages/web/src/components/ui/chat-input-bar.tsx#L82)：

```tsx
return (
  <div className={cn('border-t border-white/20 px-4 py-3', className)}>
    {/* Upload progress / error indicators */}
    {(uploading || uploadError) && (
      <div className="mb-2 px-3">
        {uploading && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>上传中...</span>
          </div>
        )}
        {uploadError && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            <span>{uploadError}</span>
            <button onClick={() => onRemoveFile?.(-1)} className="shrink-0 hover:text-red-800">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    )}

    {/* Uploaded file chips */}
    {uploadedFiles && uploadedFiles.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mb-2 px-3">
        {uploadedFiles.map((file, idx) => (
          <span key={idx} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Paperclip className="w-3 h-3" />
            {file.name}
            <span className="text-gray-400 font-normal">{formatFileSize(file.size)}</span>
            {onRemoveFile && (
              <button onClick={() => onRemoveFile(idx)} className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5">
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
      </div>
    )}

    <div className="flex gap-2 items-center">
      <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown} placeholder={placeholder}
        disabled={disabled || isGenerating}
        className={cn('flex-1 px-3 py-2 rounded-lg ...', inputBgClass)} />
      {onUpload && (
        <button type="button" onClick={onUpload} disabled={uploading}
          className={cn('p-2 rounded-lg border ...', uploadBtnClass)} title="上传文件">
          <Paperclip className="w-4 h-4" />
        </button>
      )}
      {onStop && isGenerating && (
        <button type="button" onClick={onStop}
          className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 ...">
          <div className="w-3 h-3 bg-white rounded-sm" />
        </button>
      )}
      <button type="button" onClick={handleSubmit} disabled={!canSend}
        className="p-2 rounded-lg bg-primary text-white ...">
        <Send className="w-4 h-4" />
      </button>
    </div>
  </div>
);
```

布局从上到下：

1. **上传状态区**：上传中显示 spinner + "上传中..."，出错显示红色错误条 + 关闭按钮；
2. **附件芯片区**：每个已上传文件显示为圆角芯片，包含回形针图标、文件名、大小、删除按钮；
3. **输入区**：文本输入框 + 上传按钮 + 停止按钮（仅生成中显示）+ 发送按钮。

按钮的显示逻辑：

| 条件 | 显示的按钮 |
| --- | --- |
| `onUpload` 存在 | 上传按钮（回形针） |
| `onStop` 存在且 `isGenerating` | 停止按钮（红色方块） |
| 始终 | 发送按钮 |

> `formatFileSize` 是模块内的工具函数：`< 1024` 显示 B，`< 1024*1024` 显示 KB，否则显示 MB（保留一位小数）。

## 第三段源码：ChatInputBar 的浅色/深色变体

[packages/web/src/components/ui/chat-input-bar.tsx 第 74–80 行](../../../../packages/web/src/components/ui/chat-input-bar.tsx#L74)：

```tsx
const inputBgClass = lightBg
  ? 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-primary/50'
  : 'bg-white/10 border border-white/20 text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:ring-primary';

const uploadBtnClass = lightBg
  ? 'bg-gray-200 border border-gray-300 text-gray-700 hover:bg-gray-300'
  : 'bg-white/10 border border-white/20 text-gray-400 hover:text-gray-300 hover:bg-white/20';
```

`lightBg` 控制两种视觉风格：

| 属性 | `lightBg = true` | `lightBg = false`（默认） |
| --- | --- | --- |
| 输入框背景 | `bg-white` | `bg-white/10`（半透明） |
| 输入框边框 | `border-gray-300` | `border-white/20` |
| 聚焦环 | `focus:ring-2 focus:ring-primary/50` | `focus:ring-1 focus:ring-primary` |
| 上传按钮 | `bg-gray-200` | `bg-white/10` |

> 默认风格适合深色/毛玻璃背景（如 Agent 对话框底部），`lightBg` 适合白色背景的聊天区域。

---

## 第四段源码：parseAskUserQuestion 的 YAML 解析

[packages/web/src/components/ui/chat-message.tsx 第 74–111 行](../../../../packages/web/src/components/ui/chat-message.tsx#L74)：

```tsx
export function parseAskUserQuestion(content: string): ParsedQuestion | null {
  const yamlMatch = content.match(/```ya?ml\s*([\s\S]*?)```/);
  if (!yamlMatch?.[1]) return null;

  const yamlContent = yamlMatch[1];

  const questionMatch = yamlContent.match(/question:\s*["']?([^"'\n]+)["']?/);
  if (!questionMatch?.[1]) return null;
  const question = questionMatch[1].trim();

  const options: QuestionOption[] = [];
  const optionsMatch = yamlContent.match(/options:\s*([\s\S]*?)(?=\n\w+|\n\s*$|multiSelect:)/);
  if (optionsMatch?.[1]) {
    const optionsText = optionsMatch[1];
    const optionRegex = /-\s*label:\s*["']?([^"'\n]+)["']?\s*\n\s*description:\s*["']?([^"'\n]+)["']?/g;
    let match;
    while ((match = optionRegex.exec(optionsText)) !== null) {
      if (match[1] && match[2]) {
        options.push({ label: match[1].trim(), description: match[2].trim() });
      }
    }
    if (options.length === 0) {
      const inlineRegex = /-\s*label:\s*["']?([^"'\n]+)["']?\s+description:\s*["']?([^"'\n]+)["']?/g;
      while ((match = inlineRegex.exec(yamlContent)) !== null) {
        if (match[1] && match[2]) {
          options.push({ label: match[1].trim(), description: match[2].trim() });
        }
      }
    }
  }

  if (options.length === 0) return null;

  const multiSelectMatch = yamlContent.match(/multiSelect:\s*(true|false)/i);
  const multiSelect = multiSelectMatch?.[1] ? multiSelectMatch[1].toLowerCase() === 'true' : false;

  return normalizeAskUserQuestion({ question, options, multiSelect });
}
```

`parseAskUserQuestion` 从 Agent 回复的 Markdown 里提取 YAML 格式的问题卡片：

1. 用正则匹配 ` ```yaml ... ``` ` 代码块；
2. 从代码块里提取 `question:` 字段；
3. 用正则提取 `options:` 列表里的 `label` 和 `description`（支持换行和内联两种格式）；
4. 提取 `multiSelect:` 布尔值；
5. 最后调用 `normalizeAskUserQuestion` 验证结构完整性。

> 用正则而不是 YAML 解析器，是因为 Agent 输出的 YAML 格式不一定严格合规，正则更宽容。代价是只能处理简单结构，不支持嵌套或复杂语法。

## 第五段源码：normalizeAskUserQuestion 与 removeYamlBlock

[packages/web/src/components/ui/chat-message.tsx 第 47–72 行](../../../../packages/web/src/components/ui/chat-message.tsx#L47)：

```tsx
export function normalizeAskUserQuestion(input: StructuredQuestionLike): ParsedQuestion | null {
  if (typeof input.question !== 'string' || input.question.trim().length === 0) return null;
  if (!Array.isArray(input.options) || input.options.length === 0) return null;

  const options = input.options.flatMap((option) => {
    if (!option || typeof option !== 'object') return [];

    const label = 'label' in option && typeof option.label === 'string'
      ? option.label.trim()
      : '';
    const description = 'description' in option && typeof option.description === 'string'
      ? option.description.trim()
      : '';

    if (!label || !description) return [];
    return [{ label, description }];
  });

  if (options.length === 0) return null;

  return {
    question: input.question.trim(),
    options,
    multiSelect: input.multiSelect === true,
  };
}
```

[packages/web/src/components/ui/chat-message.tsx 第 113–115 行](../../../../packages/web/src/components/ui/chat-message.tsx#L113)：

```tsx
export function removeYamlBlock(content: string): string {
  return content.replace(/```ya?ml\s*[\s\S]*?```/g, '').trim();
}
```

`normalizeAskUserQuestion` 处理结构化的问题对象（非 YAML 文本），用于工具执行参数里的 `ask_user_question`：

- 验证 `question` 是非空字符串；
- 验证 `options` 是非空数组；
- 过滤掉缺少 `label` 或 `description` 的选项；
- 如果过滤后没有有效选项，返回 `null`。

`removeYamlBlock` 从消息内容里删除 YAML 代码块，因为问题已经被解析成 UI 卡片，不需要再显示原始 YAML。

> `ChatMessageList` 里的 `parseToolQuestion` 先尝试从工具参数里 `normalizeAskUserQuestion`，失败再从工具结果里 `parseAskUserQuestion`。两条路径覆盖了 Agent 通过文本回复和通过工具调用两种提问方式。

## 第六段源码：AskUserQuestionComponent 的单选/多选

[packages/web/src/components/ui/chat-message.tsx 第 121–201 行](../../../../packages/web/src/components/ui/chat-message.tsx#L121)：

```tsx
export function AskUserQuestionComponent({
  parsedQuestion, onAnswer, disabled,
}: {
  parsedQuestion: ParsedQuestion;
  onAnswer: (selectedLabels: string[]) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleOptionClick = (label: string) => {
    if (disabled) return;
    if (parsedQuestion.multiSelect) {
      const next = new Set(selected);
      next.has(label) ? next.delete(label) : next.add(label);
      setSelected(next);
    } else {
      setSelected(new Set([label]));
      onAnswer([label]);  // 单选：立即提交
    }
  };

  const handleSubmit = () => {
    if (selected.size === 0 || disabled) return;
    onAnswer(Array.from(selected));
  };

  return (
    <div className="space-y-3 mt-3">
      <p className="text-sm font-medium text-gray-900">{parsedQuestion.question}</p>
      <div className="space-y-2">
        {parsedQuestion.options.map((option, i) => {
          const isSelected = selected.has(option.label);
          return (
            <button key={i} onClick={() => handleOptionClick(option.label)}
              disabled={disabled}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                isSelected
                  ? 'bg-primary/15 border-primary/50 ring-1 ring-primary/30'
                  : 'bg-white/60 border-white/40 hover:border-primary/30 hover:bg-white/80'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {parsedQuestion.multiSelect ? (
                    /* 复选框 */
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      isSelected ? 'bg-primary border-primary' : 'border-gray-400 bg-white'
                    }`}>
                      {isSelected && <svg>...</svg>}
                    </div>
                  ) : (
                    /* 单选圆点 */
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-primary' : 'border-gray-400'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 mb-1">{option.label}</div>
                  <div className="text-xs text-gray-600 leading-relaxed">{option.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {parsedQuestion.multiSelect && (
        <button onClick={handleSubmit} disabled={selected.size === 0 || disabled}
          className="w-full px-4 py-2 rounded-lg bg-primary text-white ...">
          确认选择 {selected.size > 0 && `(${selected.size})`}
        </button>
      )}
    </div>
  );
}
```

`AskUserQuestionComponent` 的交互逻辑：

| 模式 | 点击行为 | 提交方式 | UI 控件 |
| --- | --- | --- | --- |
| 单选（`multiSelect = false`） | 选中后立即调用 `onAnswer` | 自动 | 圆形 radio |
| 多选（`multiSelect = true`） | 切换选中状态 | 点击"确认选择"按钮 | 方形 checkbox |

> 单选模式下 `onAnswer` 在 `handleOptionClick` 里直接调用，不需要确认按钮。多选模式下需要用户手动点击"确认选择"按钮，按钮上显示已选数量。

## 第七段源码：MarkdownContent 的流式性能降级

[packages/web/src/components/ui/chat-message.tsx 第 209–224 行](../../../../packages/web/src/components/ui/chat-message.tsx#L209)：

```tsx
export const STREAMING_PLAIN_TEXT_THRESHOLD = 4_000;

export const MarkdownContent = memo(function MarkdownContent({ content, isStreaming }: MarkdownContentProps) {
  const safeContent = sanitizeAgentDisplayContent(content);
  if (isStreaming && safeContent.length >= STREAMING_PLAIN_TEXT_THRESHOLD) {
    return (
      <div
        className="min-w-0 whitespace-pre-wrap break-words text-inherit"
        data-stream-renderer="plain-text"
      >
        {safeContent}
        <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse opacity-70" />
      </div>
    );
  }

  const normalizedContent = normalizeMarkdownTables(safeContent);
  return (
    <div className="min-w-0 overflow-hidden break-words text-inherit">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{ ... }}
      >
        {normalizedContent}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse opacity-70" />
      )}
    </div>
  );
});
```

`MarkdownContent` 是性能敏感的组件——Agent 流式输出时，每收到一个 token 就要重新渲染整个 Markdown。

性能降级策略：

| 条件 | 渲染方式 | 说明 |
| --- | --- | --- |
| `isStreaming && content.length >= 4000` | 纯文本（`whitespace-pre-wrap`） | 跳过 Markdown 解析，直接显示原文 |
| 其他 | `ReactMarkdown` + `remarkGfm` + `rehypeHighlight` | 完整 Markdown 渲染 + 代码高亮 |

> `memo` 包裹避免父组件无关渲染触发重新解析。`STREAMING_PLAIN_TEXT_THRESHOLD = 4000` 是经验值：短文本的 Markdown 解析开销可接受，长文本的解析会导致明显卡顿。

## 第八段源码：MarkdownContent 的代码块与 Mermaid 处理

[packages/web/src/components/ui/chat-message.tsx 第 238–264 行](../../../../packages/web/src/components/ui/chat-message.tsx#L238)：

```tsx
code({ className, children, ...props }) {
  const isInline = !className;
  if (isInline) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-black/20 text-inherit text-sm font-mono" {...props}>
        {children}
      </code>
    );
  }

  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  if (language === 'mermaid') {
    const code = String(children).replace(/\n$/, '');
    return <MermaidDiagram chart={code} />;
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
},
```

`code` 组件的三种分支：

| 条件 | 渲染 | 说明 |
| --- | --- | --- |
| 无 `className`（行内代码） | `<code>` + 背景色 | 如 `` `const x = 1` `` |
| `language-mermaid` | `<MermaidDiagram>` | Mermaid 图表 |
| 其他语言 | `<code>` + `rehype-highlight` 高亮 | 代码块 |

> `rehype-highlight` 自动为代码块添加语法高亮，引入 `highlight.js/styles/github-dark.css` 主题。

---

## 第九段源码：ChatMessageList 的自动滚动策略

[packages/web/src/components/ui/chat/ChatMessageList.tsx 第 87–137 行](../../../../packages/web/src/components/ui/chat/ChatMessageList.tsx#L87)：

```tsx
const listRef = useRef<HTMLDivElement>(null);
const prevLengthRef = useRef(0);
const lastScrollTimeRef = useRef(0);
const isNearBottomRef = useRef(true);
const pendingScrollFrameRef = useRef<number | null>(null);

const SCROLL_THROTTLE_MS = 100;
const BOTTOM_THRESHOLD_PX = 80;

const scheduleScroll = (force = false) => {
  if (!force && !isNearBottomRef.current) return;
  const now = Date.now();
  if (now - lastScrollTimeRef.current < SCROLL_THROTTLE_MS) return;
  lastScrollTimeRef.current = now;
  if (pendingScrollFrameRef.current !== null) return;
  pendingScrollFrameRef.current = requestAnimationFrame(() => {
    pendingScrollFrameRef.current = null;
    const list = listRef.current;
    if (!list || (!force && !isNearBottomRef.current)) return;
    list.scrollTo({ top: list.scrollHeight, behavior: 'auto' });
    isNearBottomRef.current = true;
  });
};

const handleScroll = () => {
  const list = listRef.current;
  if (!list) return;
  const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
  isNearBottomRef.current = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
};
```

`ChatMessageList` 的自动滚动设计：

| 机制 | 参数 | 说明 |
| --- | --- | --- |
| 节流 | `SCROLL_THROTTLE_MS = 100` | 两次滚动之间至少间隔 100ms |
| 底部阈值 | `BOTTOM_THRESHOLD_PX = 80` | 距离底部 80px 以内视为"在底部" |
| 用户意图 | `isNearBottomRef` | 用户手动上滚时不自动滚动到底部 |
| 帧调度 | `requestAnimationFrame` | 合并同一帧内的多次滚动请求 |

三个触发滚动的 `useEffect`：

1. **新消息到达**（`messages.length` 增加）：强制滚动，重置节流；
2. **流式内容更新**（`messages` 变化且有 `isStreaming`）：尊重用户滚动位置；
3. **工具执行变化**（`toolExecutions` 变化）：尊重用户滚动位置。

> `behavior: 'auto'` 而不是 `'smooth'`：流式输出时平滑滚动会累积动画队列，导致卡顿。`'auto'` 是瞬间跳转，配合节流实现流畅的跟随效果。

## 第十段源码：ChatMessageList 的消息渲染与工具帧

[packages/web/src/components/ui/chat/ChatMessageList.tsx 第 165–284 行](../../../../packages/web/src/components/ui/chat/ChatMessageList.tsx#L165)：

```tsx
{messages.map((msg, index) => {
  if (skipIndices.has(index)) return null;

  const key = msg.id || `msg-${index}`;
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <div key={key} className="flex min-w-0 justify-end">
        <div className="... rounded-2xl rounded-tr-sm px-4 py-3 text-sm bg-primary text-white">
          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        </div>
      </div>
    );
  }

  const safeContent = sanitizeAgentDisplayContent(msg.content);
  if (!safeContent && !msg.isStreaming) return null;

  const parsedQuestion = onQuestionAnswer ? parseAskUserQuestion(safeContent) : null;
  const isAnswered = answeredQuestions.has(index);
  const displayContent = parsedQuestion ? removeYamlBlock(safeContent) : safeContent;

  return (
    <div key={key} className="flex min-w-0 justify-start gap-2 items-start">
      <div className="w-2 h-2 rounded-full bg-primary mt-3 shrink-0" />
      <div className="... rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-white/60 border border-white/40">
        {assistantMessageExtra?.(msg, index)}
        {displayContent && (
          <div className="prose prose-sm max-w-none">
            <MarkdownContent content={displayContent} isStreaming={msg.isStreaming} />
          </div>
        )}
        {msg.isStreaming && !displayContent && <StreamingDots />}
        {parsedQuestion && onQuestionAnswer && !isAnswered && (
          <AskUserQuestionComponent parsedQuestion={parsedQuestion}
            onAnswer={onQuestionAnswer.bind(null, index)} disabled={false} />
        )}
      </div>
    </div>
  );
})}

{/* Tool execution frames */}
{toolExecutions && toolExecutions.length > 0 && (
  <div className="flex justify-start items-start">
    <div className="w-2 h-2 rounded-full bg-primary mt-3 shrink-0" />
    <div className="... bg-white/60 border border-white/40">
      <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-500">
        <Wrench className="w-3 h-3" />
        <span className="font-medium">工具执行</span>
      </div>
      <ToolExecutionFrame executions={toolExecutions} />
      {toolExecutions
        .filter(t => t.name === 'ask_user_question')
        .map((toolExec) => {
          const parsed = parseToolQuestion(toolExec);
          if (!parsed) return null;
          const questionKey = `tool-question-${toolExec.id}`;
          const isAnswered = answeredQuestions.has(questionKey);
          return (
            <div key={toolExec.id} className="mt-3 pt-3 border-t border-gray-200/50">
              {parsed && onQuestionAnswer && !isAnswered && (
                <AskUserQuestionComponent parsedQuestion={parsed}
                  onAnswer={onQuestionAnswer.bind(null, questionKey)}
                  disabled={toolExec.status === 'error'} />
              )}
            </div>
          );
        })}
    </div>
  </div>
)}
```

消息渲染的关键设计：

| 特性 | 实现 | 说明 |
| --- | --- | --- |
| 用户消息 | 右对齐，`bg-primary text-white`，`rounded-tr-sm` | 气泡右上角方角 |
| 助手消息 | 左对齐，`bg-white/60`，`rounded-tl-sm`，带圆点指示器 | 气泡左上角方角 |
| 空消息跳过 | `!safeContent && !msg.isStreaming` 时返回 `null` | 避免空气泡 |
| `skipIndices` | `Set<number>`，跳过指定索引 | 隐藏系统消息 |
| `assistantMessageExtra` | 渲染函数，注入额外内容 | 如 `ThinkingProcess` |
| 工具帧 | 独立于消息列表，显示在消息之后 | 包含 `ask_user_question` 卡片 |

> 助手消息左侧有一个 `w-2 h-2 rounded-full bg-primary` 小圆点，代替传统头像，视觉上更轻量。

---

## 第十一节源码：molecules/ChatInput 的受控/非受控模式

[packages/web/src/components/molecules/ChatInput.tsx 第 85–148 行](../../../../packages/web/src/components/molecules/ChatInput.tsx#L85)：

```tsx
export const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(
  ({
    onSubmit, disabled = false,
    placeholder = "输入消息，按 Enter 发送，Shift+Enter 换行...",
    maxLength = 2000, className, defaultValue = "",
    value: controlledValue, onChange, autoFocus = false,
  }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const autoResize = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      }
    }, []);

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : internalValue;

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (!isControlled) setInternalValue(newValue);
      onChange?.(newValue);
      setTimeout(autoResize, 0);
    }, [isControlled, onChange, autoResize]);

    const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !disabled) {
          onSubmit(value.trim());
          if (!isControlled) setInternalValue("");
        }
      }
    }, [value, onSubmit, disabled, isControlled]);
```

`molecules/ChatInput` 的设计特点：

| 特性 | 说明 |
| --- | --- |
| `forwardRef` | 支持外部控制焦点 |
| 受控/非受控 | `value` prop 存在时为受控模式，否则用内部 `useState` |
| 自动调整高度 | `autoResize` 设置 `height: auto` 后取 `scrollHeight`，最大 200px |
| Enter 发送 | `Enter` 发送，`Shift+Enter` 换行 |
| 字符计数 | 底部显示 `charCount/maxLength`，接近上限变橙色，达到上限变红色 |

> 与 `ChatInputBar` 的区别：`ChatInput` 用 `<Textarea>`（多行），`ChatInputBar` 用 `<input>`（单行）。`ChatInput` 支持 `maxLength` 和字符计数，`ChatInputBar` 支持附件和停止按钮。

## 第十二段源码：molecules/MessageList 的简单自动滚动

[packages/web/src/components/molecules/MessageList.tsx 第 218–354 行](../../../../packages/web/src/components/molecules/MessageList.tsx#L218)：

```tsx
export const MessageList = React.forwardRef<HTMLDivElement, MessageListProps>(
  ({
    messages = [], className, maxMessages,
    autoScroll = true, showTimestamps = true, showAvatars = true,
    userAvatar, agentAvatar,
  }, forwardedRef) => {
    const listRef = React.useRef<HTMLDivElement>(null);
    const endRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      if (autoScroll && messages.length > 0) {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }, [messages, autoScroll]);

    const displayMessages = React.useMemo(() => {
      if (maxMessages && messages.length > maxMessages) {
        return messages.slice(-maxMessages);
      }
      return messages;
    }, [messages, maxMessages]);

    return (
      <div ref={setRef} className={cn("flex-1 overflow-y-auto space-y-4", className)}>
        {displayMessages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div key={message.id} className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
              {showAvatars && (
                <div className="shrink-0">
                  {userAvatar ? <>{userAvatar}</> : isUser ? <UserAvatar /> : agentAvatar ? <>{agentAvatar}</> : <AgentAvatar />}
                </div>
              )}
              <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
                <div className={cn("rounded-lg px-4 py-2",
                  isUser ? "bg-primary text-foreground" : "bg-muted text-foreground",
                  isError && "border border-destructive/50"
                )}>
                  {!isUser && message.toolInfo && (
                    <div className="mb-2"><ToolIndicator toolName={message.toolInfo.name} duration={message.toolInfo.duration} /></div>
                  )}
                  <p className={cn("text-sm", isError && "text-destructive")}>{message.content}</p>
                </div>
                {showTimestamps && message.timestamp && <Timestamp timestamp={message.timestamp} />}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    );
  }
);
```

`molecules/MessageList` 与 `ChatMessageList` 的对比：

| 特性 | `MessageList`（molecules） | `ChatMessageList`（ui/chat） |
| --- | --- | --- |
| 自动滚动 | `scrollIntoView({ behavior: "smooth" })` | `requestAnimationFrame` + 节流 + 底部阈值 |
| 用户滚动感知 | 无（始终滚动到底部） | `isNearBottomRef` 尊重用户手动上滚 |
| Markdown 渲染 | 纯文本 `<p>` | `ReactMarkdown` + `remarkGfm` + `rehypeHighlight` |
| 代码高亮 | 无 | 有 |
| Mermaid | 无 | 有（`MermaidDiagram`） |
| AskUserQuestion | 无 | 有（YAML 解析 + 交互卡片） |
| 工具执行帧 | `ToolIndicator`（简单标签） | `ToolExecutionFrame`（完整帧） |
| 头像 | SVG 用户/Agent 头像 | 小圆点指示器 |
| 消息限制 | `maxMessages` 截取最后 N 条 | `skipIndices` 跳过指定索引 |
| 流式指示器 | 无 | `StreamingDots`（三个弹跳圆点） |
| 错误状态 | `error` 布尔值 + 红色边框 | 无（由外部处理） |

> `MessageList` 是早期实现，功能简单但通用。`ChatMessageList` 是后来为 Skill/Agent 对话框专门设计的，功能更完整但耦合了更多业务逻辑。两套并存是因为不同场景的需求不同。

---

## 本节小结

- `ChatInputBar` 是较新的聊天输入组件，支持附件芯片、上传进度/错误、停止按钮、浅色/深色两种背景变体。
- `chat-message.tsx` 包含三个核心功能：`parseAskUserQuestion` 从 Markdown YAML 代码块提取问题卡片；`MarkdownContent` 用 `ReactMarkdown` 渲染完整 Markdown，流式输出超过 4000 字符时降级为纯文本；`AskUserQuestionComponent` 支持单选（立即提交）和多选（确认后提交）。
- `ChatMessageList` 的自动滚动用 `requestAnimationFrame` + 100ms 节流 + 80px 底部阈值，尊重用户手动上滚。工具执行帧独立于消息渲染，`ask_user_question` 工具的参数/结果也会被解析成交互卡片。
- `molecules/ChatInput` 是较老的输入组件，用 `<Textarea>` 多行输入，支持受控/非受控模式和自动调整高度。
- `molecules/MessageList` 是较老的消息列表，纯文本渲染，简单 `scrollIntoView` 自动滚动，与 `ChatMessageList` 形成新旧两套体系。

下一节课读服务适配器：`ViewReconcilerAdapter` 和 `normalize-markdown-tables`。
