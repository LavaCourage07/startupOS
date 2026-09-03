# G31：Schema 验证——`validateInstance` 和 `loadConceptSchema` 是怎么验证数据的

> 本课核心问题：`validateInstance` 是怎么验证实例数据的？`loadConceptSchema` 是怎么从 ontology.json 加载 Schema 的？严格模式是怎么工作的？

## 1. 开篇场景：小王录入了一个错误的价格

小王录入商品时，不小心把价格写成了字符串：

```ts
{
  name: '埃塞俄比亚耶加雪菲咖啡豆',
  price: '128',  // 应该是数字，但写成了字符串
  stock: 50,
}
```

系统需要检测到这个问题并阻止保存。这就是 Schema 验证的职责。

## 2. 两种验证策略

### 2.1 宽松验证

```ts
// 不验证类型，任何数据都可以保存
function save(data: any) {
  db.write(data);
}
```

优点：灵活，不会报错。
缺点：数据质量无法保证。

### 2.2 严格验证

```ts
// 验证类型、必填项、枚举值
validateInstance(fields, schema);
```

OriginOS 选择了**严格验证**。

## 3. 源码精读：`validateInstance`

打开 [packages/core/src/lib/features/ontology-data-store/schema-validator.ts](../../../../packages/core/src/lib/features/ontology-data-store/schema-validator.ts)。

### 3.1 入口方法

```ts
export function validateInstance(
  fields: Record<string, unknown>,
  schema: ConceptSchema,
): void {
  const errors: string[] = [];

  for (const field of schema.fields) {
    const value = fields[field.name];

    // 1. 检查必填项
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`字段 "${field.name}" 是必填项`);
      continue;
    }

    // 2. 如果值为空且非必填，跳过
    if (value === undefined || value === null) {
      continue;
    }

    // 3. 检查类型
    const typeError = validateType(field, value);
    if (typeError) {
      errors.push(typeError);
      continue;
    }

    // 4. 检查枚举值
    if (field.enum && !field.enum.includes(String(value))) {
      errors.push(`字段 "${field.name}" 的值 "${value}" 不在允许范围内`);
    }
  }

  // 5. 严格模式：检查未知字段
  const knownFields = new Set(schema.fields.map((f) => f.name));
  for (const key of Object.keys(fields)) {
    if (!knownFields.has(key) && !key.startsWith('_ext_')) {
      errors.push(`未知字段 "${key}"`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Schema 验证失败: ${errors.join(', ')}`);
  }
}
```

对应源码位置：[packages/core/src/lib/features/ontology-data-store/schema-validator.ts 第 1—50 行](../../../../packages/core/src/lib/features/ontology-data-store/schema-validator.ts#L1-L50)。

### 3.2 流程分析

```
validateInstance
  ├─ 1. 遍历 Schema 字段
  │    ├─ 检查必填项
  │    ├─ 检查类型
  │    └─ 检查枚举值
  ├─ 2. 检查未知字段（严格模式）
  └─ 3. 如果有错误，抛出异常
```

### 3.3 类型验证

```ts
function validateType(field: ConceptField, value: unknown): string | undefined {
  switch (field.type) {
    case 'string':
      if (typeof value !== 'string') return `字段 "${field.name}" 必须是字符串`;
      break;
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return `字段 "${field.name}" 必须是数字`;
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return `字段 "${field.name}" 必须是布尔值`;
      break;
    case 'date':
      if (!(value instanceof Date) && !isValidDateString(value)) {
        return `字段 "${field.name}" 必须是有效日期`;
      }
      break;
    case 'array':
      if (!Array.isArray(value)) return `字段 "${field.name}" 必须是数组`;
      break;
    case 'object':
      if (typeof value !== 'object' || value === null) {
        return `字段 "${field.name}" 必须是对象`;
      }
      break;
    case 'relation':
      if (typeof value !== 'string') return `字段 "${field.name}" 必须是字符串（关系 ID）`;
      break;
  }
  return undefined;
}
```

对应源码位置：[packages/core/src/lib/features/ontology-data-store/schema-validator.ts 第 52—85 行](../../../../packages/core/src/lib/features/ontology-data-store/schema-validator.ts#L52-L85)。

## 4. 源码精读：`loadConceptSchema`

### 4.1 入口方法

```ts
export async function loadConceptSchema(
  ontologyId: string,
  conceptId: string,
): Promise<ConceptSchema> {
  if (!isValidId(ontologyId) || !isValidId(conceptId)) {
    throw new Error('Invalid IDs: path traversal detected');
  }

  const ontologyPath = schemaPath(ontologyId);
  const content = await fs.readFile(ontologyPath, 'utf-8');
  const ontology = JSON.parse(content) as OntologyData;

  const concept = ontology.concepts.find((c) => c.id === conceptId);
  if (!concept) {
    throw new Error(`Concept "${conceptId}" 不存在`);
  }

  return {
    conceptId: concept.id,
    domainId: concept.domainId,
    ontologyId,
    name: concept.name,
    fields: Object.entries(concept.attributes || {}).map(([name, attr]) => ({
      name,
      type: attr.type,
      required: attr.required,
      description: attr.description,
      enum: attr.enum,
    })),
  };
}
```

对应源码位置：[packages/core/src/lib/features/ontology-data-store/schema-validator.ts 第 87—115 行](../../../../packages/core/src/lib/features/ontology-data-store/schema-validator.ts#L87-L115)。

### 4.2 流程分析

```
loadConceptSchema
  ├─ 1. 验证 ID
  ├─ 2. 读取 ontology.json
  ├─ 3. 查找 Concept
  ├─ 4. 映射 attributes 到 ConceptField[]
  └─ 返回 ConceptSchema
