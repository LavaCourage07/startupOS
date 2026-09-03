# F65：`KnowledgeIngest` —— 业务模型导入

## 开篇场景

项目访谈完成后，会生成 `business-model.json`，里面包含业务领域、概念、规则等信息。这些结构化数据需要导入到认知系统中，供 Agent 在后续对话中使用。`KnowledgeIngest` 就是做这个的——它把业务模型导入到 UnifiedOntology，并生成人类可读的 wiki 页面。

## 核心问题

**`KnowledgeIngest` 如何导入业务模型？导入后存储在哪里？如何与对话知识区分？**

## 概念阶梯

### 1. 导入来源

```
business-model.json
  ├── domains[]
  │     ├── name: "项目管理"
  │     ├── concepts[]
  │     │     ├── name: "任务"
  │     │     └── ...
  │     └── ...
  └── rules[]
```

### 2. 导入目标

```
knowledge/
├── business-ontology.json    # 业务本体（只读）
└── wiki/entities/
    ├── project-management.md
    └── task.md
```

### 3. 查找优先级

```typescript
const candidates = [
  path.join(projectDir, 'output', 'business-model.json'),
  path.join(projectDir, 'reference', 'business-model.json'),
  path.join(projectDir, 'business-model.json'),
];
```

## 源码精读

### 1. ingestBusinessModel 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-ingest.ts 第 55-81 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-ingest.ts#L55)

```typescript
async ingestBusinessModel(businessModelPath?: string): Promise<void> {
  // 按优先级查找业务模型文件
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

    // 生成 wiki 页面（人类可读视图）
    this.writeBusinessWikiPages(ontology);
  } catch (err) {
    console.error('[KnowledgeIngest] Failed to ingest business model:', err);
  }
}
```

**关键点**：
- 按优先级查找 `business-model.json`
- 使用 `UnifiedOntology.fromBusinessModel` 解析
- 业务本体存储在 `knowledge/business-ontology.json`（独立于对话知识）
- 生成 wiki 页面供人类查看

### 2. fromBusinessModel 工厂方法

[packages/core/src/lib/integrations/pi-agent/cognitive/unified-ontology.ts 第 458-519 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/unified-ontology.ts#L458)

```typescript
static fromBusinessModel(json: string, projectId?: string): UnifiedOntology {
  const data = JSON.parse(json);
  const ontology = new UnifiedOntology({
    id: `ontology-${Date.now()}`,
    projectId: projectId ?? 'default',
    name: data.name ?? 'Business Ontology',
  });

  // 注册业务类型 schema
  const domains: unknown[] = data.domains ?? [];
  for (const domain of domains) {
    const d = domain as Record<string, unknown>;
    const domainName = (d['name'] as string) ?? 'Unknown';
    const domainId = `entity-${ontology.nextEntitySeq++}`;
    ontology.entities.push({
      id: domainId,
      type: 'BusinessDomain',
      name: domainName,
      attributes: buildAttributes(d),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 创建概念实体
    const concepts: unknown[] = (d['concepts'] as unknown[]) ?? [];
    for (const concept of concepts) {
      const c = concept as Record<string, unknown>;
      const conceptName = (c['name'] as string) ?? 'Unknown';
      const conceptId = `entity-${ontology.nextEntitySeq++}`;
      ontology.entities.push({
        id: conceptId,
        type: 'BusinessConcept',
        name: conceptName,
        attributes: buildAttributes(c),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // 建立 contains 关系
      ontology.relations.push({
        id: `relation-${ontology.nextRelationSeq++}`,
        sourceId: domainId,
        targetId: conceptId,
        type: 'contains',
        attributes: {},
      });
    }
  }

  // 业务规则
  const bizRules: unknown[] = data['rules'] ?? [];
  for (const br of bizRules) {
    const b = br as Record<string, unknown>;
    ontology.rules.push({
      id: `rule-${ontology.nextRuleSeq++}`,
      name: (b['name'] as string) ?? 'Unnamed Rule',
      type: ((b['ruleType'] as string) ?? 'constraint') as RuleType,
      description: (b['description'] as string) ?? '',
      severity: ((b['severity'] as RuleSeverity) ?? 'warning'),
      enabled: true,
    });
  }

  return ontology;
}
```

**转换逻辑**：
- `domains` → `BusinessDomain` 实体
- `concepts` → `BusinessConcept` 实体
- `domain -> concept` → `contains` 关系
- `rules` → Rule

### 3. writeBusinessWikiPages 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-ingest.ts 第 125-147 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-ingest.ts#L125)

```typescript
private writeBusinessWikiPages(ontology: UnifiedOntology): void {
  const entitiesDir = path.join(this.wikiDir, 'entities');
  if (!existsSync(entitiesDir)) mkdirSync(entitiesDir, { recursive: true });

  for (const entity of ontology.entities) {
    const fileName = `${entity.name.toLowerCase().replace(/\s+/g, '-')}.md`;
    const entityFile = path.join(entitiesDir, fileName);

    if (!existsSync(entityFile)) {
      const attrLines = entity.attributes.map(a => `- **${a.key}**: ${formatValue(a.value)}`).join('\n');
      const related = ontology.relations
        .filter(r => r.sourceId === entity.id || r.targetId === entity.id)
        .map(r => {
          const target = ontology.getEntity(r.sourceId === entity.id ? r.targetId : r.sourceId);
          return `- ${r.type} → ${target?.name ?? r.sourceId === entity.id ? r.targetId : r.sourceId}`;
        })
        .join('\n');

      const wikiContent = `# ${entity.name}\n\n**类型:** ${entity.type}\n\n## 属性\n\n${attrLines || '（无）'}\n\n## 关系\n\n${related || '（无）'}\n\n## 来源\n\n- business-model.json（knowledge/business-ontology.json 主存储）\n`;
      writeFileSync(entityFile, wikiContent, 'utf-8');
    }
  }
}
```

## 真实调用链

```
项目访谈完成
  → 生成 business-model.json
  → KnowledgeIngest.ingestBusinessModel()
       → 查找 business-model.json
       → UnifiedOntology.fromBusinessModel(content)
            → 创建 BusinessDomain 实体
            → 创建 BusinessConcept 实体
            → 建立 contains 关系
            → 添加业务规则
       → ontology.saveToFile(business-ontology.json)
       → writeBusinessWikiPages()
            → 生成 wiki/entities/*.md
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| business-model.json 不存在 | 跳过 | `findBusinessModelPath` 返回 null |
| JSON 解析失败 | 记录错误 | `JSON.parse` 抛异常 |
| wiki 目录不存在 | 自动创建 | `mkdirSync` |
| 实体 wiki 已存在 | 跳过 | `!existsSync(entityFile)` |

## 练习与验收

1. **设计导入流程**：如果业务模型有更新，如何增量导入？
2. **分析实体关系**：`BusinessDomain` 和 `BusinessConcept` 之间是什么关系？如何查询？
3. **设计 wiki 模板**：为 "用户画像" 实体设计一个 wiki 模板。

**验收标准**：能理解 KnowledgeIngest 的导入流程和双本体设计。

## 章节收束

`KnowledgeIngest` 讲完了。下一节课（F66）看 Frozen Snapshot 模式。
