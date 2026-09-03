# F69：认知系统测试策略

## 开篇场景

认知系统涉及文件系统、LLM、统计分析等复杂逻辑，测试需要覆盖多种场景。这节课看认知系统的测试策略和现有测试。

## 核心问题

**认知系统需要测试哪些场景？如何 mock 文件系统和 LLM？**

## 现有测试

### 1. PracticeLogger 测试

```typescript
// practice-logger.test.ts（伪代码）
describe('PracticeLogger', () => {
  it('should write turn data to file', async () => {
    const logger = new PracticeLogger(tempDir);
    await logger.sync_turn({
      turnNumber: 1,
      userMessage: 'hello',
      assistantThinking: 'thinking',
      toolCalls: [{ name: 'read_file', success: true, result: 'content' }],
      outcome: { resolved: true },
    });

    const turnFile = path.join(tempDir, 'practice', 'turns', 'turn-1.json');
    expect(existsSync(turnFile)).toBe(true);
  });

  it('should update summary statistics', async () => {
    const logger = new PracticeLogger(tempDir);
    await logger.sync_turn({ /* ... */ });
    await logger.sync_turn({ /* ... */ });

    const summary = JSON.parse(readFileSync(path.join(tempDir, 'practice', 'summary.json'), 'utf-8'));
    expect(summary.totalTurns).toBe(2);
    expect(summary.successRate).toBe(100);
  });
});
```

### 2. UnifiedOntology 测试

```typescript
// unified-ontology.test.ts（伪代码）
describe('UnifiedOntology', () => {
  it('should create entity with schema', () => {
    const ontology = new UnifiedOntology({ id: 'test', projectId: 'p1', name: 'Test' });
    ontology.registerTypeSchema({
      typeName: 'Company',
      description: 'Company entity',
      attributes: [
        { key: 'name', type: 'string', required: true },
        { key: 'founded', type: 'number', required: false },
      ],
    });

    const entity = ontology.createEntity('Company', 'GrowMap', { name: 'GrowMap', founded: 2024 });
    expect(entity.name).toBe('GrowMap');
    expect(entity.attributes.find(a => a.key === 'name')?.value).toBe('GrowMap');
  });

  it('should throw when missing required attribute', () => {
    const ontology = new UnifiedOntology({ id: 'test', projectId: 'p1', name: 'Test' });
    ontology.registerTypeSchema({
      typeName: 'Company',
      description: 'Company entity',
      attributes: [
        { key: 'name', type: 'string', required: true },
      ],
    });

    expect(() => {
      ontology.createEntity('Company', 'GrowMap', {});
    }).toThrow("Missing required attribute 'name' for type 'Company'");
  });

  it('should query by type', () => {
    const ontology = new UnifiedOntology({ id: 'test', projectId: 'p1', name: 'Test' });
    ontology.createEntity('Company', 'GrowMap', { name: 'GrowMap' });
    ontology.createEntity('Person', 'Alice', { name: 'Alice' });

    const companies = ontology.query({ type: 'Company' });
    expect(companies.length).toBe(1);
    expect(companies[0].name).toBe('GrowMap');
  });
});
```

### 3. PatternProvider 测试

```typescript
// pattern-provider.test.ts（伪代码）
describe('PatternProvider', () => {
  it('should create new pattern on success', async () => {
    const provider = new PatternProvider(tempDir);
    await provider.sync_turn({
      turnNumber: 1,
      userMessage: 'read file',
      assistantThinking: 'thinking',
      toolCalls: [{ name: 'read_file', success: true, result: 'content' }],
      outcome: { resolved: true },
    });

    const registry = JSON.parse(readFileSync(path.join(tempDir, 'patterns', 'registry.json'), 'utf-8'));
    expect(registry.patterns.length).toBe(1);
    expect(registry.patterns[0].toolChain).toEqual(['read_file']);
  });

  it('should create reflection on failure', async () => {
    const provider = new PatternProvider(tempDir);
    await provider.sync_turn({
      turnNumber: 1,
      userMessage: 'read file',
      assistantThinking: 'thinking',
      toolCalls: [{ name: 'read_file', success: false, result: 'not found' }],
      outcome: { resolved: false },
    });

    const files = readdirSync(path.join(tempDir, 'patterns', 'episodic-memory'));
    expect(files.length).toBeGreaterThan(0);
  });
});
```

## 待补测试

| 模块 | 待补测试 |
|---|---|
| KnowledgeProvider | `sync_turn` 实体提取、`prefetch` 查询、`exportSnapshot` |
| PatternProvider | `on_session_end` 批量分析、`searchReflections`、Jaccard 相似度 |
| RuleEngine | `validate` 结构化规则、`validateStructuredOnly`、`addAndValidate` |
| SleepComputeScheduler | `schedule`、`checkIntervalTriggers`、`executePendingForSessionEnd` |
| KnowledgeIngest | `ingestBusinessModel`、`ingestFile`、`ingestExternalInfo` |
| CognitiveManager | `on_turn_end`、`on_session_end`、`build_snapshot_prompt`、`prefetch` |

## 测试策略

### 1. 单元测试

- **mock 文件系统**：使用 `mock-fs` 或临时目录
- **mock LLM**：使用固定返回值的 mock
- **独立测试**：每个测试用例独立，不依赖其他测试

### 2. 集成测试

- **构造临时目录**：创建完整的 Agent 目录结构
- **验证完整流程**：从数据写入到 Frozen Snapshot 生成
- **检查文件内容**：验证 JSON 和 Markdown 格式

### 3. Prompt 测试

- **验证 Frozen Snapshot**：检查 Knowledge.md 和 Patterns.md 的内容
- **验证 system prompt**：检查 `system_prompt_block` 返回的内容

## 练习与验收

1. **补全测试**：为 `KnowledgeProvider.sync_turn` 写一个单元测试。
2. **集成测试**：构造一个完整的 Agent 目录，验证认知系统的完整流程。
3. **性能测试**：测试大量 turn 文件时的性能。

**验收标准**：能独立为认知系统写测试。

## 章节收束

认知系统测试策略讲完了。下一节课（F70）看性能优化与边界。
