# OriginOS 学习笔记

本目录用于记录从零学习 OriginOS 项目的过程。

## 学习目标

12 节课的目标不是把所有源码细节背下来，而是达到：

- 能说清 OriginOS 的产品主线和核心模块；
- 能看懂 monorepo 的目录分层；
- 能从页面入口一路追到 Agent 会话 API；
- 能理解项目、技能、Agent、记忆、知识的基本关系；
- 能自己定位一个小功能的大致代码位置；
- 能完成一个小的 UI 或配置改动，并知道怎么验证。

也就是说，12 节课可以把你从“完全不知道怎么下手”带到“能自己读项目、能做小改动、知道继续深挖哪里”。

## 课程安排

1. [项目是什么：理解 OriginOS 解决的问题和产品闭环](lesson-01.md)
2. [仓库怎么看：认识 monorepo 和主要 package 职责](lesson-02.md)
3. [怎么跑起来：理解开发、桌面、检查命令](lesson-03.md)
4. [Web 首页怎么启动：从 Next.js App Router 入口看起](lesson-04.md)
5. [桌面界面怎么组织：Desktop、Dock、Window、AppCard](lesson-05.md)
6. [Skill 是什么：首页应用入口和 SkillDialog](lesson-06.md)
7. [Agent 会话怎么开始：session 创建 API](lesson-07.md)
8. [消息怎么流式返回：message API、stream、消息渲染](lesson-08.md)
9. [core 为什么重要：业务逻辑和适配层边界](lesson-09.md)
10. [项目访谈怎么工作：Project Agent、业务模型、本体](lesson-10.md)
11. [记忆和知识怎么存：Memory、Knowledge、Patterns、data 目录](lesson-11.md)
12. [自己做一个小改动：定位、修改、验证、总结](lesson-12.md)

## 每节课笔记格式

每节课单独创建一个文件：

```text
learning-note/lesson-01.md
learning-note/lesson-02.md
...
```

每节课记录：

- 今天学什么
- 人话解释
- 看到的真实文件
- 关键代码或结构
- 我现在应该记住什么
- 还不懂的问题

## 图解规则

- 架构关系、调用链、数据流优先使用 Mermaid 图，方便直接放进 Markdown。
- 概念类比、学习正文配图、阶段总结图可以使用 `ian-xiaohei-illustrations` 风格。
- 初学阶段先画“少节点、强主线”的图，不追求一次覆盖所有细节。
- 每张图只解释一个问题：例如“项目主线”“目录分层”“消息链路”，不把所有内容塞进一张图。
