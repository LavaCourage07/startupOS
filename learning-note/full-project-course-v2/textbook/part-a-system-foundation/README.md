# Part A：学习起点与全景

> 共 6 节。目标不是背目录，而是建立以后能反复使用的「从用户动作追到真实源码」的阅读方法。

| 课号 | 课题 | 学完后能做什么 | 文件 |
| --- | --- | --- | --- |
| A01 | OriginOS 不是「聊天页面加 API」 | 用自己的话说清产品、用户、Agent、模型和四个系统角色的关系 | `A01-originos-product-and-boundaries.md` |
| A02 | 从一次点击看系统角色的接力 | 画出一次技能点击在 Web / Core / Runtime / Storage / Desktop 之间的高层接力 | `A02-from-user-action-to-system-roles.md` |
| A03 | 代码为什么分布在不同包中 | 用 Monorepo 层级与 `workspace:*` 解释 web / core / desktop / agent 的分工 | `A03-package-roles-and-dependency-direction.md` |
| A04 | 同一项目的两种运行形态 | 区分浏览器、Next.js、Electron 主进程与共享 Core 的权限 | `A04-runtime-shapes-and-entry-points.md` |
| A05 | 用架构规约判断一段代码的位置 | 用 `AGENTS.md` 的目录规则与依赖层级判断任意 import 是否越界 | `A05-architecture-rules-as-reading-compass.md` |
| A06 | 把源码阅读变成可验证的知识 | 建立「问题 → 入口 → 调用链 → 类型 → 测试 → 练习 → 复盘」的闭环 | `A06-source-reading-and-verification-loop.md` |

完成 A06 后再进入 Part B。你会先知道「从哪里读、为什么这样读」，而不是把 Pi Agent 当作一堆孤立文件。
