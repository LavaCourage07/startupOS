# F74：`Memory` —— Block 集合管理

## 开篇场景

Agent 有多个 Block（human、persona、project、scratchpad、temporal），需要统一管理它们的 CRUD、编译渲染、持久化。`Memory` 类就是做这个的。

## 核心问题

**`Memory` 如何管理 Block 集合？如何编译为 markdown/xml？如何持久化？**

## 概念阶梯

### 1. CRUD 操作

```typescript
class Memory {
  getBlock(label: string): Block | null;           // 读取
  setBlock(label: string, value: string): void;    // 更新（完整替换）
  appendBlock(label: string, content: string): void;  // 追加
  replaceBlock(label: string, old: string, new: string): boolean;  // 精确替换
  createBlock(def: BlockDefinition, value?: string): Block;  // 创建
  deleteBlock(label: string): void;                // 删除
  listBlocks(): Block[];                           // 列出所有
}
```

### 2. 编译渲染

```typescript
memory.compile({ format: 'markdown' });  // 编译为 Markdown
memory.compile({ format: 'xml' });         // 编译为 XML
```

### 3. 持久化

```
Memory.md     # 人类可读格式
blocks.json   # 机器可读格式（版本快照）
```

## 源码精读

### 1. setBlock 实现

[packages/core/src/modules/memory-core/core/memory.ts 第 53-68 行](../../../../packages/core/src/modules/memory-core/core/memory.ts#L53)

```typescript
setBlock(label: string, value: string): void {
  const block = this.blocks.get(label);
  if (!block) throw new Error(`Block '${label}' does not exist`);
  if (block.readOnly) throw new Error(`Block '${label}' is read-only`);
  if (value.length > block.limit) {
    throw new Error(`Content exceeds block limit (${block.limit} chars)`);
  }
  block.value = value;
  block.updatedAt = Date.now();
  block.version += 1;
  block.metadata = {
    ...block.metadata,
    lastEdited: Date.now(),
    lastEditedBy: block.metadata.lastEditedBy ?? 'agent',
  };
  this.save();
}
```

**关键点**：
- 检查 block 是否存在
- 检查 readOnly
- 检查 limit
- 更新 metadata
- 自动 save()

### 2. compileToMarkdown 实现

[packages/core/src/modules/memory-core/core/memory.ts 第 151-173 行](../../../../packages/core/src/modules/memory-core/core/memory.ts#L151)

```typescript
private compileToMarkdown(includeLabels?: string[], includeHidden = false): string {
  const lines: string[] = ['# Memory\n'];
  for (const block of this.blocks.values()) {
    if (includeLabels && !includeLabels.includes(block.label)) continue;
    if ((block.metadata as any).hidden && !includeHidden) continue;

    lines.push(`## ${block.label}`);
    lines.push(`{description: ${block.description}}`);
    lines.push(`{limit: ${block.limit}}`);
    lines.push(`{readOnly: ${block.readOnly}}`);
    if (block.tags.length > 0) {
      lines.push(`{tags: ${block.tags.join(', ')}}`);
    }
    lines.push('');
    if (block.value) {
      lines.push(block.value);
    }
    lines.push('');
  }
  return lines.join('\n');
}
```

**输出示例**：
```markdown
# Memory

## human
{description: 用户画像、偏好、历史习惯}
{limit: 2000}
{readOnly: false}

用户叫小明，喜欢深色模式。

## persona
{description: Agent 角色认知、工作风格、专业语言}
{limit: 2000}
{readOnly: false}

我是 OriginOS 助手，擅长项目管理和代码开发。
```

### 3. save 持久化

[packages/core/src/modules/memory-core/core/memory.ts 第 208-238 行](../../../../packages/core/src/modules/memory-core/core/memory.ts#L208)

```typescript
save(): void {
  this.saveMemoryMd();
  this.saveBlocksSnapshot();
}

private saveMemoryMd(): void {
  const content = this.compileToMarkdown();
  const filePath = path.join(this.agentDir, 'Memory.md');
  fs.mkdirSync(this.agentDir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

private saveBlocksSnapshot(): void {
  const filePath = path.join(this.agentDir, 'blocks.json');
  fs.mkdirSync(this.agentDir, { recursive: true });
  const existing = this.loadBlocksSnapshot();
  const snapshots: BlocksVersionSnapshot[] = existing ?? [];

  const snapshot: BlocksVersionSnapshot = {
    version: this.getNextVersion(snapshots),
    timestamp: Date.now(),
    blocks: Array.from(this.blocks.values()).map(serializeBlock),
  };

  // Keep last 10 versions
  snapshots.push(snapshot);
  while (snapshots.length > 10) {
    snapshots.shift();
  }

  fs.writeFileSync(filePath, JSON.stringify(snapshots, null, 2), 'utf-8');
}
```

**版本快照**：
- 保留最近 10 个版本
- 可以回溯到任意版本

### 4. loadFromDisk 加载

[packages/core/src/modules/memory-core/core/memory.ts 第 257-264 行](../../../../packages/core/src/modules/memory-core/core/memory.ts#L257)

```typescript
private loadFromDisk(): void {
  const memoryMdPath = path.join(this.agentDir, 'Memory.md');
  if (fs.existsSync(memoryMdPath)) {
    const content = fs.readFileSync(memoryMdPath, 'utf-8');
    this.parseMemoryMd(content);
  }
}
```

**解析逻辑**：
- 从 Memory.md 解析 Block
- 支持 `{key: value}` 元数据格式
- 支持多行 value

## 真实调用链

```
Agent 启动
  → new Memory(agentDir)
       → loadFromDisk()
            → 读取 Memory.md
            → parseMemoryMd(content)
                 → 解析 ## label
                 → 解析 {key: value}
                 → 解析 value
       → 如果 blocks 为空
            → initializeDefaults(DEFAULT_BLOCKS)

Agent 编辑
  → memory.setBlock('human', '用户叫小明')
       → 检查 block 存在、readOnly、limit
       → 更新 value、updatedAt、version
       → save()
            → saveMemoryMd() → Memory.md
            → saveBlocksSnapshot() → blocks.json
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| Memory.md 不存在 | 初始化默认 Block | `initializeDefaults` |
| Memory.md 格式错误 | 跳过错误行 | `parseMemoryMd` 有容错 |
| blocks.json 损坏 | 返回 null | `loadBlocksSnapshot` 有 try/catch |
| 版本超过 10 个 | 删除最旧的 | `while (snapshots.length > 10)` |

## 练习与验收

1. **设计 Memory.md**：手写一个 Memory.md，包含 human 和 project 两个 Block。
2. **分析持久化**：为什么同时保存 Memory.md 和 blocks.json？各有什么用途？
3. **版本回溯**：如何从 blocks.json 回溯到上一个版本？

**验收标准**：能理解 Memory 的 CRUD、编译、持久化。

## 章节收束

`Memory` 讲完了。下一节课（F75）看 `ArchivalMemory`——长期语义记忆。
