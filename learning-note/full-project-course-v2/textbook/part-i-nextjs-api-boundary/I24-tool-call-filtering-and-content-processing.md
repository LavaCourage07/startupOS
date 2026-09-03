# I24：工具调用过滤与 Content 处理

I19 课提到了 `stripToolCodeBlocks` 和 `isToolCallOnlyContent`。这节课专门解决一个问题：为什么需要工具调用过滤？它是如何工作的？

## 1. 问题背景：LLM 的工具调用描述

当 LLM 调用工具时，它可能在回复中包含工具调用的描述：

```
我将调用 read_file 工具来读取文件内容。

```json
{"name": "read_file", "args": {"path": "/data/file.txt"}}
```

文件内容是：Hello, world!
```

用户不希望看到工具调用的描述，只想看到最终结果。`stripToolCodeBlocks` 的作用就是过滤掉这些描述。

## 2. isToolCallOnlyContent：判断是否为工具调用描述

```ts
function isToolCallOnlyContent(content: string): boolean {
  const trimmed = content.trim();
  // 包含 JSON 工具调用块: {"name": "read_file", ...}
  if (/".*name".*:.*"(read_file|write_file|list_directory|bash|file)/i.test(trimmed)) return true;
  // 包含 YAML 工具调用: tool_name: xxx
  if (/tool_name\s*:/i.test(trimmed)) return true;
  // 包含函数调用语法: func(...)
  if (/[a-z_]+\s*\([^)]{0,200}\)/i.test(trimmed)) return true;
  // 匹配: *(调用工具: xxx) 等自然语言工具调用标记
  if (/[*`]*\s*[\(（]\s*(调用工具|Calling|Tool call)\s*[:：\s]/i.test(trimmed)) return true;
  // 匹配 **工具: xxx** 格式
  if (/\*\*工具\s*[:：\s]/i.test(trimmed)) return true;
  // 匹配纯 JSON 结果: {"status": "..."}
  if (/"status"\s*:/i.test(trimmed)) return true;
  return false;
}
```

### 2.1 六种匹配模式

| 模式 | 示例 | 说明 |
| --- | --- | --- |
| JSON 工具调用 | `{"name": "read_file", ...}` | 标准的工具调用 JSON |
| YAML 工具调用 | `tool_name: read_file` | YAML 格式的工具调用 |
| 函数调用语法 | `read_file("/data/file.txt")` | 类函数调用语法 |
| 自然语言标记 | `(调用工具: read_file)` | 中文工具调用标记 |
| Markdown 加粗 | `**工具: read_file**` | Markdown 格式的工具调用 |
| 纯 JSON 结果 | `{"status": "success"}` | 工具返回的 JSON 结果 |

### 2.2 误匹配风险

这些正则表达式可能误匹配正常内容。例如：

- `"name": "read_file"` 可能出现在正常的 JSON 示例中。
- `func(...)` 可能出现在代码示例中。
- `"status": "active"` 可能出现在正常的 JSON 数据中。

当前实现没有解决误匹配问题，这是一个已知限制。

## 3. stripToolCodeBlocks：移除工具调用描述

```ts
function stripToolCodeBlocks(content: string): string {
  // 1. 移除 code block（如果是工具调用或纯 JSON 结果）
  let result = content.replace(/```(?:json)?\s*\n([\s\S]*?)```/g, (match) => {
    return isToolCallOnlyContent(match) ? '' : match;
  });
  // 2. 逐行过滤：移除工具调用描述行
  result = result.split('\n').filter(line => {
    const trimmed = line.trim();
    if (trimmed === '') return false;
    if (/[*`]\s*[\(（]\s*(调用工具|Calling|Tool call)\s*[:：\s]/i.test(trimmed)) return false;
    if (/\*\*工具\s*[:：\s]/i.test(trimmed)) return false;
    if (/^\{?\s*"status"\s*:/i.test(trimmed)) return false;
    if (isToolCallOnlyContent(trimmed)) return false;
    return true;
  }).join('\n');
  // 3. 移除行内的 functionName(...) 模式
  result = result.replace(/[a-z_]+\s*\([^)]{0,200}\)/gi, '').trim();
  // 4. 清理空行
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}
```

### 3.1 四步处理

| 步骤 | 操作 | 目的 |
| --- | --- | --- |
| 1 | 移除 code block | 过滤工具调用的 JSON 块 |
| 2 | 逐行过滤 | 过滤工具调用描述行 |
| 3 | 移除函数调用语法 | 过滤行内的 `func(...)` |
| 4 | 清理空行 | 美化输出 |

### 3.2 副作用

`stripToolCodeBlocks` 可能误删正常内容：

1. **合法的 JSON code block**：如果 code block 包含 `"name"` 或 `"status"`，会被误删。
2. **代码示例**：如果包含 `func(...)`，会被误删。
3. **Markdown 格式**：如果包含 `**工具: xxx**`，会被误删。

## 4. 使用场景

### 4.1 项目级消息发送

```ts
            case 'message_end':
              if (event['message']?.role === 'assistant') {
                // ...
                let content = reconcileFinalStreamContent(
                  assistantContent,
                  extractTextContent(event['message']['content'])
                );
                if (content) {
                  content = stripToolCodeBlocks(content);
                  if (content) {
                    send({
                      type: 'assistant_message',
                      data: { content, isStreaming: false },
                    });
                  }
                }
              }
              break;
```

在 `message_end` 事件中，使用 `stripToolCodeBlocks` 过滤工具调用描述，只保留实际回复内容。

### 4.2 会话级消息发送

会话级消息发送没有使用 `stripToolCodeBlocks`，因为会话级 Agent（如 Skill）通常不调用工具，或工具调用描述已经由前端处理。

## 5. 与会话级消息发送的对比

| 维度 | 项目级 | 会话级 |
| --- | --- | --- |
| 工具调用过滤 | `stripToolCodeBlocks` | 无 |
| 适用场景 | Project Agent（调用工具） | Skill Agent（不调用工具） |
| 误匹配风险 | 有 | 无 |

## 6. 失败路径

### 6.1 误过滤正常内容

如果 LLM 的回复包含合法的 JSON code block 或代码示例，可能被误删。这是当前实现的固有限制。

### 6.2 过滤不完全

如果 LLM 的工具调用描述使用了新的格式（不在六种匹配模式中），`isToolCallOnlyContent` 无法识别，导致过滤不完全。

### 6.3 性能问题

`stripToolCodeBlocks` 使用正则表达式和字符串替换，对于长文本可能性能较差。

## 7. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 代码阅读 | 过滤逻辑清晰 | 所有工具调用格式都能过滤 |
| 运行观察 | 工具调用描述被过滤 | 正常内容不被误删 |
| 单元测试 | 函数逻辑正确 | 所有 LLM 输出都能正确处理 |

## 8. 小实验

不运行项目，回答：

1. `isToolCallOnlyContent('{"name": "read_file", "args": {"path": "/data/file.txt"}}')` 返回什么？
2. `stripToolCodeBlocks('Hello\n\n```json\n{"name": "read_file"}\n```\n\nWorld')` 返回什么？
3. 为什么会话级消息发送不使用 `stripToolCodeBlocks`？

参考答案：

1. `true`，因为匹配 JSON 工具调用模式。
2. `'Hello\n\nWorld'`，因为 code block 被移除。
3. 会话级 Agent（如 Skill）通常不调用工具，或工具调用描述已经由前端处理。

## 9. 章节收束

本节课深入工具调用过滤的实现：`isToolCallOnlyContent` 判断是否为工具调用描述，`stripToolCodeBlocks` 移除工具调用描述。项目级消息发送使用这些函数过滤工具调用，会话级消息发送不使用。

下一节课是 Unit 4 的总结工作坊，会把 I18–I24 的知识整合成一张排查地图。
