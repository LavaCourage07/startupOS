# OriginOS 72+4 深入课程大纲

本目录是逐节大纲版。每一节都有独立文件，方便逐一审阅。

完整版课件统一格式：

```text
问题 -> 图解 -> 源码入口 -> 调用链 -> 关键类型 -> 测试入口 -> 练习 -> 验收
```

当前已拆分：72 节源码课 + 4 个综合实战。


## A. 项目事实源与学习方法

- [A1. 产品主线和真实目标](lessons/a1-product-source-of-truth.md)
- [A2. 技术栈和 monorepo](lessons/a2-tech-stack-monorepo.md)
- [A3. 架构规约](lessons/a3-architecture-rules.md)
- [A4. 全仓文件分类方法](lessons/a4-file-classification-method.md)
- [A5. 从用户流程读源码](lessons/a5-read-source-from-user-flow.md)
- [A6. 从维护者视角读项目](lessons/a6-maintainer-view.md)

## B. Monorepo 与工程系统

- [B1. 根 package scripts](lessons/b1-root-package-scripts.md)
- [B2. pnpm workspace 与 hoisted 依赖](lessons/b2-pnpm-workspace-hoisted.md)
- [B3. TypeScript 配置体系](lessons/b3-typescript-configs.md)
- [B4. Tailwind 与 Web 样式入口](lessons/b4-tailwind-style-entry.md)
- [B5. 测试运行方式](lessons/b5-test-running.md)
- [B6. 构建产物和源码边界](lessons/b6-build-artifact-boundary.md)

## C. Web App Router 与 API 边界

- [C1. Next.js App Router 根入口](lessons/c1-nextjs-app-router-entry.md)
- [C2. 首页 AppCard 和配置驱动](lessons/c2-home-appcard-config.md)
- [C3. Web API route 总览](lessons/c3-web-api-routes-overview.md)
- [C4. Agent session API](lessons/c4-agent-session-api.md)
- [C5. Skills API](lessons/c5-skills-api.md)
- [C6. Project / Interview API](lessons/c6-project-interview-api.md)
- [C7. Ontology / Workspace API](lessons/c7-ontology-workspace-api.md)
- [C8. 其他 API 和调试入口](lessons/c8-other-api-debug.md)

## D. Web 桌面 UI 与状态系统

- [D1. 桌面页面和 Shell](lessons/d1-desktop-page-shell.md)
- [D2. Dock 系统](lessons/d2-dock-system.md)
- [D3. Window 系统](lessons/d3-window-system.md)
- [D4. AppWindow store](lessons/d4-appwindow-store.md)
- [D5. CUI 和 AgentDialog](lessons/d5-cui-agent-dialog.md)
- [D6. Notification / Spotlight / Settings](lessons/d6-notification-spotlight-settings.md)
- [D7. Workspace UI](lessons/d7-workspace-ui.md)
- [D8. Web hooks、services、store 总复盘](lessons/d8-web-hooks-services-store-review.md)

## E. Skill 系统

- [E1. Skill 文件格式](lessons/e1-skill-file-format.md)
- [E2. Core skill feature](lessons/e2-core-skill-feature.md)
- [E3. Pi Agent skill loader](lessons/e3-pi-agent-skill-loader.md)
- [E4. SkillDialog 执行链](lessons/e4-skilldialog-execution-chain.md)
- [E5. 项目初始化类 skills](lessons/e5-project-initialization-skills.md)
- [E6. Skill 创建器体系](lessons/e6-skill-creator-system.md)
- [E7. BMAD skills](lessons/e7-bmad-skills.md)
- [E8. 其他实用 skills](lessons/e8-other-practical-skills.md)

## F. Agent Runtime

- [F1. Agent 类型和 session model](lessons/f1-agent-types-session-model.md)
- [F2. Session service](lessons/f2-session-service.md)
- [F3. 消息流式输出](lessons/f3-message-streaming.md)
- [F4. OriginOSAgent 主体](lessons/f4-originos-agent.md)
- [F5. Agent manager](lessons/f5-agent-manager.md)
- [F6. Tool registry 和系统工具](lessons/f6-tool-registry-system-tools.md)
- [F7. 工作目录和安全边界](lessons/f7-cwd-security-boundary.md)
- [F8. RoleAgent](lessons/f8-role-agent.md)
- [F9. RoleAgent memory / dream](lessons/f9-role-agent-memory-dream.md)
- [F10. Project Agent](lessons/f10-project-agent.md)

## G. Project / Interview / Ontology / Workspace

- [G1. Project feature](lessons/g1-project-feature.md)
- [G2. Interview feature](lessons/g2-interview-feature.md)
- [G3. Project interview templates](lessons/g3-project-interview-templates.md)
- [G4. Ontology domain model](lessons/g4-ontology-domain-model.md)
- [G5. Ontology data store](lessons/g5-ontology-data-store.md)
- [G6. Ontology Web UI](lessons/g6-ontology-web-ui.md)
- [G7. Workspace 文件系统](lessons/g7-workspace-filesystem.md)
- [G8. Project 到 Agent 的完整链路](lessons/g8-project-to-agent-flow.md)

## H. Core Modules 与认知系统

- [H1. Memory Core 总览](lessons/h1-memory-core-overview.md)
- [H2. Memory Core 测试](lessons/h2-memory-core-tests.md)
- [H3. Cognitive providers](lessons/h3-cognitive-providers.md)
- [H4. Collaboration runtime engine](lessons/h4-collaboration-runtime-engine.md)
- [H5. Collaboration protocol / session / sandbox](lessons/h5-collaboration-protocol-session-sandbox.md)
- [H6. Collaboration UI 和 API](lessons/h6-collaboration-ui-api.md)
- [H7. Scheduler / neural-channel](lessons/h7-scheduler-neural-channel.md)
- [H8. View manager / reconciler / mcp-in-browser](lessons/h8-view-manager-reconciler-mcp.md)

## I. Desktop / Electron / 发布

- [I1. Electron main 入口](lessons/i1-electron-main-entry.md)
- [I2. Preload 和 IPC 协议](lessons/i2-preload-ipc-protocol.md)
- [I3. Desktop services](lessons/i3-desktop-services.md)
- [I4. Desktop lib / renderer 补充](lessons/i4-desktop-lib-renderer.md)
- [I5. 打包、发布、验证](lessons/i5-desktop-build-release-verify.md)

## J. OpenSpec / Story / 测试 / 维护者能力

- [J1. OpenSpec skills 工作流](lessons/j1-openspec-skills-workflow.md)
- [J2. OpenSpec changes 和 specs](lessons/j2-openspec-changes-specs.md)
- [J3. Story 文档体系](lessons/j3-story-doc-system.md)
- [J4. 测试体系](lessons/j4-test-system.md)
- [J5. 维护者审查方法](lessons/j5-maintainer-review-method.md)

## P. 综合实战

- [P1. 小实战：新增或调整首页入口](lessons/p1-practice-home-entry.md)
- [P2. 中实战：改造一个 Skill](lessons/p2-practice-skill-refactor.md)
- [P3. 中高实战：新增一个 core-backed API](lessons/p3-practice-core-backed-api.md)
- [P4. 完整实战：OpenSpec 变更闭环](lessons/p4-practice-openspec-lifecycle.md)

## 审阅重点

- 72 节是否覆盖了你关心的所有系统；
- 每节颗粒度是否足够细；
- 哪些模块需要拆得更细；
- 哪些课程顺序应该调整；
- 哪些地方需要更多 Xiaohei 图帮助理解。

通过后，再进入完整版课件阶段。
