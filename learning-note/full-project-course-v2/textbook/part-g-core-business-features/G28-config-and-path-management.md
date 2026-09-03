# G28：配置与路径管理——`config.ts` 怎么解析 ontologyId、生成存储路径、防止路径遍历

> 本课核心问题：`config.ts` 是怎么把 ontologyId 转换成文件路径的？`isValidId` 是怎么防止路径遍历攻击的？

## 1. 开篇场景：小王的数据存在哪里

小王的咖啡馆项目生成了本体数据。系统需要把这些数据存到文件系统的某个位置：

```
data/projects/cafe-project/ontology/
├── ontology.json
└── data/
    └── product/
        ├── _index.json
        ├── inst-001.json
        └── inst-002.json
```

这些路径是怎么生成的？`config.ts` 就是做这个的。

## 2. 两种路径管理策略

### 2.1 硬编码路径

```ts
const path = `data/projects/${projectId}/ontology/${conceptId}/${instanceId}.json`;
```

优点：简单直接。
缺点：重复代码，难以维护，容易出错。

### 2.2 集中配置

```ts
const path = instancePath(ontologyId, conceptId, instanceId);
```

OriginOS 选择了**集中配置**。

## 3. 源码精读：`config.ts`

打开 [packages/core/src/lib/features/ontology-data-store/config.ts](../../../../packages/core/src/lib/features/ontology-data-store/config.ts)。

### 3.1 从 ontologyId 提取 projectId

```ts
export function projectIdFromOntologyId(ontologyId: string): string {
  // 支持 "ontology-project-{projectId}"、"ontology_{projectId}"、"ontology-{projectId}" 格式
  if (ontologyId.startsWith('ontology-project-')) {
    return ontologyId.replace('ontology-project-', '');
  }
  if (ontologyId.startsWith('ontology_')) {
    return ontologyId.replace('ontology_', '');
  }
  if (ontologyId.startsWith('ontology-')) {
    return ontologyId.replace('ontology-', '');
  }
  return ontologyId;
}
```

