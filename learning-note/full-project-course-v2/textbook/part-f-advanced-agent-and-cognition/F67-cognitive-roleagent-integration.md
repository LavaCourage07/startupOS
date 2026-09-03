# F66：Frozen Snapshot 模式

## 开篇场景

Agent 启动时加载了 `Knowledge.md` 和 `Patterns.md` 到 system prompt。如果运行中每次新知识产生都更新 system prompt，LLM 的 prefix cache 就会失效，导致性能下降。解决方案是：**启动时加载一次，运行中不再修改内存中的快照**。

## 核心问题

**什么是 Frozen Snapshot？为什么能保持 prefix cache 稳定？新产生的知识怎么处理？**

## 概念阶梯

### 1. 传统模式 vs Frozen Snapshot

```
传统模式：
  启动 → 加载 Knowledge.md → 运行中更新 → prefix cache 失效 → 性能下降

Frozen Snapshot：
  启动 → 加载 Knowledge.md → 运行中只写磁盘 → prefix cache 稳定 → 性能稳定
  下次启动 → 重新加载 → 包含新知识
```

### 2. Frozen Snapshot 的存储结构

```
Agent 目录/
├── Knowledge.md          # Frozen Snapshot（启动时加载）
├── Patterns.md           # Frozen Snapshot（启动时加载）
├── knowledge/
│   ├── ontology.json     # 运行时写入
│   ├── wiki/             # 运行时写入
│   └── ...
└── patterns/
    ├── registry.json     # 运行时写入
    └── episodic-memory/  # 运行时写入
```

### 3. 更新策略

| 操作 | 内存中的 Snapshot | 磁盘文件 |
|---|---|---|
| 启动时 | 加载到 system prompt | 读取 |
| 运行中 | 不修改 | 写入 |
| 会话结束 | 不修改 | 写入 |
| 下次启动 | 重新加载（包含新知识） | 读取 |

## 源码精读

### 1. KnowledgeProvider 的 Frozen Snapshot

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

**关键点**：
- `exportSnapshot` 只在 `sync_turn` 结束时调用
- 写入磁盘，不修改内存
- 下次启动时重新加载

### 2. PatternProvider 的 Frozen Snapshot

[packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts 第 659-703 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts#L659)

```typescript
private updatePatternsMd(registry: PatternRegistry): void {
  const lines = ['# Experience Patterns\n'];

  // 成功模式
  const validPatterns = registry.patterns.filter(p => !p.isAntiPattern);
  if (validPatterns.length > 0) {
    lines.push('## Positive — 最佳实践\n');
    for (const p of validPatterns) {
      lines.push(`### ${p.triggerCondition}`);
      lines.push(`**推荐路径:** \`${p.toolChain.join(' → ')}\``);
      if (p.principle) {
        lines.push(`**原则:** ${p.principle}`);
      }
      lines.push('');
    }
  }

  // 反模式 + 反思
  const antiPatterns = registry.patterns.filter(p => p.isAntiPattern);
  const reflections = this.getReflectionsForPatternsMd();

  if (antiPatterns.length > 0 || reflections.length > 0) {
    lines.push('## Negative — 避免路径\n');
    // ...
  }

  writeFileSync(this.snapshotMdPath, lines.join('\n'), 'utf-8');
}
```

### 3. system_prompt_block 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts 第 142-154 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/knowledge-provider.ts#L142)

```typescript
async system_prompt_block(): Promise<string> {
  if (existsSync(this.snapshotMdPath)) {
    try {
      const content = readFileSync(this.snapshotMdPath, 'utf-8');
      if (content.trim()) {
        return `## Knowledge Base Snapshot\n\n以下是知识库快照（Knowledge.md），包含当前认知世界的知识索引：\n\n${content}`;
      }
    } catch {
      // ignore
    }
  }
  return '';
}
```

**调用时机**：Agent 启动时，由 `CognitiveManager.build_snapshot_prompt()` 调用。

## 真实调用链

```
Agent 启动
  → CognitiveManager.build_snapshot_prompt()
       → KnowledgeProvider.system_prompt_block()
            → 读取 Knowledge.md（上次会话的快照）
            → 返回 prompt 文本
       → PatternProvider.system_prompt_block()
            → 读取 Patterns.md（上次会话的快照）
            → 返回 prompt 文本
  → 拼接为 system prompt 的一部分

运行中
  → KnowledgeProvider.sync_turn()
       → 提取实体 → 写入 ontology.json
       → exportSnapshot() → 写入 Knowledge.md（磁盘）
       → 内存中的 snapshot 不变
  → PatternProvider.sync_turn()
       → 更新 registry.json
       → updatePatternsMd() → 写入 Patterns.md（磁盘）
       → 内存中的 snapshot 不变

下次启动
  → 重新加载 Knowledge.md 和 Patterns.md（包含新知识）
```

## 为什么 Frozen Snapshot 能保持 Prefix Cache 稳定

LLM 的 prefix cache 机制：
- 当 system prompt 的前缀不变时，LLM 可以复用之前的计算结果
- 如果 system prompt 中途修改，prefix cache 失效，需要重新计算
- Frozen Snapshot 确保 system prompt 的前缀在运行中不变

```
System Prompt:
  [Layer 1: Identity]         ← cacheable
  [Layer 2: StateMemory]        ← cacheable（Frozen Snapshot 在这里）
  [Layer 3: ThinkingLoop]       ← cacheable
  [Layer 4: Toolbox]            ← cacheable
  [Layer 5: Style]              ← cacheable
  [Layer 6: Permissions]        ← cacheable
  [Layer 7: Safety]             ← cacheable
  ---
  [User Message]                ← 不 cache
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| Snapshot 文件不存在 | 返回空字符串 | `existsSync` 检查 |
| Snapshot 文件损坏 | 返回空字符串 | try/catch |
| 新知识与 Snapshot 不一致 | 下次启动时更新 | 设计如此 |
| 大量知识导致 Snapshot 过大 | 可能影响性能 | 需要控制大小 |

## 练习与验收

1. **分析 cache 机制**：为什么 Frozen Snapshot 能保持 prefix cache 稳定？如果不冻结会怎样？
2. **设计更新策略**：如果需要在运行中更新 Snapshot（如紧急知识），如何设计？
3. **控制 Snapshot 大小**：如果 Knowledge.md 超过 10KB，如何优化？

**验收标准**：能理解 Frozen Snapshot 的原理和优势。

## 章节收束

Frozen Snapshot 讲完了。下一节课（F67）看认知系统与 RoleAgent 的集成。
