# L07：Skill 的加载链路——从磁盘到内存

> 本课问题：Skill 从 `templates/skills/` 下的文件，到 Agent 能使用的内存对象，中间经历了哪些步骤？

## 小林的场景

小林知道 Skill 定义在 `templates/skills/` 下，但她发现运行时使用的是 `packages/core/src/lib/features/skills/bundled/` 下的副本。她想知道：

- 模板和运行时副本是什么关系？
- Skill 是怎么被加载到内存的？
- 加载过程中有哪些失败路径？

## 概念阶梯：加载不是“复制”，而是“解析”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “加载就是把文件复制到内存” | 加载是**解析文件 → 构建对象 → 注册到 Registry** | 不是简单的文件复制，而是结构化的解析过程 |
| “模板和运行时副本是一样的” | 运行时副本是**编译后的产物**，不是原始模板 | 副本可能经过转换、裁剪或合并 |
| “加载一次就够了” | 加载是**按需的**，可能多次加载 | 系统启动时加载内置 Skill，用户请求时加载自定义 Skill |

## 第一段源码：`loader.ts` 的加载逻辑

```typescript
// [packages/core/src/lib/features/skills/project-initialization/loader.ts 第 1—92 行](../../../../packages/core/src/lib/features/skills/project-initialization/loader.ts#L1)
/**
 * Load the project-initialization skill into the skill registry
 */

import type { LoadedSkill, SkillContext, SkillResult } from '@/types/skill';
import { skillRegistry } from '../registry';
import { SkillType } from '@/types/skill';
import { projectInitializationSkill } from './index';

/**
 * Create the loaded project-initialization skill
 */
const projectInitializationLoadedSkill: LoadedSkill = {
  metadata: {
    name: 'project-initialization',
    displayName: 'Project Initialization',
    description: 'Composite skill for project initialization through conversational interview and ontology building',
    type: SkillType.COMPOSITE,
    version: '1.0.0',
    priority: 'critical',
    dependencies: ['ontology'],
    reads: ['Project', 'Person', 'Task', 'Goal', 'Organization'],
    writes: ['Project', 'Person', 'Task', 'Goal', 'Action'],
    preconditions: ['User wants to create a new project'],
    postconditions: [
      'Created Project entity',
      'Created Person entities for team members',
      'Created Task entities from interview',
      'Relations established between entities',
    ],
  },

  /**
   * Handler for project-initialization skill execution
   */
  handler: async (context: SkillContext): Promise<SkillResult> => {
    const { sessionId, input, tools } = context;

    if (input.message) {
      // Process user message in interview
      const phase = context.skillData?.phase as string || 'foundation';

      // Delegate to the TypeScript skill implementation
      const response = await projectInitializationSkill.processMessage(sessionId, input.message as string);

      return {
        success: true,
        message: response.message,
        nextPhase: response.phase,
        complete: response.complete,
        data: {
          response,
          phase: response.phase,
        },
      };
    }

    // Initialize new interview
    const projectName = context.session.projectContext.projectName;
    const projectId = context.session.projectContext.projectId;

    const session = await projectInitializationSkill.initialize({
      projectId,
      projectName,
    });

    return {
      success: true,
      message: `Project initialization started for "${projectName}"`,
      data: {
        sessionId: session.sessionId,
        phase: 'foundation',
      },
    };
  },
};

/**
 * Register the project-initialization skill
 */
export function registerProjectInitializationSkill(): void {
  skillRegistry.register(projectInitializationLoadedSkill);
}

/**
 * Auto-register on module import
 */
registerProjectInitializationSkill();
```

**加载流程**：

1. **定义 `LoadedSkill` 对象**：包含 `metadata` 和 `handler`
2. **`metadata`**：从 `SKILL.md` 的 frontmatter 解析而来
3. **`handler`**：Skill 的执行逻辑，处理用户输入并返回结果
4. **注册到 Registry**：`skillRegistry.register(projectInitializationLoadedSkill)`
5. **自动注册**：模块导入时自动执行 `registerProjectInitializationSkill()`

**关键判断**：`loader.ts` 是**手写的**，不是自动生成的。这意味着每个内置 Skill 都需要一个对应的 `loader.ts` 文件。

## 第二段源码：`service.ts` 的 Skill 查找逻辑

