# P2. 中实战：安全改造一个 Skill

## 问题

以 `templates/skills/task-manager/SKILL.md` 为练习对象，学习改 Skill 定义而不破坏加载、prompt、会话和产物目录。最重要的边界：模板/技能源目录可读，运行产物必须写 data root 或项目工作目录。

## 图解

```mermaid
flowchart LR
  SkillMd[SKILL md] --> Load[Skill content API]
  Load --> Dialog[Skill dialog]
  Dialog --> Prompt[Build system prompt]
  Prompt --> Launch[Skill launcher]
  Launch --> Session[Agent session]
  Session --> Output[Writable output directory]
```

![小黑把源码、流程图、测试清单串成一次完整练习](../assets/p-practice-loop.png)

## 源码入口

- [Task manager Skill 定义](../../../../templates/skills/task-manager/SKILL.md#L1)
- [SkillDialog 内容加载（第 59 行）](../../../../packages/web/src/components/skills/SkillDialog.tsx#L59)
- [前端 prompt 构建（第 103 行）](../../../../packages/web/src/components/skills/SkillDialog.tsx#L103)
- [核心 SkillLauncher 路径解析（第 385 行）](../../../../packages/core/src/lib/features/services/launcher/skill.ts#L385)
- [会话与 Agent 注册（第 429 行）](../../../../packages/core/src/lib/features/services/launcher/skill.ts#L429)

## 调用链

```text
Home skill click -> SkillDialog.loadSkillContent
  -> GET skill content -> SKILL.md
  -> buildSkillSystemPrompt
  -> SkillLauncher reads frontmatter
  -> resolve agentWorkingDir/outputDir
  -> createOrRestoreSession -> registerAgent
```

## 关键类型

| 概念 | 作用 |
| --- | --- |
| Skill frontmatter | 声明 name、依赖、前置条件、可选 outputDir。 |
| `agentBaseDir` | 会话工具的主要工作目录。 |
| `CLAUDE_SKILL_DIR` | 指向只读技能资源，不能承载输出。 |
| `OUTPUT_DIR` | 提示词中的产物绝对目录提示。 |

## 测试入口

- [Skill 服务测试](../../../../packages/core/src/lib/features/skills/__tests__/service.test.ts#L1)
- [Skill launcher 测试](../../../../packages/core/src/lib/features/services/launcher/__tests__/skill-launcher.test.ts#L1)
- [Skill export policy 测试](../../../../packages/web/src/components/skills/__tests__/skill-export-policy.test.ts#L1)

## 逐行精读

1. 内容加载优先 Skill API，才回退 Agent API（[第 59 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L59)）。
2. prompt 明确指示技能资源只读、产物不能写入其中（[第 130 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L130)）。
3. launcher 独立运行默认工作目录是 `data/skills/{entryId}`（[第 396 行](../../../../packages/core/src/lib/features/services/launcher/skill.ts#L396)）。
4. session 与 Agent 都接收相同 `agentBaseDir`（[第 429 行](../../../../packages/core/src/lib/features/services/launcher/skill.ts#L429)）。

## 深度拆解

改 Skill 文案通常不需要改 TypeScript；新增依赖、输出约定、前置条件才会影响 launcher 行为。`baseDir`、`workingDir`、`outputDir` 不可混用：源目录用于读参考，工作目录影响工具相对路径，输出目录描述落盘位置。

## 常见故障

| 现象 | 原因 |
| --- | --- |
| Skill 找不到 | config skillName 与 frontmatter/name 不一致。 |
| 产物写入模板目录 | 把 `CLAUDE_SKILL_DIR` 当工作目录。 |
| 恢复错会话 | skill/session stable id 改变。 |
| prompt 没更新 | 内容缓存或未重新初始化。 |

## 改动场景判断

- 只改善步骤说明：改 SKILL.md，验证加载与提示词。
- 新增参考文件：放技能源目录，只读使用。
- 新增产物：明确 outputDir 与 data root，不改 `.claude/skills`。
- 新依赖：更新 frontmatter，审查 launcher 解析与失败提示。

## 源码追问清单

1. frontmatter parser 支持哪些字段？
2. `resolveOutputDirFromFrontmatter` 如何防止越界？
3. 何时使用项目 `agentBaseDir` 覆盖默认 data/skills？
4. Skill 内容缓存何时失效？

## 练习

给 task-manager 设计一项“生成任务周报”的新增输出约定：写清输入、参考文件、可写产物目录、失败反馈和两条测试。先提交设计，不直接写 Skill。

## 验收

- 能从 SKILL.md 追到 prompt、session 与工作目录。
- 能解释三种目录边界。
- 能改进 Skill 而不把产物写进只读源目录。
