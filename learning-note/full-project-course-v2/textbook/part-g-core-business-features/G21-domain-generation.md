# G21：领域生成——`generateDomain` 怎么从答案中提取领域信息

> 本课核心问题：`generateDomain` 是怎么从访谈答案中生成 Domain 的？生成的 Domain 有哪些字段？哪些字段是硬编码的？

## 1. 开篇场景：小王的咖啡馆领域

小王回答"餐饮零售，社区咖啡馆"后，系统生成了一个 Domain：

```json
{
  "id": "dom-xxx",
  "name": "餐饮零售，社区咖啡馆",
  "description": "Project for 餐饮零售，社区咖啡馆 working in 独立经营 mode",
  "icon": "🔷",
  "color": "#3b82f6",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

这个 Domain 是怎么生成的？`name` 来自答案，`description` 是模板合成的，但 `icon` 和 `color` 为什么是固定的？

## 2. 两种领域生成策略

### 2.1 直接使用用户输入

```ts
function generateDomain(workDomain: string): Domain {
  return {
    id: uuidv4(),
    name: workDomain,
    description: workDomain,
    // ...
  };
}
```

优点：简单直接。
缺点：缺乏上下文（如工作模式）。

### 2.2 模板合成

```ts
function generateDomain(workDomain: string, workMode: string): Domain {
  return {
    id: uuidv4(),
    name: workDomain || 'My Project',
    description: `Project for ${workDomain} working in ${workMode} mode`,
    // ...
  };
}
```

优点：包含更多上下文信息。
缺点：模板是硬编码的，不够灵活。

OriginOS 选择了**模板合成**。

## 3. 源码精读：`generateDomain`

打开 [packages/core/src/lib/features/ontology/ontology-builder.ts](../../../../packages/core/src/lib/features/ontology/ontology-builder.ts)。

```ts
private generateDomain(workDomain: string, workMode: string): Domain {
  return {
    id: uuidv4(),
    name: workDomain || 'My Project',
    description: `Project for ${workDomain} working in ${workMode} mode`,
    icon: '🔷',
    color: '#3b82f6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
```

对应源码位置：[packages/core/src/lib/features/ontology/ontology-builder.ts 第 501—511 行](../../../../packages/core/src/lib/features/ontology/ontology-builder.ts#L501-L511)。

## 4. 字段分析

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| `id` | `uuidv4()` | 随机生成 |
| `name` | `workDomain \|\| 'My Project'` | 用户输入，为空时 fallback |
| `description` | 模板合成 | `Project for ${workDomain} working in ${workMode} mode` |
| `icon` | 硬编码 `'🔷'` | 所有 Domain 都一样 |
| `color` | 硬编码 `'#3b82f6'` | 所有 Domain 都一样（Tailwind blue-500） |
| `createdAt` / `updatedAt` | `new Date().toISOString()` | 当前时间 |

### 4.1 `name` 的 fallback

```ts
name: workDomain || 'My Project',
```

如果 `workDomain` 为空，`name` 会变成 `'My Project'`。这是一个英文 fallback，没有本地化。

### 4.2 `description` 的模板

```ts
description: `Project for ${workDomain} working in ${workMode} mode`,
```

模板是英文的，格式固定。对于小王的答案：

> "Project for 餐饮零售，社区咖啡馆 working in 独立经营 mode"

这个描述：
- 是英文格式，中文内容嵌入其中，看起来不自然。
- 没有利用 `workMode` 的语义（如"独立经营"是一个完整的中文短语，但模板把它当作英文名词使用）。

### 4.3 `icon` 和 `color` 的硬编码

```ts
icon: '🔷',
color: '#3b82f6',
```

所有 Domain 的 `icon` 都是 `🔷`，`color` 都是 `#3b82f6`（Tailwind blue-500）。这意味着：
- 无法通过图标或颜色区分不同领域。
- 前端展示时所有 Domain 看起来都一样。

## 5. 改进建议

### 5.1 动态图标和颜色

```ts
const DOMAIN_ICONS: Record<string, string> = {
  '餐饮': '🍽️',
  '咖啡': '☕',
  '软件': '💻',
  '设计': '🎨',
  // ...
};

const DOMAIN_COLORS: Record<string, string> = {
  '餐饮': '#8B4513',  // 棕色
  '咖啡': '#6F4E37',  // 咖啡色
  '软件': '#3b82f6',  // 蓝色
  '设计': '#ec4899',  // 粉色
  // ...
};

function generateDomain(workDomain: string, workMode: string): Domain {
  const icon = Object.entries(DOMAIN_ICONS).find(([key]) => 
    workDomain.includes(key))?.[1] || '🔷';
  const color = Object.entries(DOMAIN_COLORS).find(([key]) => 
    workDomain.includes(key))?.[1] || '#3b82f6';

  return {
    id: uuidv4(),
    name: workDomain || 'My Project',
    description: `Project for ${workDomain} working in ${workMode} mode`,
    icon,
    color,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
```

### 5.2 本地化描述

```ts
function generateDomain(workDomain: string, workMode: string): Domain {
  return {
    id: uuidv4(),
    name: workDomain || '我的项目',
    description: `${workDomain}项目，工作模式：${workMode}`,
    // ...
  };
}
```

## 6. 失败路径与边界

### 6.1 `workDomain` 为空

```ts
name: workDomain || 'My Project',
```

如果 `workDomain` 为空，`name` 变成 `'My Project'`（英文）。

### 6.2 `workMode` 为空

```ts
description: `Project for ${workDomain} working in ${workMode} mode`,
```

如果 `workMode` 为空，描述变成 `"Project for 餐饮零售 working in  mode"`（语法错误）。

### 6.3 超长 `workDomain`

```ts
name: workDomain || 'My Project',
```

如果 `workDomain` 超过数据库字段限制（如 255 字符），保存时会失败。

## 7. 测试证据与缺口

### 已覆盖

- `generateDomain` 没有直接单元测试。

### 缺口

- `workDomain` 为空时的 fallback 没有测试。
- `workMode` 为空时的描述生成没有测试。
- 超长 `workDomain` 的处理没有测试。
- 动态图标和颜色的映射没有测试。

## 8. 小实验：验证领域生成

### 步骤一：基本生成

```ts
import { ontologyService } from '@originos/core/lib/features/ontology';

const domain = ontologyService['generateDomain']('餐饮零售，社区咖啡馆', '独立经营');
console.log(domain.name);        // "餐饮零售，社区咖啡馆"
console.log(domain.description); // "Project for 餐饮零售，社区咖啡馆 working in 独立经营 mode"
console.log(domain.icon);        // "🔷"
console.log(domain.color);       // "#3b82f6"
```

### 步骤二：空输入

```ts
const domain2 = ontologyService['generateDomain']('', '');
console.log(domain2.name);        // "My Project"
console.log(domain2.description); // "Project for  working in  mode"
```

### 步骤三：超长输入

```ts
const longDomain = 'a'.repeat(300);
const domain3 = ontologyService['generateDomain'](longDomain, 'test');
console.log(domain3.name.length);  // 300
// 如果保存到数据库，可能会失败
```

### 实验结论

`generateDomain` 逻辑简单，但存在硬编码和边界问题。特别是空输入和超长输入需要处理。

## 9. 口头验收

读完本课后，应能不看书稿回答：

1. `generateDomain` 接收几个参数？分别是什么？
2. `name` 和 `description` 是怎么生成的？
3. `icon` 和 `color` 为什么是硬编码的？这会带来什么问题？
4. 如果 `workDomain` 为空，`name` 会变成什么？
5. 如果要让不同领域有不同的图标和颜色，应该怎么设计？

## 10. 章节收束

本课的核心认知是：**`generateDomain` 是一个简单的模板生成器，它从访谈答案中提取领域名称和工作模式，生成一个 Domain 对象。但 icon 和 color 是硬编码的，描述模板是英文的，缺乏灵活性和本地化**。

我们看到的几个关键设计：

- **模板合成**：`description` 是模板合成的，包含 `workDomain` 和 `workMode`。
- **硬编码默认值**：`icon` 和 `color` 对所有 Domain 都一样。
- **英文 fallback**：`name` 为空时 fallback 为 `'My Project'`（英文）。
- **英文模板**：`description` 是英文格式，中文内容嵌入其中。
- **无测试覆盖**：没有自动化测试。

下一课（G22）我们会深入 `generateConcepts`，看看概念是怎么从任务、工具、目标中提取的。
