# F36：`system-prompt.ts`（上）—— 7 层 Prompt 架构与 Layer 1-3

## 开篇场景

RoleAgent 的 system prompt 不是简单的字符串拼接，而是分 7 层构建的。每层独立生成、按需重建。这节课看 `system-prompt.ts` 的上半部分：Layer 1（身份）、Layer 2（状态与记忆）、Layer 3（思维循环）。

## 核心问题

**为什么 system prompt 要分 7 层？每层解决什么问题？Layer 1-3 分别包含什么内容？**

## 概念阶梯

**PromptLayers**：7 层 prompt 的分层快照，每层是一个字符串。

**assemblePrompt**：把 7 层用 `\n\n---\n\n` 连接成最终 system prompt。

**Layer 1: Identity**：角色身份，来自 `Agent.md` 全文。

**Layer 2: StateMemory**：当前阶段 + Memory.md + Knowledge.md + Patterns.md + Memory Blocks。

**Layer 3: ThinkingLoop**：5 步思考流程指令。

## 源码精读

### 1. PromptLayers 与 assemblePrompt

[packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts 第 33—53 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts#L33)

```typescript
export interface PromptLayers {
  identity: string;
  stateMemory: string;
  thinkingLoop: string;
  toolbox: string;
  style: string;
  permissions: string;
  safety: string;
}

export function assemblePrompt(layers: PromptLayers): string {
  return appendGlobalUserPreferencesPrompt([
    layers.identity,
    layers.stateMemory,
    layers.thinkingLoop,
    layers.toolbox,
    layers.style,
    layers.permissions,
    layers.safety,
  ].filter(Boolean).join('\n\n---\n\n'));
}
```

- 每层用 `\n\n---\n\n` 分隔，形成视觉上的 section 边界。
- `filter(Boolean)` 过滤掉空字符串（如 `style` 层在 `tasteMd` 缺失时为空）。
- `appendGlobalUserPreferencesPrompt` 追加全局用户偏好（如语言设置）。

### 2. Layer 1: Identity

[packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts 第 98—100 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts#L98)

```typescript
function buildLayer1_Identity(ctx: RoleContext): string {
  return `## Role Identity\n\n${ctx.agentMd}`;
}
```

最简单的一层：直接把 `Agent.md` 全文包装在 `## Role Identity` 下。

### 3. Layer 2: StateMemory

[packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts 第 102—128 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts#L102)

```typescript
function buildLayer2_StateMemory(ctx: RoleContext, sm?: StateMachine): string {
  const phaseSection = (() => {
    if (sm && sm.phases.length > 0) {
      const current = sm.phases.find(p => p.name === ctx.currentPhase);
      if (current) {
        return [
          `**当前阶段：** ${current.name}`,
          current.behavior ? `**行为特征：**\n${current.behavior}` : '',
          current.entryCondition ? `**进入条件：** ${current.entryCondition}` : '',
        ].filter(Boolean).join('\n\n');
      }
    }
    return `**当前阶段：** ${ctx.currentPhase}`;
  })();

  const memorySections = buildPromptMemorySections({
    memoryBlocks: ctx.memoryBlocks,
    memoryMd: ctx.memoryMd,
    knowledgeMd: ctx.knowledgeMd,
    patternsMd: ctx.patternsMd,
    stableMemoryHeading: 'Long-term Stable Memory',
    knowledgeHeading: 'Knowledge Base',
    patternsHeading: 'Experience Patterns',
  });

  return `## Role State\n\n${phaseSection}${memorySections.coreMemorySection}${memorySections.stableMemorySection}${memorySections.knowledgeSection}${memorySections.patternsSection}`;
}
```

Layer 2 包含：

1. **当前阶段**：从 `StateMachine` 和 `RoleContext.currentPhase` 构建；
2. **Core Memory**：`memoryBlocks` 渲染为 Letta XML；
3. **Long-term Stable Memory**：`memoryMd` 截断后注入；
4. **Knowledge Base**：`knowledgeMd` 注入；
5. **Experience Patterns**：`patternsMd` 注入。

### 4. Layer 3: ThinkingLoop

[packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts 第 130—150 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/system-prompt.ts#L130)

```typescript
function buildLayer3_ThinkingLoop(): string {
  return `\
## Thinking Loop — RoleAgent

在每次回复用户之前，你必须严格按照以下 5 步进行思考：

1. **状态检查（State Check）**：确认当前所处的角色阶段（准备/执行/复盘等），以及本阶段的行为特征。
2. **意图理解（Intent Understanding）**：分析用户消息的核心意图，判断是需要技能介入还是系统工具。
3. **工具箱选择（Tool Selection）**：
   - 首先检查 Toolbox 中 "Installed Skills" 表格，找到能覆盖用户需求的已安装技能
   - 如果有匹配技能，使用 \`read_file\` 读取该技能的 SKILL.md（路径见表格中"技能路径"列），按照文件内容中的指令渐进式执行任务
   - 如果没有已安装技能能满足需求，再选择系统工具
   - **禁止**仅凭技能名称描述就声称完成了任务；必须实际读取技能文件并执行其指令
4. **执行响应（Execution）**：调用选定的技能或工具，向用户输出响应。
5. **状态更新（State Update）**：如果完成了阶段目标或需要切换阶段，在回复中包含 \`[PHASE:目标阶段名]\` 标记以触发状态转换。

**关键原则：**
- 技能优先于系统工具
- **已安装技能的权威来源**：当前 system prompt 中 "Installed Skills" 表格（来自 \`.skills/\` 目录扫描）。不要用 \`list_skills\` 工具来判断"是否已安装"，\`list_skills\` 返回的是 \`data/skills/\` 中所有**可安装**技能，不代表已安装
- 执行技能 = 读取技能 SKILL.md 文件并按其指令操作，不是口头描述步骤`;
}
```

5 步思考流程：

1. **状态检查**：确认当前阶段和行为特征；
2. **意图理解**：分析用户意图；
3. **工具箱选择**：优先已安装技能，其次系统工具；
4. **执行响应**：调用技能/工具；
5. **状态更新**：输出 `[PHASE:xxx]` 标记触发转换。

## 真实调用链

1. `RoleAgentLauncher.launch()` 调用 `loadRoleContext()` 获取 `RoleContext`。
2. 调用 `parseStateMachine(roleContext.roleMd)` 获取 `StateMachine`。
3. 调用 `buildRoleSystemPrompt(roleContext, stateMachine)` 构建 7 层 prompt。
4. `buildRoleSystemPrompt` 调用 `buildPromptLayers`，每层独立构建。
5. `assemblePrompt` 把 7 层连接成最终字符串。

## 关键类型与数据示例

### 最终 System Prompt 片段

```markdown
## Role Identity

你是一个代码审查助手...

---

## Role State

**当前阶段：** preparation
**行为特征：**
收集需求，制定计划

### Core Memory

<memory_blocks>...</memory_blocks>

---

## Thinking Loop — RoleAgent

在每次回复用户之前，你必须严格按照以下 5 步进行思考：
...
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| agentMd 为空 | Layer 1 为空字符串 | 但 `filter(Boolean)` 不会过滤 |
| tasteMd 缺失 | Layer 5 为空 | `filter(Boolean)` 过滤 |
| memoryMd 为空 | `stableMemorySection` 为空 | `buildPromptMemorySections` 处理 |
| memoryBlocks 存在 | 不渲染 `stableMemorySection` | 互斥逻辑 |

## 练习与验收

1. **构造 RoleContext**：手动构造一个 `RoleContext`，验证 `buildRoleSystemPrompt` 输出。
2. **测试 layer 过滤**：构造 `tasteMd = null` 的 `RoleContext`，验证 Layer 5 被过滤。
3. **测试 memory 互斥**：同时提供 `memoryBlocks` 和 `memoryMd`，验证只渲染 Core Memory。

**验收标准**：能解释 7 层 prompt 的分层逻辑，能独立构建和验证 system prompt。

## 章节收束

Layer 1-3 是 RoleAgent 身份、状态和思维的核心。下一节课（F37）看 Layer 4-7：工具箱、风格、权限和安全。
