# G46：单元小结课——画出"文档解析 → API 调用 → 沙箱运行"的完整调用链

> 本课核心问题：从 G39 到 G45，我们已经把 Document、API Clients、Sandbox 拆成了七节课。现在请你脱离源码，把"文档解析 → API 调用 → 沙箱运行"的完整旅程画出来，并标出每个关键节点的责任方、数据格式、失败路径和测试缺口。

## 1. 开篇场景：七节课之后，小王的数据终于能用了

让我们回到小王的视角：

1. 小王上传了 `menu.docx`，系统用 `parseDocument` 解析成 AST。
2. 小王上传了 `inventory.xlsx`，系统用 `parseWorkbook` 解析成表格数据。
3. 小王点击"开始访谈"，前端通过 `interviewApi` 调用后端服务。
4. 小王安装了一个技能，系统用 `listSandboxApps` 发现 HTML 应用。
5. 小王打开 HTML 应用，沙箱通过 `CONSOLE_BRIDGE_SCRIPT` 把日志传回主窗口。

## 2. 概念阶梯回顾

### 2.1 从直觉到术语

| 直觉说法 | 专业术语 | 对应源码 |
| --- | --- | --- |
| "小王上传了一个 Word 文档" | `parseDocument` | `parsers.ts` |
| "系统提取了文档内容" | `parseDocxParagraphs` | `parsers.ts` |
| "系统提取了表格数据" | `parseDocxTables` | `parsers.ts` |
| "系统解析了 Excel" | `parseWorkbook` | `parsers.ts` |
| "前端调用了后端服务" | `interviewApi.createInterview` | `interviewApi.ts` |
| "系统发现了技能应用" | `listSandboxApps` | `app-scanner.ts` |
| "系统安全地加载了文件" | `resolveSandboxFilePath` | `path-resolver.ts` |
| "系统看到了沙箱日志" | `CONSOLE_BRIDGE_SCRIPT` | `console-bridge.ts` |

### 2.2 关键边界

本单元反复强调的边界：

- **`document/` 负责文档解析。**
- **`api-clients/` 负责 API 封装。**
- **`sandbox/` 负责沙箱安全。**
- **所有模块都没有直接测试。**

## 3. 完整调用链图解

```mermaid
flowchart TD
    subgraph Document["文档解析"]
        D1["parseDocument('menu.docx')"]
        D2["OfficeZip.fromFile"]
        D3["parseDocxParagraphs"]
        D4["parseDocxTables"]
        D5["DocumentAst"]
    end

    subgraph Workbook["表格解析"]
        W1["parseWorkbook('inventory.xlsx')"]
        W2["OfficeZip.fromFile"]
        W3["parseSheetXml"]
        W4["WorkbookAst"]
    end

    subgraph Api["API 调用"]
        A1["interviewApi.createInterview"]
        A2["interviewApi.submitAnswer"]
        A3["interviewApi.completeInterview"]
    end

    subgraph Sandbox["沙箱运行"]
        S1["listSandboxApps"]
        S2["resolveSandboxFilePath"]
        S3["getMimeType"]
        S4["CONSOLE_BRIDGE_SCRIPT"]
    end

    D1 --> D2 --> D3 --> D4 --> D5
    W1 --> W2 --> W3 --> W4
    A1 --> A2 --> A3
    S1 --> S2 --> S3 --> S4
```

## 4. 节点责任表

| 步骤 | 负责人 | 输入 | 输出 | 关键设计决策 |
| --- | --- | --- | --- | --- |
| 解析文档 | `parseDocument` | 文件路径 | `DocumentAst` | ZIP 解析 + 正则提取 |
| 解析段落 | `parseDocxParagraphs` | XML 字符串 | `DocumentBlock[]` | 正则匹配 |
| 解析表格 | `parseDocxTables` | XML 字符串 | `DocumentTable[]` | 正则匹配 |
| 解析表格 | `parseWorkbook` | 文件路径 | `WorkbookAst` | ZIP 解析 + XML |
| 创建访谈 | `interviewApi.createInterview` | `CreateInterviewRequest` | `ApiResponse` | 封装 Electron 服务 |
| 提交答案 | `interviewApi.submitAnswer` | `interviewId, questionId, answer` | `ApiResponse` | 参数转换 |
| 发现应用 | `listSandboxApps` | 无 | `SandboxAppInfo[]` | 递归扫描 |
| 解析路径 | `resolveSandboxFilePath` | `appId, filePath` | 路径或 null | 多层安全验证 |
| 桥接日志 | `CONSOLE_BRIDGE_SCRIPT` | 无 | postMessage | 拦截 + 转发 |

## 5. 数据格式转换链

