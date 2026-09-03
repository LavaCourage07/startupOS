# Part I：Next.js 页面与 API 边界

> 共 60 节。Part I 只讲 Web 包如何通过 Next.js App Router 把用户请求接入 Core：页面怎样渲染、API Route 怎样解析输入、怎样调用 Core Service、怎样把响应和流返回给浏览器。Core 内部实现放到 Part E/F/G/H，UI 组件细节放到 Part J。

## 课程分段

| 单元 | 课号 | 问题 | 导读 | 小结课 |
| --- | --- | --- | --- | --- |
| U1：App Router 与页面入口 | I01–I06 | 用户打开的桌面页面是怎么被 Next.js App Router 渲染出来的？ | [00-01 单元导读](00-01-app-router-guide.md) | [I06：App Router 单元工作坊](I06-app-router-workshop.md) |
| U2：Agent 会话 API — 创建与管理 | I07–I11 | 一次 Agent 会话如何从 HTTP 请求变成 Core 中的持久会话？ | [00-02 单元导读](00-02-agent-session-management-guide.md) | [I11：Agent 会话管理工作坊](I11-agent-session-management-workshop.md) |
| U3：Agent 消息与流式响应 | I12–I17 | 用户消息怎样进入 Agent 运行时？SSE 流为什么有两种模式？ | [00-03 单元导读](00-03-agent-messages-and-streaming-guide.md) | [I17：消息与流式响应工作坊](I17-messages-and-streaming-workshop.md) |
| U4：Project API — 项目生命周期 | I18–I25 | 项目从创建到启动、消息、停止、中止的完整生命周期 API 如何组织？ | [00-04 单元导读](00-04-project-agent-lifecycle-guide.md) | [I25：项目生命周期工作坊](I25-project-agent-lifecycle-workshop.md) |
| U5：统计与摘要 API | I26–I31 | Session 统计和摘要如何在 API 层暴露？ | [00-05 单元导读](00-05-statistics-and-summary-guide.md) | [I31：统计与摘要工作坊](I31-statistics-and-summary-workshop.md) |
| U6：Skill 与 Interview API | I32–I36 | Skill 内容加载和 Interview 页面如何在 API 层暴露？ | [00-06 单元导读](00-06-skill-and-interview-guide.md) | [I36：Skill 与 Interview 工作坊](I36-skill-and-interview-workshop.md) |
| U7：全局样式与布局 | I37–I43 | 全局样式、Tailwind CSS、响应式设计如何在 OriginOS 中工作？ | [00-07 单元导读](00-07-global-styles-and-layout-guide.md) | [I43：全局样式与布局工作坊](I43-global-styles-workshop.md) |
| U8：API 路由与中间件 | I44–I49 | API 路由、中间件、工具函数、错误处理、请求验证如何组织？ | [00-08 单元导读](00-08-api-routes-and-middleware-guide.md) | [I49：API 路由与中间件工作坊](I49-api-routes-workshop.md) |
| U9：高级 API 模式 | I50–I55 | 分页、缓存、限流等高级 API 模式如何在 OriginOS 中实现？ | [00-09 单元导读](00-09-advanced-api-patterns-guide.md) | [I55：高级 API 模式工作坊](I55-advanced-api-workshop.md) |
| U10：安全与监控 | I56–I60 | 身份验证、日志记录、监控告警如何保障 OriginOS 稳定运行？ | [00-10 单元导读](00-10-security-and-monitoring-guide.md) | [I60：安全与监控工作坊](I60-security-and-monitoring-workshop.md) |

每一节均以独立文件写入本目录，使用 `I01-...md` 至 `I60-...md` 命名。阅读单节前先用对应单元导读建立整体路径。

## 边界说明

- **Part I 讲什么**：`packages/web/src/app/` 下的页面、布局和 API Route Handler，以及它们与 Core Service 的调用边界。
- **Part I 不讲什么**：
  - Core 内部业务逻辑 → Part G
  - Agent 运行时、工具、流式事件内部 → Part E
  - RoleAgent / ProjectAgent / 认知系统 → Part F
  - Collaboration Runtime 内部实现 → Part H
  - React 组件、Zustand、窗口管理器、CSS 细节 → Part J
  - Electron 主进程 / IPC → Part K
