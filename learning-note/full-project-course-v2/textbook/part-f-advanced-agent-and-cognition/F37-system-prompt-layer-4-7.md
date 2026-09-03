# F37：`system-prompt.ts`（下）—— Layer 4-7 与 Prompt 组装

## 开篇场景

F36 讲了 Layer 1-3（身份、状态记忆、思维循环）。这节课继续看 Layer 4-7：工具箱、风格、权限和安全。以及 `system-prompt.ts` 中的辅助函数：`rebuildToolboxLayer`、`rebuildStateMemoryLayer`、`buildSkillTable`、`truncate`。

## 核心问题

**Layer 4（工具箱）如何生成 Installed Skills 表格和 System Tools 列表？Layer 5-7 分别包含什么？如何按需重建某一层？**

## 概念阶梯

**Layer 4: Toolbox**：已安装技能表格 + 技能管理说明 + 系统工具列表。

**Layer 5: Style**：风格指南，来自 `Taste.md`。

**Layer 6: Permissions**：工作目录 + 工具权限授权。

**Layer 7: Safety**：安全约束（固定内容）。

**rebuildToolboxLayer**：技能或 Tool.md 变化时，只重建 Layer 4。

**rebuildStateMemoryLayer**：Memory.md 或阶段变化时，只重建 Layer 2。

## 源码精读

### 1. Layer 4: Toolbox

[packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts 第 152—160 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts#L152)

```typescript
function buildLayer4_Toolbox(ctx: RoleContext): string {
  return `## Toolbox

${buildInstalledSkillsSection(ctx)}

${buildSkillManagementSection()}

${buildSystemToolsSection()}`;
}
```

Layer 4 包含三个子 section：

1. **Installed Skills**：已安装技能表格；
2. **Skill Management**：技能安装/移除说明；
3. **System Tools**：系统工具列表。

### 2. Installed Skills 表格

[packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts 第 162—183 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts#L162)

```typescript
function buildInstalledSkillsSection(ctx: RoleContext): string {
  const hasSkills = ctx.installedSkills.length > 0;
  const skillCodes = ctx.installedSkills
    .slice(0, MAX_SKILLS_IN_PROMPT)
    .map(s => `\`${s.code}\``)
    .join(', ');

  const skillsContent = hasSkills
    ? `${buildSkillTable(ctx.installedSkills)}

- 当前已安装 ${ctx.installedSkills.length} 个技能：${skillCodes}
- **仅以上列出的技能才算已安装**。如果用户要求移除未列出的技能，告知该技能尚未安装。
- **执行技能**：使用 \`read_file\` 读取表格中"技能路径"列对应的 SKILL.md 文件，然后按照文件指令渐进式完成任务。
- **注意**：\`list_skills\` 工具返回的是 \`data/skills/\` 中所有**可安装**技能，不代表已安装。已安装技能以上方表格为准。`
    : `当前没有安装任何技能（\`.skills/\` 目录为空）。当用户需要技能支持时，可按下方 Skill Management 步骤安装。`;

  return `### Installed Skills

以下是你已安装的技能（位于 \`.skills/\` 目录中的软链接），**必须优先使用技能而非系统工具**：

${skillsContent}`;
}
```

关键点：

- 最多显示 50 个技能（`MAX_SKILLS_IN_PROMPT = 50`）；
- 强调 `list_skills` 返回的是“可安装”而非“已安装”；
- 执行技能 = 读取 `SKILL.md` 并按其指令操作。

### 3. Skill Management 说明

[packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts 第 185—206 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts#L185)

```typescript
function buildSkillManagementSection(): string {
  return `\
### Skill Management

**已安装技能**存放在工作目录下的 \`.skills/\` 目录中，每个条目是指向技能目录的软链接。

**安装技能**：当用户要求安装技能时
1. 调用 \`list_skills\` 查询技能库，在返回结果中找到匹配的技能，获取其 \`path\` 字段（真实路径）
2. 如果技能库中**不存在**该技能，告知用户无法安装，并提示用户可以前往技能市场搜索所需技能后再安装，**不要创建软链接**
3. 找到技能后，使用返回的真实 \`path\` 创建软链接：\`mkdir -p .skills && ln -sf {skill.path} .skills/{skillCode}\`
4. **更新 Tool.md**：读取 \`Tool.md\`，在 \`## 已安装技能\` 部分末尾追加一行：
   \`\`\`
   | \`{skillCode}\` | {skillName} | {skill 的 description 字段} | \`.skills/{skillCode}/SKILL.md\` |
   \`\`\`
   然后使用 \`write_file\` 将更新后的内容写回 \`Tool.md\`。

**移除技能**：当用户要求移除技能时
1. 删除目录软链接：\`rm -rf .skills/{skillCode}\`
2. **更新 Tool.md**：读取 \`Tool.md\`，删除该技能对应的记录行，然后使用 \`write_file\` 写回。

**管理原则**：技能仅在 \`.skills/\` 目录中存在时才视为已安装（上方 Installed Skills 表格即为当前状态）。
\`list_skills\` 工具仅用于**浏览可安装的技能库**，不代表已安装状态，不要用它来回答"我有哪些技能"。`;
}
```

安装/移除技能的完整流程，包含软链接操作和 `Tool.md` 更新。

### 4. System Tools 列表

[packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts 第 208—237 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts#L208)

```typescript
function buildSystemToolsSection(): string {
  const categoryLabels: Record<string, string> = {
    file: '文件操作',
    system: '系统命令',
    skill: '技能管理',
    ontology: '本体管理',
    graph: '图谱操作',
    url: '网络工具',
  };

  const toolGroups = getEnabledToolsByCategory('role-agent');
  const groupBlocks = (Object.entries(toolGroups) as [string, ReturnType<typeof getEnabledToolsByCategory>[string][])
    .filter(([, tools]) => tools.length > 0)
    .map(([category, tools]) => {
      const label = categoryLabels[category] ?? category;
      const toolLines = [...tools]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(t => `- \`${t.name}\`: ${truncate(t.description, MAX_SKILL_DESC_CHARS)}`)
        .join('\n');
      return `**${label}：**\n${toolLines}`;
    })
    .join('\n\n');

  return `### System Tools

当技能无法满足用户需求时，你可以使用以下系统工具：

${groupBlocks}`;
}
```

- 按分类分组显示系统工具；
- 工具描述截断到 120 字符（`MAX_SKILL_DESC_CHARS = 120`）；
- 调用 `getEnabledToolsByCategory('role-agent')` 获取 role-agent 可用的工具。

### 5. Layer 5: Style

[packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts 第 239—242 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts#L239)

```typescript
function buildLayer5_Style(ctx: RoleContext): string {
  if (!ctx.tasteMd) return '';
  return `## Style Guide\n\n${ctx.tasteMd}`;
}
```

如果 `tasteMd` 缺失，返回空字符串，被 `filter(Boolean)` 过滤。

### 6. Layer 6: Permissions

[packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts 第 244—252 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts#L244)

```typescript
function buildLayer6_Permissions(ctx: RoleContext): string {
  return `## Working Directory

你的工作目录是: ${ctx.agentBaseDir}

IMPORTANT: All file paths in your operations are relative to this working directory. Use relative file names (e.g., "Tool.md", "Agent.md") rather than full directory paths.

${AGENT_PERMISSION_PROMPT}`;
}
```

- 注入工作目录路径；
- 强调使用相对路径；
- 追加 `AGENT_PERMISSION_PROMPT`（工具权限授权）。

### 7. Layer 7: Safety

[packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts 第 254—260 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts#L254)

```typescript
function buildLayer7_Safety(): string {
  return `## Safety

- 你没有独立目标：不追求自我保护、复制、资源获取或权力扩张；避免超出用户请求的长期计划。
- 优先安全和人工监督：如果指令冲突，暂停并询问；遵守停止/暂停/审计请求，不绕过安全机制。
- 不要操纵或说服用户扩大访问权限或禁用安全措施。`;
}
```

固定内容，所有 RoleAgent 共享。

### 8. 按需重建

[packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts 第 82—89 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts#L82)

```typescript
export function rebuildToolboxLayer(roleContext: RoleContext): string {
  return buildLayer4_Toolbox(roleContext);
}

export function rebuildStateMemoryLayer(roleContext: RoleContext, stateMachine?: StateMachine): string {
  return buildLayer2_StateMemory(roleContext, stateMachine);
}
```

- `rebuildToolboxLayer`：技能安装/移除后调用；
- `rebuildStateMemoryLayer`：Memory.md 更新或阶段转换后调用。

## 真实调用链

1. 技能安装后，`RoleAgentLauncher` 调用 `rebuildToolboxLayer` 获取新的 Layer 4；
2. 用新的 Layer 4 替换旧的，重新组装 system prompt；
3. 调用 `agent.updateSystemPrompt(newPrompt)` 更新运行时 prompt。

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| installedSkills > 50 | 只显示前 50 个 | `MAX_SKILLS_IN_PROMPT` 限制 |
| 工具描述 > 120 字符 | 截断并加 "..." | `truncate` 函数 |
| tasteMd 缺失 | Layer 5 为空 | `filter(Boolean)` 过滤 |
| agentBaseDir 为空 | Layer 6 包含空路径 | 数据问题 |

## 练习与验收

1. **构造技能列表**：构造 60 个技能，验证表格只显示 50 个。
2. **测试 rebuild**：安装新技能后，验证 `rebuildToolboxLayer` 输出包含新技能。
3. **测试截断**：构造超长工具描述，验证截断行为。

**验收标准**：能解释 Layer 4-7 的内容，能按需重建某一层。

## 章节收束

7 层 prompt 全部讲完。下一节课（F38）看 `memory-tracker.ts`，理解 JSONL 历史存储和 Memory Block 管理。
