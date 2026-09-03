# H46：认知系统测试与验证

## 小林的旅行规划，如何验证 Agent 的认知能力

上一章讲了多 Agent 协作中的记忆共享。本章回答：**如何测试认知系统的各个组件？有哪些测试缺口？**

## 概念阶梯：认知系统测试不是“功能测试”

| 特性 | 认知系统测试 | 功能测试 |
| --- | --- | --- |
| 测试目标 | 知识提取准确性、模式有效性 | 功能正确性 |
| 输入 | 对话历史、工具调用 | 请求参数 |
| 输出 | 结构化知识、经验模式 | 响应数据 |
| 验证方式 | 人工检查 + 自动化 | 自动化断言 |
| 典型挑战 | LLM 输出不确定 | 确定性断言 |

## 第一段源码：现有测试

### `knowledge-provider.test.ts`

```ts
it('extracts knowledge from turn data', async () => {
  const provider = new KnowledgeProvider('/tmp/test-knowledge');
  const data: TurnCognitiveData = {
    turnNumber: 1,
    userMessage: '我喜欢日本料理',
    assistantMessage: '收到',
    toolCalls: [],
    outcome: { resolved: true },
  };
  
  await provider.sync_turn(data);
  
  const ontology = provider.getOntology();
  expect(ontology.entities.length).toBeGreaterThan(0);
});
```

### `pattern-provider.test.ts`

```ts
it('records tool chain pattern', async () => {
  const provider = new PatternProvider('/tmp/test-pattern');
  const data: TurnCognitiveData = {
    turnNumber: 1,
    userMessage: '查询天气',
    assistantMessage: '正在查询',
    toolCalls: [{ name: 'weather_query', success: true }],
    outcome: { resolved: true },
  };
  
  await provider.sync_turn(data);
  
  const registry = provider.readRegistry();
  expect(registry.patterns.length).toBeGreaterThan(0);
});
```

## 第二段源码：测试挑战

### 挑战 1：LLM 输出不确定

```ts
const extracted = this.extractKnowledge(data);
// extracted 的内容依赖 LLM，每次可能不同
```

**解决方案**：
- Mock LLM 响应。
- 使用固定 seed。
- 人工验证样本。

### 挑战 2：知识提取准确性

```ts
// 如何验证提取的知识是否正确？
expect(extracted.entities[0].name).toBe('日本料理');
// 可能失败，因为 LLM 可能提取为 '日本菜'
```

**解决方案**：
- 使用模糊匹配。
- 定义知识提取的验收标准。
- 人工抽查。

### 挑战 3：模式有效性评估

```ts
// 如何验证模式是否有效？
expect(pattern.effectiveness.successRate).toBeGreaterThan(80);
// 需要大量样本才能评估
```

**解决方案**：
- 收集足够样本。
- 使用 A/B 测试。
- 人工评估。

## 测试策略

### 单元测试

| 组件 | 测试内容 | 方法 |
| --- | --- | --- |
| `KnowledgeProvider` | 知识提取、去重、持久化 | Mock LLM，断言实体 |
| `PatternProvider` | 模式注册、统计更新 | Mock 数据，断言注册表 |
| `PracticeLogger` | 日志记录、统计更新 | 临时目录，断言文件 |
| `CognitiveManager` | Provider 注册、生命周期 | Mock Provider |

### 集成测试

| 场景 | 测试内容 | 方法 |
| --- | --- | --- |
| 完整对话 | 知识提取 → 持久化 → 查询 | 端到端测试 |
| 多 Provider | 多个 Provider 协同工作 | 断言各 Provider 状态 |
| Session 结束 | 记忆整理、知识合并 | 断言文件变化 |

## 测试缺口

### 缺口 1：LLM 输出不确定

- **影响**：知识提取测试不稳定。
- **现状**：Mock LLM 响应。
- **风险**：Mock 可能无法覆盖真实场景。

### 缺口 2：知识提取准确性

- **影响**：无法自动验证知识质量。
- **现状**：人工抽查。
- **风险**：人工成本高，覆盖率低。

### 缺口 3：模式有效性

- **影响**：无法自动评估模式质量。
- **现状**：依赖统计指标。
- **风险**：统计指标可能误导。

### 缺口 4：性能测试

- **影响**：不知道认知系统在大数据量下的表现。
- **现状**：无性能测试。
- **风险**：生产环境可能性能不足。

## 测试建议

1. **建立知识提取基准测试**：定义标准输入和期望输出。
2. **自动化模式评估**：使用统计指标 + 人工抽查。
3. **性能基准测试**：测试大数据量下的性能。
4. **集成测试覆盖**：端到端测试认知系统。

## 口头验收

不看源码，你能解释：

1. 认知系统测试的挑战是什么？
2. 如何测试 `KnowledgeProvider`？
3. 如何评估模式有效性？
4. 测试缺口有哪些？

## 章节收束

本章讲解了认知系统的测试与验证：测试挑战、测试策略、测试缺口。下一章（H47）是 Unit 7 小结课。
