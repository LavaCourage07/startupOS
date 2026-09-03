# Part L 源码范围与写作台账

本文记录 Part L：Skills、模板与 OpenSpec 的覆盖范围、单元拆分、教学责任和验证边界。它不是正式课正文；正式课负责教学，本文负责防止文件范围、证据状态和延后主题被遗漏。

## 1. Part L 总范围

Part L 对应课程总表中的 T17 与 T18：

| 轨道 | 文件数 | 课程责任 |
| --- | ---: | --- |
| T17 Templates and bundled skills | 238 | 解释 `templates/skills/**`、`templates/project-interview/**`、`skills/reports/**` 怎样定义、生成、评测和沉淀可复用能力。 |
| T18 OpenSpec workflow | 40 | 解释 `.codex/skills/openspec-*`、`openspec/config.yaml`、`openspec/changes/**`、`openspec/specs/**` 怎样支撑变更从提案到归档。 |
| 合计 | 278 | 本 Part 只讲扩展能力与开发工作流，不讲 Web UI、Core Agent runtime、Electron IPC 的生产实现。 |

按文件类型统计：

| 类型 | 文件数 | 教学处理方式 |
| --- | ---: | --- |
| `template-or-skill` | 178 | 精读 frontmatter、变量、输入上下文、引用材料、产物边界和不能替代的运行时事实。 |
| `source` | 60 | 精读脚本入口、参数、文件读写、副作用、失败分支、测试或人工验证方式。 |
| `documentation` | 29 | 区分规范、提案、设计、任务、验证证据、归档历史，不把历史文档写成当前生产事实。 |
| `configuration` | 7 | 解释配置字段、工作流状态、归档元信息和环境约束。 |
| `markup-source` | 4 | 解释 HTML 报告页面的结构、脚本入口、数据展示责任和非生产 UI 边界。 |

## 2. Part L 主线案例

Part L 延续前文的 Skill 主线，但学习目标发生变化：小林不再只是打开一个毕业旅行 Skill，而是要理解团队如何把一个可复用能力写成 Skill、用模板生成配套文件、用脚本检查质量，再通过 OpenSpec 把变更变成可审查、可归档的工程记录。

一句核心问题：

```text
一个 OriginOS 扩展能力，怎样从 SKILL.md 和模板文件，走到脚本化生成、质量验证、OpenSpec 提案、实施任务、归档证据？
```

本 Part 的边界：

| 纳入 | 不纳入 |
| --- | --- |
| Skill 定义文件、模板变量、生成脚本、评测脚本、报告 HTML、OpenSpec Skill、OpenSpec change/spec 文档 | Pi Agent 会话运行时内部实现、SkillDialog UI、Core feature service、Electron IPC、Story 文档体系、发布脚本 |

## 3. 小单元拆分

| 小单元 | 课号 | 导读文件 | 单元总问题 |
| --- | --- | --- | --- |
| Skill 定义与产物边界 | L01-L07 | `00-01-skill-definition-and-output-boundary-guide.md` | `SKILL.md` 到底定义什么，为什么源目录、工作目录和产物目录不能混在一起？ |
| 内置业务 Skill 模板 | L08-L15 | `00-02-bundled-business-skill-templates-guide.md` | 业务型 Skill 怎样组织说明、引用、脚本和 handler？ |
| Agent 与 RoleAgent 创建模板 | L16-L24 | `00-03-agent-and-role-agent-templates-guide.md` | Agent 的身份、记忆、工具、风格文件怎样被模板化？ |
| Skill Creator 与评测报告链 | L25-L34 | `00-04-skill-creator-evaluation-guide.md` | 生成 Skill 后，怎样用脚本、评测和 HTML 报告验证质量？ |
| BMAD 模板家族 | L35-L42 | `00-05-bmad-template-system-guide.md` | 大型模板系统怎样拆分 agent、workflow、module、brainstorming 和 review？ |
| OpenSpec 工作流 | L43-L50 | `00-06-openspec-change-lifecycle-guide.md` | 一个变更怎样从 propose 到 apply、sync、archive，并留下证据？ |

## 4. 源码覆盖台账

