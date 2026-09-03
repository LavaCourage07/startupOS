# 单元导读五：Document 解析、API 客户端与沙箱安全

> 本单元总问题：OriginOS 是怎么解析 Office 文档的？API 客户端是怎么封装底层服务的？沙箱是怎么保证安全的？

## 0. 本页先读什么

如果只记住一句话，记住这一句：

> **Document 模块把 Office 文件解析成结构化 AST，API 客户端封装了 Electron 服务调用，沙箱通过路径隔离和控制台桥接保证安全。**

## 1. 本单元在讲什么

上一单元（G27–G38）讲的是"本体数据存储"——系统如何管理实例数据的 CRUD、查询和版本。但 OriginOS 还需要处理更多类型的数据：

- **Office 文档**：用户上传的 docx、xlsx 文件需要被解析。
- **API 调用**：前端需要调用后端的访谈、本体等服务。
- **沙箱应用**：用户技能生成的 HTML 应用需要安全运行。

这就是 Document、API Clients、Sandbox 三个模块的职责。

## 2. 本单元的 8 节课

| 课号 | 课题 | 核心问题 |
| --- | --- | --- |
| G39 | Document 类型系统 | `types.ts` 定义了哪些文档类型？DocumentAst 和 WorkbookAst 是怎么设计的？ |
| G40 | Office ZIP 解析器 | `OfficeZip` 是怎么解析 docx/xlsx 文件的？ZIP 结构是怎么被读取的？ |
| G41 | 文档解析引擎 | `parseDocument` 和 `parseWorkbook` 是怎么把文件转成 AST 的？ |
| G42 | API 客户端设计 | `interviewApi` 是怎么封装 Electron 服务的？ |
| G43 | 沙箱应用扫描器 | `listSandboxApps` 是怎么发现 /data 下的 HTML 应用的？ |
| G44 | 沙箱路径解析器 | `resolveSandboxFilePath` 是怎么防止目录穿越的？ |
| G45 | 控制台桥接 | `CONSOLE_BRIDGE_SCRIPT` 是怎么把沙箱日志传出来的？ |
| G46 | 单元小结课 | 画出"文档解析 → API 调用 → 沙箱运行"的完整调用链 |

## 3. 本单元涉及的源码文件

```
packages/core/src/lib/features/document/
├── index.ts                    # 公共 API 导出
├── types.ts                    # DocumentAst, WorkbookAst 等类型
├── parsers.ts                  # parseDocument, parseWorkbook
└── office-zip.ts               # OfficeZip ZIP 解析器

packages/core/src/lib/features/api-clients/
├── index.ts                    # 公共 API 导出
└── interviewApi.ts             # interviewApi 封装

packages/core/src/lib/features/sandbox/
├── index.ts                    # 公共 API 导出
├── app-scanner.ts              # listSandboxApps
├── path-resolver.ts            # resolveSandboxFilePath
├── console-bridge.ts           # CONSOLE_BRIDGE_SCRIPT
└── mime.ts                     # getMimeType
```

## 4. 主线案例：小王的咖啡馆文档处理

本单元沿用"小王开社区咖啡馆"案例：

1. 小王上传了一个 `menu.docx` 文件，系统用 `parseDocument` 解析成 AST。
2. 小王上传了一个 `inventory.xlsx` 文件，系统用 `parseWorkbook` 解析成表格数据。
3. 前端通过 `interviewApi` 调用后端服务创建访谈。
4. 小王安装了一个技能，生成了 HTML 应用，系统用 `listSandboxApps` 发现并展示。
5. 小王打开 HTML 应用，沙箱通过 `CONSOLE_BRIDGE_SCRIPT` 把日志传回主窗口。

## 5. 关键概念速览

### 5.1 文档解析流程

```
.docx / .xlsx 文件
  ↓
OfficeZip（ZIP 解析）
  ↓
XML 提取（word/document.xml, xl/workbook.xml）
  ↓
AST（DocumentAst / WorkbookAst）
  ↓
渲染文本 / 表格数据
```

### 5.2 API 客户端架构

```
前端（React）
  ↓
api-clients/interviewApi.ts
  ↓
integrations/electron/services/
  ↓
Electron 主进程
```

### 5.3 沙箱安全模型

```
沙箱 HTML 应用
  ├── 路径隔离（resolveSandboxFilePath）
  ├── 控制台桥接（CONSOLE_BRIDGE_SCRIPT）
  └── MIME 类型限制（getMimeType）
```

## 6. 与前后单元的衔接

**上游（单元四 G27–G38）：**
- 本体数据存储提供了结构化的数据管理。
- Document 模块为本体数据提供了文档导入能力。

**下游（单元六 G47–G60）：**
- 动画、系统、Taste、Culture 等模块使用 Document 和 API Clients。
- 沙箱为技能系统提供了安全的运行环境。

## 7. 阅读建议

按以下顺序阅读本单元：

1. 先读 G39，理解文档类型系统。
2. 读 G40，理解 Office ZIP 解析器。
3. 读 G41，理解文档解析引擎。
4. 读 G42，理解 API 客户端设计。
5. 读 G43，理解沙箱应用扫描器。
6. 读 G44，理解沙箱路径解析器。
7. 读 G45，理解控制台桥接。
8. 最后做 G46 工作坊，画出完整调用链。

---

**准备好后，从 G39 开始。**
