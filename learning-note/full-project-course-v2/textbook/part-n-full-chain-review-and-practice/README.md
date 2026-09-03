# Part N：全链路复盘与实战验收

> 共 7 节。Part N 不新增源码精读，而是把 Part A~M 的碎片知识连成**可操作的能力**：能从用户入口走到最终副作用，能从故障症状反推到责任层，能安全地做一个小改动并验证闭环。

## 课程定位

**总问题**：学完 Part A~M 后，学习者如何把分散的源码知识转化为**端到端的判断能力**——能追踪一条完整调用链、能定位一次故障、能实施一次小改动并验证？

**与 Part A~M 的关系**：Part A~M 是"分而治之"，Part N 是"合而用之"。Part N 不复读新源码，而是**复用和串联**前序 Part 已精读的源码，形成跨 Part 的端到端认知地图。

**核心能力链**：

```text
看得懂现象 → 说得准概念 → 跟得上源码 → 推得出结果 → 查得到故障 → 用得了方法
```

## 课程分段

| 单元 | 课号 | 导读文件 | 单元总问题 |
|------|------|----------|-----------|
| 从用户入口到 Agent 会话 | N01-N02 | [00-01-entry-to-session-guide.md](00-01-entry-to-session-guide.md) | 用户点击首页 Skill 卡片后，系统内部发生了哪些步骤？ |
| 从会话创建到流式响应 | N03-N04 | [00-02-session-to-stream-guide.md](00-02-session-to-stream-guide.md) | `POST /api/agent/sessions` 到 SSE 事件到达 UI，中间经过哪些边界？ |
| 从故障症状到责任层定位 | N05-N06 | [00-03-symptom-to-layer-guide.md](00-03-symptom-to-layer-guide.md) | 当 Agent 不回复、回复错误、会话丢失时，如何按证据逐层定位？ |
| 全链路实战工作坊 | N07 | — | 如何安全地做一个小改动，并验证它不破坏现有链路？ |

## 主线案例

小林已经学完了 Part A~M 的所有课程。现在他要做三件事：

1. **正向追踪**：从首页点击"旅行助手"Skill，追踪请求如何经过 Web UI → API Route → Core Service → Agent Runtime → SSE Stream → UI 渲染的完整链路。
2. **反向诊断**：当旅行助手没有按预期推荐酒店时，按证据逐层排查：是入口配置错了？是会话没创建？是 Agent 没收到消息？是模型回复不符合约束？
3. **安全改动**：给旅行助手增加一个"预算上限"的输入参数，从定位源码到修改、测试、验证，完成一次最小可验证的变更闭环。

## 源码覆盖原则

Part N 的源码覆盖采用**"复用+标注"**策略：

| 策略 | 说明 |
|------|------|
| 不复读新源码 | 所有源码窗口引用前序 Part 已精读的文件，Part N 只负责串联和解释跨边界关系 |
| 明确复用关系 | 每节课标注"本课复用 Part X 的哪些源码"，不造成覆盖重复或遗漏 |
| 补充跨边界连接 | 前序 Part 之间未明确说明的调用关系，在 Part N 中补齐 |
| 源码状态台账 | 每节课末尾附"本课复用的源码覆盖状态"，标明精读/背景引用/缺口 |

## 质量标准

每节课必须达到 [03-sample-unit-writing-sop.md](../../03-sample-unit-writing-sop.md) 的硬标准：

1. **源码窗口**：不是只放链接，要逐段解释输入、状态、分支、输出
2. **调用链清楚**：能说清调用者、被调用者、数据流
3. **失败路径**：写出异常、误判或边界条件
4. **测试证据**：说明测试证明了什么、没证明什么
5. **练习可验收**：有定位、推演、微改动或复述标准
6. **单元小结**：有低负担入口、阅读路径、认知图、核心区分、源码台账、排查练习、口头验收

单元小结课（N02, N04, N06）必须包含：
- 一张总体认知图（Mermaid）
- 至少一张小黑配图
- 源码覆盖台账
- 排查地图或判断流程
- 口头验收（至少 5 个问题）

## 与 deep-dive 实战课的关系

| deep-dive 实战课 | Part N 对应处理 |
|------------------|-----------------|
| P1 新增首页入口 | 融入 N01，升级为教材标准（场景→源码→测试→验收） |
| P2 改造 Skill | 融入 N01-N03 链路中，作为验证点 |
| P3 新增 Core-backed API | 融入 N03，展示 route→core→store 单向调用 |
| P4 OpenSpec 变更闭环 | 融入 N07，作为"变更验证"的高级场景 |

**关键区别**：deep-dive 的 p1-p4 是**操作指南**风格，Part N 的 N01-N07 必须达到**教材标准**——有场景、有概念阶梯、有源码窗口、有调用链、有失败路径、有测试证据、有口头验收。

## 文件清单

```
part-n-full-chain-review-and-practice/
├── README.md                                    # 本文件：Part N 总览
├── 00-01-entry-to-session-guide.md              # 单元一导读：从用户入口到 Agent 会话
├── N01-from-home-click-to-skill-dialog.md       # 首页入口到 SkillDialog
├── N02-entry-link-review-workshop.md            # 单元一小结
├── 00-02-session-to-stream-guide.md            # 单元二导读：从会话创建到流式响应
├── N03-from-session-create-to-sse-render.md     # 会话创建到流式渲染
├── N04-stream-link-review-workshop.md           # 单元二小结
├── 00-03-symptom-to-layer-guide.md              # 单元三导读：从故障症状到责任层
├── N05-reverse-diagnosis-from-symptom.md       # 故障反向诊断
├── N06-diagnosis-review-workshop.md             # 单元三小结
├── N07-full-chain-practice-workshop.md          # 全链路实战工作坊
└── assets/                                      # 配图目录
```
