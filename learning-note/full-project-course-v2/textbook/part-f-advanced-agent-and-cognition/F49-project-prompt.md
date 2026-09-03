# F49：`project-prompt.ts` —— 6 层 Project Prompt 构建

## 开篇场景

ProjectAgent 的 system prompt 是 6 层的，和 RoleAgent 的 7 层相比，少了安全层，多了动态技能加载。这节课看 `project-prompt.ts`。

## 核心问题

**ProjectAgent 的 6 层 prompt 和 RoleAgent 的 7 层 prompt 有什么不同？Layer 3 的“动态加载 SKILL.md”是什么意思？**

## 概念阶梯

**ProjectPromptLayers**：6 层 prompt（身份、状态记忆、思维循环、工具箱、风格、权限）。

**buildProjectPromptLayers**：构建 6 层 prompt 的入口函数。

**rebuildProjectToolboxLayer**：技能变化时，只重建 Layer 4。

## 源码精读

### 1. ProjectPromptLayers 与 assembleProjectPrompt

[packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts 第 34—52 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts#L34)

```typescript
export interface ProjectPromptLayers {
  identity: string;
  stateMemory: string;
  thinkingLoop: string;
  toolbox: string;
  style: string;
  permissions: string;
}

export function assembleProjectPrompt(layers: ProjectPromptLayers): string {
  return appendGlobalUserPreferencesPrompt([
    layers.identity,
    layers.stateMemory,
    layers.thinkingLoop,
    layers.toolbox,
    layers.style,
    layers.permissions,
  ].filter(Boolean).join('\n\n---\n\n'));
}
```

### 2. Layer 1: Identity

[packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts 第 73—75 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts#L73)

```typescript
function buildLayer1_Identity(ctx: ProjectContext): string {
  return `## Role Identity\n\n${ctx.agentMd}`;
}
```

和 RoleAgent 相同。

### 3. Layer 2: StateMemory

[packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts 第 77—94 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts#L77)

```typescript
function buildLayer2_StateMemory(ctx: ProjectContext): string {
  const businessModelPath = path.join(ctx.workingDirectory, 'output', 'business-model.json');
  const hasBusinessModel = existsSync(businessModelPath);

  const statusSection = hasBusinessModel
    ? `\n**项目状态：** 已有业务模型，进入模型审阅模式。`
    : `\n**项目状态：** 尚未建立业务模型，进入访谈模式。`;

  const memorySections = buildPromptMemorySections({
    memoryBlocks: ctx.memoryBlocks,
    memoryMd: ctx.memoryMd,
    stableMemoryHeading: 'Long-term Stable Memory',
  });
  const knowledgeSection = ctx.knowledgeMd ? buildKnowledgeLazySection(ctx.knowledgeMd) : '';
  const patternsSection = ctx.patternsMd ? buildPatternsLazySection(ctx.patternsMd) : '';

  return `## Project State & Memory\n\n${statusSection}${memorySections.coreMemorySection}${memorySections.stableMemorySection}${knowledgeSection}${patternsSection}`;
}
```

关键点：

- 检查 `output/business-model.json` 是否存在，判断项目阶段；
- `buildKnowledgeLazySection` 和 `buildPatternsLazySection` 是“惰性加载”——只注入索引，不注入全文。

### 4. Layer 3: ThinkingLoop

[packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts 第 156—179 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts#L156)

```typescript
function buildLayer3_ThinkingLoop(): string {
  return `\
## Thinking Loop — Project Agent

每次回复用户之前，**必须先执行以下三步，不可跳过**：

**Step 1 — 阶段判断**
先调用 \`list_files\` 查看 \`output\` 目录；仅当列表中存在 \`business-model.json\` 时再调用 \`read_file\` 读取。根据文件状态以及 entities 是否为空确认当前阶段：
- 文件不存在或 entities 为空 → Phase 1 领域发现
- entities 存在但模型未完整 → Phase 2 业务精炼
- 用户主动要求审阅或模型完整 → Phase 3 模型审阅

**Step 2 — [MANDATORY] 加载技能文件**
根据 Step 1 确认的阶段，调用 \`read_file\` 读取对应的 SKILL.md 文件：

| 阶段 | 技能文件 |
|------|----------|
| Phase 1 | \`skills/domain-discovery/SKILL.md\` |
| Phase 2 | \`skills/business-refinement/SKILL.md\` |
| Phase 3 | \`skills/model-review/SKILL.md\` |

**Step 3 — 按技能指引响应**
严格按照技能文件中的步骤执行任务，使用业务语言与用户对话，一次只问一个问题。`;
}
```

关键点：

- **动态加载 SKILL.md**：Agent 启动时不会把技能内容注入 prompt，而是让 Agent 在运行中自己 `read_file` 加载；
- **阶段判断**：根据 `business-model.json` 的存在与否判断当前阶段；
- **MANDATORY**：强调必须加载技能文件，不能跳过。

### 5. Layer 4: Toolbox

[packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts 第 181—210 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts#L181)

```typescript
function buildLayer4_Toolbox(_ctx: ProjectContext): string {
  return `## Toolbox

${buildWorkflowSkillsSection()}

${buildSystemToolsSection()}`;
}
```

`buildWorkflowSkillsSection` 生成内置技能的表格（domain-discovery、business-refinement、model-review）。

### 6. Layer 5: Style

[packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts 第 238—241 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts#L238)

```typescript
function buildLayer5_Style(ctx: ProjectContext): string {
  if (!ctx.tasteMd) return '';
  return `## Style Guide\n\n${ctx.tasteMd}`;
}
```

和 RoleAgent 相同。

### 7. Layer 6: Permissions

[packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts 第 243—255 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/project-prompt.ts#L243)

```typescript
function buildLayer6_Permissions(ctx: ProjectContext): string {
  const originosSection = ctx.originosProjectId
    ? `\n\n**OriginOS Business Project ID:** ${ctx.originosProjectId}\n\n这是 OriginOS 业务项目 ID（格式：proj-{id}），用于区分业务项目和本体中的"项目"概念。本体操作工具会使用此 ID 定位正确的本体目录。`
    : '';

  return `## Working Directory

你的工作目录是: ${ctx.workingDirectory}

IMPORTANT: All file paths in your operations are relative to this working directory. Use relative file names (e.g., "Tool.md", "Agent.md") rather than full directory paths.${originosSection}

${AGENT_PERMISSION_PROMPT}`;
}
```

和 RoleAgent 相比，多了 `originosProjectId` 的注入。

## 真实调用链

1. `ProjectLauncher.launch()` 调用 `loadProjectContext()`；
2. 调用 `buildProjectPromptLayers(ctx)`；
3. 调用 `assembleProjectPrompt(layers)` 生成最终 prompt；
4. 传给 `OriginOSAgent`。

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| business-model.json 不存在 | 进入访谈模式 | `existsSync` 检查 |
| tasteMd 缺失 | Layer 5 为空 | `filter(Boolean)` 过滤 |
| originosProjectId 缺失 | 不注入 ID | 可选字段 |

## 测试证据

- `collaboration-prompt.test.ts` 中的 `buildCollaborationPrompt` 测试间接验证了类似逻辑。

## 练习与验收

1. **构造 ProjectContext**：验证 `buildProjectPromptLayers` 输出。
2. **测试阶段判断**：创建/删除 `business-model.json`，验证 Layer 2 的变化。

**验收标准**：能解释 ProjectAgent 的 6 层 prompt 和动态技能加载。

## 章节收束

`project-prompt.ts` 是 ProjectAgent 的核心。下一节课（F50）看 `collaboration-prompt.ts`。