```
menu.docx
  ↓
OfficeZip.fromFile
  ↓
word/document.xml
  ↓
parseDocxParagraphs / parseDocxTables
  ↓
DocumentAst {
  type: 'docx',
  title: '社区咖啡馆菜单',
  blocks: [...],
  tables: [...],
  metadata: { ... }
}
```

## 6. 失败路径复盘

### 6.1 文档解析

| 失败场景 | 处理方式 | 风险 |
| --- | --- | --- |
| 文件不存在 | 抛出错误 | 正常 |
| ZIP 结构损坏 | 抛出错误 | 正常 |
| XML 格式错误 | 可能解析失败 | 数据丢失 |
| 不支持的格式 | 抛出错误 | 正常 |

### 6.2 API 调用

| 失败场景 | 处理方式 | 风险 |
| --- | --- | --- |
| Electron 服务不可用 | 抛出错误 | 功能不可用 |
| 网络错误 | 抛出错误 | 数据丢失 |
| 参数错误 | 抛出错误 | 正常 |

### 6.3 沙箱运行

| 失败场景 | 处理方式 | 风险 |
| --- | --- | --- |
| 路径穿越 | 返回 null | 安全 |
| 文件不存在 | 返回 null | 正常 |
| 目录请求 | 返回 null | 安全 |
| 沙箱崩溃 | 无法捕获 | 需要重启 |

## 7. 测试覆盖复盘

| 能力 | 测试位置 | 覆盖状态 |
| --- | --- | --- |
| `parseDocument` | 无 | 未覆盖 |
| `parseWorkbook` | 无 | 未覆盖 |
| `OfficeZip` | 无 | 未覆盖 |
| `interviewApi` | 无 | 未覆盖 |
| `listSandboxApps` | 无 | 未覆盖 |
| `resolveSandboxFilePath` | 无 | 未覆盖 |
| `CONSOLE_BRIDGE_SCRIPT` | 无 | 未覆盖 |
| `getMimeType` | 无 | 未覆盖 |

## 8. 工作坊练习

### 练习一：画出调用链

请拿一张纸或打开一个白板工具，不看书稿，画出以下调用链：

1. 小王上传 docx 文件。
2. 系统解析 ZIP，提取 XML。
3. 系统解析段落和表格。
4. 小王点击"开始访谈"。
5. 前端通过 interviewApi 调用后端。
6. 小王安装技能。
7. 系统发现 HTML 应用。
8. 小王打开应用，日志传回主窗口。

要求：
- 每个箭头标注调用的函数/方法名。
- 每个节点标注输入和输出的数据格式。
- 在每个节点旁边写出一个可能的失败场景。

### 练习二：找出设计问题

请列出至少三个设计问题：

| 问题 | 影响 | 改进建议 |
| --- | --- | --- |
| 无测试覆盖 | 无法验证功能正确性 | 补单元测试 |
| 正则解析 XML | 可能解析失败 | 使用 XML 解析器 |
| 无缓存 | 重复解析相同文件 | 增加解析缓存 |
| 沙箱无隔离 | 可能访问敏感资源 | 增加 CSP 和 iframe sandbox |
| 日志无过滤 | 可能泄露敏感信息 | 增加日志过滤 |

### 练习三：补测试计划

假设你只能补三个测试，你会优先补哪三个？请说明理由。

参考答案（不唯一）：

1. **`OfficeZip` 解析测试**
   - 理由：ZIP 解析是文档解析的基础，需要验证。

2. **`resolveSandboxFilePath` 安全测试**
   - 理由：安全是关键，需要验证路径穿越防护。

3. **`interviewApi` 集成测试**
   - 理由：API 客户端是前后端交互的桥梁，需要验证。

## 9. 口头验收

完成本单元后，应能不看书稿回答：

1. `parseDocument` 是怎么解析 docx 的？
2. `interviewApi` 提供了哪些方法？
3. `listSandboxApps` 是怎么发现应用的？
4. `resolveSandboxFilePath` 是怎么保证安全的？
5. `CONSOLE_BRIDGE_SCRIPT` 是怎么工作的？

## 10. 章节收束

本单元（G39—G46）围绕"文档解析 → API 调用 → 沙箱运行"这一流程，拆解了 OriginOS 的 Document、API Clients、Sandbox 三个模块。

我们学到的核心认知：

- **文档解析**：通过 `OfficeZip` 自定义解析 ZIP，通过正则提取内容。
- **API 客户端**：通过 `interviewApi` 封装 Electron 服务，提供类型安全。
- **沙箱安全**：通过 `resolveSandboxFilePath` 多层验证，通过 `CONSOLE_BRIDGE_SCRIPT` 桥接日志。
- **无测试覆盖**：所有模块都没有直接测试。

下一单元（G47—G60）我们将进入**动画、系统、Taste、Culture**，看看 OriginOS 的动画系统和配置管理。

---

**本单元到此结束。**
