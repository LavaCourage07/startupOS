# G39：Document 类型系统——`types.ts` 定义了哪些文档类型

> 本课核心问题：`types.ts` 定义了哪些文档类型？DocumentAst 和 WorkbookAst 是怎么设计的？

## 1. 开篇场景：小王上传了一个菜单文档

小王要把咖啡馆的菜单导入系统。菜单是一个 Word 文档（`menu.docx`），包含：
- 标题："社区咖啡馆菜单"
- 段落：各种咖啡和甜点的介绍
- 表格：价格表

系统需要把这些内容解析成结构化的 AST，才能被 Agent 理解和处理。

## 2. 两种设计策略

### 2.1 纯文本提取

```ts
const text = await extractText('menu.docx');
// "社区咖啡馆菜单 拿铁 28元 ..."
```

优点：简单。
缺点：丢失了结构信息（标题、段落、表格）。

### 2.2 结构化 AST

```ts
const ast = await parseDocument('menu.docx');
// { type: 'docx', blocks: [...], tables: [...] }
```

OriginOS 选择了**结构化 AST**。

## 3. 源码精读：`types.ts`

打开 [packages/core/src/lib/features/document/types.ts](../../../../packages/core/src/lib/features/document/types.ts)。

### 3.1 支持的文档类型

```ts
export type SupportedDocumentType = 'docx' | 'txt' | 'md' | 'json' | 'xml' | 'html';
```

对应源码位置：[packages/core/src/lib/features/document/types.ts 第 1 行](../../../../packages/core/src/lib/features/document/types.ts#L1)。

### 3.2 DocumentAst

```ts
export interface DocumentAst {
  type: SupportedDocumentType;
  title?: string;
  blocks: DocumentBlock[];
  tables: DocumentTable[];
  metadata: DocumentMetadata;
}
```

对应源码位置：[packages/core/src/lib/features/document/types.ts 第 23—29 行](../../../../packages/core/src/lib/features/document/types.ts#L23-L29)。

### 3.3 DocumentBlock

```ts
export interface DocumentBlock {
  type: 'heading' | 'paragraph';
  text: string;
  level?: number;
}
```

对应源码位置：[packages/core/src/lib/features/document/types.ts 第 12—16 行](../../../../packages/core/src/lib/features/document/types.ts#L12-L16)。

### 3.4 DocumentTable

```ts
export interface DocumentTable {
  index: number;
  rows: string[][];
}
```

对应源码位置：[packages/core/src/lib/features/document/types.ts 第 18—21 行](../../../../packages/core/src/lib/features/document/types.ts#L18-L21)。

### 3.5 WorkbookAst

```ts
export interface WorkbookAst {
  type: SupportedWorkbookType;
  sheets: WorkbookSheet[];
  metadata: WorkbookMetadata;
}
```

对应源码位置：[packages/core/src/lib/features/document/types.ts 第 54—58 行](../../../../packages/core/src/lib/features/document/types.ts#L54-L58)。

### 3.6 WorkbookSheet

```ts
export interface WorkbookSheet {
  name: string;
  rowCount: number;
  columnCount: number;
  merges: string[];
  rows: string[][];
  cells: WorkbookCell[];
}
```

对应源码位置：[packages/core/src/lib/features/document/types.ts 第 45—52 行](../../../../packages/core/src/lib/features/document/types.ts#L45-L52)。

## 4. 类型之间的关系

```
DocumentAst
  ├── type: 'docx' | 'txt' | 'md' | ...
  ├── title?: string
  ├── blocks: DocumentBlock[]
  │     ├── type: 'heading' | 'paragraph'
  │     ├── text: string
  │     └── level?: number
  ├── tables: DocumentTable[]
  │     ├── index: number
  │     └── rows: string[][]
  └── metadata: DocumentMetadata

WorkbookAst
  ├── type: 'xlsx' | 'csv'
  ├── sheets: WorkbookSheet[]
  │     ├── name: string
  │     ├── rowCount, columnCount
  │     ├── merges: string[]
  │     ├── rows: string[][]
  │     └── cells: WorkbookCell[]
  └── metadata: WorkbookMetadata
```

## 5. 设计亮点

### 5.1 分离文档和表格

```ts
// 文档：docx, txt, md, json, xml, html
interface DocumentAst { ... }

// 表格：xlsx, csv
interface WorkbookAst { ... }
```

文档和表格使用不同的 AST，因为它们的结构差异很大。

### 5.2 统一的元数据

```ts
interface DocumentMetadata {
  fileName: string;
  extension: string;
  sizeBytes: number;
  parser: string;
}
```

所有文档都有统一的元数据，便于管理和追踪。

## 6. 测试证据与缺口

### 已覆盖

- 类型定义本身没有直接测试。

### 缺口

- 类型兼容性没有测试。
- 边界值没有测试。

## 7. 小实验：验证类型

```ts
import { DocumentAst, WorkbookAst } from '@originos/core/lib/features/document';

const doc: DocumentAst = {
  type: 'docx',
  title: '社区咖啡馆菜单',
  blocks: [
    { type: 'heading', level: 1, text: '社区咖啡馆菜单' },
    { type: 'paragraph', text: '欢迎来到我们的社区咖啡馆！' },
  ],
  tables: [
    { index: 0, rows: [['拿铁', '28'], ['美式', '22']] },
  ],
  metadata: {
    fileName: 'menu.docx',
    extension: '.docx',
    sizeBytes: 10240,
    parser: 'office-zip-docx',
  },
};

console.log(doc.blocks[0].text);  // "社区咖啡馆菜单"
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `DocumentAst` 包含哪些字段？
2. `DocumentBlock` 支持哪些类型？
3. `WorkbookAst` 和 `DocumentAst` 有什么区别？
4. `DocumentMetadata` 包含哪些信息？
5. 为什么文档和表格要分开设计？

## 9. 章节收束

本课的核心认知是 **`types.ts` 定义了严格的文档类型系统，分离了文档 AST 和表格 AST，统一了元数据**。

我们看到的几个关键设计：

- **严格类型**：`DocumentAst`、`WorkbookAst` 都有明确的类型定义。
- **结构分离**：文档和表格使用不同的 AST。
- **统一元数据**：所有文档都有 `DocumentMetadata`。
- **支持多种格式**：docx、txt、md、json、xml、html、xlsx、csv。

下一课（G40）我们会深入 `office-zip.ts`，看看 ZIP 解析器是怎么工作的。
