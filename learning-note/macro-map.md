# OriginOS 宏观学习地图

## 这一轮学习目标

这一轮先宏观学习一遍，不深入每个实现细节。目标是建立一张脑内地图：

- OriginOS 要解决什么问题；
- 项目由哪些大模块组成；
- 用户操作如何进入 Web、Agent、Skill、数据存储；
- 后续深度学习应该从哪些入口继续。

## 产品主线图

```mermaid
flowchart LR
    User[用户的问题] --> Interview[项目访谈]
    Interview --> Model[业务模型和本体]
    Model --> Solution[AI 解决方案]
    Solution --> Runtime[Agent 和 Skill 执行]
    Runtime --> Artifacts[文件 记忆 知识 经验]
    Artifacts --> Model
```

人话理解：

OriginOS 不是单纯聊天工具，而是把“一个真实工作问题”变成“可执行的 AI 工作流”，最后沉淀成文件、知识和经验。

## 仓库分层图

```mermaid
flowchart TB
    Root[startupOS monorepo]
    Root --> Web[packages/web<br/>Next.js 前端界面]
    Root --> Core[packages/core<br/>共享业务和 Agent 集成]
    Root --> Desktop[packages/desktop<br/>Electron 桌面壳和 IPC]
    Root --> Agent[packages/agent<br/>Pi Agent 适配运行边界]
    Root --> Tasks[packages/pi-tasks<br/>任务运行相关]
    Root --> Docs[docs<br/>产品 规格 Story 文档]
    Root --> Data[data 和包内 data<br/>本地 JSON 运行数据]
```

第一遍只需要记：

- `web` 负责用户看见和点击的界面；
- `core` 负责可复用业务逻辑；
- `desktop` 负责桌面应用壳；
- `docs` 解释为什么这样设计；
- `data` 存运行时产物。

## 12 节课路线图

```mermaid
flowchart TD
    L01[01 项目是什么] --> L02[02 仓库怎么看]
    L02 --> L03[03 怎么跑起来]
    L03 --> L04[04 Web 首页入口]
    L04 --> L05[05 桌面界面组织]
    L05 --> L06[06 Skill 入口]
    L06 --> L07[07 Agent 会话创建]
    L07 --> L08[08 消息流式返回]
    L08 --> L09[09 core 边界]
    L09 --> L10[10 项目访谈]
    L10 --> L11[11 记忆和知识存储]
    L11 --> L12[12 做一个小改动]
```

## 画图方式

宏观结构图使用 Mermaid。

当某节课需要“正文配图”帮助理解时，使用 `ian-xiaohei-illustrations` 的小黑风格，原则是：

- 16:9 横版；
- 白底手绘；
- 小黑参与核心动作；
- 少量中文标注；
- 每张图只表达一个概念。

## 后续深挖方向

宏观 12 节之后，可以按模块继续深挖：

- Agent 会话链路；
- Skill 加载和运行；
- Project Agent 访谈；
- Ontology 本体；
- Memory / Knowledge / Patterns；
- Electron 桌面主进程；
- AI solution 和多 Agent 协作。
