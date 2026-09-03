# G71：用户注册表——`listUserAgents` 和 `listUserSkills`

> 本课核心问题：用户注册表是怎么扫描和解析 Agent/Skill 的？

## 1. 开篇场景：小王查看自己的 Agent

小王在 OriginOS 中打开"我的 Agent"页面，系统需要：
1. 扫描 `data/agents/` 目录。
2. 解析每个 Agent 的 `Agent.md` 文件。
3. 提取 frontmatter 元数据。
4. 返回 Agent 列表。

## 2. 两种扫描策略

### 2.1 手动注册

```ts
const agents = [
  { name: 'MyAgent', description: 'My Agent' },
];
```

缺点：每次新增都要修改代码。

### 2.2 自动扫描

```ts
const agents = await scanAgentsDirectory();
```

OriginOS 选择了**自动扫描**。

## 3. 源码精读：`user-registry/index.ts`

打开 [packages/core/src/lib/features/user-registry/index.ts](../../../../packages/core/src/lib/features/user-registry/index.ts)。

### 3.1 扫描 Agent

```ts
export async function listUserAgents(): Promise<UserAgent[]> {
  const agentsDir = path.join(DATA_ROOT, 'agents');
  const entries = await fs.readdir(agentsDir, { withFileTypes: true });

  const agents: UserAgent[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const agentDir = path.join(agentsDir, entry.name);
    const agentFile = path.join(agentDir, 'Agent.md');

    try {
      const content = await fs.readFile(agentFile, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      agents.push({
        name: entry.name,
        displayName: frontmatter.name || entry.name,
        description: frontmatter.description || '',
        role: frontmatter.role || 'assistant',
        createdAt: frontmatter.createdAt || new Date().toISOString(),
      });
    } catch {
      // Skip invalid agents
      continue;
    }
  }

  return agents;
}
```

对应源码位置：[packages/core/src/lib/features/user-registry/index.ts 第 1—100 行](../../../../packages/core/src/lib/features/user-registry/index.ts#L1-L100)。

### 3.2 扫描 Skill

```ts
export async function listUserSkills(): Promise<UserSkill[]> {
  const skillsDir = path.join(DATA_ROOT, 'skills');
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });

  const skills: UserSkill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = path.join(skillsDir, entry.name);
    const skillFile = path.join(skillDir, 'SKILL.md');

    try {
      const content = await fs.readFile(skillFile, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      skills.push({
        name: entry.name,
        displayName: frontmatter.name || entry.name,
        description: frontmatter.description || '',
        tags: frontmatter.tags || [],
        version: frontmatter.version || '1.0.0',
        createdAt: frontmatter.createdAt || new Date().toISOString(),
      });
    } catch {
      // Skip invalid skills
      continue;
    }
  }

  return skills;
}
```

对应源码位置：[packages/core/src/lib/features/user-registry/index.ts 第 101—209 行](../../../../packages/core/src/lib/features/user-registry/index.ts#L101-L209)。

### 3.3 解析 Frontmatter

```ts
function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const lines = match[1].split('\n');
  const frontmatter: Record<string, unknown> = {};

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      frontmatter[key.trim()] = value;
    }
  }

  return frontmatter;
}
```

## 4. 图解：扫描流程

```
data/agents/
├── my-agent/
│   └── Agent.md
├── another-agent/
│   └── Agent.md
└── ...

listUserAgents()
  │
  ▼
┌──────────────────┐
│ fs.readdir()     │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌──────────
│ 目录1 │ │ 目录2    │
└───┬───┘ └────┬─────┘
    │          │
    ▼          ▼
┌────────┐ ┌────────┐
│读取文件│ │读取文件│
└───┬────┘ └───┬────┘
    │          │
    ▼          ▼
┌────────┐ ┌────────┐
│解析front│ │解析front│
└───┬────┘ └───┬────┘
    │          │
    └────┬─────┘
         ▼
    UserAgent[]
```

## 5. 设计亮点

### 5.1 容错处理

```ts
try {
  const content = await fs.readFile(agentFile, 'utf-8');
  const frontmatter = parseFrontmatter(content);
  // ...
} catch {
  // Skip invalid agents
  continue;
}
```

- 跳过无效 Agent/Skill。
- 不影响其他 Agent/Skill。

### 5.2 Frontmatter 解析

```ts
function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  // ...
}
```

- 支持 YAML 格式 frontmatter。
- 容错解析。

## 6. 测试证据与缺口

### 已覆盖

- `listUserAgents` 没有直接测试。

### 缺口

- 目录扫描没有测试。
- Frontmatter 解析没有测试。
- 错误处理没有测试。

## 7. 小实验：扫描 Agent

```ts
import { listUserAgents, listUserSkills } from '@originos/core/lib/features/user-registry';

// 列出 Agent
const agents = await listUserAgents();
console.log(agents);
// [
//   { name: 'my-agent', displayName: 'My Agent', ... },
//   { name: 'another-agent', displayName: 'Another Agent', ... },
// ]

// 列出 Skill
const skills = await listUserSkills();
console.log(skills);
// [
//   { name: 'task-manager', displayName: 'Task Manager', ... },
//   { name: 'info-query', displayName: 'Info Query', ... },
// ]
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `listUserAgents` 是怎么扫描 Agent 的？
2. `listUserSkills` 是怎么扫描 Skill 的？
3. Frontmatter 是怎么解析的？
4. 如果文件不存在，怎么处理？

## 9. 章节收束

本课的核心认知是 **用户注册表通过扫描目录和解析 Frontmatter，动态发现 Agent 和 Skill**。

我们看到的几个关键设计：

- **自动扫描**：通过 `fs.readdir` 扫描目录。
- **Frontmatter 解析**：提取 YAML 元数据。
- **容错处理**：跳过无效 Agent/Skill。
- **无测试**：没有直接测试覆盖。

下一课（G72）是单元小结课，我们会画出"配置 → 注册表 → 技能系统"的完整调用链。
