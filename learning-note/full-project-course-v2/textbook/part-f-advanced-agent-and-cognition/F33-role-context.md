# F33：`role-context.ts` —— 角色上下文加载器

## 开篇场景

RoleAgent 启动时，第一步就是加载角色上下文。系统需要读取 `data/agents/{id}/` 下的 7 个 .md 文件，扫描 `.skills/` 目录，解析 frontmatter，最终构建一个 `RoleContext` 对象。这节课看 `role-context.ts` 如何实现这个“加载器”。

## 核心问题

**`RoleContext` 包含哪些字段？`loadRoleContext` 如何保证文件不存在时的健壮性？`parseToolMdTools` 和 `extractCurrentPhase` 的解析逻辑是什么？**

## 概念阶梯

**RoleContext**：角色上下文的统一接口，包含 12 个字段，覆盖身份、状态、记忆、技能、权限。

**readMdFile**：安全读取 .md 文件的辅助函数，不存在时返回 `null`。

**parseFrontmatterArray**：从 Markdown frontmatter 中提取数组值（如 `allowedTools: ['read_file', 'write_file']`）。

**parseToolMdTools**：从 `Tool.md` frontmatter 提取 `allowedTools` 和 `disabledTools`。

**extractCurrentPhase**：从 `Role.md` frontmatter 提取当前阶段名，默认 `'default'`。

## 源码精读

### 1. RoleContext 接口

