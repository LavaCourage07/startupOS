# 单元导读一：Skill 定义与产物边界

前面的课程已经讲过用户怎样从首页打开一个 Skill，并进入 Pi Agent 会话。Part L 的第一单元换一个角度看同一件事：如果读者面对的不是运行中的窗口，而是一组 `SKILL.md`、模板文件、状态文件和报告文件，应该怎样判断它们各自负责什么？

本单元不急着写脚本，也不急着追运行时。读者先要建立一个基础判断：Skill 定义文件不是按钮，不是模型，也不是产物目录。它是一份可被系统读取的能力说明。模板文件不是执行结果，而是生成或指导结果的材料。报告文件不是生产逻辑，而是某次检查留下的证据。

## 1. 本单元要解决的问题

| 问题 | 对应课程 |
| --- | --- |
| `SKILL.md` 为什么是一份能力合同，而不是一个可直接点击的应用？ | L01 |
| Project Interview 模板中的身份、知识、记忆、模式、口味和工具文件怎样分工？ | L02 |
| 最小 Skill 定义需要表达哪些任务边界？ | L03 |
| 有状态 Skill 与静态说明型 Skill 有什么不同？ | L04 |
| Skill report 为什么只能作为证据，而不能当成源码入口？ | L05 |
| 源目录、工作目录、产物目录混淆后会出现什么问题？ | L06 |
| 怎样从文件结构判断一个 Skill 是否被正确理解？ | L07 |

## 2. 本单元源码覆盖

| 文件组 | 本单元责任 |
| --- | --- |
| [templates/project-interview/Agent.md](../../../../templates/project-interview/Agent.md) 、 [templates/project-interview/Knowledge.md](../../../../templates/project-interview/Knowledge.md) 、 [templates/project-interview/MEMORY.md](../../../../templates/project-interview/MEMORY.md) | 解释 Project Agent 初始化模板的身份、知识和记忆边界。 |
| [templates/project-interview/Patterns.md](../../../../templates/project-interview/Patterns.md) 、 [templates/project-interview/Taste.md](../../../../templates/project-interview/Taste.md) 、 [templates/project-interview/Tool.md](../../../../templates/project-interview/Tool.md) | 解释经验模式、风格偏好和工具授权怎样进入工作目录。 |
| [templates/skills/business-refinement/SKILL.md](../../../../templates/skills/business-refinement/SKILL.md) 、 [templates/skills/domain-discovery/SKILL.md](../../../../templates/skills/domain-discovery/SKILL.md) 、 [templates/skills/model-review/SKILL.md](../../../../templates/skills/model-review/SKILL.md) | 建立最小 Skill 定义的阅读方法。 |
| [templates/skills/mahjong-scorer/SKILL.md](../../../../templates/skills/mahjong-scorer/SKILL.md) 、 [templates/skills/mahjong-scorer/game-state.json](../../../../templates/skills/mahjong-scorer/game-state.json) | 解释带状态文件的 Skill 怎样表达当前状态。 |
| [templates/skills/search-and-install-skill/SKILL.md](../../../../templates/skills/search-and-install-skill/SKILL.md) 、 [templates/skills/search-and-install-skill/Memory.md](../../../../templates/skills/search-and-install-skill/Memory.md) 、 [templates/skills/search-and-install-skill/skill.json](../../../../templates/skills/search-and-install-skill/skill.json) | 解释安装型 Skill 的记忆文件和结构化描述。 |
| [skills/reports/architecture-guard/architecture-guard-20260729-120736.md](../../../../skills/reports/architecture-guard/architecture-guard-20260729-120736.md) | 解释报告文件怎样作为检查证据被阅读。 |

## 3. 核心区分

| 对象 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `SKILL.md` | 告诉 Agent 或调用方这个能力的目标、约束、输入材料和执行方式。 | 不保证模型一定正确执行，也不等于产物已经生成。 |
| 模板文件 | 提供可复制、可替换或可初始化的内容结构。 | 不代表用户工作目录中已经存在对应产物。 |
| 状态文件 | 保存一个 Skill 或模板的当前结构化状态。 | 不等于所有运行时状态，也不一定被生产入口消费。 |
| 报告文件 | 记录某次检查、扫描或验证的结果。 | 不等于当前代码仍然满足报告中的判断。 |
| 工作目录 | 承载用户任务产生的文件和中间结果。 | 不应该被源定义目录替代。 |

## 4. 学习终点

读完 L01-L07 后，读者应该能独立完成三件事：

1. 打开一个陌生的 Skill 目录，判断哪些文件是定义、哪些是模板、哪些是状态、哪些是证据。
2. 说明一个产物应该写入工作目录，而不是写回 `templates/skills/**` 或 `.codex/skills/**`。
3. 从“运行失败”或“结果写错地方”这种现象出发，先检查目录边界和输入材料，而不是直接怀疑模型。

本单元最后的 L07 是工作坊。它会要求读者选择一个简单 Skill，画出源定义、可读材料、可写产物和验证证据之间的关系。