对应源码位置：[packages/core/src/lib/features/ontology-data-store/config.ts 第 1—15 行](../../../../packages/core/src/lib/features/ontology-data-store/config.ts#L1-L15)。

支持三种前缀格式：
- `ontology-project-{projectId}`
- `ontology_{projectId}`
- `ontology-{projectId}`

如果没有前缀，直接返回原值。

### 3.2 生成本体目录路径

```ts
export function ontologyDir(ontologyId: string): string {
  const projectId = projectIdFromOntologyId(ontologyId);
  return `data/projects/${projectId}/ontology`;
}
```

对应源码位置：[packages/core/src/lib/features/ontology-data-store/config.ts 第 17—20 行](../../../../packages/core/src/lib/features/ontology-data-store/config.ts#L17-L20)。

### 3.3 生成实例目录和文件路径

```ts
export function instanceDir(ontologyId: string, conceptId: string): string {
  return `${ontologyDir(ontologyId)}/data/${conceptId}`;
}

export function instancePath(ontologyId: string, conceptId: string, instanceId: string): string {
  return `${instanceDir(ontologyId, conceptId)}/${instanceId}.json`;
}
```

对应源码位置：[packages/core/src/lib/features/ontology-data-store/config.ts 第 22—28 行](../../../../packages/core/src/lib/features/ontology-data-store/config.ts#L22-L28)。

### 3.4 生成索引路径

```ts
export function indexPath(ontologyId: string, conceptId: string): string {
  return `${instanceDir(ontologyId, conceptId)}/_index.json`;
}
```

对应源码位置：[packages/core/src/lib/features/ontology-data-store/config.ts 第 30—32 行](../../../../packages/core/src/lib/features/ontology-data-store/config.ts#L30-L32)。

### 3.5 生成版本目录和路径

```ts
export function versionDir(ontologyId: string, instanceId: string): string {
  return `${ontologyDir(ontologyId)}/versions/${instanceId}`;
}

export function versionPath(ontologyId: string, instanceId: string, version: number): string {
  return `${versionDir(ontologyId, instanceId)}/${version}.json`;
}
```

对应源码位置：[packages/core/src/lib/features/ontology-data-store/config.ts 第 34—40 行](../../../../packages/core/src/lib/features/ontology-data-store/config.ts#L34-L40)。

### 3.6 路径安全验证

```ts
export function isValidId(id: string): boolean {
  // 防止路径遍历：禁止包含 ../、./、/ 等路径分隔符
  if (id.includes('..') || id.includes('./') || id.startsWith('/')) {
    return false;
  }
  // 禁止空字符串
  if (!id || id.trim().length === 0) {
    return false;
  }
  // 只允许字母、数字、连字符、下划线
  return /^[a-zA-Z0-9_-]+$/.test(id);
}
```

对应源码位置：[packages/core/src/lib/features/ontology-data-store/config.ts 第 42—53 行](../../../../packages/core/src/lib/features/ontology-data-store/config.ts#L42-L53)。

## 4. 路径生成流程

```
ontologyId: "ontology-project-cafe-001"
  ↓
projectIdFromOntologyId("ontology-project-cafe-001")
  ↓
projectId: "cafe-001"
  ↓
ontologyDir("ontology-project-cafe-001")
  ↓
"data/projects/cafe-001/ontology"
  ↓
instanceDir("ontology-project-cafe-001", "product")
  ↓
"data/projects/cafe-001/ontology/data/product"
  ↓
instancePath("ontology-project-cafe-001", "product", "inst-001")
  ↓
"data/projects/cafe-001/ontology/data/product/inst-001.json"
```

## 5. 安全设计

### 5.1 路径遍历防护

```ts
isValidId('../etc/passwd');  // false
isValidId('/absolute/path');  // false
isValidId('normal-id');       // true
```

### 5.2 字符白名单

```ts
/^[a-zA-Z0-9_-]+$/
```

只允许：字母、数字、连字符、下划线。

### 5.3 空值检查

```ts
if (!id || id.trim().length === 0) {
  return false;
}
```

禁止空字符串和纯空白字符串。

## 6. 测试证据与缺口

### 已覆盖

```ts
it('isValidId returns true for normal IDs', async () => {
  const { isValidId } = await import('../config');
  expect(isValidId('test-id')).toBe(true);
  expect(isValidId('concept-123')).toBe(true);
});

it('isValidId rejects path traversal', async () => {
  const { isValidId } = await import('../config');
  expect(isValidId('../etc/passwd')).toBe(false);
  expect(isValidId('/absolute/path')).toBe(false);
});
```

对应源码位置：[packages/core/src/lib/features/ontology-data-store/__tests__/ontology-data-store.test.ts 第 121—132 行](../../../../packages/core/src/lib/features/ontology-data-store/__tests__/ontology-data-store.test.ts#L121-L132)。

### 缺口

- `projectIdFromOntologyId` 的三种前缀格式没有测试。
- 路径生成函数没有直接测试。

## 7. 小实验：验证路径生成

### 步骤一：生成路径

```ts
import { ontologyDir, instancePath, indexPath, isValidId } from '@originos/core/lib/features/ontology-data-store';

// 验证 ID
console.log(isValidId('cafe-001'));           // true
console.log(isValidId('../etc/passwd'));      // false

// 生成路径
console.log(ontologyDir('ontology-project-cafe-001'));
// "data/projects/cafe-001/ontology"

console.log(instancePath('ontology-project-cafe-001', 'product', 'inst-001'));
// "data/projects/cafe-001/ontology/data/product/inst-001.json"

console.log(indexPath('ontology-project-cafe-001', 'product'));
// "data/projects/cafe-001/ontology/data/product/_index.json"
```

### 实验结论

路径生成逻辑清晰，安全验证有效。

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `config.ts` 提供了哪些路径生成函数？
2. `isValidId` 是怎么防止路径遍历的？
3. `projectIdFromOntologyId` 支持哪些前缀格式？
4. 实例数据文件的路径格式是什么？
5. 索引文件的路径格式是什么？

## 9. 章节收束

本课的核心认知是 **`config.ts` 集中管理了所有路径生成逻辑，并通过 `isValidId` 防止了路径遍历攻击**。

我们看到的几个关键设计：

- **集中配置**：所有路径生成函数集中在一个文件。
- **多格式支持**：支持三种 ontologyId 前缀格式。
- **路径安全**：`isValidId` 禁止路径遍历字符。
- **字符白名单**：只允许字母、数字、连字符、下划线。
- **已测试**：`isValidId` 有单元测试覆盖。

下一课（G29）我们会深入 `store.ts`，看看实例的创建和读取。
