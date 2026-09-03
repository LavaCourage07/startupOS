# L11：`interview.py` 怎样把问题流程变成脚本

## 学习目标

读完本节，你要能解释：

1. `interview.py` 如何把访谈阶段写成可执行状态机。
2. 脚本怎样创建 Project、Person、Goal、Task 并建立关系。
3. 为什么脚本中的抽取逻辑只是简化样例，不能当成完整 NLP。
4. 如何区分脚本能证明的事情与仍然缺口的事情。

本节精读 [scripts/interview.py](../../../../templates/skills/project-initialization/scripts/interview.py#L1) 。

## 脚本先定义阶段，再定义阶段处理器

`interview.py` 定义了 `InterviewPhase`：`foundation`、`team`、`goals`、`tasks`、`review`、`complete`。`InterviewAgent` 初始化时记录 `session_id`、`project_id`、图谱路径、当前阶段、已创建实体和对话历史。对应源码见 [interview.py](../../../../templates/skills/project-initialization/scripts/interview.py#L53) 和 [interview.py](../../../../templates/skills/project-initialization/scripts/interview.py#L64) 。

处理用户消息时，脚本先把用户输入写入 `conversation_history`，再根据当前阶段调用对应 handler，随后把助手回复也写入历史并保存上下文。也就是说，状态推进不是藏在提示词里，而是写在 `handle_message_by_phase` 的路由表里。对应源码见 [interview.py](../../../../templates/skills/project-initialization/scripts/interview.py#L114) 。

```mermaid
flowchart LR
  User[用户输入] --> History1[记录用户消息]
  History1 --> Router[按 phase 路由]
  Router --> Handler[阶段处理器]
  Handler --> History2[记录助手回复]
  History2 --> Save[保存 context.json]
```

## 上下文保存让脚本可恢复

脚本把上下文默认保存在 `sessions/{session_id}/context.json`。如果文件存在，`load_context` 会读取它；如果不存在，就创建一个包含 `session_id`、`project_id`、`phase`、`entities_created`、`conversation`、`project_entity_id` 的新上下文。对应源码见 [interview.py](../../../../templates/skills/project-initialization/scripts/interview.py#L48) 和 [interview.py](../../../../templates/skills/project-initialization/scripts/interview.py#L78) 。

注意这里的路径是脚本自己的默认值，不等同于 L10 中 `SKILL.md` 规定的 `output/interview-progress.md`。一个是脚本状态 JSON，一个是访谈进度 Markdown。两者都服务恢复，但文件类型和用途不同。

## 阶段如何创建业务对象

Foundation 阶段尝试从用户消息中抽取项目名和描述，然后创建 `Project` 实体，状态为 `planning`。创建成功后，它把项目 ID 保存到上下文，并引导用户进入团队话题。对应源码见 [interview.py](../../../../templates/skills/project-initialization/scripts/interview.py#L159) 。

Team 阶段如果用户表示 solo 或没有团队，会转到 goals；如果用户提到 goal 或 objective，也会转到 goals；否则尝试抽取人员并创建 `Person`，再用 `has_owner` 把项目和人员关联起来。对应源码见 [interview.py](../../../../templates/skills/project-initialization/scripts/interview.py#L204) 。

Goals 阶段抽取目标，创建 `Goal`，并通过 `has_goal` 关联项目。Tasks 阶段抽取任务，创建 `Task`，并通过 `has_task` 关联项目。Review 阶段读取相关人员、目标和任务，生成总结；Complete 阶段把项目状态更新为 `active`。对应源码见 [interview.py](../../../../templates/skills/project-initialization/scripts/interview.py#L249) 、 [interview.py](../../../../templates/skills/project-initialization/scripts/interview.py#L287) 和 [interview.py](../../../../templates/skills/project-initialization/scripts/interview.py#L347) 。

## 抽取逻辑是教学样例，不是生产级理解

脚本自己在注释中说明，抽取方法是 simplified，生产环境应使用 NLP/AI。`extract_project_name` 会寻找英文首字母大写短语，否则取第一个词；`extract_persons` 寻找大写英文名或 “is the” 模式；`extract_goals` 和 `extract_tasks` 用逗号和 `and` 分割文本。对应源码见 [interview.py](../../../../templates/skills/project-initialization/scripts/interview.py#L425) 。

这会带来明显边界：中文项目名、中文人名、复杂目标、带逗号的说明、任务和目标混写，都可能被错误拆分。教程要把这类边界说清楚，因为它直接影响读者对模板能力的判断。

## fallback mock 也要读

脚本尝试从 `awesome-openclaw-skills-1/skills/ontology/scripts` 导入本体函数。如果路径不存在，就打印警告并定义 mock 的 `create_entity` 和 `create_relation`。对应源码见 [interview.py](../../../../templates/skills/project-initialization/scripts/interview.py#L19) 。

这说明脚本有开发态回退能力，但这个回退只覆盖创建实体和创建关系，后面的 `get_related`、`get_entity`、`update_entity` 等函数并没有在 fallback 分支中定义。若真实本体脚本不存在，走到 Review 或 Complete 时可能失败。这个风险不应该被“有 mock”三个字掩盖。

## 以“小林的毕业旅行策划”为例

小林输入：“Graduation Trip planning for our class.” 脚本可能抽到 `Graduation Trip` 作为项目名，并创建 Project。

如果小林输入：“小林、阿杰和晓雨一起去毕业旅行”，当前人员抽取逻辑更偏英文大写名，可能不能可靠创建 Person。即使 L10 的访谈说明支持中文业务对话，L11 的脚本样例也没有完整中文抽取能力。

如果小林在任务阶段输入：“订青旅, 买车票 and 做预算”，脚本会按逗号和 `and` 拆分，创建多个 Task。这个例子能说明脚本的基本流程，但不能证明它理解所有中文表达。

## 测试证据与缺口

本节完成的是静态脚本阅读。已核对 CLI 参数、阶段路由、上下文保存、实体创建、关系创建、Review 和 Complete 逻辑。尚未实际执行脚本，也未安装或验证外部 ontology 脚本路径。

建议后续验证：

1. 用英文项目名运行单轮消息，确认 Project 创建和 context 保存。
2. 用缺失 ontology 路径运行到 Review，确认 fallback 风险是否触发。
3. 用中文姓名和中文任务输入，记录抽取失败边界。
4. 检查输出 JSON 与 `SKILL.md` 的访谈进度 Markdown 是否需要桥接。

## 本节小结

`interview.py` 把访谈流程落成状态机和文件状态，但它只是项目初始化模板中的一个执行样例。它能展示阶段推进、实体创建和上下文保存；它不能证明完整中文业务理解、完整本体集成和所有恢复协议已经生产可用。

## 口头验收

请回答：脚本里的 `context.json` 和 `SKILL.md` 要求的 `interview-progress.md` 有什么不同？为什么 fallback mock 不等于完整离线可运行？
