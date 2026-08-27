# 01 深度课程设计

这一版按“非常详细、尽量吃透整个项目”的标准重新设计。

结论先说：**24 节只能掌握主线，不能吃透项目。深入版改为 72 节源码课 + 4 个综合实战。**

每节正式课程都必须使用同一格式：

```text
问题 -> 图解 -> 源码入口 -> 调用链 -> 关键类型 -> 测试入口 -> 练习 -> 验收
```

## 为什么不是 24 节

当前项目排除依赖和构建产物后，仍有两千多个可学习文件。核心重量集中在：

- `packages/core/src`：共享业务、Agent 集成、模块、存储、类型；
- `packages/web/src`：App Router、桌面 UI、组件、store、services、API routes；
- `templates/skills`：内置 skills、BMAD skills、脚本和参考资料；
- `docs/specs`：Epic / Story / requirements / architecture / testing；
- `openspec`：变更提案、delta specs、归档流程；
- `packages/desktop`：Electron main、preload、IPC、打包和本地服务；
- `tests` 和 `packages/**/__tests__`：单元、集成、E2E 验证体系。

所以深入学习必须分三种读法：

- **精读**：核心入口、关键服务、关键类型、调用链、测试；
- **通读**：同一模块的辅助组件、配置、脚本、文档；
- **索引阅读**：历史 specs、运行数据、示例、归档材料，知道在哪里、什么时候查。

## 课程总结构

| 阶段 | 课数 | 目标 |
| --- | ---: | --- |
| A. 项目事实源与学习方法 | 6 | 建立产品目标、文件地图、规约、读源码方法 |
| B. Monorepo 与工程系统 | 6 | 掌握 package 边界、TypeScript、构建、lint、测试脚本 |
| C. Web App Router 与 API 边界 | 8 | 从页面入口追到 API routes 和 core |
| D. Web 桌面 UI 与状态系统 | 8 | 掌握桌面、Dock、Window、CUI、store、services |
| E. Skill 系统 | 8 | 掌握 Skill 定义、加载、执行、产物目录和内置 skills |
| F. Agent Runtime | 10 | 掌握 session、流式消息、tools、RoleAgent、Project Agent |
| G. Project / Interview / Ontology / Workspace | 8 | 掌握项目、访谈、本体、文件工作区 |
| H. Core Modules 与认知系统 | 8 | 掌握 memory-core、collaboration-runtime、scheduler、view modules |
| I. Desktop / Electron / 发布 | 5 | 掌握 main、preload、IPC、本地服务、打包发布 |
| J. OpenSpec / Story / 测试 / 维护者能力 | 5 | 掌握变更治理、测试闭环、维护和评审 |
| 综合实战 | 4 | 从小改动到跨 Web/Core/OpenSpec 的完整闭环 |

合计：**72 节源码课 + 4 个综合实战。**

## 阶段 A：项目事实源与学习方法

### A1. 产品主线和真实目标

精读：`README.md`、`README_CN.md`、`docs/product/`、`AGENTS.md`

目标：理解 OriginOS 不是普通聊天工具，而是 Project -> Agent -> Skill -> Artifacts -> Knowledge 的工作闭环。

### A2. 技术栈和 monorepo

精读：`package.json`、`pnpm-workspace.yaml`、`packages/*/package.json`、`tsconfig*.json`

目标：理解 Web、Core、Desktop、Agent adapter、pi-tasks、service 的 package 边界。

### A3. 架构规约

精读：`AGENTS.md`、`LINT.md`、`eslint-rules/agents-compliance.js`、`scripts/check-agents-compliance.js`

目标：掌握目录边界、单向依赖、MVP 数据存储、Story 测试闭环。

### A4. 全仓文件分类方法

精读：`00-reading-inventory.md`、`02-system-source-map.md`

目标：区分源码、文档、测试、运行数据、脚本、技能资产、归档材料和构建产物。

### A5. 从用户流程读源码

精读：`README_CN.md` 的产品流程、`packages/web/src/app/page.tsx` 的入口、关键 API 目录

目标：学会从“用户点击”反向拆成 UI、状态、API、core、storage。

### A6. 从维护者视角读项目

精读：`docs/DOCUMENTATION-MANAGEMENT.md`、`docs/index.md`、`docs/changes/`

目标：理解为什么这个项目同时有源码、Story、OpenSpec、变更记录和测试证据。

## 阶段 B：Monorepo 与工程系统

### B1. 根 package scripts

精读：根 `package.json`

目标：读懂 `dev`、`build`、`desktop:*`、`lint`、`test`、`docs:*`、`agents:check` 的转发关系。

### B2. pnpm workspace 与 hoisted 依赖

精读：`pnpm-workspace.yaml`、`pnpm-lock.yaml` 的 workspace 关系

