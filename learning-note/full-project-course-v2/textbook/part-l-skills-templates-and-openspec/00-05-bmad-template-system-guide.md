# 单元导读五：BMAD 模板家族

第五单元阅读 Part L 中体量最大的模板家族：`bmad-*`。这些目录不能按文件名机械拆成很多短课。它们更适合按能力分层阅读：Agent Builder 负责构建 agent，Workflow Builder 负责构建工作流，Module Builder 和 BMB Setup 负责搭脚手架，Brainstorming、Distillator、Review、Help 等目录提供不同任务类型的模板能力。

读者要学会一种大型模板系统的阅读方法：先找入口 `SKILL.md`，再看 assets 和 references 如何定义产物形状与质量标准，最后看 scripts 如何扫描、转换、验证或生成报告。

## 1. 本单元要解决的问题

| 问题 | 对应课程 |
| --- | --- |
| BMAD 家族为什么是模板系统，而不是一个单独 Skill？ | L35 |
| Agent Builder 的身份、能力、记忆、启动模板怎样组织？ | L36 |
| 质量扫描 references 怎样把“好 Skill”拆成可检查维度？ | L37 |
| Agent Builder 的预检脚本怎样检查结构、依赖和 prompt 指标？ | L38 |
| Workflow Builder 怎样描述复杂工作流和转换过程？ | L39 |
| Workflow Builder 的报告链怎样工作？ | L40 |
| Module Builder 与 BMB Setup 怎样搭脚手架、合并配置、执行校验？ | L41 |
| 怎样把大型模板系统压缩成可复用的阅读框架？ | L42 |

## 2. 本单元源码覆盖

| 文件组 | 本单元责任 |
| --- | --- |
| [templates/skills/bmad-agent-builder/SKILL.md](../../../../templates/skills/bmad-agent-builder/SKILL.md) 及 `assets/**` | 解释 agent 构建模板的入口、身份文件、能力文件、记忆文件、启动配置和可替换变量。 |
| [templates/skills/bmad-agent-builder/references/build-process.md](../../../../templates/skills/bmad-agent-builder/references/build-process.md) 及 quality scan references | 解释构建流程和质量扫描维度。 |
| [templates/skills/bmad-agent-builder/scripts/process-template.py](../../../../templates/skills/bmad-agent-builder/scripts/process-template.py) 、 [templates/skills/bmad-agent-builder/scripts/prepass-execution-deps.py](../../../../templates/skills/bmad-agent-builder/scripts/prepass-execution-deps.py) 、 [templates/skills/bmad-agent-builder/scripts/prepass-prompt-metrics.py](../../../../templates/skills/bmad-agent-builder/scripts/prepass-prompt-metrics.py) | 解释模板处理、依赖预检和 prompt 指标扫描。 |
| [templates/skills/bmad-agent-builder/scripts/prepass-sanctum-architecture.py](../../../../templates/skills/bmad-agent-builder/scripts/prepass-sanctum-architecture.py) 、 [templates/skills/bmad-agent-builder/scripts/prepass-structure-capabilities.py](../../../../templates/skills/bmad-agent-builder/scripts/prepass-structure-capabilities.py) 、 [templates/skills/bmad-agent-builder/scripts/scan-path-standards.py](../../../../templates/skills/bmad-agent-builder/scripts/scan-path-standards.py) 、 [templates/skills/bmad-agent-builder/scripts/scan-scripts.py](../../../../templates/skills/bmad-agent-builder/scripts/scan-scripts.py) | 解释结构、能力、路径和脚本扫描。 |
| [templates/skills/bmad-workflow-builder/SKILL.md](../../../../templates/skills/bmad-workflow-builder/SKILL.md) 、 `assets/**`、`references/**`、`scripts/**` | 解释 workflow 模板、转换流程、质量扫描和报告生成链。 |
| [templates/skills/bmad-module-builder/SKILL.md](../../../../templates/skills/bmad-module-builder/SKILL.md) 、 `assets/**`、`references/**`、`scripts/**` | 解释 module/setup skill 脚手架和校验流程。 |
| [templates/skills/bmad-bmb-setup/scripts/merge-config.py](../../../../templates/skills/bmad-bmb-setup/scripts/merge-config.py) 、 [templates/skills/bmad-bmb-setup/scripts/merge-help-csv.py](../../../../templates/skills/bmad-bmb-setup/scripts/merge-help-csv.py) 、 [templates/skills/bmad-bmb-setup/scripts/cleanup-legacy.py](../../../../templates/skills/bmad-bmb-setup/scripts/cleanup-legacy.py) | 解释 setup 脚本的合并和清理副作用。 |
| [templates/skills/bmad-brainstorming/SKILL.md](../../../../templates/skills/bmad-brainstorming/SKILL.md) 、 `steps/**`、 [templates/skills/bmad-distillator/SKILL.md](../../../../templates/skills/bmad-distillator/SKILL.md) 、 `resources/**` | 作为 step workflow 和压缩重构型 Skill 的背景精读。 |
| 其余 `bmad-*` 单文件 Skill | 作为家族成员背景引用，讲清用途，不拆成短章。 |

## 3. 大型模板系统的三层读法

| 层级 | 先看什么 | 读者要回答的问题 |
| --- | --- | --- |
| 入口层 | `SKILL.md` | 这个 Skill 要生成什么，要求用户提供什么，输出到哪里？ |
| 材料层 | `assets/**`、`references/**`、`steps/**` | 产物结构、质量标准、示例流程和分步指导分别在哪里？ |
| 执行层 | `scripts/**`、`scripts/tests/**` | 哪些脚本会真实读写文件，哪些检查有测试，哪些只是人工参考？ |

## 4. 学习终点

读完 L35-L42 后，读者应该能拿到一个新的 `bmad-*` 目录，并按以下顺序完成阅读：

1. 先用 `SKILL.md` 判断它属于 agent、workflow、module、brainstorming、review 还是辅助工具。
2. 再用 assets/references/steps 判断它生成什么材料、引用什么质量标准。
3. 最后用 scripts/tests 判断哪些行为可以运行验证，哪些只能人工检查。
4. 遇到重复的质量扫描材料时，能合并理解职责，而不是把每个文件拆成孤立知识点。
5. 能说清模板系统和 OriginOS 生产运行时代码之间的边界。