```typescript
// [packages/core/src/lib/features/skills/service.ts 第 259—275 行](../../../../packages/core/src/lib/features/skills/service.ts#L259)
function findSkill(name: string): Skill | undefined {
  const result = loadSkills({ includeDefaults: true });
  return result.skills.find((skill) => skill.code === name || skill.name === name);
}

function findSkillForContent(name: string): Skill | undefined {
  const dataSkill = loadSkillFromDirectory(path.join(getSkillsDataDir(), name), 'user').skill;
  if (dataSkill) {
    return dataSkill;
  }

  const skill = findSkill(name);
  if (skill?.systemManaged) {
    return materializeBundledSkill(skill.code ?? skill.name) ?? skill;
  }
  return skill ?? materializeBundledSkill(name) ?? undefined;
}
```

**查找优先级**：

1. **用户数据目录**：`getSkillsDataDir()` 下的 Skill（用户自定义）
2. **内置 Skill**：`loadSkills()` 加载的 Skill（系统内置）
3. **物化副本**：`materializeBundledSkill()` 生成的运行时副本

**关键判断**：查找顺序是**用户自定义 > 系统内置 > 运行时副本**。这意味着用户自定义的 Skill 可以覆盖系统内置的 Skill。

## 第三段源码：`service.ts` 的 Skill 内容获取

```typescript
// [packages/core/src/lib/features/skills/service.ts 第 488—511 行](../../../../packages/core/src/lib/features/skills/service.ts#L488)
export function getSkillContent(request: SkillContentRequest): SkillContentResponse {
  const skill = findSkillForContent(request.name);

  if (!skill) {
    throw new SkillServiceError('NOT_FOUND', `Skill "${request.name}" not found`, 404);
  }

  const content = readFileSync(skill.filePath, 'utf-8');
  const workingDir = resolveSkillWorkingDirectory(skill);
  const outputDir = resolveSkillOutputDir(skill);
  const response: SkillContentResponse = {
    content,
    baseDir: skill.baseDir,
    workingDir,
    outputDir,
    systemManaged: skill.systemManaged === true,
  };

  if (request.includeFrontmatter) {
    response.frontmatter = parseFrontmatter(content).frontmatter;
  }

  return response;
}
```

**内容获取流程**：

1. **查找 Skill**：`findSkillForContent(request.name)`
2. **读取文件**：`readFileSync(skill.filePath, 'utf-8')`
3. **解析 frontmatter**：`parseFrontmatter(content).frontmatter`
4. **解析工作目录**：`resolveSkillWorkingDirectory(skill)`
5. **解析输出目录**：`resolveSkillOutputDir(skill)`

**关键判断**：`getSkillContent` 返回的是**原始文件内容**，不是解析后的对象。frontmatter 的解析是可选的（`includeFrontmatter`）。

## 第四段源码：`service.ts` 的 Skill 执行启动

```typescript
// [packages/core/src/lib/features/skills/service.ts 第 561—696 行](../../../../packages/core/src/lib/features/skills/service.ts#L561)
export async function startSkillExecution(
  request: SkillExecutionStartRequest
): Promise<{ status: number; data: SkillExecutionStartResponse }> {
  const skillName = request.skillName;
  if (!skillName) {
    throw new SkillServiceError('INVALID_REQUEST', 'skillName is required', 400);
  }

  const skill = findSkill(skillName);
  if (!skill) {
    throw new SkillServiceError('NOT_FOUND', `Skill "${skillName}" not found`, 404);
  }

  const loadedSkill = loadSkillHandler(skillName);
  if (!loadedSkill) {
    throw new SkillServiceError('NOT_FOUND', `Skill "${skillName}" not found`, 404);
  }

  // ... 创建会话、构建 SkillContext、调用 handler

  const skillContext: SkillContext = {
    sessionId,
    session: {
      projectContext: {
        projectId: session.projectContext.projectId || `skill-${skillName}`,
        projectName: session.projectContext.projectName || `Skill: ${skillName}`,
        // ...
      },
      messages: session.messages,
    },
    input: {
      message: typeof inputData === 'string' ? inputData : undefined,
      data: typeof inputData === 'object' && inputData !== null
        ? inputData as Record<string, unknown>
        : undefined,
    },
    tools: createSkillContextTools(),
    config: typeof request.config === 'object' && request.config !== null
      ? request.config as Record<string, unknown>
      : undefined,
  };

  // 调用 Skill handler
  const result = await loadedSkill.handler(skillContext);

  // ... 返回结果
}
```

