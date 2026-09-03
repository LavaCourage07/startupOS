# F47：`project-context.ts` —— 项目上下文加载器

## 开篇场景

ProjectAgent 启动时，需要加载项目上下文。和 RoleAgent 类似，但 ProjectAgent 从 `data/projects/{id}/` 加载，且字段略有不同。这节课看 `project-context.ts`。

## 核心问题

**`ProjectContext` 和 `RoleContext` 有什么区别？`loadProjectContext` 如何处理 `Memory.md` 和 `MEMORY.md` 的兼容性？**

## 概念阶梯

**ProjectContext**：项目上下文的统一接口，包含 13 个字段。

**readProjectMemoryFile**：兼容历史命名，优先读取 `Memory.md`， fallback 到 `MEMORY.md`。

**parseAllowedTools**：从 `Tool.md` frontmatter 提取 `allowedTools`。

## 源码精读

### 1. ProjectContext 接口

[packages/core/src/lib/integrations/pi-agent/project-agent/project-context.ts 第 16—43 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-context.ts#L16)

```typescript
export interface ProjectContext {
  agentMd: string;           // Agent.md 全文（角色身份）
  toolMd: string | null;     // Tool.md 全文（工具配置）
  tasteMd: string | null;    // Taste.md 全文（风格指南）
  memoryMd: string | null;   // Memory.md 全文（历史记忆）
  knowledgeMd: string | null;   // Knowledge.md 全文（知识库索引快照）
  patternsMd: string | null;    // Patterns.md 全文（经验模式索引快照）
  memoryBlocks: MemoryBlock[] | null;  // C.9 三元记忆 Core
  installedSkills: SkillInfo[];  // 已安装技能列表
  allowedTools: string[];    // Tool.md frontmatter 中的 allowedTools
  workingDirectory: string;  // 项目工作目录
  projectId: string;         // 项目 ID
  agentId: string;           // Agent ID
  originosProjectId: string | null;  // OriginOS 业务项目 ID
}
```

和 `RoleContext` 的区别：

- 无 `roleMd`、`currentPhase`（ProjectAgent 无状态机）；
- 有 `projectId`、`agentId`、`originosProjectId`；
- `workingDirectory` 替代 `agentBaseDir`。

### 2. loadProjectContext

[packages/core/src/lib/integrations/pi-agent/project-agent/project-context.ts 第 93—145 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-context.ts#L93)

```typescript
export async function loadProjectContext(projectDir: string, projectId?: string, agentId?: string): Promise<ProjectContext | null> {
  const agentMd = readMdFile(projectDir, 'Agent.md');
  if (!agentMd) return null;

  const toolMd = readMdFile(projectDir, 'Tool.md');
  const tasteMd = readMdFile(projectDir, 'Taste.md');
  const memoryMd = readProjectMemoryFile(projectDir);  // 兼容 Memory.md / MEMORY.md
  const knowledgeMd = readMdFile(projectDir, 'Knowledge.md');
  const patternsMd = readMdFile(projectDir, 'Patterns.md');

  const allowedTools = parseAllowedTools(toolMd);
  const installedSkills = scanInstalledSkills(projectDir);
  const memoryBlocks = parseMemoryBlocks(memoryMd);

  // 尝试从 project-collaboration-context.json 读取上下文信息
  let contextProjectId = projectId ?? null;
  let contextAgentId = agentId ?? null;
  let originosProjectId: string | null = null;

  const contextJsonPath = path.join(projectDir, 'project-collaboration-context.json');
  if (existsSync(contextJsonPath)) {
    try {
      const contextJson = JSON.parse(readFileSync(contextJsonPath, 'utf-8'));
      if (contextJson.projectId && !contextProjectId) {
        contextProjectId = contextJson.projectId;
      }
      if (contextJson.agentId && !contextAgentId) {
        contextAgentId = contextJson.agentId;
      }
      if (contextJson.originosProjectId) {
        originosProjectId = contextJson.originosProjectId;
      }
    } catch {
      // 忽略解析错误
    }
  }

  return {
    agentMd, toolMd, tasteMd, memoryMd, knowledgeMd, patternsMd,
    memoryBlocks, installedSkills, allowedTools,
    workingDirectory: projectDir,
    projectId: contextProjectId ?? '',
    agentId: contextAgentId ?? '',
    originosProjectId,
  };
}
```

关键点：

- `readProjectMemoryFile` 兼容 `Memory.md` 和 `MEMORY.md`；
- 从 `project-collaboration-context.json` 读取 `originosProjectId`；
- `scanInstalledSkills` 复用 RoleAgent 的实现。

### 3. readProjectMemoryFile

[packages/core/src/lib/integrations/pi-agent/project-agent/project-context.ts 第 57—59 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-context.ts#L57)

```typescript
function readProjectMemoryFile(dir: string): string | null {
  return readMdFile(dir, 'Memory.md') ?? readMdFile(dir, 'MEMORY.md');
}
```

简单的 fallback 逻辑。

## 真实调用链

1. `ProjectLauncher.launch()` 或 `PersistentAgentManager.startAgent()` 调用 `loadProjectContext(projectDir)`；
2. 返回的 `ProjectContext` 被传给 `buildProjectPromptLayers(ctx)`；
3. 构建 6 层 system prompt。

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| Agent.md 不存在 | 返回 `null` | 项目身份必须存在 |
| project-collaboration-context.json 不存在 | `originosProjectId = null` | 可选文件 |
| project-collaboration-context.json 解析失败 | 忽略错误 | `try/catch` |

## 测试证据

- `collaboration-prompt.test.ts` 中的 `loadProjectContext` 测试：
  - 优先读取 `Memory.md`；
  - fallback 到 `MEMORY.md`。

## 练习与验收

1. **构造 ProjectContext**：手动构造一个 `ProjectContext`，验证 `buildProjectPromptLayers` 输出。
2. **测试 Memory.md 兼容性**：创建 `MEMORY.md` 但不创建 `Memory.md`，验证 fallback 行为。

**验收标准**：能解释 `ProjectContext` 和 `RoleContext` 的区别。

## 章节收束

`project-context.ts` 是 ProjectAgent 的数据入口。下一节课（F48）看 `project-collaboration-context.ts`。
