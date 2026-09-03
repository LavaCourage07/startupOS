# H09：结构化 Memory Keys 与共享内存约定

## 小林的 Blackboard 上为什么不是乱糟糟的

上一章（H08）讲到，`UpstreamResults` 通过 Blackboard 的 `setData` 写入上游产出。但如果有 10 个 Agent，每个 Agent 写入 5 个 key，Blackboard 很快就会变成"键值垃圾场"。如何确保 key 的命名一致、可查询、可过滤？

本章回答：`memory-keys.ts` 如何定义结构化的 key 命名规范？Ruflo-style 的设计哲学是什么？

## 概念阶梯：key 不是"名字"，而是"地址"

初学者容易把 Blackboard 的 key 理解为"变量名"。但在多 Agent 系统中，key 是**跨 Agent 共享的地址**，需要支持：

| 需求 | 反例（不好的 key） | 正例（结构化的 key） |
| --- | --- | --- |
| 区分数据来源 | `"output"` | `"upstream$HotelResearcher$output"` |
| 按角色过滤 | `"status"` | `"swarm$supervisor$status"` |
| 按类别查询 | `"report1"` | `"swarm$worker-coder$report$weekly"` |
| 避免冲突 | `"data"` | `"shared$hierarchy"` |

## 第一段源码：`MemoryKeyPrefix` 和 `MemoryKeyCategory`

打开 [packages/core/src/modules/collaboration-runtime/session/memory-keys.ts](../../../../packages/core/src/modules/collaboration-runtime/session/memory-keys.ts)：

```ts
export enum MemoryKeyPrefix {
  SWARM = "swarm",       // 协作 Agent 集群
  AGENT = "agent",       // 单个 Agent 状态
  SHARED = "shared",     // 跨 Agent 共享数据
  ONTOLOGY = "ontology",   // 本体相关
  UPSTREAM = "upstream",   // 上游产出
  METADATA = "metadata",   // 元数据
  PROJECT = "project",     // 项目上下文
}

export enum MemoryKeyCategory {
  STATUS = "status",
  PROGRESS = "progress",
  COMPLETE = "complete",
  BLOCKED = "blocked",
  METRICS = "metrics",
  DIRECTIVE = "directive",
  HEALTH = "health",
  REPORT = "report",
  DISCOVERY = "discovery",
}
```

前缀（Prefix）解决"数据属于谁"，类别（Category）解决"数据是什么"。

## 第二段源码：键值构建器

```ts
export function buildSupervisorKey(
  category: MemoryKeyCategory,
  _sessionId: string,
  subkey?: string
): string {
  if (subkey) {
    return `${MemoryKeyPrefix.SWARM}$supervisor$${category}$${subkey}`;
  }
  return `${MemoryKeyPrefix.SWARM}$supervisor$${category}`;
}

export function buildWorkerKey(
  category: MemoryKeyCategory,
  workerId: string,
  subkey?: string
): string {
  if (subkey) {
    return `${MemoryKeyPrefix.SWARM}$worker-${workerId}$${category}$${subkey}`;
  }
  return `${MemoryKeyPrefix.SWARM}$worker-${workerId}$${category}`;
}
```

构建器的价值：**强制使用规范格式，避免手写 key 的错误**。

## 第三段源码：键值解析与过滤

```ts
export function parseMemoryKey(key: string): {
  prefix: string;
  role?: string;
  category?: string;
  subkey?: string;
} | null {
  const parts = key.split("$");
  if (parts.length < 2) return null;

  const prefix = parts[0]!;
  const validPrefixes = Object.values(MemoryKeyPrefix);
  if (!validPrefixes.includes(prefix as MemoryKeyPrefix)) {
    return null;
  }

  const role = parts[1];
  const category = parts[2];
  const subkey = parts.length > 3 ? parts.slice(3).join("$") : undefined;

  return { prefix, role, category, subkey };
}
```

解析器的价值：**从 key 中提取结构化信息，支持动态过滤**。

过滤函数：

```ts
export function filterKeysByPrefix(keys: string[], prefix: MemoryKeyPrefix): string[] {
  return keys.filter(key => hasPrefix(key, prefix));
}

export function filterKeysByRole(keys: string[], role: string): string[] {
  return keys.filter(key => belongsToRole(key, role));
}

export function filterKeysByCategory(keys: string[], category: MemoryKeyCategory): string[] {
  return keys.filter(key => {
    const parsed = parseMemoryKey(key);
    return parsed?.category === category;
  });
}
```

## 图解：Memory Key 的结构

```
upstream$HotelResearcher$output
|         |               |
prefix    role            category

swarm$supervisor$status$active
|    |          |       |
|    |          |       subkey
|    |          category
|    role
prefix
```

## 失败路径与边界

### 边界 1：解析器对非法 key 返回 null

`parseMemoryKey("invalid-key")` 返回 `null`。调用方必须处理这个返回值，否则会出现 `Cannot read property 'role' of null` 错误。

### 边界 2：构建器不验证参数

`buildSupervisorKey` 接受任意字符串作为 `category`，即使它不是 `MemoryKeyCategory` 的有效值。TypeScript 的类型检查在编译时有效，但运行时传入非法值不会报错。

### 边界 3：`subkey` 中的 `$` 会被解析错误

如果 `subkey` 包含 `$` 字符，`parseMemoryKey` 可能解析错误。例如 `buildSupervisorKey("status", "session1", "a$b")` 生成 `swarm$supervisor$status$a$b`，解析时 `subkey` 会变成 `a$b`（正确），但如果 key 本身包含更多 `$`，解析结果可能不符合预期。

## 测试证据与缺口

### 测试缺口

- 没有针对 `parseMemoryKey` 边界条件的测试（空字符串、非法前缀、包含 `$` 的 subkey 等）。
- 没有针对过滤函数性能的大 key 集合测试。

## 口头验收

不看源码，你能解释：

1. Memory Key 的命名规范是什么？为什么需要前缀和类别？
2. `buildSupervisorKey` 和 `buildWorkerKey` 的区别是什么？
3. `parseMemoryKey` 返回 null 的情况有哪些？调用方应该如何处理？
4. `filterKeysByRole` 和 `filterKeysByCategory` 的区别是什么？
5. 如果新增一个 `MemoryKeyPrefix`，需要修改哪些代码？

## 章节收束

本章讲解了结构化 Memory Key 的设计：通过前缀、角色、类别、子键四级结构，确保 Blackboard key 的命名一致、可查询、可过滤。`parseMemoryKey` 和过滤函数提供了动态查询能力。

下一章（H10）会进入 `AgentTaskSnapshot` 与会话状态恢复，讲解如何在进程重启后恢复协作状态。
