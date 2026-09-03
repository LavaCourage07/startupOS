# 单元导读三：Agent 与 RoleAgent 创建模板

第三单元从 Skill 转向 Agent 模板。前面 Part F 已经讲过 RoleAgent、ProjectAgent 和认知系统的运行机制；本单元只看模板层：一个 Agent 工作目录被创建之前，哪些文件先作为模板存在？这些模板怎样表达身份、工具、记忆、知识、模式和风格？

读者需要特别克制一个误判：模板里出现 `Memory.md`、`Knowledge.md` 或 `Tool.md`，并不表示运行时已经加载了它们。模板只是准备一组初始文件。是否被加载、何时被加载、怎样进入 prompt，要回到 Part F 的运行时源码查证。

## 1. 本单元要解决的问题

| 问题 | 对应课程 |
| --- | --- |
| `agent-creator/SKILL.md` 怎样规定创建 Agent 的任务？ | L16 |
| Agent 身份、记忆和风格模板分别承担什么职责？ | L17 |
| Process/Data 模板怎样描述运行过程和数据边界？ | L18 |
| RoleAgent 的状态机、工具和风格模板怎样分工？ | L19 |
| `Memory.md`、`Knowledge.md`、`Patterns.md` 为什么不能混用？ | L20 |
| `evolution.json` 能说明什么，不能说明什么？ | L21 |
| 安装型 Skill 的记忆和描述怎样补充 Agent 模板理解？ | L22 |
| 模板事实和运行时事实怎样对照？ | L23-L24 |

## 2. 本单元源码覆盖

| 文件组 | 本单元责任 |
| --- | --- |
| [templates/skills/agent-creator/SKILL.md](../../../../templates/skills/agent-creator/SKILL.md) | 解释 Agent Creator 的入口说明和任务边界。 |
| [templates/skills/agent-creator/assets/templates/agent-md.md](../../../../templates/skills/agent-creator/assets/templates/agent-md.md) 、 [templates/skills/agent-creator/assets/templates/memory-md.md](../../../../templates/skills/agent-creator/assets/templates/memory-md.md) 、 [templates/skills/agent-creator/assets/templates/taste-md.md](../../../../templates/skills/agent-creator/assets/templates/taste-md.md) | 解释身份、记忆和风格模板。 |
| [templates/skills/agent-creator/assets/templates/process-md.md](../../../../templates/skills/agent-creator/assets/templates/process-md.md) 、 [templates/skills/agent-creator/assets/templates/data-md.md](../../../../templates/skills/agent-creator/assets/templates/data-md.md) | 解释过程和数据模板。 |
| [templates/skills/agent-creator/references/Memory.md](../../../../templates/skills/agent-creator/references/Memory.md) | 解释参考记忆和真实记忆文件的差别。 |
| [templates/skills/role-agent-creator/SKILL.md](../../../../templates/skills/role-agent-creator/SKILL.md) 、 [templates/skills/role-agent-creator/Memory.md](../../../../templates/skills/role-agent-creator/Memory.md) 、 [templates/skills/role-agent-creator/evolution.json](../../../../templates/skills/role-agent-creator/evolution.json) | 解释 RoleAgent Creator 的入口、初始记忆和演化配置。 |
| [templates/skills/role-agent-creator/reference/Agent.md](../../../../templates/skills/role-agent-creator/reference/Agent.md) 、 [templates/skills/role-agent-creator/reference/Role.md](../../../../templates/skills/role-agent-creator/reference/Role.md) 、 [templates/skills/role-agent-creator/reference/Tool.md](../../../../templates/skills/role-agent-creator/reference/Tool.md) | 解释身份、状态机和工具授权模板。 |
| [templates/skills/role-agent-creator/reference/Knowledge.md](../../../../templates/skills/role-agent-creator/reference/Knowledge.md) 、 [templates/skills/role-agent-creator/reference/Memory.md](../../../../templates/skills/role-agent-creator/reference/Memory.md) 、 [templates/skills/role-agent-creator/reference/Patterns.md](../../../../templates/skills/role-agent-creator/reference/Patterns.md) 、 [templates/skills/role-agent-creator/reference/Taste.md](../../../../templates/skills/role-agent-creator/reference/Taste.md) | 解释长期上下文和风格模板的边界。 |

## 3. 三类文件不要混淆

| 文件类 | 典型路径 | 阅读重点 |
| --- | --- | --- |
| 创建说明 | `templates/skills/*/SKILL.md` | 这个 Skill 怎样要求 Agent 创建另一个 Agent 或工作目录。 |
| 初始化模板 | `assets/templates/**`、`reference/**` | 生成后的文件应该长什么样，哪些字段需要替换。 |
| 运行时证据 | Part F 中的 launcher、prompt、context loader | 模板生成的文件是否真的被读取、何时被读取、怎样进入 prompt。 |

本单元只完成前两类文件的教学。第三类文件作为边界提醒，不在 L16-L24 里重新精读。

## 4. 学习终点

读完 L16-L24 后，读者应该能从一组模板还原一个 Agent 工作目录的结构，并能说清：

1. `Agent.md` 负责身份，不负责工具授权。
2. `Tool.md` 负责允许的工具，不负责描述人格。
3. `Memory.md` 记录历史，不等于 `Knowledge.md` 的事实索引。
4. `Patterns.md` 沉淀经验模式，不是普通聊天摘要。
5. `Taste.md` 表达风格偏好，不应该承载系统架构规则。

L24 会把这些文件重新组织成一个纸面实验：给定一个新 Agent 需求，读者先选模板、填变量、标产物目录，再说明哪些结论仍需要运行时源码证明。