目标：理解 Electron + monorepo 为什么要关注依赖解析和 native 包。

### B3. TypeScript 配置体系

精读：`tsconfig.json`、`tsconfig.base.json`、`tsconfig.electron.json`、各 package tsconfig

目标：理解 path alias、strict、module resolution、Electron 编译边界。

### B4. Tailwind 与 Web 样式入口

精读：`tailwind.config.ts`、`packages/web/src/styles/`、`packages/web/src/app/layout.tsx`

目标：理解全局样式、Tailwind 约束、图标和 shadcn/ui 组件样式。

### B5. 测试运行方式

精读：`vitest.config.ts`、`tests/setup.ts`、各 package `vitest.config.ts`

目标：区分根测试、Web 测试、Core 测试、Desktop 测试、E2E。

### B6. 构建产物和源码边界

精读：`.gitignore`、`packages/desktop/scripts/verify-*`、构建说明文档

目标：知道哪些目录不能当源码入口，如何验证打包产物。

## 阶段 C：Web App Router 与 API 边界

### C1. Next.js App Router 根入口

精读：`packages/web/src/app/layout.tsx`、`packages/web/src/app/page.tsx`

目标：理解 layout、client page、全局 Spotlight、桌面首页。

### C2. 首页 AppCard 和配置驱动

精读：`packages/web/src/config/homeApps.ts`、`packages/web/src/config/system-apps.ts`、`packages/web/src/components/framework/`

目标：理解首页入口如何由配置驱动，区分 `skill` 和 `action`。

### C3. Web API route 总览

通读：`packages/web/src/app/api/*`

目标：建立 API route 地图，知道 agent、skills、projects、ontology、workspace、collaboration 等入口。

### C4. Agent session API

精读：`packages/web/src/app/api/agent/sessions/route.ts`、`packages/web/src/app/api/agent/sessions/[sessionId]/messages/route.ts`

目标：理解会话创建、消息发送、SSE、错误处理和持久化边界。

### C5. Skills API

精读：`packages/web/src/app/api/skills/`、`packages/web/src/app/api/skill-sessions/`、`packages/web/src/app/api/user-skills/`

目标：理解 Skill 内容加载、会话初始化、用户 skills 管理。

### C6. Project / Interview API

精读：`packages/web/src/app/api/projects/`、`packages/web/src/app/api/project/`、`packages/web/src/app/api/interviews/`

目标：理解项目创建、访谈状态、项目上下文如何进入 core。

### C7. Ontology / Workspace API

精读：`packages/web/src/app/api/ontology/`、`packages/web/src/app/api/ontology-data/`、`packages/web/src/app/api/workspace/`、`packages/web/src/app/api/files/`

目标：理解本体数据和文件工作区的 Web 边界。

### C8. 其他 API 和调试入口

通读：`notifications`、`schedules`、`sandbox`、`taste`、`user-config`、`debug`、`launch`

目标：知道辅助 API 的职责，能判断它们是否应该下沉 core。

## 阶段 D：Web 桌面 UI 与状态系统

### D1. 桌面页面和 Shell

精读：`packages/web/src/app/desktop/`、`packages/web/src/components/os/Desktop*`

目标：理解桌面 UI 如何组织第一屏体验。

### D2. Dock 系统

精读：`packages/web/src/components/os/dock/`

目标：理解 Dock action、应用入口、状态反馈。

### D3. Window 系统

精读：`packages/web/src/components/os/window/`、`packages/web/src/services/AppWindowManager`

目标：理解窗口打开、关闭、最小化、最大化、zIndex、尺寸位置。

### D4. AppWindow store

精读：`packages/web/src/store/appWindowStore.ts`、相关测试

目标：理解 Zustand 状态如何管理窗口生命周期。

### D5. CUI 和 AgentDialog

精读：`packages/web/src/components/os/cui/`、`packages/web/src/components/os/agent-dialog/`

目标：理解会话 UI、消息输入、流式渲染、状态展示。

### D6. Notification / Spotlight / Settings

精读：`packages/web/src/components/os/notification/`、`spotlight/`、`settings/`

目标：理解全局系统级 UI 组件和事件入口。

### D7. Workspace UI

精读：`packages/web/src/components/os/workspace/`、`packages/web/src/components/os/data-editor/`

目标：理解文件树、编辑器、数据编辑和本地文件交互。

### D8. Web hooks、services、store 总复盘

精读：`packages/web/src/hooks/`、`packages/web/src/services/`、`packages/web/src/store/`

目标：掌握 Web 侧状态、适配服务和组件之间的依赖方向。

## 阶段 E：Skill 系统

### E1. Skill 文件格式

精读：`templates/skills/*/SKILL.md`

目标：理解 frontmatter、正文指令、参考文件、脚本、资产目录。

