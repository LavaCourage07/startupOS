# G06：`SkillService` 如何发现项目可用 Skill

> 本课核心问题：项目创建后，系统如何知道有哪些 Skill 可用？`SkillService` 在 Skill 发现和调用之间扮演什么角色？

## 1. 开篇场景：小王想让 Agent 帮忙列开店清单

小王的“社区咖啡馆”项目已经创建并初始化完成。现在他想让 Agent 帮他生成一份“开店待办清单”。

这个请求不是直接发给某个硬编码的函数，而是交给 Skill 系统：

1. 系统先知道有哪些 Skill 可用。
2. 根据用户请求或 Agent 判断，选择合适的 Skill。
3. 加载该 Skill 的内容（`SKILL.md`）。
4. 把 Skill 格式化成 Agent 能理解的 prompt 片段。
5. Agent 根据 Skill 指引执行任务。

`SkillService` 就是负责第 1、3、4 步的服务。这节课我们就打开它，看 Skill 如何被发现、缓存和格式化。

## 2. Skill 发现的三层结构

在讲源码之前，先理解 Skill 在 OriginOS 中的三层存在：

| 层级 | 代表 | 谁管理 | 本课关注点 |
| --- | --- | --- | --- |
| Skill 定义源 | `.claude/skills/`、`data/skills/`、`templates/skills/` | 系统管理员、用户、模板 | `loadSkills` 从哪里读 |
| Skill 运行时对象 | `Skill`（含 name、source、path 等） | `lib/integrations/pi-agent/core/skills` | `loadSkills` 返回什么 |
| Skill 服务封装 | `SkillService` | `lib/features/services/skill-service.ts` | 缓存、查询、格式化 |

`SkillService` 本身不定义 Skill 的底层格式，而是调用 `lib/integrations/pi-agent/core/skills` 中的能力，并加上缓存和服务层封装。

## 3. 源码精读：`SkillService` 的核心能力

打开 [packages/core/src/lib/features/services/skill-service.ts](../../../../packages/core/src/lib/features/services/skill-service.ts)。

### 3.1 缓存设计

```ts
let cachedSkillsResult: LoadSkillsResult | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds cache

class SkillService {
  private skillsCache: Map<string, LoadSkillsResult> = new Map();
  private cacheTimeouts: Map<string, NodeJS.Timeout> = new Map();
}
```

