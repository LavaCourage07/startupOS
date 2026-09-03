# F60：`KnowledgeProvider` —— 知识提取与存储

## 开篇场景

Agent 和用户对话："我叫小明，在 GrowMap 工作，我们做的是项目管理工具"。Agent 需要从这段对话中提取关键信息："小明"（人名）、"GrowMap"（公司名）、"项目管理工具"（产品名）。`KnowledgeProvider` 就是做这个的——它从每轮对话中提取实体和事实，存储到本体中。

## 核心问题

**`KnowledgeProvider` 如何从对话中提取知识？提取后存储在哪里？Frozen Snapshot 是什么？**

## 概念阶梯

### 1. 知识存储结构

```
knowledge/
├── ontology.json           # 主存储（UnifiedOntology JSON）
├── business-ontology.json  # 业务本体（从 business-model.json 导入）
├── index.md                # 知识索引
├── log.md                  # 变更日志
└── wiki/                   # 人类可读视图
    ├── xiaoming.md
    └── growmap.md
```

### 2. 知识提取流程

```
对话文本
  → 提取专有名词（正则匹配）
  → 创建 Entity（type: "Concept"）
  → 写入 ontology.json
  → 生成 wiki 页面
  → 更新 index.md
  → 追加 log.md
  → 导出 Frozen Snapshot（Knowledge.md）
```

### 3. 双本体设计

| 本体 | 来源 | 用途 | 可写性 |
|---|---|---|---|
| **对话知识** (`ontology.json`) | 从对话中提取 | 记录 Agent-用户交互中的知识 | 可写 |
| **业务本体** (`business-ontology.json`) | 从 `business-model.json` 导入 | 记录项目业务模型 | 只读 |

## 源码精读

### 1. 构造函数与目录初始化

[packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts 第 51-64 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts#L51)

```typescript
constructor(agentDir: string) {
  this.agentDir = agentDir;
  this.knowledgeDir = path.join(agentDir, 'knowledge');
  this.ontologyPath = path.join(this.knowledgeDir, 'ontology.json');
  this.businessOntologyPath = path.join(this.knowledgeDir, 'business-ontology.json');
  this.wikiDir = path.join(this.knowledgeDir, 'wiki');
  this.indexMdPath = path.join(this.knowledgeDir, 'index.md');
  this.logMdPath = path.join(this.knowledgeDir, 'log.md');
  this.snapshotMdPath = path.join(agentDir, 'Knowledge.md');

  // 加载两份本体
  this.ontology = this.loadOrCreateOntology();
  this.businessOntology = this.loadBusinessOntology();
  this.ensureKnowledgeDir();
}
```

### 2. sync_turn 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts 第 86-109 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts#L86)

```typescript
async sync_turn(data: TurnCognitiveData): Promise<void> {
  const extracted = this.extractKnowledge(data);
  if (extracted.entities.length === 0 && extracted.facts.length === 0) return;

  // 1. 写入统一本体
  for (const ent of extracted.entities) {
    const existing = this.ontology.entities.find(
      e => e.name === ent.name && e.type === ent.type
    );
    if (!existing) {
      this.ontology.createEntity(ent.type, ent.name, ent.attributes);
    }
  }
  this.saveOntology();

  // 2. 更新衍生 wiki 页面
  this.writeWikiPages(extracted);
  this.updateIndex(extracted);
  this.appendLog(data.turnNumber, extracted);

  // 3. 更新 Frozen Snapshot
  this.exportSnapshot();
}
```

**三个步骤**：
1. **写入本体**：避免重复创建同名同类型实体
2. **更新衍生视图**：wiki 页面、索引、日志
3. **导出快照**：生成 `Knowledge.md`

### 3. 知识提取（启发式）

[packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts 第 264-289 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts#L264)

```typescript
private extractKnowledge(data: TurnCognitiveData): ExtractedKnowledge {
  const entities = [];
  const facts = [];

  // 从用户消息中提取专有名词（大写开头的词组）
  const entityRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  let match: RegExpExecArray | null;
  while ((match = entityRegex.exec(data.userMessage)) !== null) {
    if (match[1] && !entities.some(e => e.name === match![1]) && match[1].length > 2) {
      entities.push({
        name: match[1],
        type: 'Concept',
        attributes: { source: 'conversation', turn: data.turnNumber }
      });
    }
  }

  // 从助手思考过程中提取关键信息
  if (data.assistantThinking && data.assistantThinking.length > 20) {
    facts.push(`Turn #${data.turnNumber}: [thinking] ${data.assistantThinking.slice(0, 500)}`);
  }

  // 从工具调用结果中提取关键信息
  for (const toolCall of data.toolCalls) {
    if (toolCall.success && toolCall.result.length > 50) {
      facts.push(`Turn #${data.turnNumber}: ${toolCall.name} → ${toolCall.result.slice(0, 200)}`);
    }
  }

  return { entities, facts };
}
```

**提取策略**：
- **专有名词**：大写开头的词组（如 "GrowMap"、"Project Management"）
- **思考过程**：助手的推理过程（长度 20-2000）
- **工具结果**：成功的工具调用结果（长度 50-2000）

### 4. Frozen Snapshot 导出

[packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts 第 251-261 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts#L251)

```typescript
private exportSnapshot(): void {
  try {
    let markdown = this.ontology.toMarkdown();
    if (this.businessOntology) {
      markdown += '\n\n---\n\n# Business Ontology\n\n' + this.businessOntology.toMarkdown();
    }
    writeFileSync(this.snapshotMdPath, markdown, 'utf-8');
  } catch (err) {
    console.error('[KnowledgeProvider] Failed to export snapshot:', err);
  }
}
```

**Frozen Snapshot 的特点**：
- 启动时加载到 system prompt（Layer 2: StateMemory）
- 运行中不修改内存中的快照
- 新产生的知识只写入磁盘（`ontology.json`、`wiki/`）
- 下次启动时重新加载

### 5. prefetch 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts 第 111-139 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts#L111)

```typescript
async prefetch(query: string): Promise<string | null> {
  const keywords = query.split(/\s+/).filter(w => w.length > 2);
  if (keywords.length === 0) return null;

  // 联合查询：对话知识 + 业务本体
  const matched: Entity[] = [];
  for (const kw of keywords) {
    matched.push(...this.ontology.query({ type: kw }));
    matched.push(...this.ontology.query({ attributeKey: 'name', attributeValue: kw }));
    if (this.businessOntology) {
      matched.push(...this.businessOntology.query({ type: kw }));
    }
  }

  if (matched.length === 0) {
    return this.searchWikiForMatch(keywords[0]);
  }

  // 去重并格式化
  const unique = new Map<string, Entity>();
  for (const e of matched) unique.set(e.id, e);

  const lines: string[] = [];
  for (const e of unique.values()) {
    lines.push(`- **${e.name}** (type: ${e.type})`);
  }
  return lines.join('\n');
}
```

## 真实调用链

```
用户："我叫小明，在 GrowMap 工作"
  → Agent 处理
  → on_turn_end
       → KnowledgeProvider.sync_turn(data)
            → extractKnowledge(data)
                 → 提取 "GrowMap"（专有名词）
                 → entities = [{ name: "GrowMap", type: "Concept", ... }]
            → ontology.createEntity("Concept", "GrowMap", { source: "conversation", turn: 5 })
            → saveOntology() → knowledge/ontology.json
            → writeWikiPages() → knowledge/wiki/growmap.md
            → updateIndex() → knowledge/index.md
            → appendLog() → knowledge/log.md
            → exportSnapshot() → Knowledge.md
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| 无专有名词 | 跳过处理 | `extracted.entities.length === 0` |
| 实体已存在 | 不重复创建 | `existing` 检查 |
| ontology.json 损坏 | 创建新的空本体 | `loadOrCreateOntology` 有 fallback |
| wiki 目录不存在 | 自动创建 | `ensureKnowledgeDir()` |
| 业务本体不存在 | 返回 null | `loadBusinessOntology` 返回 null |

## 练习与验收

1. **改进提取策略**：当前的正则匹配 `\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b` 有什么局限？如何改进？
2. **设计查询**：如何实现一个查询，找到所有与 "GrowMap" 相关的实体？
3. **分析 Frozen Snapshot**：为什么 Frozen Snapshot 能保持 LLM prefix cache 稳定？如果不冻结会怎样？

**验收标准**：能理解 KnowledgeProvider 的知识提取流程和 Frozen Snapshot 模式。

## 章节收束

`KnowledgeProvider` 讲完了。下一节课（F61）看 `PatternProvider` 如何识别和沉淀经验模式。