### E2. Core skill feature

精读：`packages/core/src/lib/features/skills/`

目标：理解 skills 的扫描、解析、注册、读取、测试。

### E3. Pi Agent skill loader

精读：`packages/core/src/lib/integrations/pi-agent/core/skills.ts`

目标：理解 bundled / project / user 多源加载和 prompt 注入。

### E4. SkillDialog 执行链

精读：`packages/web/src/components/skills/SkillDialog.tsx`

目标：从首页 skill 入口追到内容加载、session 初始化和消息流。

### E5. 项目初始化类 skills

精读：`project-initialization`、`domain-discovery`、`business-refinement`、`model-review`

目标：理解项目访谈和业务模型生成的技能链。

### E6. Skill 创建器体系

精读：`project-skill-creator`、`skill-creator-app`、`search-and-install-skill`

目标：理解如何创建、安装、评估和管理 skills。

### E7. BMAD skills

精读：`bmad-*`

目标：理解 BMAD agent builder、workflow builder、module builder、distillator、review skills。

### E8. 其他实用 skills

通读：`agent-creator`、`role-agent-creator`、`task-manager`、`solution-design`、`wrong-answer-review` 等

目标：建立内置 skills 索引，知道什么时候查哪个。

## 阶段 F：Agent Runtime

### F1. Agent 类型和 session model

精读：`packages/core/src/types/agent.ts`、`packages/core/src/lib/features/agent/`

目标：理解 AgentSession、消息、projectContext、session persistence。

### F2. Session service

精读：`packages/core/src/lib/features/agent/session-service.ts`

目标：理解会话创建、读取、更新、存储格式和错误处理。

### F3. 消息流式输出

精读：message API、`stream-dedupe.ts`、`stream-render-scheduler.ts`、client hooks

目标：理解 SSE、delta、状态事件、最终消息保存。

### F4. OriginOSAgent 主体

精读：`packages/core/src/lib/integrations/pi-agent/core/agent.ts`

目标：理解对上游 Pi Agent 的包装、生命周期和执行入口。

### F5. Agent manager

精读：`packages/core/src/lib/integrations/pi-agent/agent-manager.ts`

目标：理解 Agent 实例管理、scope、工具过滤。

### F6. Tool registry 和系统工具

精读：`packages/core/src/lib/integrations/pi-agent/tools/`

目标：理解 bash、file、skill、ontology、url 等工具如何注册和执行。

### F7. 工作目录和安全边界

精读：`bash-tools.ts`、file tools、AGENTS 数据目录规约

目标：理解 `agentBaseDir`、project path、workingDirectory 的优先级。

### F8. RoleAgent

精读：`role-agent/role-context.ts`、`state-machine.ts`、`skill-resolver.ts`、`system-prompt.ts`

目标：理解角色上下文、状态机、技能扫描和 7 层 prompt。

### F9. RoleAgent memory / dream

精读：`memory-tracker.ts`、`dream.ts`、`consolidator.ts`

目标：理解 Memory.md、history.jsonl、周期整理和自动记忆维护。

### F10. Project Agent

精读：`project-agent/project-context.ts`、`project-prompt.ts`

目标：理解项目 Agent 的上下文加载、Frozen Snapshot 和项目工作目录。

## 阶段 G：Project / Interview / Ontology / Workspace

### G1. Project feature

精读：`packages/core/src/lib/features/project/`

目标：理解项目元数据、项目目录、创建和读取。

### G2. Interview feature

精读：`packages/core/src/lib/features/interview/`、`packages/web/src/components/interview/`

目标：理解访谈问题、答案、状态机和初始业务模型。

### G3. Project interview templates

精读：`templates/project-interview/`

目标：理解项目初始化模板如何成为 Agent 上下文。

### G4. Ontology domain model

精读：`packages/core/src/lib/features/ontology/`

目标：理解 Domain、Concept、Instance、Relation 和规则推荐。

### G5. Ontology data store

精读：`packages/core/src/lib/features/ontology-data-store/`、相关测试

目标：理解 JSON 存储、版本、查询、更新和错误路径。

### G6. Ontology Web UI

精读：`packages/web/src/components/os/ontology-preview/`、ontology API

目标：理解本体可视化、节点交互和数据加载。

### G7. Workspace 文件系统

精读：workspace API、workspace UI、desktop workspace service

目标：理解文件列表、Markdown 编辑、本地文件桥接和权限边界。

### G8. Project 到 Agent 的完整链路

串读：Project 创建 -> Interview -> Business model -> Agent session -> Workspace artifact

目标：把 G 阶段所有模块串成一条可解释调用链。

## 阶段 H：Core Modules 与认知系统

### H1. Memory Core 总览

精读：`packages/core/src/modules/memory-core/`、`docs/design/memory-core.md`

