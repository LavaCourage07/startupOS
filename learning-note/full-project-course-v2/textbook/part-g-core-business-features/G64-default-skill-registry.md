# G64：DefaultSkillRegistry——技能是怎么注册的

> 本课核心问题：`DefaultSkillRegistry` 是怎么注册和存储技能的？

## 1. 开篇场景：OriginOS 启动时加载技能

OriginOS 启动时，需要：
1. 扫描内置技能目录。
2. 加载每个技能的元数据。
3. 注册到 SkillRegistry。
4. 后续通过名称查找技能。

## 2. 两种注册策略

### 2.1 硬编码注册

```ts
registry.register({
  name: 'task-manager',
  handler: taskManagerHandler,
});

registry.register({
  name: 'info-query',
  handler: infoQueryHandler,
});
```

缺点：每次新增技能都要修改代码。

### 2.2 动态扫描注册

```ts
const skills = await scanSkillsDirectory();
for (const skill of skills) {
  registry.register(skill);
}
```

OriginOS 选择了**动态扫描注册**。

## 3. 源码精读：`registry.ts`

打开 [packages/core/src/lib/features/skills/registry.ts](../../../../packages/core/src/lib/features/skills/registry.ts)。

### 3.1 DefaultSkillRegistry 类定义

```ts
class DefaultSkillRegistry implements SkillRegistry {
  private skills = new Map<string, LoadedSkill>();

  register(skill: LoadedSkill): void {
    this.skills.set(skill.metadata.name, skill);
  }

  get(name: string): LoadedSkill | undefined {
    return this.skills.get(name);
  }

  list(): LoadedSkill[] {
    return Array.from(this.skills.values());
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  unregister(name: string): boolean {
    return this.skills.delete(name);
  }
}
```

对应源码位置：[packages/core/src/lib/features/skills/registry.ts 第 1—136 行](../../../../packages/core/src/lib/features/skills/registry.ts#L1-L136)。

### 3.2 LoadedSkill 类型

```ts
interface LoadedSkill {
  metadata: SkillMetadata;
  handler: SkillHandler;
}

interface SkillMetadata {
  name: string;
  description: string;
  scope: 'bundled' | 'project' | 'user';
  tags: string[];
  version: string;
}

type SkillHandler = (context: SkillContext) => Promise<SkillResult>;
```

## 4. 图解：注册表结构

```
SkillRegistry
├─ "task-manager" → LoadedSkill { metadata, handler }
├─ "info-query"   → LoadedSkill { metadata, handler }
├─ "ontology-editor" → LoadedSkill { metadata, handler }
└─ ...
```

## 5. 设计亮点

### 5.1 Map 存储

```ts
private skills = new Map<string, LoadedSkill>();
```

- O(1) 查找。
- 自动去重（同名覆盖）。

### 5.2 接口抽象

```ts
interface SkillRegistry {
  register(skill: LoadedSkill): void;
  get(name: string): LoadedSkill | undefined;
  list(): LoadedSkill[];
  has(name: string): boolean;
  unregister(name: string): boolean;
}
```

## 6. 测试证据与缺口

### 已覆盖

- `DefaultSkillRegistry` 没有直接测试。

### 缺口

- 注册没有测试。
- 查找没有测试。
- 注销没有测试。

## 7. 小实验：注册技能

```ts
import { DefaultSkillRegistry } from '@originos/core/lib/features/skills';

const registry = new DefaultSkillRegistry();

// 注册技能
registry.register({
  metadata: {
    name: 'task-manager',
    description: '任务管理',
    scope: 'bundled',
    tags: ['task', 'management'],
    version: '1.0.0',
  },
  handler: async (context) => {
    return { success: true, data: { message: 'Hello' } };
  },
});

// 查找技能
const skill = registry.get('task-manager');
console.log(skill?.metadata.description);

// 列出所有技能
const skills = registry.list();
console.log(skills.length);
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `DefaultSkillRegistry` 用什么数据结构存储技能？
2. `register` 方法会覆盖同名技能吗？
3. `list` 方法返回什么？
4. `SkillRegistry` 接口有哪些方法？

## 9. 章节收束

本课的核心认知是 **`DefaultSkillRegistry` 通过 Map 存储技能，支持 O(1) 查找和动态注册**。

我们看到的几个关键设计：

- **Map 存储**：O(1) 查找，自动去重。
- **接口抽象**：`SkillRegistry` 接口便于替换实现。
- **动态注册**：支持运行时注册技能。
- **无测试**：没有直接测试覆盖。

下一课（G65）我们会看 `DefaultSkillRouter`，了解技能是怎么路由的。
