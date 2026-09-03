# Part L：Skills、模板与 OpenSpec

> 共 50 节。Part L 只讲 OriginOS 的扩展能力和开发工作流：Skill 定义、模板文件、生成脚本、评测报告、OpenSpec 提案与归档证据。Pi Agent 会话运行时在 Part E，RoleAgent / ProjectAgent 运行机制在 Part F，Core 业务服务在 Part G，Web UI 在 Part J，Electron 与桌面服务在 Part K，都不在这里抢跑。

## 课程分段

> 每个大板块都先阅读对应的“单元导读”。导读不替代正式课；它先建立问题、词汇、源码范围和学习终点，避免把模板、脚本、报告和变更记录混成一类文件。

Part L 的源码范围、文件类型统计、延后主题和复审状态统一记录在 [Part L 源码范围与写作台账](../../05-part-l-source-coverage-audit.md) 。正文负责教学，台账负责防止模板文件、脚本文件、证据文件和 OpenSpec 文档被静默遗漏。

| 单元 | 课号 | 总问题 | 导读与正式课 |
| --- | --- | --- | --- |
| Skill 定义与产物边界 | L01-L07 | `SKILL.md` 到底定义什么，为什么源目录、工作目录和产物目录不能混在一起？ | 先读 [单元导读一](00-01-skill-definition-and-output-boundary-guide.md)。已写： [L01](L01-skill-is-a-loadable-capability-contract.md) 、 [L02](L02-project-interview-template-files.md) 、 [L03](L03-minimal-skill-definitions-express-task-boundaries.md) 、 [L04](L04-stateful-skill-and-static-skill.md) 、 [L05](L05-skill-report-is-evidence-not-source.md) 、 [L06](L06-common-misreadings-and-failure-boundaries.md) 、 [L07](L07-skill-definition-and-output-boundary-workshop.md)。 |
| 内置业务 Skill 模板 | L08-L15 | 业务型 Skill 怎样组织说明、引用、脚本和 handler？ | 先读 [单元导读二](00-02-bundled-business-skill-templates-guide.md)。已写： [L08](L08-business-skill-instructions-constrain-work.md) 、 [L09](L09-handler-and-skill-md-have-different-jobs.md) 、 [L10](L10-project-initialization-guides-interview.md) 、 [L11](L11-interview-py-turns-questions-into-script.md) 、 [L12](L12-solution-design-references-collaboration-types.md) 、 [L13](L13-wrong-answer-review-evals-to-practice.md) 、 [L14](L14-file-side-effects-in-tool-skills.md) 、 [L15](L15-business-skill-template-workshop.md)。 |
| Agent 与 RoleAgent 创建模板 | L16-L24 | Agent 的身份、记忆、工具、风格文件怎样被模板化？ | 先读 [单元导读三](00-03-agent-and-role-agent-templates-guide.md)。 |
| Skill Creator 与评测报告链 | L25-L34 | 生成 Skill 后，怎样用脚本、评测和 HTML 报告验证质量？ | 先读 [单元导读四](00-04-skill-creator-evaluation-guide.md)。 |
| BMAD 模板家族 | L35-L42 | 大型模板系统怎样拆分 agent、workflow、module、brainstorming 和 review？ | 先读 [单元导读五](00-05-bmad-template-system-guide.md)。 |
| OpenSpec 工作流 | L43-L50 | 一个变更怎样从 propose 到 apply、sync、archive，并留下证据？ | 先读 [单元导读六](00-06-openspec-change-lifecycle-guide.md)。 |

## 50 节正式课计划