```

## 5. 严格模式

### 5.1 未知字段检查

```ts
const knownFields = new Set(schema.fields.map((f) => f.name));
for (const key of Object.keys(fields)) {
  if (!knownFields.has(key) && !key.startsWith('_ext_')) {
    errors.push(`未知字段 "${key}"`);
  }
}
```

如果字段不在 Schema 中，且不以 `_ext_` 开头，就报错。

### 5.2 扩展字段

```ts
const fields = {
  name: '咖啡豆',
  price: 128,
  _ext_customField: '自定义值',  // 以 _ext_ 开头，不会报错
};
```

以 `_ext_` 开头的字段被视为扩展字段，不会被严格模式拒绝。

## 6. 测试证据与缺口

### 已覆盖

```ts
it('validateInstance passes valid instance', async () => {
  const { validateInstance, loadConceptSchema } = await import('../schema-validator');

  const schema = await loadConceptSchema(TEST.ontologyId, TEST.conceptId);
  expect(() => validateInstance({ name: '张三', status: 'active' }, schema)).not.toThrow();
});

it('validateInstance fails on missing required field', async () => {
  const { validateInstance, loadConceptSchema } = await import('../schema-validator');

  const schema = await loadConceptSchema(TEST.ontologyId, TEST.conceptId);
  expect(() => validateInstance({ status: 'active' }, schema)).toThrow('必填项');
});

it('validateInstance fails on wrong type', async () => {
  const { validateInstance, loadConceptSchema } = await import('../schema-validator');

  const schema = await loadConceptSchema(TEST.ontologyId, TEST.conceptId);
  expect(() => validateInstance({ name: 123, status: 'active' }, schema)).toThrow('字符串');
});

it('validateInstance fails on invalid enum value', async () => {
  const { validateInstance, loadConceptSchema } = await import('../schema-validator');

  const schema = await loadConceptSchema(TEST.ontologyId, TEST.conceptId);
  expect(() => validateInstance({ name: '张三', status: 'unknown' }, schema)).toThrow('不在允许范围内');
});
```

对应源码位置：[packages/core/src/lib/features/ontology-data-store/__tests__/ontology-data-store.test.ts 第 240—287 行](../../../../packages/core/src/lib/features/ontology-data-store/__tests__/ontology-data-store.test.ts#L240-L287)。

### 缺口

- 严格模式（未知字段）没有直接测试。
- `_ext_` 前缀的扩展字段没有测试。
- `date` 类型的验证没有测试。

## 7. 小实验：验证 Schema

### 步骤一：验证有效数据

```ts
import { validateInstance, loadConceptSchema } from '@originos/core/lib/features/ontology-data-store';

const schema = await loadConceptSchema('ontology-project-cafe-001', 'product');

// 通过
validateInstance({
  name: '埃塞俄比亚耶加雪菲咖啡豆',
  price: 128,
  stock: 50,
}, schema);
```

### 步骤二：验证无效数据

```ts
// 失败：price 是字符串
validateInstance({
  name: '埃塞俄比亚耶加雪菲咖啡豆',
  price: '128',  // 错误！
  stock: 50,
}, schema);
// Error: Schema 验证失败: 字段 "price" 必须是数字

// 失败：缺少必填项
validateInstance({
  price: 128,
}, schema);
// Error: Schema 验证失败: 字段 "name" 是必填项
```

### 实验结论

Schema 验证严格，能有效防止脏数据。

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `validateInstance` 验证哪些内容？
2. 严格模式是怎么工作的？
3. `_ext_` 前缀的字段有什么特殊作用？
4. `loadConceptSchema` 是怎么加载 Schema 的？
5. 如果验证失败，会发生什么？

## 9. 章节收束

本课的核心认知是 **`validateInstance` 通过严格模式验证字段类型、必填项、枚举值和未知字段，保证数据质量**。

我们看到的几个关键设计：

- **严格验证**：验证类型、必填项、枚举值。
- **严格模式**：拒绝未知字段（`_ext_` 除外）。
- **扩展字段**：`_ext_` 前缀的字段被允许。
- **动态加载**：从 `ontology.json` 动态加载 Schema。
- **已测试**：必填项、类型、枚举值有测试覆盖。

下一课（G32）我们会深入 `query-engine.ts`，看看查询引擎是怎么工作的。
