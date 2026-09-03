# 单元五导读与复盘：Agent、Skill 与 Sandbox 合同

本单元回答一个问题：课程助手获得会话、技能和受控执行能力时，Core 用哪些类型防止对象混用。

主线进入 `agent.ts`、`agent-host.ts`、`agent-object.ts`、`skill.ts` 和 `sandbox.ts`。读者需要学会区分产品 Agent、Agent Host 最小执行对象、Hook 返回合同、Skill 元数据和 Sandbox 执行报告。

## 正式课

| 课次 | 作用 |
| --- | --- |
| D19 | 合并讲解三种 Agent 类型的身份、状态和展示边界。 |
| D20 | 合并讲解会话消息、Thinking、tool call 和统计信息。 |
| D21 | 合并讲解 Skill 加载、路由、工具和执行结果合同。 |
| D22 | 合并讲解 Sandbox 场景、步骤、缺口、报告和 store state。 |
| D23 | 为课程助手推演一次技能调用，完成本单元小结。 |

## 小结课验收

读者必须能给出一次技能调用的对象流，并说明 Agent 对象、Skill 对象、tool call 过程对象和 Sandbox 结果对象分别停在哪个边界。
