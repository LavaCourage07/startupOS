# Part E：Pi Agent 基础运行时

> 共 70 节。Part E 只讲“一个 Agent 会话怎样被创建、接收消息、调用工具、流式返回、保存和恢复”。RoleAgent、ProjectAgent、认知系统会放在后续 Part，不在这里抢跑。

## 课程分段

> 每个大板块都先阅读对应的“单元导读”。导读不替代正式课；它先建立问题、词汇和学习终点，避免在源码细节中失去方向。

| 范围 | 课号 | 问题 |
| --- | --- | --- |
| 会话心智模型与公共类型 | E01-E08 | 阅读 [单元导读与复盘](00-01-session-model-and-public-types-guide.md)，理解一次 Agent 对话由哪些对象组成。已写：[E01](E01-a-trip-window-is-not-yet-a-conversation.md)、[E02](E02-the-configuration-that-starts-a-trip-agent.md)、[E03](E03-one-trip-request-is-a-turn-not-a-single-bubble.md)、[E04](E04-events-become-the-thinking-indicator.md)、[E05](E05-identities-that-must-not-be-confused.md)、[E06](E06-from-history-to-model-context.md)、[E07](E07-three-shapes-of-a-conversation.md)、[E08](E08-session-foundations-workshop.md)。 |
| 客户端、服务端与流式消息 | E09-E20 | 先读 [单元导读二](00-02-client-server-and-streaming-guide.md)。前端如何创建会话、发送消息、持续接收事件？ |
| 会话状态、持久化与恢复 | E21-E30 | 先读 [单元导读三](00-03-session-persistence-and-restoration-guide.md)。刷新或重启后，为什么还能继续这次对话？ |
| Skills | E31-E40 | 先读 [单元导读四](00-04-skills-guide.md)。Skill 从磁盘到 Prompt、再到输出目录如何流动？ |
| Tools | E41-E55 | 先读 [单元导读五](00-05-tools-guide.md)。Agent 为什么能读文件、运行命令、访问 URL，又如何受约束？ |
| 稳定性与可观测性 | E56-E63 | 先读 [单元导读六](00-06-stability-and-observability-guide.md)。如何处理重复流、异常、长会话、通知和上传？ |
| 测试与端到端验收 | E64-E70 | 先读 [单元导读七](00-07-testing-and-end-to-end-acceptance-guide.md)。怎样证明这套运行时确实可靠？ |

每一节会以独立文件写入本目录，使用 `E01-...md` 至 `E70-...md` 命名。正式文件写完后，本表会补充每节的直接链接和源码范围。
