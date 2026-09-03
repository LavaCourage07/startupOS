# F53：ProjectAgent 测试策略

## 开篇场景

ProjectAgent 涉及文件系统、prompt 构建、技能补齐等复杂逻辑，测试需要覆盖多种场景。这节课看 ProjectAgent 的测试策略和现有测试。

## 核心问题

**ProjectAgent 的测试覆盖哪些场景？如何 mock 文件系统和 LLM？**

## 现有测试

### 1. collaboration-prompt.test.ts

[packages/core/src/lib/integrations/pi-agent/project-agent/__tests__/collaboration-prompt.test.ts](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/__tests__/collaboration-prompt.test.ts)

覆盖：
- `loadProjectCollaborationContext`：
  - `Agent.md` 不存在时返回 null；
  - 仅 `Agent.md` 存在时其他字段为空；
  - `Data.md` + `Process.md` 同时存在时正确加载；
  - `Tool.md` 存在时提取 `allowedTools`；
  - `Memory.md` / `MEMORY.md` 兼容性。
- `buildCollaborationPrompt`：
  - 生成包含 7 层的完整 prompt；
  - 各层内容验证；
  - `extraInstructions` 注入；
  - 已安装技能注入；
  - 空层过滤。
- `assembleCollaborationPrompt`：
  - 按顺序拼接 7 层；
  - 空层过滤。
- 集成测试：
  - 从文件系统加载并构建完整 prompt。

### 2. project-skill-provisioning.test.ts

[packages/core/src/lib/integrations/pi-agent/project-agent/__tests__/project-skill-provisioning.test.ts](../../../../packages/core/src/lib/integrations/pi-agent/project-agent/__tests__/project-skill-provisioning.test.ts)

覆盖：
- 复制 bundled skill 及其支持文件；
- 保留用户修改，只补齐缺失的依赖；
- 文件与目录冲突时不失败。

## 待补测试

| 模块 | 待补测试 |
|---|---|
| project-context.ts | `loadProjectContext`、`parseAllowedTools` |
| project-prompt.ts | `buildProjectPromptLayers`、`rebuildProjectToolboxLayer` |
| collaboration-prompt.ts | `extractCollaborationSection` 边界情况 |

## 测试策略

1. **单元测试**：mock 文件系统，验证单个函数；
2. **集成测试**：构造临时目录，验证完整流程；
3. **Prompt 测试**：验证 prompt 包含/不包含特定内容。

## 练习与验收

1. **补全测试**：为 `project-context.ts` 写单元测试。
2. **集成测试**：构造临时项目目录，验证完整启动流程。

**验收标准**：能独立为 ProjectAgent 写测试。

## 章节收束

测试策略讲完了。下一节课（F54）看边界与扩展点。
