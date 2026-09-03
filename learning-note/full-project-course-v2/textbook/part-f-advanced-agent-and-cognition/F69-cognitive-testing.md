# F68：认知系统与 ProjectAgent 集成

## 开篇场景

ProjectAgent 专注于项目协作，需要理解项目业务模型、跟踪项目进度、协调多 Agent 协作。认知系统如何帮助 ProjectAgent 积累项目知识、沉淀协作模式？

## 核心问题

**认知系统如何与 ProjectAgent 协作？项目知识如何与对话知识区分？多 Agent 场景下认知系统如何工作？**

## 概念阶梯

### 1. ProjectAgent 的认知架构

```
ProjectAgent
├── ProjectContext
│   ├── Agent.md（项目身份）
│   ├── Tool.md（工具配置）
│   ├── Taste.md（风格指南）
│   ├── Memory.md（历史记录）
│   ├── Knowledge.md（项目知识快照）
│   └── Patterns.md（协作模式快照）
└── CognitiveManager
    ├── PracticeLogger      → practice/turns/
    ├── KnowledgeProvider   → knowledge/ontology.json + business-ontology.json
    └── PatternProvider     → patterns/registry.json
```

### 2. 项目知识与对话知识的区别

| 维度 | 项目知识 | 对话知识 |
|---|---|---|
| **来源** | `business-model.json` | 对话中提取 |
| **存储** | `business-ontology.json` | `ontology.json` |
| **可写性** | 只读 | 可写 |
| **生命周期** | 项目级别 | 会话级别 |
| **用途** | 理解业务背景 | 积累交互经验 |

### 3. 多 Agent 场景

```
ProjectAgent（主 Agent）
  ├── 加载项目认知上下文
  │     ├── Knowledge.md（项目知识）
  │     └── Patterns.md（协作模式）
  └── 启动 Worker Agent
        ├── Worker Agent 1
        │     └── 独立的认知系统（可选）
        └── Worker Agent 2
              └── 独立的认知系统（可选）
```

## 源码精读

### 1. ProjectAgent 启动时的认知初始化

```typescript
// 伪代码
class ProjectLauncher {
  async launch(ctx: LaunchContext): Promise<LaunchResult> {
    // 1. 加载 ProjectContext
    const projectContext = await loadProjectContext(ctx.agentBaseDir!);

    // 2. 初始化认知系统
    const cognitiveManager = new CognitiveManager(projectContext.workingDirectory);
    cognitiveManager.register(new PracticeLogger(projectContext.workingDirectory));
    cognitiveManager.register(new KnowledgeProvider(projectContext.workingDirectory));
    cognitiveManager.register(new PatternProvider(projectContext.workingDirectory));

    // 3. 导入业务模型（如果存在）
    const knowledgeIngest = new KnowledgeIngest(
      path.join(projectContext.workingDirectory, 'knowledge'),
      projectContext.workingDirectory
    );
    await knowledgeIngest.ingestBusinessModel();

    // 4. 构建 system prompt
    const cognitiveSnapshot = await cognitiveManager.build_snapshot_prompt();
    const systemPrompt = buildProjectPromptLayers({
      ...projectContext,
      cognitiveSnapshot,
    });
  }
}
```

### 2. 业务模型导入

[packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-ingest.ts 第 55-81 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-ingest.ts#L55)

```typescript
async ingestBusinessModel(businessModelPath?: string): Promise<void> {
  const actualPath = businessModelPath && existsSync(businessModelPath)
    ? businessModelPath
    : this.findBusinessModelPath();

  if (!actualPath) {
    console.log('[KnowledgeIngest] No business-model.json found, skipping');
    return;
  }

  try {
    const content = readFileSync(actualPath, 'utf-8');
    const projectId = path.basename(this.projectDir);

    // 用 UnifiedOntology 解析业务模型
    const ontology = UnifiedOntology.fromBusinessModel(content, projectId);

    // 写入独立的业务本体文件
    ontology.saveToFile(this.businessOntologyPath);

    // 生成 wiki 页面
    this.writeBusinessWikiPages(ontology);
  } catch (err) {
    console.error('[KnowledgeIngest] Failed to ingest business model:', err);
  }
}
```

### 3. 联合查询

[packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts 第 78-84 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts#L78)

```typescript
queryCombined(filter: Parameters<UnifiedOntology['query']>[0]): Entity[] {
  const results = this.ontology.query(filter);
  if (this.businessOntology) {
    results.push(...this.businessOntology.query(filter));
  }
  return results;
}
```

**联合查询**：同时查询对话知识和业务知识，返回合并结果。

## 真实调用链

```
项目创建
  → 用户完成项目访谈
  → 生成 business-model.json
  → ProjectAgent 启动
       → KnowledgeIngest.ingestBusinessModel()
            → 解析 business-model.json
            → 生成 business-ontology.json
            → 生成 wiki/entities/*.md
       → CognitiveManager 初始化
            → 注册 PracticeLogger、KnowledgeProvider、PatternProvider
       → build_snapshot_prompt()
            → KnowledgeProvider.system_prompt_block()
                 → 加载 Knowledge.md（包含业务知识）
            → PatternProvider.system_prompt_block()
                 → 加载 Patterns.md

项目协作
  → 用户发送消息
  → prefetch(userMessage)
       → KnowledgeProvider.prefetch() → 查询 ontology + business-ontology
       → PatternProvider.prefetch() → 查询 registry + reflections
  → Agent 处理 → 工具调用
  → on_turn_end
       → PracticeLogger.sync_turn() → 记录到 practice/
       → KnowledgeProvider.sync_turn() → 提取实体 → ontology.json
       → PatternProvider.sync_turn() → 检测模式 → registry.json

多 Agent 协作
  → ProjectAgent 启动 Worker Agent
  → Worker Agent 继承 ProjectAgent 的认知上下文
  → Worker Agent 可以独立积累认知数据
  → 会话结束时，Worker Agent 的认知数据合并回 ProjectAgent
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| business-model.json 不存在 | 跳过导入 | `findBusinessModelPath` 返回 null |
| 业务本体损坏 | 创建新的 | `loadBusinessOntology` 有 fallback |
| Worker Agent 认知数据冲突 | 需要合并策略 | 设计问题 |
| 项目知识过大 | 影响性能 | 需要控制大小 |

## 练习与验收

1. **设计合并策略**：如果多个 Worker Agent 产生冲突的认知数据，如何合并？
2. **分析查询性能**：`queryCombined` 同时查询两个 ontology，如何优化？
3. **设计项目知识更新**：如果业务模型更新了，如何通知 ProjectAgent？

**验收标准**：能理解认知系统与 ProjectAgent 的集成关系。

## 章节收束

认知系统与 ProjectAgent 的集成讲完了。下一节课（F69）看认知系统的测试策略。
