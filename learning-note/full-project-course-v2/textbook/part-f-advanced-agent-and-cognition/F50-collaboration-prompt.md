# F50：`collaboration-prompt.ts` —— 协作 Prompt 构建

## 开篇场景

在多 Agent 协作场景中，ProjectAgent 需要知道：

1. 自己的角色身份（`Agent.md`）；
2. 可操作的数据对象和权限（`Data.md`）；
3. 处理流程和协作协议（`Process.md`）；
4. 与其他 Agent 的数据边界和触发关系。

`collaboration-prompt.ts` 就是为这种场景设计的 7 层协作 prompt 构建器。

## 核心问题

**协作 prompt 的 7 层和 RoleAgent 的 7 层有什么不同？`extractCollaborationSection` 如何从 `Process.md` 提取协作协议？**

## 概念阶梯

**CollaborativePromptLayers**：7 层协作 prompt（身份、数据契约、处理流程、协作协议、工具箱、风格、权限）。

**extractCollaborationSection**：从 `Process.md` 中提取“协作协议”相关章节。

**Data Contract**：定义可操作的本体对象、字段、约束、操作权限、Agent 间数据边界。

## 源码精读

### 1. CollaborativePromptLayers

[packages/core/src/lib/integrations/pi-agent/project-agent/collaboration-prompt.ts 第 24—32 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/collaboration-prompt.ts#L24)

```typescript
export interface CollaborativePromptLayers {
  identity: string;
  stateAndData: string;
  processFlow: string;
  collaborationProtocol: string;
  toolbox: string;
  style: string;
  permissions: string;
}
```

### 2. Layer 2: Data Contract

[packages/core/src/lib/integrations/pi-agent/project-agent/collaboration-prompt.ts 第 81—101 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/collaboration-prompt.ts#L81)

```typescript
function buildLayer2StateAndData(ctx: ProjectCollaborationContext): string {
  const memorySections = buildPromptMemorySections({
    memoryMd: ctx.memoryMd,
    knowledgeMd: ctx.knowledgeMd,
    patternsMd: ctx.patternsMd,
    stableMemoryHeading: 'Long-term Stable Memory',
    knowledgeHeading: 'Knowledge Base Snapshot',
    patternsHeading: 'Experience Patterns Snapshot',
  });
  const dataContract = ctx.dataMd
    ? `## Data Contract\n\n以下是你的数据契约，定义了你可操作的本体对象、字段约束、操作权限以及与其他 Agent 的数据边界。\n\n${ctx.dataMd}`
    : '';

  return [
    memorySections.coreMemorySection,
    memorySections.stableMemorySection,
    memorySections.knowledgeSection,
    memorySections.patternsSection,
    dataContract,
  ].filter(Boolean).join('\n\n');
}
```

### 3. Layer 4: Collaboration Protocol

[packages/core/src/lib/integrations/pi-agent/project-agent/collaboration-prompt.ts 第 118—142 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/collaboration-prompt.ts#L118)

```typescript
function buildLayer4CollaborationProtocol(ctx: ProjectCollaborationContext): string {
  if (!ctx.processMd) {
    return '';
  }
  return `## Collaboration Protocol\n\n以下是你在多 Agent 协作网络中的位置和协议，包括谁触发你、你触发谁、传递什么数据。\n\n${extractCollaborationSection(ctx.processMd)}`;
}
```

### 4. extractCollaborationSection

[packages/core/src/lib/integrations/pi-agent/project-agent/collaboration-prompt.ts 第 126—142 行](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/collaboration-prompt.ts#L126)

```typescript
function extractCollaborationSection(processMd: string): string {
  const patterns = [
    /^(#{1,3}\s+.*协作协议.*[\s\S]*?)(?=\n#{1,3}\s+|$)/im,
    /^(#{1,3}\s+.*Collaboration.*[\s\S]*?)(?=\n#{1,3}\s+|$)/im,
    /^(#{1,3}\s+.*触发.*[\s\S]*?)(?=\n#{1,3}\s+|$)/im,
    /^(#{1,3}\s+.*被触发.*[\s\S]*?)(?=\n#{1,3}\s+|$)/im,
  ];
  for (const pattern of patterns) {
    const match = processMd.match(pattern);
    if (match !== null && match[0] !== null && match[0].trim().length > 0) {
      return match[0].trim();
    }
  }
  return '';
}
```

提取逻辑：

1. 尝试匹配“协作协议”章节；
2. 尝试匹配“Collaboration”章节；
3. 尝试匹配“触发”章节；
4. 尝试匹配“被触发”章节；
5. 如果都找不到，返回空字符串。

## 真实调用链

1. `CollaborationRuntime` 调用 `loadProjectCollaborationContext`；
2. 调用 `buildCollaborationPrompt(ctx)`；
3. 构建 7 层协作 prompt；
4. 传给 `OriginOSAgent`。

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| Process.md 不存在 | `collaborationProtocol` 为空 | `processMd = ''` |
| 协作协议章节缺失 | `extractCollaborationSection` 返回空 | 正则匹配失败 |
| dataMd 为空 | `stateAndData` 只包含记忆部分 | `filter(Boolean)` 过滤 |

## 测试证据

- `collaboration-prompt.test.ts` 覆盖：
  - `Process.md` 中有协作协议章节时正确提取；
  - 中文协作章节能正确提取；
  - `dataMd` 为空时 Layer 2 为空；
  - `processMd` 为空时 Layer 3 和 Layer 4 都为空。

## 练习与验收

1. **构造 Process.md**：创建包含“协作协议”章节的 `Process.md`，验证 `extractCollaborationSection` 输出。
2. **测试多语言**：测试中文和英文章节标题。

**验收标准**：能解释协作 prompt 的 7 层结构。

## 章节收束

`collaboration-prompt.ts` 是多 Agent 协作的核心。下一节课（F51）看 `project-skill-provisioning.ts`。
