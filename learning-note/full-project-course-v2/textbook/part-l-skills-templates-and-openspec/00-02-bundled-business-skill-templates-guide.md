# 单元导读二：内置业务 Skill 模板

第一单元只建立了 Skill 文件的基本边界。第二单元进入业务型 Skill：这些 Skill 不只是写一段说明，还会带 references、脚本、handler、evals 或文件处理逻辑。读者要学会区分三件事：说明文件怎样约束任务，脚本怎样处理输入输出，handler 什么时候才是真正的执行入口。

本单元的主线仍然是小林的毕业旅行策划。假设团队想给她补一个“行程任务管理”或“项目初始化访谈”能力，不能只写一句提示词就结束。一个正式 Skill 至少要说明任务目标、可用材料、输入形态、输出形态、失败边界和验证方式；如果有脚本或 handler，还要能说清它们怎样读文件、写文件、返回结果。

## 1. 本单元要解决的问题

| 问题 | 对应课程 |
| --- | --- |
| 业务 Skill 的 `SKILL.md` 怎样限定任务，而不是泛泛描述能力？ | L08 |
| TypeScript handler 与说明文件是什么关系？ | L09 |
| 项目初始化 Skill 怎样把访谈材料和脚本放在同一能力里？ | L10-L11 |
| 一个 Skill 引用协作类型材料时，怎样避免抢跑 Collaboration runtime？ | L12 |
| evals 配置怎样进入练习生成脚本？ | L13 |
| 文件处理型 Skill 的副作用怎样讲清楚？ | L14 |
| 怎样验收一个业务 Skill 是否被真正读懂？ | L15 |

## 2. 本单元源码覆盖

| 文件组 | 本单元责任 |
| --- | --- |
| [templates/skills/info-query/SKILL.md](../../../../templates/skills/info-query/SKILL.md) 、 [templates/skills/info-query/Memory.md](../../../../templates/skills/info-query/Memory.md) 、 [templates/skills/info-query/handler.ts](../../../../templates/skills/info-query/handler.ts) | 对照说明、记忆和 handler 的分工。 |
| [templates/skills/task-manager/SKILL.md](../../../../templates/skills/task-manager/SKILL.md) 、 [templates/skills/task-manager/handler.ts](../../../../templates/skills/task-manager/handler.ts) | 解释任务管理 Skill 的说明和执行入口边界。 |
| [templates/skills/project-initialization/SKILL.md](../../../../templates/skills/project-initialization/SKILL.md) 、 [templates/skills/project-initialization/references/agent-prompts.md](../../../../templates/skills/project-initialization/references/agent-prompts.md) 、 [templates/skills/project-initialization/references/examples.md](../../../../templates/skills/project-initialization/references/examples.md) | 解释项目初始化 Skill 的任务说明和参考材料。 |
| [templates/skills/project-initialization/scripts/interview.py](../../../../templates/skills/project-initialization/scripts/interview.py) | 精读访谈脚本的输入、输出、状态推进和失败处理。 |
| [templates/skills/solution-design/SKILL.md](../../../../templates/skills/solution-design/SKILL.md) 、 [templates/skills/solution-design/references/collaboration-types.md](../../../../templates/skills/solution-design/references/collaboration-types.md) | 解释引用材料怎样服务方案设计，但不替代协作运行时教学。 |
| [templates/skills/wrong-answer-review/SKILL.md](../../../../templates/skills/wrong-answer-review/SKILL.md) 、 [templates/skills/wrong-answer-review/evals/evals.json](../../../../templates/skills/wrong-answer-review/evals/evals.json) 、 [templates/skills/wrong-answer-review/scripts/generate_practice_test.py](../../../../templates/skills/wrong-answer-review/scripts/generate_practice_test.py) | 解释 evals 到练习生成脚本的转换关系。 |
| [templates/skills/seal-stamper/SKILL.md](../../../../templates/skills/seal-stamper/SKILL.md) 、 [templates/skills/seal-stamper/scripts/remove_bg.py](../../../../templates/skills/seal-stamper/scripts/remove_bg.py) 、 [templates/skills/seal-stamper/scripts/stamp_docx.py](../../../../templates/skills/seal-stamper/scripts/stamp_docx.py) | 解释文件处理型 Skill 的输入文件、输出文件和副作用。 |

## 3. 读源码时的顺序

先读 `SKILL.md`，看它承诺什么。再读 references，判断这些材料只是背景、约束还是输入样例。最后读脚本或 handler，检查它是否真的接收了前面描述的输入，并产生了可观察输出。

```mermaid
flowchart LR
    A[SKILL.md 任务说明] --> B[references 约束材料]
    B --> C[脚本或 handler]
    C --> D[输出文件或返回结果]
    D --> E[测试证据或人工检查]
```

这张图回答的是阅读顺序问题。箭头不是说所有 Skill 都必须有 references 或脚本，而是提醒读者：每出现一层材料，都要检查它和前一层的合同是否一致。

## 4. 学习终点

读完 L08-L15 后，读者应该能解释：

1. 为什么只有 `SKILL.md` 的 Skill 仍然可能是完整能力，但它的验证方式和带脚本的 Skill 不一样。
2. 为什么 handler 存在不等于首页 Skill 会话一定调用 handler。
3. 为什么脚本的文件副作用必须讲输入路径、输出路径和失败路径。
4. 为什么引用材料只能支持当前任务，不能替代被引用模块的源码精读。
5. 为什么测试缺口也要进入教材，而不能用“脚本看起来能跑”替代验证。
