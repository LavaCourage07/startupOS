# F43：RoleAgent 测试策略

## 开篇场景

RoleAgent 涉及文件系统、LLM 调用、状态机等复杂逻辑，测试需要覆盖多种场景。这节课看 RoleAgent 的测试策略和现有测试。

## 核心问题

**RoleAgent 的测试覆盖哪些场景？如何 mock 文件系统和 LLM？**

## 现有测试

### 1. index.test.ts

[packages/core/src/lib/integrations/pi-agent/role-agent/__tests__/index.test.ts](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/__tests__/index.test.ts)

```typescript
describe('role-agent barrel exports', () => {
  it('does not expose Dream on the default runtime surface', () => {
    expect('Dream' in roleAgentExports).toBe(false);
    expect('DREAM_PHASE1_PROMPT' in roleAgentExports).toBe(false);
  });
});
```

验证 Dream 不在公共导出中。

### 2. memory-tracker.test.ts

[packages/core/src/lib/integrations/pi-agent/role-agent/__tests__/memory-tracker.test.ts](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/__tests__/memory-tracker.test.ts)

覆盖：
- JSONL 历史存储；
- 增量读取；
- Dream cursor；
- flush 行为。

### 3. dream.test.ts

[packages/core/src/lib/integrations/pi-agent/role-agent/__tests__/dream.test.ts](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/__tests__/dream.test.ts)

覆盖：
- ADD、UPDATE、REMOVE、SKILL、SKIP；
- 混合指令；
- Memory.md 不存在时创建。

### 4. consolidator.test.ts

[packages/core/src/lib/integrations/pi-agent/role-agent/__tests__/consolidator.test.ts](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/__tests__/consolidator.test.ts)

覆盖：
- 阈值判断；
- 配置自定义。

## 待补测试

| 模块 | 待补测试 |
|---|---|
| role-context.ts | loadRoleContext、parseToolMdTools、extractCurrentPhase |
| skill-resolver.ts | scanInstalledSkills、extractSkillInfo |
| state-machine.ts | parseStateMachine、determinePhase、checkTransition、applyTransition |
| system-prompt.ts | buildRoleSystemPrompt、rebuildToolboxLayer、rebuildStateMemoryLayer |
| memory-tracker.ts | MemoryBlockManager、parseBlocksFromMarkdown、serializeBlocksToMarkdown |

## 测试策略

1. **单元测试**：mock 文件系统，验证单个函数；
2. **集成测试**：构造临时目录，验证完整流程；
3. **LLM mock**：使用固定输出验证 Dream Phase 2。

## 练习与验收

1. **补全测试**：为 `role-context.ts` 写单元测试。
2. **集成测试**：构造临时 Agent 目录，验证完整启动流程。

**验收标准**：能独立为 RoleAgent 写测试。

## 章节收束

测试策略讲完了。下一节课（F44）看边界与扩展点。