对应源码位置：[packages/core/src/lib/features/services/skill-service.ts 第 18—28 行](../../../../packages/core/src/lib/features/services/skill-service.ts#L18-L28)。

`SkillService` 有两层缓存：

1. **全局缓存**（`cachedSkillsResult` + `cacheTimestamp`）：所有 `SkillService` 实例共享，5 秒过期。
2. **实例缓存**（`skillsCache` + `cacheTimeouts`）：按 `cacheKey` 隔离，支持不同调用方使用不同缓存。

这种设计的原因是：Skill 加载可能涉及磁盘扫描和文件读取，频繁调用成本高。缓存 5 秒可以显著降低开销，同时保证 Skill 更新后不会太长时间不一致。

### 3.2 获取 Skill 列表：`getSkills`

```ts
async getSkills(options: { useCache?: boolean; cacheKey?: string } = {}): Promise<LoadSkillsResult> {
  const { useCache = true, cacheKey = 'default' } = options;

  if (useCache) {
    const now = Date.now();

    if (cachedSkillsResult && (now - cacheTimestamp) < CACHE_TTL) {
      return cachedSkillsResult;
    }

    const cached = this.skillsCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const result = loadSkills({ includeDefaults: true });

  cachedSkillsResult = result;
  cacheTimestamp = Date.now();
  this.skillsCache.set(cacheKey, result);

  const timeout = setTimeout(() => {
    this.skillsCache.delete(cacheKey);
  }, CACHE_TTL);
  this.cacheTimeouts.set(cacheKey, timeout);

  return result;
}
```

对应源码位置：[packages/core/src/lib/features/services/skill-service.ts 第 32—65 行](../../../../packages/core/src/lib/features/services/skill-service.ts#L32-L65)。

这个方法的逻辑是：

1. 如果允许缓存，先检查全局缓存是否未过期。
2. 再检查实例缓存是否存在。
3. 如果都没有，调用 `loadSkills({ includeDefaults: true })` 重新加载。
4. 更新全局缓存和实例缓存，并为实例缓存设置 5 秒后自动清除的定时器。

注意几个边界：

- **全局缓存和实例缓存的关系**：全局缓存优先于实例缓存。也就是说，即使实例缓存为空，只要全局缓存未过期，就返回全局缓存。
- **定时器泄漏风险**：每次 `getSkills` 都会创建一个新的 `setTimeout`，并用 `cacheKey` 覆盖旧的定时器引用。旧的定时器仍然会在后台运行，只是不再被 `cacheTimeouts` 引用。这在 5 秒 TTL 下影响很小，但长时间运行后可能积累大量定时器。
- **缓存不一致**：如果 Skill 文件在 5 秒内被修改，缓存会返回旧数据。

### 3.3 按名称查找 Skill

```ts
async getSkillByName(name: string): Promise<Skill | null> {
  const result = await this.getSkills();
  return result.skills.find((s) => s.name === name) || null;
}
```

对应源码位置：[packages/core/src/lib/features/services/skill-service.ts 第 91—94 行](../../../../packages/core/src/lib/features/services/skill-service.ts#L91-L94)。

这是典型的“先全量加载，再内存过滤”模式。对于 Skill 数量较少的场景没问题；如果 Skill 很多，可能需要索引优化。

### 3.4 加载 Skill 内容

```ts
getSkillContent(skill: Skill) {
  return loadSkillContent(skill);
}
```

对应源码位置：[packages/core/src/lib/features/services/skill-service.ts 第 99—101 行](../../../../packages/core/src/lib/features/services/skill-service.ts#L99-L101)。

`loadSkillContent` 来自 `lib/integrations/pi-agent/core/skills`，负责读取 Skill 的 `SKILL.md` 文件内容。`SkillService` 只是透传调用。

### 3.5 格式化为 Agent Prompt

```ts
async formatSkillsForAgentPrompt(options?: { source?: Skill['source'] }): Promise<string> {
  const result = await this.getSkills();

  let skills = result.skills;
  if (options?.source) {
    skills = skills.filter((s) => s.source === options.source);
  }

  return formatSkillsForPrompt(skills);
}
```

对应源码位置：[packages/core/src/lib/features/services/skill-service.ts 第 106—115 行](../../../../packages/core/src/lib/features/services/skill-service.ts#L106-L115)。

这个方法把 Skill 列表格式化成 Agent Prompt 中的 XML 片段。`options.source` 允许只选择特定来源的 Skill，例如只选 bundled Skill 或只选用户 Skill。

### 3.6 Skill 目录结构验证

```ts
async validateSkillDirectory(dirPath: string): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  if (!existsSync(dirPath)) {
    return { valid: false, errors: [`Directory does not exist: ${dirPath}`] };
  }

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const hasSkillMd = entries.some((e) => e.isFile() && e.name === 'SKILL.md');

    if (!hasSkillMd) {
      errors.push('SKILL.md file not found in directory');
    }
  } catch (error) {
    errors.push(`Failed to read directory: ${error}`);
  }

  return { valid: errors.length === 0, errors };
}
```

对应源码位置：[packages/core/src/lib/features/services/skill-service.ts 第 128—153 行](../../../../packages/core/src/lib/features/services/skill-service.ts#L128-L153)。

这个方法的职责是：检查一个目录是否是合法的 Skill 目录。当前只检查是否存在 `SKILL.md` 文件。这是一个非常宽松的验证：只要目录里有 `SKILL.md`，就算合法 Skill。

## 4. 图解：Skill 发现的数据流

```mermaid
flowchart TD
    A[调用方] -->|getSkills| B[SkillService]
    B -->|useCache?| C{全局缓存未过期?}
    C -->|是| D[返回 cachedSkillsResult]
    C -->|否| E{实例缓存存在?}
    E -->|是| F[返回实例缓存]
    E -->|否| G[loadSkills]
    G -->|LoadSkillsResult| H[更新全局缓存]
    H --> I[更新实例缓存]
    I --> J[设置 5s 定时清理]
    J --> K[返回 LoadSkillsResult]

    A -->|getSkillByName| B
    B --> L[getSkills]
    L --> M[skills.find name]
    M --> N[返回 Skill | null]

    A -->|formatSkillsForAgentPrompt| B
    B --> O[getSkills]
    O --> P[按 source 过滤]
    P --> Q[formatSkillsForPrompt]
    Q --> R[返回 XML 字符串]
```

这张图说明：`SkillService` 的核心是“加载一次、多处使用”。无论是按名称查找、加载内容还是格式化 Prompt，都依赖 `getSkills` 返回的全量 Skill 列表。

## 5. `LoadSkillsResult` 里有什么？

`loadSkills` 返回的 `LoadSkillsResult` 定义在 [packages/core/src/lib/integrations/pi-agent/core/skills.ts](../../../../packages/core/src/lib/integrations/pi-agent/core/skills.ts)。本课不展开其内部实现，但要知道它的输出形状：

```ts
interface LoadSkillsResult {
  skills: Skill[];
  diagnostics: {
    total: number;
    bySource: Record<string, number>;
    errors: Array<{ path: string; error: string }>;
  };
}
```

其中 `Skill` 包含：

- `name`：Skill 名称。
- `source`：来源（如 `'bundled'`、`'project'`、`'user'`）。
- `path`：Skill 文件路径。
- `description`：Skill 描述。
- `icon`、`category`、`tags` 等元数据。

`SkillService.getDiagnostics` 就是返回这个 `diagnostics` 对象，用于排查 Skill 加载问题。

## 6. 失败路径与边界

### 6.1 缓存导致的新 Skill 不可见

如果用户在 5 秒内新增了一个 Skill，`getSkills` 仍可能返回旧列表。这在开发调试时容易让人困惑：明明文件放对了，为什么 Agent 看不到？

可以通过 `clearCache()` 手动清除缓存，或等待 5 秒后再试。

### 6.2 `getSkillByName` 大小写敏感

```ts
return result.skills.find((s) => s.name === name) || null;
```

是按精确匹配查找。如果调用方传了 `'task-manager'` 而 Skill 名称是 `'Task Manager'`，就找不到。

### 6.3 `validateSkillDirectory` 只检查 `SKILL.md`

一个目录即使包含 `SKILL.md`，也可能缺少 handler、references 等必要文件。当前验证不会发现这些问题。

### 6.4 `formatSkillsForAgentPrompt` 可能返回空字符串

如果 `skills` 数组为空，或全部被 `source` 过滤掉，`formatSkillsForPrompt` 可能返回空字符串。Agent 会收到一个空的 Skill 指引，但不会报错。

## 7. 测试证据与缺口

### 已覆盖

- `skills/__tests__/service.test.ts` 是 `SkillService` 的直接测试文件。本课应检查它覆盖了哪些场景。

### 缺口

- 缓存 TTL 行为（5 秒过期）可能没有直接测试。
- 全局缓存与实例缓存的优先级关系可能没有测试。
- `clearCache` 的完整清除和按 key 清除可能没有测试。
- `validateSkillDirectory` 对非法目录的验证可能没有测试。
- `formatSkillsForAgentPrompt` 按 `source` 过滤的行为可能没有测试。

### 当前可做的验证

1. 调用 `skillService.getSkills()`，观察返回的 `skills` 和 `diagnostics`。
2. 新增一个 Skill 文件，立即再次调用 `getSkills()`，确认是否因为缓存未出现。
3. 调用 `skillService.clearCache()` 后再调用 `getSkills()`，确认新 Skill 出现。
4. 调用 `skillService.validateSkillDirectory('/path/to/skill')`，验证合法和非法目录。

## 8. 小实验：观察 Skill 缓存行为

### 步骤一：首次加载

```ts
const result1 = await skillService.getSkills();
console.log(result1.diagnostics.total); // 例如 5
```

### 步骤二：在磁盘新增一个 Skill

在 `data/skills/my-skill/` 下创建 `SKILL.md`。

### 步骤三：立即再次加载

```ts
const result2 = await skillService.getSkills();
console.log(result2.diagnostics.total); // 可能仍然是 5
```

### 步骤四：清除缓存后加载

```ts
skillService.clearCache();
const result3 = await skillService.getSkills();
console.log(result3.diagnostics.total); // 现在是 6
```

### 实验结论

这个实验说明：`SkillService` 的缓存能提升性能，但也会让 Skill 变化不能立即生效。开发新 Skill 时，需要了解缓存机制，必要时手动清除。

## 9. 口头验收

读完本课后，应能不看书稿回答：

1. `SkillService` 为什么需要缓存？缓存过期时间是多久？
2. `SkillService` 有哪两层缓存？哪一层优先级更高？
3. `getSkillByName` 是按什么匹配名称的？如果名称大小写不一致会怎样？
4. `formatSkillsForAgentPrompt` 的 `source` 参数有什么作用？
5. `validateSkillDirectory` 只检查了什么？一个目录通过验证是否代表它一定能正常运行？

## 10. 章节收束

本课的核心认知是：**`SkillService` 是 Skill 发现层的服务封装，它通过缓存降低 Skill 加载成本，并提供查询、内容加载、Prompt 格式化的统一入口**。

它不负责：

- Skill 的具体执行（那是 `SkillExecutor`，归 Part F）。
- Skill 的注册决策（那是 `SkillDecision`，归 Part F）。
- Skill 的底层文件扫描（那是 `loadSkills`，在 `lib/integrations/pi-agent/core/skills` 中，归 Part E）。

下一课（G07）会看 `services/index.ts`，了解这些服务如何被组织成 `services` feature 的公共 API。
