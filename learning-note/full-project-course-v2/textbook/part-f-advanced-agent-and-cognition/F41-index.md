# F41：`index.ts` —— 模块导出与公共 API

## 开篇场景

`role-agent/` 目录下有 7 个文件，外部使用者不需要知道内部结构，只需要 import `index.ts` 暴露的公共 API。这节课看 `index.ts` 如何组织导出。

## 核心问题

**`index.ts` 导出了哪些公共 API？为什么不直接导出 `Dream`？**

## 源码精读

[packages/core/src/lib/integrations/pi-agent/role-agent/index.ts 第 1—33 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/index.ts#L1)

```typescript
// R.1: 角色上下文加载器
export { loadRoleContext, parseToolMdTools, scanInstalledSkills, type RoleContext, type SkillInfo } from './role-context';

// R.2: 状态机解析与推进
export {
  parseStateMachine,
  determinePhase,
  checkTransition,
  applyTransition,
  type RolePhase,
  type TransitionRule,
  type StateMachine,
  type TransitionResult,
} from './state-machine';

// R.3: 技能扫描器（内部由 skill-resolver 提供，role-context 已 re-export）
export { scanInstalledSkills as scanInstalledSkillsDirect } from './skill-resolver';

// R.4: 分层 System Prompt 构建器
export { buildRoleSystemPrompt, buildSkillMarkdown } from './system-prompt';

// R.5: Memory Tracker
export { MemoryTracker, type MemoryEntry, type MemoryTrackerState } from './memory-tracker';

// R.7 legacy: Dream compatibility shim remains in ./dream, but is no longer part of the default runtime surface.

// R.7: Consolidator (reserved)
export { Consolidator, type ConsolidatorConfig, CONSOLIDATOR_ARCHIVE_PROMPT } from './consolidator';
```

### 导出清单

| Story | 导出内容 |
|---|---|
| R.1 | `loadRoleContext`, `parseToolMdTools`, `scanInstalledSkills`, `RoleContext`, `SkillInfo` |
| R.2 | `parseStateMachine`, `determinePhase`, `checkTransition`, `applyTransition`, 类型 |
| R.3 | `scanInstalledSkillsDirect`（别名） |
| R.4 | `buildRoleSystemPrompt`, `buildSkillMarkdown` |
| R.5 | `MemoryTracker`, `MemoryEntry`, `MemoryTrackerState` |
| R.7 | `Consolidator`, `ConsolidatorConfig`, `CONSOLIDATOR_ARCHIVE_PROMPT` |

### 不导出 Dream

注释说明："Dream compatibility shim remains in ./dream, but is no longer part of the default runtime surface."

原因：

- Dream 是内部机制，外部不需要直接调用；
- 通过 `MemoryTracker` 和 `turn_end` 钩子间接使用。

## 测试证据

- `index.test.ts` 验证：
  - `Dream` 不在导出中；
  - `DREAM_PHASE1_PROMPT` 不在导出中。

## 练习与验收

1. **验证导出**：import `index.ts`，验证所有导出存在。
2. **测试 Dream 不可见**：尝试 import `Dream`，验证编译错误。

**验收标准**：能解释模块导出设计。

## 章节收束

`index.ts` 是 RoleAgent 的公共 API 边界。下一节课（F42）回顾 RoleAgent 与 Launcher 的集成。
