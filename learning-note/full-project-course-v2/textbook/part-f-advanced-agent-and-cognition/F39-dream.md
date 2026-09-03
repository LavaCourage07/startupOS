# F39：`dream.ts` —— 两阶段自动记忆维护

## 开篇场景

RoleAgent 运行了 20 轮对话，Memory.md 中积累了大量信息：有些已经过时，有些需要更新，有些是新的事实。Dream 是一个两阶段自动记忆维护机制：Phase 1 让 LLM 分析对话历史，输出结构化的记忆更新指令；Phase 2 解析这些指令，精准编辑 Memory.md。这节课看 `dream.ts`。

## 核心问题

**为什么 Dream 要分两个阶段？`DREAM_PHASE1_PROMPT` 包含哪些指令类型？`Dream.run` 如何执行 Phase 2？**

## 概念阶梯

**DreamConfig**：配置触发间隔（默认 20 turn）和过时阈值（默认 14 天）。

**DreamResult**：执行结果，包含变更列表和是否跳过。

**DREAM_PHASE1_PROMPT**：Phase 1 的 prompt 模板，包含现有 Memory.md 和对话历史占位符。

**parseDreamInstructions**：解析 LLM 输出的指令（ADD/UPDATE/REMOVE/SKILL/SKIP）。

**applyDreamInstructions**：委托 memory-core 的 `dream-compat.ts` 执行指令。

## 源码精读

### 1. Dream 配置与结果

[packages/core/src/lib/integrations/pi-agent/role-agent/dream.ts 第 16—29 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/dream.ts#L16)

```typescript
export interface DreamConfig {
  turnInterval?: number;        // 触发间隔（turn 数，默认 20）
  staleThresholdDays?: number;  // 过时阈值（天数，默认 14）
}

export interface DreamResult {
  changes: string[];
  skipped: boolean;
}
```

### 2. DREAM_PHASE1_PROMPT

[packages/core/src/lib/integrations/pi-agent/role-agent/dream.ts 第 34—55 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/dream.ts#L34)

```typescript
export const DREAM_PHASE1_PROMPT = `分析以下对话历史，结合现有 Memory.md，输出记忆更新指令：

## 现有 Memory.md
{existingMemoryMd}

## 对话历史
{recentHistory}

输出格式（每行一条）：
- [ADD] 原子级事实
- [UPDATE] 对已有条目的修正
- [REMOVE] 过时/重复/可从代码推导的条目
- [SKILL] 发现的重复工作流程（名称: 描述）

规则：
- 原子级：具体事实，不要泛泛描述
- 用户纠正 > 解决方案 > 决策 > 事件 > 环境事实
- 去重：同一事实在多处出现时保留最精确的一条
- 过时：已过期计划、已完成任务、被取代的方案
- 不添加：可从源码推导的信息、临时状态、对话填充物

[SKIP] 如果无需更新。`;
```

指令类型：

- `[ADD]`：追加新事实；
- `[UPDATE]`：修正已有条目；
- `[REMOVE]`：删除过时/重复条目；
- `[SKILL]`：发现重复工作流程；
- `[SKIP]`：无需更新。

### 3. Dream.run

[packages/core/src/lib/integrations/pi-agent/role-agent/dream.ts 第 87—108 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/dream.ts#L87)

```typescript
async run(llmOutput: string): Promise<DreamResult> {
  const instructions = parseDreamInstructions(llmOutput);

  if (instructions.length === 0) {
    return { changes: [], skipped: true };
  }

  const memoryPath = path.join(this.agentDir, 'Memory.md');
  const existingContent = existsSync(memoryPath)
    ? readFileSync(memoryPath, 'utf-8')
    : '';

  const newContent = applyDreamInstructions(existingContent, instructions);
  writeFileSync(memoryPath, newContent, 'utf-8');

  const changeDescriptions = instructions.map(i =>
    `[${i.type}] ${i.content.slice(0, 80)}${i.content.length > 80 ? '...' : ''}`,
  );

  return { changes: changeDescriptions, skipped: false };
}
```

Phase 2 流程：

1. 解析 LLM 输出为指令列表；
2. 如果无指令，返回 `skipped: true`；
3. 读取现有 `Memory.md`；
4. 委托 `applyDreamInstructions` 执行指令；
5. 写回 `Memory.md`；
6. 返回变更描述。

## 真实调用链

1. `turn_end` 钩子检查 `turnCount % dream.turnInterval === 0`；
2. 触发时，构造 `DREAM_PHASE1_PROMPT`，填充 `existingMemoryMd` 和 `recentHistory`；
3. 调用 LLM 获取输出；
4. 调用 `dream.run(llmOutput)` 执行 Phase 2；
5. 更新 `Memory.md`。

## 关键类型与数据示例

### LLM 输出示例

```markdown
- [ADD] 用户有一个名为 Luna 的猫
- [UPDATE] 用户偏好中文交流，回答要简洁
- [REMOVE] 旧的项目方案已被取代
- [SKILL] auto-review: 自动审查 PR 流程
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| LLM 输出无指令 | 返回 `skipped: true` | `parseDreamInstructions` 返回空数组 |
| Memory.md 不存在 | 创建新文件 | `existsSync` 检查 |
| applyDreamInstructions 失败 | 可能部分应用 | 取决于实现 |

## 测试证据

- `dream.test.ts` 覆盖 ADD、UPDATE、REMOVE、SKILL、SKIP、混合指令。
- 关键测试：
  - `[ADD]` 在没有 "## 更新记忆" 时创建新 section；
  - `[UPDATE]` 降级为 ADD 当匹配不到时；
  - `[SKILL]` 不修改文件；
  - 混合指令同时执行。

## 练习与验收

1. **模拟 Dream 流程**：构造 LLM 输出，验证 `dream.run` 正确更新 Memory.md。
2. **测试边界**：测试空输入、SKIP、UPDATE 降级为 ADD。
3. **测试 SKILL**：验证 SKILL 指令不修改文件。

**验收标准**：能解释 Dream 的两阶段流程，能模拟 LLM 输出并验证结果。

## 章节收束

Dream 是 RoleAgent 自动记忆维护的核心。下一节课（F40）看 `consolidator.ts`，理解 token 预算触发式压缩。