目标：理解 recall、archival、block、session provider、consolidator。

### H2. Memory Core 测试

精读：`packages/core/src/modules/memory-core/__tests__/`

目标：用测试反推 memory-core 的真实行为和边界。

### H3. Cognitive providers

精读：`packages/core/src/lib/integrations/pi-agent/cognitive/`

目标：理解 practice log、knowledge provider、pattern provider、周期分析。

### H4. Collaboration runtime engine

精读：`packages/core/src/modules/collaboration-runtime/engine/`、`facade/`

目标：理解多 Agent DAG、supervisor、执行引擎。

### H5. Collaboration protocol / session / sandbox

精读：`protocol/`、`session/`、`sandbox/`

目标：理解协议、会话状态、隔离执行和错误路径。

### H6. Collaboration UI 和 API

精读：`packages/web/src/app/api/collaboration/`、`packages/web/src/components/solution/`

目标：理解多 Agent 执行如何展示到 Web UI。

### H7. Scheduler / neural-channel

精读：`packages/core/src/modules/scheduler/`、`neural-channel/`

目标：理解调度、通道、消息通信的模块边界。

### H8. View manager / reconciler / mcp-in-browser

精读：`view-manager`、`view-reconciler`、`mcp-in-browser`

目标：理解视图管理、iframe/micro-app/qiankun 适配和浏览器 MCP 能力。

## 阶段 I：Desktop / Electron / 发布

### I1. Electron main 入口

精读：`packages/desktop/src/main/main.ts`

目标：理解桌面应用启动、窗口创建、生命周期。

### I2. Preload 和 IPC 协议

精读：`preload.ts`、`ipc-protocol.ts`

目标：理解 renderer 与 main 的安全通信边界。

### I3. Desktop services

精读：`packages/desktop/src/main/services/`

目标：理解 agent-session、project、ontology、skill、workspace 等本地服务。

### I4. Desktop lib / renderer 补充

通读：`packages/desktop/src/lib/`、`packages/desktop/src/renderer/`

目标：理解桌面侧适配如何补充 Web 和 Core。

### I5. 打包、发布、验证

精读：`packages/desktop/scripts/`、`electron-builder.yml`、`.github/workflows/`

目标：理解构建产物、签名、发布、更新元数据和验证脚本。

## 阶段 J：OpenSpec / Story / 测试 / 维护者能力

### J1. OpenSpec skills 工作流

精读：`.codex/skills/openspec-*`、`openspec/config.yaml`

目标：理解 explore、propose、apply、sync、archive 的职责区别。

### J2. OpenSpec changes 和 specs

精读：`openspec/changes/`、`openspec/specs/`

目标：理解 proposal、design、tasks、delta spec、archive。

### J3. Story 文档体系

精读：`docs/specs/`、`docs/templates/story-spec-template/`

目标：理解 README、requirements、interaction、architecture、implementation、testing 的分工。

### J4. 测试体系

精读：`tests/`、`packages/**/__tests__`、`docs/test-cases/`

目标：能根据改动范围选择单元、集成、E2E 或人工验收。

### J5. 维护者审查方法

精读：`AGENTS.md`、lint rules、典型 archived changes、测试报告

目标：能审查依赖方向、文件位置、测试覆盖、数据格式和发布风险。

## 综合实战

### P1. 小实战：新增或调整首页入口

范围：`homeApps.ts`、AppCard、相关 UI 测试。

验收：能解释配置如何渲染为 UI，能跑对应 Web 验证。

### P2. 中实战：改造一个 Skill

范围：一个 `templates/skills/*`、Skill loader、SkillDialog 或输出目录。

验收：能解释 Skill 定义、加载、prompt 注入和产物路径。

### P3. 中高实战：新增一个 core-backed API

范围：Web API route、core feature/service、storage、测试。

验收：业务逻辑不写在 route，测试覆盖成功路径和失败路径。

### P4. 完整实战：OpenSpec 变更闭环

范围：proposal、design、tasks、delta spec、代码、测试、sync/archive。

验收：能像维护者一样留下可审查证据。

## 学完算什么程度

学完 72 节和 4 个实战，目标不是“背下每个文件每一行”，而是达到下面标准：

- 给任意文件路径，能判断它属于哪一层、职责是什么、是否应该精读；
- 给任意用户流程，能画出 UI -> API -> core -> storage 或 Agent 的调用链；
- 给任意小需求，能判断改哪些文件、跑哪些测试、是否需要 OpenSpec；
- 能解释核心模块：Web 桌面、Skill、Agent runtime、Project、Ontology、Memory、Collaboration、Electron；
- 能做至少一个跨 Web/Core 的真实改动，并能提交测试或验收证据。

这才接近“吃透项目”的学习标准。