[packages/core/src/lib/integrations/pi-agent/role-agent/role-context.ts 第 31—56 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/role-context.ts#L31)

```typescript
export interface RoleContext {
  agentMd: string;           // Agent.md 全文（角色身份）
  roleMd: string | null;     // Role.md 全文（状态机 + 生命周期）
  tasteMd: string | null;    // Taste.md 全文（风格指南）
  memoryMd: string | null;   // Memory.md 全文（历史记忆）
  toolMd: string | null;     // Tool.md 全文（工具箱配置）
  knowledgeMd: string | null;   // Knowledge.md 全文（知识库索引快照）
  patternsMd: string | null;    // Patterns.md 全文（经验模式索引快照）
  memoryBlocks: MemoryBlock[] | null;  // C.9 三元记忆 Core
  currentPhase: string;      // 当前阶段名
  installedSkills: SkillInfo[];  // 已安装技能列表
  allowedTools: string[];    // Tool.md frontmatter 中提取的允许工具列表
  agentBaseDir: string;      // 角色工作目录
}
```

### 2. loadRoleContext 主流程

[packages/core/src/lib/integrations/pi-agent/role-agent/role-context.ts 第 143—175 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/role-context.ts#L143)

```typescript
export async function loadRoleContext(agentDir: string): Promise<RoleContext | null> {
  const agentMd = readMdFile(agentDir, 'Agent.md');
  if (!agentMd) return null;  // Agent.md 必须存在

  const roleMd = readMdFile(agentDir, 'Role.md');
  const tasteMd = readMdFile(agentDir, 'Taste.md');
  const memoryMd = readMdFile(agentDir, 'Memory.md');
  const toolMd = readMdFile(agentDir, 'Tool.md');
  const knowledgeMd = readMdFile(agentDir, 'Knowledge.md');
  const patternsMd = readMdFile(agentDir, 'Patterns.md');

  const { allowedTools } = parseToolMdTools(toolMd);
  const installedSkills = scanInstalledSkills(agentDir);
  const currentPhase = extractCurrentPhase(roleMd);
  const memoryBlocks = parseMemoryBlocks(memoryMd);

  return { agentMd, roleMd, tasteMd, memoryMd, toolMd, knowledgeMd, patternsMd,
           memoryBlocks, currentPhase, installedSkills, allowedTools, agentBaseDir: agentDir };
}
```

关键点：

- `Agent.md` 必须存在，否则返回 `null`；其他文件可选。
- 所有文件读取都是同步的（`readFileSync`），因为启动时需要立即拿到结果。
- `scanInstalledSkills` 是同步的，扫描 `.skills/` 目录中的软链接。

### 3. parseToolMdTools

[packages/core/src/lib/integrations/pi-agent/role-agent/role-context.ts 第 91—99 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/role-context.ts#L91)

```typescript
export function parseToolMdTools(toolMd: string | null): {
  allowedTools: string[];
  disabledTools: string[];
} {
  return {
    allowedTools: parseFrontmatterArray(toolMd, 'allowedTools'),
    disabledTools: parseFrontmatterArray(toolMd, 'disabledTools'),
  };
}
```

从 `Tool.md` frontmatter 提取工具权限列表。如果文件不存在或 frontmatter 中没有定义，返回空数组。

### 4. extractCurrentPhase

[packages/core/src/lib/integrations/pi-agent/role-agent/role-context.ts 第 105—118 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/role-context.ts#L105)

```typescript
function extractCurrentPhase(roleMd: string | null): string {
  if (!roleMd) return 'default';

  const fmPhase = parseFrontmatterArray(roleMd, 'currentPhase');
  if (fmPhase.length > 0) return fmPhase[0]!;

  const match = roleMd.match(/^---\n([\s\S]*?)\n---/);
  if (match?.[1]) {
    const phaseMatch = match[1].match(/^currentPhase:\s*(.+)$/m);
    if (phaseMatch?.[1]) return phaseMatch[1].trim();
  }

  return 'default';
}
```

优先从 frontmatter 数组解析，再尝试正则匹配。如果都失败，返回 `'default'`。

## 真实调用链

1. `RoleAgentLauncher.launch(ctx)` 调用 `loadRoleContext(ctx.agentBaseDir)`。
2. `loadRoleContext` 读取 7 个 .md 文件，扫描 `.skills/`。
3. 返回的 `RoleContext` 被传给 `buildRoleSystemPrompt(roleContext, stateMachine)`。

## 关键类型与数据示例

### RoleContext 示例

```typescript
{
  agentMd: '# Code Reviewer\n\n你是一个专业的代码审查助手...',
  roleMd: '---\ncurrentPhase: preparation\nphases:\n  - name: preparation...',
  tasteMd: '## Style\n\n- 使用中文\n- 简洁直接',
  memoryMd: '## 更新记忆\n\n- 用户偏好 Vue 3',
  toolMd: '---\nallowedTools: [read_file, write_file]\n---',
  knowledgeMd: null,
  patternsMd: null,
  memoryBlocks: [{ label: 'human', value: '...', limit: 2000, ... }],
  currentPhase: 'preparation',
  installedSkills: [
    { name: 'ESLint Skill', code: 'eslint-skill', description: '...', ... }
  ],
  allowedTools: ['read_file', 'write_file'],
  agentBaseDir: '/.../data/agents/code-reviewer'
}
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| Agent.md 不存在 | 返回 `null` | 角色身份必须存在 |
| Role.md 不存在 | `currentPhase = 'default'`，`stateMachine` 为空 | 可选文件 |
| Tool.md 不存在 | `allowedTools = []` | 可选文件 |
| .skills/ 不存在 | `installedSkills = []` | 可选目录 |
| frontmatter 格式错误 | `parseFrontmatterArray` 返回空数组 | 正则匹配失败 |

## 测试证据

- `role-context.ts` 当前无直接单元测试。
- 建议补测试：
  - `loadRoleContext` 在 Agent.md 缺失时返回 `null`；
  - `parseToolMdTools` 正确解析 `allowedTools` 和 `disabledTools`；
  - `extractCurrentPhase` 在 `Role.md` 缺失时返回 `'default'`。

## 练习与验收

1. **构造 RoleContext**：手动构造一个 `RoleContext`，验证 `buildRoleSystemPrompt` 能正确构建 prompt。
2. **测试缺失文件**：删除 `Agent.md`，验证 `loadRoleContext` 返回 `null`。
3. **解析 frontmatter**：构造包含 `allowedTools: [a, b, c]` 的 `Tool.md`，验证 `parseToolMdTools` 输出。
4. **阶段提取**：构造 `Role.md`，验证 `extractCurrentPhase` 正确提取 `currentPhase`。

**验收标准**：能独立构造 `RoleContext`，能解释每个字段的来源和用途。

## 章节收束

`role-context.ts` 是 RoleAgent 的数据入口。下一节课（F34）看 `skill-resolver.ts`，理解已安装技能是如何被扫描和解析的。