| 文件组 | 数量 | 本 Part 状态 | 主讲章节 | 教学责任 | 配对验证 |
| --- | ---: | --- | --- | --- | --- |
| `templates/project-interview/**` | 6 | 精读 | L02、L24 | 解释 Project Agent 工作目录模板中的身份、记忆、知识、模式、口味和工具边界。 | 与 Part F 的 Project Agent prompt 形成概念对照；当前以源码阅读和纸面验收为主。 |
| `skills/reports/architecture-guard/**` | 1 | 背景精读 | L05 | 说明报告文件是一次检查证据，不是生产执行入口。 | 人工核对报告结构和证据字段。 |
| `templates/skills/agent-creator/**` | 7 | 精读 | L16-L18、L24 | 解释普通 Agent 模板怎样生成身份、记忆、过程、数据和风格文件。 | 人工检查模板变量和文件职责；不承诺生产接入。 |
| `templates/skills/role-agent-creator/**` | 10 | 精读 | L19-L21、L24 | 解释 RoleAgent 模板的状态机、工具授权、记忆、知识、模式和演化配置。 | 与 Part F 的 RoleAgent 7 层 prompt 形成边界对照。 |
| `templates/skills/info-query/**` | 3 | 精读 | L08-L09 | 对照说明文件、记忆文件和 TypeScript handler 的职责。 | 源码静态阅读；若后续运行，需要补真实执行命令。 |
| `templates/skills/project-initialization/**` | 4 | 精读 | L10-L11 | 解释项目初始化 Skill 的说明、引用材料和访谈脚本。 | 纸面输入输出验收；脚本运行另行登记。 |
| `templates/skills/task-manager/**` | 2 | 精读 | L08-L09 | 解释任务管理 Skill 的说明文件与 handler 分工。 | 源码静态阅读。 |
| `templates/skills/solution-design/**` | 2 | 精读 | L12 | 解释 Skill 怎样引用协作类型材料，但不替代 Collaboration runtime 精读。 | 引用边界检查。 |
| `templates/skills/wrong-answer-review/**` | 3 | 精读 | L13 | 解释 evals 配置怎样进入练习生成脚本。 | 配置和脚本对照。 |
| `templates/skills/seal-stamper/**` | 3 | 精读 | L14 | 解释工具型 Skill 的文件输入、图像处理和文档副作用。 | 仅源码阅读；真实文件处理需单独运行验证。 |
| `templates/skills/search-and-install-skill/**` | 3 | 精读 | L22 | 解释安装型 Skill 的状态文件和技能描述。 | 人工核对变量与记忆边界。 |
| `templates/skills/mahjong-scorer/**` | 2 | 背景精读 | L04 | 解释有状态 Skill 与普通说明型 Skill 的差异。 | JSON 状态文件结构检查。 |
| `templates/skills/business-refinement/**`、`domain-discovery/**`、`model-review/**` | 3 | 背景精读 | L03 | 建立最小 Skill 定义的阅读方法。 | 人工核对 `SKILL.md` 结构。 |
| `templates/skills/project-skill-creator/**` | 27 | 精读 | L25-L31、L34 | 解释 Skill 生成器的入口、agents、schemas、报告、打包、验证和循环执行脚本。 | 脚本静态阅读；测试缺口需在正文中明确。 |
| `templates/skills/skill-creator-app/**` | 22 | 精读 | L31-L34 | 对照 Project Skill Creator 的重复脚本和 HTML 查看器。 | 结构对照；不把 `__pycache__` 当生产源码。 |
| `templates/skills/bmad-agent-builder/**` | 52 | 精读 | L35-L38、L42 | 解释大型 agent 模板、质量扫描 reference、预检脚本和报告生成链。 | 脚本和 reference 对照；测试缺口登记。 |
| `templates/skills/bmad-workflow-builder/**` | 31 | 精读 | L39-L40、L42 | 解释 workflow 模板、转换流程、质量扫描和报告链。 | 已有脚本测试与人工阅读结合。 |
| `templates/skills/bmad-module-builder/**`、`bmad-bmb-setup/**` | 26 | 精读 | L41-L42 | 解释 module/setup skill 的脚手架、合并和校验责任。 | 脚本测试和源码阅读。 |
| `templates/skills/bmad-brainstorming/**` | 13 | 背景精读 | L35、L42 | 解释 step-based workflow skill 的分步材料组织方式。 | 人工核对步骤顺序。 |
| `templates/skills/bmad-distillator/**` | 8 | 背景精读 | L35、L42 | 解释压缩与重构型 Skill 的 agent/resources 分层。 | 人工核对输入输出边界。 |
| 其余 `bmad-*` 单文件 review/help/index/shard/party skills | 8 | 背景精读 | L35、L42 | 作为大型模板家族的轻量成员，讲清用途和边界，不拆成短章。 | 人工核对 `SKILL.md`。 |
| `.codex/skills/openspec-*/SKILL.md` | 5 | 精读 | L44、L50 | 解释 explore、propose、apply、sync、archive 的角色分工。 | 与实际 `openspec/changes/**` 案例对照。 |
| `openspec/config.yaml` | 1 | 精读 | L43 | 解释 OpenSpec 根配置怎样约束工作流。 | 配置字段阅读。 |
| `openspec/changes/archive/**` | 19 | 精读 | L45-L48 | 解释归档 change 的 proposal、design、tasks、verification、spec delta 和元信息。 | 归档文件完整性检查。 |
| `openspec/changes/fix-windows-multi-agent-esm-url/**` | 5 | 精读 | L49 | 解释 active change 的未完成风险和平台边界。 | 人工核对 tasks/spec 状态。 |
| `openspec/changes/validate-pi-tasks-runtime-boundary/**` | 7 | 精读 | L49 | 解释带 evidence 的 active change 怎样保留兼容性证据。 | `compatibility-report.json` 结构检查。 |
| `openspec/specs/**` | 3 | 精读 | L46、L50 | 解释主 spec 与 change delta 的关系。 | 与 archived/current change spec 对照。 |

## 5. 后续写作闸门

每写一节正式课，都必须回填以下状态：

| 状态 | 要求 |
| --- | --- |
| 精读 | 至少出现关键文件、代码窗口或模板字段，并解释输入、状态、分支、输出和边界。 |
| 运行或检查 | 脚本可运行时给出命令；不能运行或未运行时写明原因与人工检查方法。 |
| 练习 | 给出一个可操作的小实验，优先让读者修改一处变量、模板或输入并预测结果。 |
| 验收 | 至少五个口头验收问题，覆盖概念、路径、边界、失败和证据。 |

Part L 的常见误判必须避免：

1. 不能把 `SKILL.md` 写成“模型会自动做到”的保证；它只是能力说明和上下文输入。
2. 不能把模板目录当成生产产物目录；模板负责生成或指导，产物要看调用方工作目录。
3. 不能把 `__pycache__`、HTML 报告、归档文档当成生产逻辑。
4. 不能因为 OpenSpec change 已归档，就推断当前代码仍保持同一行为；只能写成历史证据或规范演进记录。
5. 不能用“本目录已讲”替代脚本级输入、输出、失败分支和验证说明。
