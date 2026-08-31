# Part A：系统全景与源码学习起点

> 共 6 节。目标不是背目录，而是建立以后能反复使用的“从用户动作追到真实源码”的阅读方法。

| 课号 | 课题 | 学完后能做什么 | 文件 |
| --- | --- | --- | --- |
| A01 | OriginOS 到底是什么系统 | 用自己的话说清产品、用户和 Agent 的关系 | `A01-originos-product-and-boundaries.md` |
| A02 | 第一次走完整条用户链路 | 从一个首页动作追到服务、Agent 与结果 | `A02-first-user-action-to-agent-result.md` |
| A03 | Monorepo 中每个包负责什么 | 区分 Web、Core、Desktop、Agent、Service 的边界 | `A03-package-roles-and-dependency-direction.md` |
| A04 | 运行形态与启动入口 | 区分浏览器、Next 服务端、Electron 主进程与共享 Core | `A04-runtime-shapes-and-entry-points.md` |
| A05 | 架构规约为什么存在 | 用真实依赖方向判断一段导入是否越界 | `A05-architecture-rules-as-reading-compass.md` |
| A06 | 如何把陌生源码读成可验证知识 | 建立问题、调用链、测试、练习、验收的学习闭环 | `A06-source-reading-and-verification-loop.md` |

完成 A06 后再进入 E 部分。你会先知道“从哪里读、为什么这样读”，而不是把 Pi Agent 当作一堆孤立文件。