| 课号 | 课题 | 直接责任 |
| --- | --- | --- |
| L01 | Skill 不是按钮，而是一份可加载的能力合同 | 建立 `SKILL.md`、源目录、工作目录、产物目录边界。 |
| L02 | Project Interview 模板里的六个角色文件 | 精读 `templates/project-interview/` 的身份、知识、记忆、模式、口味和工具模板。 |
| L03 | 最小 Skill 定义怎样表达任务边界 | 对比 `business-refinement`、`domain-discovery`、`model-review`。 |
| L04 | 有状态 Skill 与静态说明 Skill 的区别 | 精读 `mahjong-scorer/game-state.json` 与 `search-and-install-skill/skill.json`。 |
| L05 | Skill report 为什么是证据，不是源码 | 精读 `skills/reports/architecture-guard/`。 |
| L06 | Skill 定义的常见误读和失败边界 | 解释目录错位、产物写错、变量缺失和执行误判。 |
| L07 | Skill 定义与产物边界工作坊 | 单元小结、排查地图、综合练习和口头验收。 |
| L08 | 业务 Skill 的说明文件怎样约束任务 | 精读 `info-query/SKILL.md` 与 `task-manager/SKILL.md`。 |
| L09 | TypeScript handler 和说明文件的分工 | 精读 `info-query/handler.ts` 与 `task-manager/handler.ts`。 |
| L10 | 项目初始化 Skill 如何引导访谈 | 精读 `project-initialization/SKILL.md` 与 references。 |
| L11 | `interview.py` 怎样把问题流程变成脚本 | 解释脚本输入、输出、异常和人工验证。 |
| L12 | solution-design 为什么引用 collaboration types | 解释引用材料和运行时边界。 |
| L13 | wrong-answer-review 如何把 evals 转成练习 | 精读 `evals.json` 与 `generate_practice_test.py`。 |
| L14 | seal-stamper 这类工具型 Skill 的文件副作用 | 精读图像和 docx 处理脚本。 |
| L15 | 业务 Skill 模板工作坊 | 单元小结、对照表、综合练习和口头验收。 |
| L16 | Agent Creator 的模板入口 | 精读 `agent-creator/SKILL.md`。 |
| L17 | Agent 身份文件怎样被模板化 | 精读 `agent-md.md`、`taste-md.md`、`memory-md.md`。 |
| L18 | Process/Data 模板怎样描述运行边界 | 精读 `process-md.md` 与 `data-md.md`。 |
| L19 | RoleAgent Creator 的状态文件 | 精读 `Role.md`、`Tool.md`、`Taste.md`。 |
| L20 | RoleAgent 的 Memory、Knowledge、Patterns 模板 | 解释三类长期上下文边界。 |
| L21 | `evolution.json` 是什么，不是什么 | 解释演化配置和生产接入证据边界。 |
| L22 | Search and Install Skill 的安装记忆 | 精读 `Memory.md`、`skill.json`、`SKILL.md`。 |
| L23 | Agent 模板和 Part F 运行时的连接边界 | 区分模板事实、运行时事实和合理推断。 |
| L24 | Agent 与 RoleAgent 模板工作坊 | 单元小结，纸面还原一个 Agent 工作目录。 |
| L25 | Project Skill Creator 的入口合同 | 精读 `SKILL.md`、`LICENSE.txt`、`evolution.json`。 |
| L26 | Creator agents 怎样分工评测 | 精读 `analyzer.md`、`comparator.md`、`grader.md`。 |
| L27 | schemas 与 ontology-tools 作为约束材料 | 精读 references。 |
| L28 | 报告聚合脚本怎样读输入、写输出 | 精读 `aggregate_benchmark.py`、`generate_report.py`。 |
| L29 | 描述优化和打包脚本的边界 | 精读 `improve_description.py`、`package_skill.py`。 |
| L30 | 快速验证、运行评测、循环执行 | 精读 `quick_validate.py`、`run_eval.py`、`run_loop.py`、`utils.py`。 |
| L31 | HTML 评测查看器怎样展示证据 | 精读 `eval_review.html`、`viewer.html`、`generate_review.py`。 |
| L32 | Skill Creator App 与 Project Skill Creator 的重复和差异 | 合并讲重复脚本，明确不同入口。 |
| L33 | `__pycache__` 被跟踪时怎么教学处理 | 标为产物索引，不当作生产源码精读。 |
| L34 | Skill Creator 与评测报告工作坊 | 单元小结，建立验证矩阵。 |
| L35 | BMAD 家族为什么是模板系统，不是单个 Skill | 总览 `bmad-*`。 |
| L36 | BMAD Agent Builder 的核心模板 | 精读身份、能力、记忆、启动模板。 |
| L37 | Agent Builder 的质量扫描 reference | 精读 cohesion、prompt、script、structure 等质量材料。 |
| L38 | Agent Builder 脚本怎样预检结构和依赖 | 精读 `prepass-*`、`scan-*`、`process-template.py`。 |
| L39 | BMAD Workflow Builder 的 workflow 模板 | 精读 workflow assets 与 references。 |
| L40 | Workflow Builder 脚本和报告链 | 精读 `generate-*`、`prepass-*`、tests。 |
| L41 | Module Builder 与 BMB Setup 怎样搭脚手架 | 精读 scaffold、merge、validate 脚本。 |
| L42 | BMAD 模板家族工作坊 | 单元小结，建立大型模板系统排查地图。 |
| L43 | OpenSpec 配置是工作流入口 | 精读 `openspec/config.yaml`。 |
| L44 | 五个 OpenSpec Codex Skill 的角色分工 | 精读 `.codex/skills/openspec-*`。 |
| L45 | 一个归档变更的基本结构 | 精读 proposal、design、tasks、verification。 |
| L46 | spec delta 和 main spec 的关系 | 对照 `openspec/changes/**/specs/**` 与 `openspec/specs/**`。 |
| L47 | window-session-history-restore 作为归档案例 | 完整读一个 archive。 |
| L48 | pi-task-public-command-adapter 作为兼容性案例 | 精读 compatibility 和 verification evidence。 |
| L49 | active changes 如何保留未完成风险 | 精读当前 active changes 和 evidence。 |
| L50 | OpenSpec 变更生命周期工作坊 | 单元小结，从需求到归档证据完成综合验收。 |

每一节均以独立文件写入本目录，使用 `L01-...md` 至 `L50-...md` 命名。阅读单节前先用对应单元导读建立整体路径；审查源码覆盖时以台账为准，不能用“文件已经列出”代替代码窗口级精读。