**执行流程**：

1. **查找 Skill**：`findSkill(skillName)`
2. **加载 Handler**：`loadSkillHandler(skillName)`
3. **创建会话**：`agentSessionService.createSession()`
4. **构建 Context**：`SkillContext`（包含 session、input、tools、config）
5. **调用 Handler**：`loadedSkill.handler(skillContext)`
6. **返回结果**：`SkillResult`

**关键判断**：Skill 的执行是**异步的**，需要创建会话、构建上下文、调用 handler、返回结果。

## 调用链：Skill 从磁盘到内存

```text
templates/skills/{skill-name}/SKILL.md
  → 被 loader.ts 读取
    → 解析 frontmatter → metadata
    → 定义 handler → 执行逻辑
    → 注册到 Registry
      → 用户请求到达
        → findSkill() 查找 Skill
          → loadSkillHandler() 加载 handler
            → 创建会话、构建 Context
              → 调用 handler()
                → 返回 SkillResult
```

## 失败路径：加载可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| `SKILL.md` 不存在 | 加载失败 | 文件被删除或路径错误 |
| Frontmatter 解析失败 | 无法获取 metadata | YAML 语法错误 |
| Handler 未定义 | 执行时报错 | `loader.ts` 中未定义 handler |
| Registry 重复注册 | 覆盖已有 Skill | 同名 Skill 被多次注册 |
| 用户自定义 Skill 覆盖系统内置 | 系统行为异常 | 查找优先级：用户 > 系统 |
| `loadSkillHandler` 找不到 handler | 执行失败 | Skill 名称不匹配或 handler 未导出 |

## 测试证据

```bash
# 检查内置 Skill 的 loader.ts 是否存在
ls packages/core/src/lib/features/skills/*/loader.ts

# 检查 Registry 中的 Skill 数量
node -e "const {skillRegistry} = require('./packages/core/src/lib/features/skills/registry'); console.log(skillRegistry.list().length);"

# 检查 bundled skills 和 templates/skills 的对应关系
for skill in packages/core/src/lib/features/skills/bundled/*/; do
  name=$(basename "$skill")
  if [ -f "templates/skills/$name/SKILL.md" ]; then
    echo "OK: $name"
  else
    echo "MISSING: $name"
  fi
done
```

**测试缺口**：
- 没有自动化测试验证加载过程的完整性
- 没有测试验证 frontmatter 解析的健壮性
- 没有测试验证 handler 的存在性

## 小实验

**实验 1：追踪 Skill 的加载过程**

1. 打开 `packages/core/src/lib/features/skills/project-initialization/loader.ts`
2. 找到 `registerProjectInitializationSkill()` 的调用点
3. 回答：这个 Skill 是什么时候被注册的？

**实验 2：对比模板和运行时副本**

| 维度 | `templates/skills/project-initialization/SKILL.md` | `packages/core/src/lib/features/skills/bundled/project-initialization/SKILL.md` |
| --- | --- | --- |
| 文件大小 | | |
| Frontmatter | | |
| Body | | |
| 是否有 handler.ts | | |

**思考**：运行时副本和模板有什么区别？

## 口头验收

1. **Skill 从磁盘到内存经历了哪些步骤？** 能说出读取 → 解析 → 构建对象 → 注册到 Registry 吗？
2. **`loader.ts` 是自动生成的还是手写的？** 能说出是手写的吗？
3. **Skill 查找的优先级是什么？** 能说出用户自定义 > 系统内置 > 运行时副本吗？
4. **`getSkillContent` 返回的是什么？** 能说出返回的是原始文件内容，不是解析后的对象吗？
5. **如果 `loadSkillHandler` 找不到 handler，会发生什么？** 能说出执行失败吗？

## 本课结论

本课建立了 Skill 加载链路的完整认知：

- **加载不是复制，而是解析**：读取文件 → 解析 frontmatter → 构建对象 → 注册到 Registry
- **`loader.ts` 是手写的**：每个内置 Skill 都需要一个对应的 loader
- **查找优先级**：用户自定义 > 系统内置 > 运行时副本
- **`getSkillContent` 返回原始内容**：frontmatter 的解析是可选的
- **执行是异步的**：创建会话 → 构建 Context → 调用 handler → 返回结果

下一课（L08）将深入 Skill 的分类，回答“30 个 Skill 如何分类”这个问题。
