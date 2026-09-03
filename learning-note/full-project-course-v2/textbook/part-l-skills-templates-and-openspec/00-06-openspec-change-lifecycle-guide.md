# 单元导读六：OpenSpec 变更生命周期

第六单元把 Part L 从 Skill 和模板带入开发工作流。OpenSpec 的价值不在于多几个 Markdown 文件，而在于让一次变更从想法、提案、设计、任务、实现、验证到归档都有可审查证据。

本单元要把两类材料放在一起读：一类是 `.codex/skills/openspec-*`，它们描述 Codex 在不同阶段应该怎样行动；另一类是 `openspec/changes/**` 和 `openspec/specs/**`，它们是项目里真实留下的变更记录、规范增量和归档证据。

## 1. 本单元要解决的问题

| 问题 | 对应课程 |
| --- | --- |
| `openspec/config.yaml` 怎样成为工作流入口？ | L43 |
| explore、propose、apply、sync、archive 五个 Skill 怎样分工？ | L44 |
| 一个归档 change 目录为什么需要 proposal、design、tasks、verification？ | L45 |
| spec delta 和 main spec 是什么关系？ | L46 |
| `window-session-history-restore` 归档案例怎样体现完整闭环？ | L47 |
| `pi-task-public-command-adapter` 案例怎样体现兼容性和验证证据？ | L48 |
| active changes 怎样表达未完成风险？ | L49 |
| 怎样从需求一路追到归档证据？ | L50 |

## 2. 本单元源码覆盖

| 文件组 | 本单元责任 |
| --- | --- |
| [openspec/config.yaml](../../../../openspec/config.yaml) | 解释 OpenSpec 根配置。 |
| [.codex/skills/openspec-explore/SKILL.md](../../../../.codex/skills/openspec-explore/SKILL.md) 、 [.codex/skills/openspec-propose/SKILL.md](../../../../.codex/skills/openspec-propose/SKILL.md) 、 [.codex/skills/openspec-apply-change/SKILL.md](../../../../.codex/skills/openspec-apply-change/SKILL.md) 、 [.codex/skills/openspec-sync-specs/SKILL.md](../../../../.codex/skills/openspec-sync-specs/SKILL.md) 、 [.codex/skills/openspec-archive-change/SKILL.md](../../../../.codex/skills/openspec-archive-change/SKILL.md) | 解释五个 OpenSpec Codex Skill 的阶段职责。 |
| [openspec/changes/archive/2026-07-30-fix-window-session-history-restore/proposal.md](../../../../openspec/changes/archive/2026-07-30-fix-window-session-history-restore/proposal.md) 、 `design.md`、`tasks.md`、`verification.md`、`.openspec.yaml`、`specs/**` | 作为归档闭环案例。 |
| [openspec/changes/archive/2026-08-02-add-pi-task-public-command-adapter/proposal.md](../../../../openspec/changes/archive/2026-08-02-add-pi-task-public-command-adapter/proposal.md) 、 `compatibility-matrix.md`、`verification-evidence.md`、`specs/**` | 作为兼容性和验证证据案例。 |
| [openspec/changes/archive/2026-08-02-fix-completion-judge-abort-handling/proposal.md](../../../../openspec/changes/archive/2026-08-02-fix-completion-judge-abort-handling/proposal.md) 、 `design.md`、`tasks.md`、`verification-evidence.md`、`specs/**` | 作为错误处理韧性案例。 |
| [openspec/changes/fix-windows-multi-agent-esm-url/proposal.md](../../../../openspec/changes/fix-windows-multi-agent-esm-url/proposal.md) 、 `design.md`、`tasks.md`、`.openspec.yaml`、`specs/**` | 解释 active change 的未归档状态和平台风险。 |
| [openspec/changes/validate-pi-tasks-runtime-boundary/README.md](../../../../openspec/changes/validate-pi-tasks-runtime-boundary/README.md) 、 `proposal.md`、`design.md`、`tasks.md`、`evidence/compatibility-report.json`、`specs/**` | 解释带 evidence 的 active change。 |
| [openspec/specs/completion-judge-resilience/spec.md](../../../../openspec/specs/completion-judge-resilience/spec.md) 、 [openspec/specs/pi-task-public-command-adapter/spec.md](../../../../openspec/specs/pi-task-public-command-adapter/spec.md) 、 [openspec/specs/window-session-history-restore/spec.md](../../../../openspec/specs/window-session-history-restore/spec.md) | 解释主 spec 与 change spec 的关系。 |

## 3. 变更生命周期图

```mermaid
flowchart LR
    A[探索问题] --> B[提出 change]
    B --> C[写 design 与 spec delta]
    C --> D[拆 tasks]
    D --> E[实现与验证]
    E --> F[同步 main spec]
    F --> G[归档 change]
```

这张图回答的是 OpenSpec 的学习顺序。每个箭头都代表一种证据变化：从问题到提案，从提案到设计，从设计到任务，从任务到验证，从验证到主规范，再从主规范到归档历史。

## 4. 学习终点

读完 L43-L50 后，读者应该能独立完成一次 OpenSpec 追踪：

1. 从一个 change 目录判断它是 active 还是 archived。
2. 说明 proposal、design、tasks、verification、spec delta 分别承担什么职责。
3. 对照 main spec 判断规范是否已经同步。
4. 从 verification 或 evidence 判断哪些结论有证据，哪些只是计划。
5. 说明 `.codex/skills/openspec-*` 是工作流指令，不是项目规范本身。

L50 的工作坊会要求读者选一个真实 change，从需求文字一路追到归档或未归档风险，并用口头验收说明每一步的证据状态。
