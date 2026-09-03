# OriginOS 学习课程安排

> 本表根据 `01-course-outline.md`、`02-all-tracked-files-map.md`、`originOS学习拆解.md` 以及 Part A–E 的 textbook 整理。目标是把每个 Part 的源码覆盖范围与全项目 2257 个 Git 已跟踪文件对应起来，并检查是否遗漏。

## 课程总表

| 阶段 | 节数 | 讲什么 | 为什么先后这样安排 |
|------|------|--------|--------------------|
| A. 学习起点与全景 | 6 | 项目是什么、如何运行、目录地图、依赖方向 | 先建立地图，避免一开始钻进代码迷路 |
| B. 从用户操作看完整链路 | 12 | 首页点技能到 Agent 回复、窗口、文件与会话 | 先知道系统“在做什么” |
| C. 仓库、构建与边界 | 18 | Monorepo、pnpm、配置、Next/Electron/Core 边界 | 知道代码为何分在这些包里 |
| D. Core 基础设施 | 20 | 类型、共享工具、存储、导出边界、测试基础 | 后续所有业务代码的地基 |
| E. Pi Agent 基础运行时 | 70 | 会话、流式消息、工具、Skill、持久化、Hook | Agent 是项目核心，必须完整拆开 |
| F. RoleAgent、ProjectAgent 与认知系统 | 80 | Prompt 七层、状态机、记忆、Dream、知识、模式、项目上下文 | 解释 Agent 如何长期工作和进化 |
| G. Core 业务功能 | 72 ✅ | 项目、文件、本体、访谈、Taste、系统功能 | 理解产品能力如何落在 Core |
| H. 协作与其他 Core Modules | 45 | Collaboration Runtime、Memory Core、Scheduler、View 等 | 学会跨模块协调与事件流 |
| I. Next.js 页面与 API 边界 | 60 | App Router、Route Handler、请求解析、响应映射 | 理解 Web 如何接入 Core |
| J. Web 交互、状态与窗体 | 55 | React 组件、Zustand、服务适配、窗口管理 | 理解用户看到和操作的界面 |
| K. Electron、Agent 与 Service 包 | 30 | 主进程、IPC、Preload、桌面服务、包间边界 | 补齐 Web 以外的运行环境 |
| L. Skills、模板与 OpenSpec | 50 | Codex Skills、内置 Skill、模板变量、OpenSpec 提案到归档 | 学会项目的扩展和开发工作流 |
| M. 数据、文档、资源与测试证据 | 35 | 运行数据、设计规格、Story、QA、静态资源、脚本 | 不把非源码文件遗漏或误读 |
| N. 全链路复盘与实战验收 | 7 | 端到端调用链、故障定位、改一个功能、读测试验证 | 把碎片知识连成可操作能力 |

## 每个 Part 对应的源码文件清单

> 划分规则：以 `02-all-tracked-files-map.md` 中的 2257 个 Git 已跟踪文件为全集，按课程轨道（T00–T99）与文件路径/类型，将每个文件唯一归入一个 Part。Part B 是端到端串联视图，其关键文件同时归属于 I/J/E/K 等 Part，因此不重复计入总数。

### Part A：学习起点与全景（11 个文件）

建立产品和架构坐标，先读规约与入口配置。

- 根文档：`README.md`、`README_CN.md`、`AGENTS.md`、`CLAUDE.md`、`CODE_OF_CONDUCT.md`、`CONTRIBUTING.md`、`LINT.md`
- 根运行入口与样式配置：`package.json`、`postcss.config.mjs`、`tailwind.config.ts`、`vitest.config.ts`

### Part B：从用户操作看完整链路（跨 Part 关键文件）

Part B 不独占轨道，它从各 Part 中抽取同一次用户操作链的关键文件，用于端到端串联。以下文件同时属于其原始 Part：

- Web 首页入口：`packages/web/src/config/homeApps.ts`、`packages/web/src/components/framework/AppCard.tsx`、`packages/web/src/app/page.tsx`
- 窗口生命周期：`packages/web/src/services/AppWindowManager.ts`、`packages/web/src/store/appWindowStore.ts`、`packages/web/src/app/window/page.tsx`
- Skill 会话准备：`packages/web/src/components/skills/SkillDialog.tsx`
- 会话创建 API：`packages/web/src/app/api/agent/sessions/route.ts`、`packages/web/src/app/api/skill-sessions/route.ts`
- 消息与流式响应：`packages/web/src/app/api/agent/sessions/[sessionId]/messages/route.ts`
- Desktop 侧会话服务：`packages/desktop/src/main/services/agent-session-service.ts`
- Core 会话服务：`packages/core/src/lib/features/agent/session-service.ts`

### Part C：仓库、构建与边界（85 个文件）

研究为什么同一份源码需要经过不同工程边界。

- 根工程配置：`.eslintrc.json`、`.gitignore`、`.prettierignore`、`.prettierrc.json`、`electron-builder.yml`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`tsconfig.base.json`、`tsconfig.electron.json`、`tsconfig.json`、`turbo.json`、`LICENSE`
- 自动化与质量门：`.husky/pre-commit`、`eslint-rules/agents-compliance.js`
- Core 包边界：`packages/core/package.json`、`packages/core/tsconfig.json`、`packages/core/tsconfig.tsbuildinfo`、`packages/core/vitest.config.ts`、`packages/core/src/ambient.d.ts`、`packages/core/src/index.ts`
- Core 集成层边界（Electron / agent-host）：`packages/core/src/lib/integrations/**`（含 `agent-host/`、`electron/`、`electron/services/`、`electron/__tests__/`）
- Web 包边界：`packages/web/package.json`、`packages/web/tsconfig.json`、`packages/web/next-env.d.ts`、`packages/web/next.config.mjs`、`packages/web/postcss.config.mjs`、`packages/web/tailwind.config.ts`、`packages/web/vitest.config.ts`、`packages/web/public/.gitkeep`
- Desktop 包边界与构建脚本：`packages/desktop/package.json`、`packages/desktop/tsconfig.json`、`packages/desktop/electron-builder.yml`、`packages/desktop/vitest.config.ts`、`packages/desktop/scripts/**`（30 个发布/验证脚本）

### Part D：Core 基础设施（35 个文件）

围绕“用户创建项目，项目被保存，关闭应用后重新恢复”这条主线。

- 路径与数据根目录：`packages/core/src/lib/paths.ts`、`packages/core/src/lib/utils.ts`
- React Hooks（公共）：`packages/core/src/lib/hooks/use-projects.ts`、`packages/core/src/lib/hooks/use-workspace.ts`、`packages/core/src/lib/hooks/use-file-upload.ts` 及对应测试
- 共享类型与模型：`packages/core/src/lib/shared/**`、`packages/core/src/lib/shared/agent/**`、`packages/core/src/lib/shared/cognitive/**`、`packages/core/src/lib/shared/model/**`
- 存储层：`packages/core/src/lib/storage/index.ts`、`packages/core/src/lib/storage/json-store.ts`
- 全局类型：`packages/core/src/types/**`（`agent.ts`、`api.ts`、`app-window.ts`、`index.ts`、`interview.ts`、`ontology.ts`、`os.ts`、`project.ts`、`skill.ts`、`solution.ts`、`taste.ts`、`workspace.ts` 等）

### Part E：Pi Agent 基础运行时（154 个文件）

一个 Agent 会话怎样被创建、接收消息、调用工具、流式返回、保存和恢复。

- Pi Agent 核心：`packages/core/src/lib/integrations/pi-agent/**`
  - `core/agent.ts`、`core/skills.ts`
  - `hooks/usePiAgent.ts`
  - `tools/`（bash、file、skill、ontology、url 等工具集）
  - `agent-manager.ts`、`session-store.ts`
  - `__tests__/` 下的 55 个测试文件
- 5 份内置 Skill 文档：`packages/core/src/lib/integrations/pi-agent/__tests__/README.md` 等

### Part F：RoleAgent、ProjectAgent 与认知系统（57 个文件）

Prompt 七层、状态机、记忆、Dream、知识、模式、项目上下文。

- Agent 定义与注册：`packages/core/src/lib/features/agent/**`（`defaults.ts`、`index.ts`、`project-agent.ts`、`registry.ts`、`session-service.ts`、`prompts/agent-system-prompts.ts`、`prompts/project-interview.ts`、`definitions/project-agent.md`）
- Skill 与启动器：`packages/core/src/lib/features/skills/**`、`packages/core/src/lib/features/services/launcher/**`（`agent.ts`、`base.ts`、`index.ts`、`project.ts`、`registry.ts`、`role-agent.ts`、`skill.ts`）
- 认知共享类型：`packages/core/src/lib/shared/cognitive/**`、`packages/core/src/lib/shared/agent/**`
- Memory Core 中的认知相关部分

**Part F 边界备注：**
- `modules/memory-core/` 在 Part F 中只覆盖 cognitive 系统直接调用的桥接文件（`adapter.ts`、`archival/archival-memory.ts`、`archival/pattern-ingest.ts`、`session/memory-provider.ts`、`session/enhanced-pattern-provider.ts`、`tools/core-memory-tools.ts`、`tools/archival-memory-tools.ts`），底层实现（`embedding.ts`、`hnsw-index.ts`、`wordpiece-tokenizer.ts`、`core/consolidator.ts`、`core/dream-compat.ts` 等）归入 **Part H**。
- `features/skills/bundled/*` 的内置 Skill handlers 归入 **Part G**，Part F 只覆盖 Skill 框架层（`service.ts`、`executor.ts`、`decision.ts`、`registry.ts`、`project-initialization/*`）。
- 测试策略：`features/agent/*`、`features/skills` 部分文件、`persistent-agent*`、`launcher` 多数文件当前无直接单元测试。教材采用“关键路径同步补最小集成测试 + 其余缺口明确标注运行验证”的策略。

### Part G：Core 业务功能（95 个文件）

项目、文件、本体、访谈、Taste、系统功能等业务能力如何落在 Core。

- 动画：`packages/core/src/lib/features/animations/**`
- API 客户端：`packages/core/src/lib/features/api-clients/**`
- Culture：`packages/core/src/lib/features/culture/**`
- Document：`packages/core/src/lib/features/document/**`
- Interview：`packages/core/src/lib/features/interview/**`
- Ontology：`packages/core/src/lib/features/ontology/**`
- Ontology Data Store：`packages/core/src/lib/features/ontology-data-store/**`
- Project：`packages/core/src/lib/features/project/**`
- Sandbox：`packages/core/src/lib/features/sandbox/**`
- Services：`packages/core/src/lib/features/services/**`（不含 launcher）
- 内置 Skill handlers：`packages/core/src/lib/features/skills/bundled/**/handler.ts`
- 系统功能：`packages/core/src/lib/features/system/**`
- Taste：`packages/core/src/lib/features/taste/**`
- 用户配置：`packages/core/src/lib/features/user-config/**`
- 用户注册表：`packages/core/src/lib/features/user-registry/**`

**Part G 边界备注：**
- `features/services/launcher/**` 归入 **Part F**，Part G 只覆盖 `project-initialization-service.ts`、`project-service.ts`、`project-service-real.ts`、`skill-service.ts`、`services/index.ts`。
- `features/skills/` 中，只有 `bundled/**/handler.ts` 及对应 `SKILL.md` 归入 **Part G**；`service.ts`、`executor.ts`、`decision.ts`、`registry.ts`、`project-initialization/*` 等 Skill 框架层归入 **Part F**。
- `features/system/**`、`features/taste/**`、`features/user-config/**`、`features/user-registry/**` 按课程总表“Taste、系统功能”纳入 Part G。

### Part H：协作与其他 Core Modules（131 个文件）

跨模块协调与事件流。

- Collaboration Runtime：`packages/core/src/modules/collaboration-runtime/**`（含 `engine/`、`protocol/`、`sandbox/`、`session/`、`ui/` 及测试）
- Memory Core：`packages/core/src/modules/memory-core/**`
- Other Core Modules：`packages/core/src/modules/` 下的 scheduler、neural-channel、view-manager、view-reconciler、browser MCP 等

### Part I：Next.js 页面与 API 边界（128 个文件）

Web 如何接入 Core。

- Next App Router：`packages/web/src/app/page.tsx`、`packages/web/src/app/layout.tsx`、`packages/web/src/app/window/page.tsx`、`packages/web/src/app/globals.css` 等
- API Routes：`packages/web/src/app/api/**`
  - Agent：`agent/sessions`、`agent/sessions/[sessionId]`、`agent/sessions/[sessionId]/messages`、`agent/abort`、`agent/memory/**`、`agent/projects/[projectId]/**`
  - Collaboration：`api/collaboration/sessions/**`
  - Project：`api/project/create/[sessionId]/**`、`api/projects/init/[sessionId]/**`
  - Skill：`api/skill-sessions/route.ts`
  - Taste：`api/taste/user/detection/[sessionId]/**`

### Part J：Web 交互、状态与窗体（238 个文件）

用户看到和操作的界面。

- Web 组件：`packages/web/src/components/**`
  - 框架组件：`components/framework/AppCard.tsx`、`AppWindow.tsx`、`OSFramework.tsx`、`Sidebar.tsx`
  - OS 组件：`components/os/**`
  - Skill 组件：`components/skills/SkillDialog.tsx` 等
  - UI primitives：`components/ui/**`
- Web 状态与服务：`packages/web/src/store/appWindowStore.ts`、`packages/web/src/services/AppWindowManager.ts`、`packages/web/src/hooks/useAppWindowManager.ts`
- Web 配置与基础：`packages/web/src/config/homeApps.ts`、`packages/web/src/lib/**`、`packages/web/src/ambient.d.ts`
- 样式与静态资源：`packages/web/src/app/globals.css`、`packages/web/public/**`

### Part K：Electron、Agent 与 Service 包（108 个文件）

补齐 Web 以外的运行环境。

- Electron Desktop：`packages/desktop/src/**`（主进程、preload、renderer、IPC、services、窗口管理）
- Agent Adapter：`packages/agent/**`（`index.js`/`index.d.ts`、`build-runtime.js`、task runtime、scripts、test）
- Pi Tasks：`packages/pi-tasks/**`（runtime contracts、commands、upstream reducer、test）
- Service 包：`packages/service/package.json`

### Part L：Skills、模板与 OpenSpec（278 个文件）

项目的扩展和开发工作流。

- 系统技能定义：`.codex/skills/openspec-*/SKILL.md`
- 模板：`templates/skills/**`（231 个文件）、`templates/project-interview/**`
- OpenSpec 变更工作流：`openspec/changes/**`（提案、设计、spec、任务、验证、归档）
- 技能报告：`skills/reports/**`

### Part M：数据、文档、资源与测试证据（782 个文件）

非源码文件也不得遗漏或误读。

- 设计文档：`docs/product/**`、`docs/design/**`、`docs/architecture/**`、`docs/cognitive/**`、`docs/decisions/**`、`docs/agent/**`、`docs/api/**`、`docs/guides/**`、`docs/ux/**`
- Story / QA / 测试用例：`docs/specs/**`（524 个文件）、`docs/QA/**`、`docs/test-cases/**`
- 变更记录：`docs/changes/**`、`docs/changes/releases/**`
- 文档模板与索引：`docs/templates/**`、`docs/index.md`、`docs/DOCUMENTATION-MANAGEMENT.md`
- 静态资源：`docs/assets/**`、`resources/**`、本地模型 `models/**`
- 运行时数据样本：`packages/web/data/**`、`packages/desktop/data/**`
- 根脚本与补丁：`scripts/**`、`patches/**`、`.github/workflows/desktop-release.yml`
- Electron 根目录：`electron/**`
- 跨包测试：`tests/**`

### Part N：全链路复盘与实战验收（155 个文件）

把碎片知识连成可操作能力。

- 学习笔记本身：`learning-note/**`（含各 lesson、assets、textbook Part A–E 草稿）

## 统计与遗漏检查

| Part | 文件数 | 主要类型 |
|------|--------|----------|
| A. 学习起点与全景 | 11 | 文档、配置 |
| B. 从用户操作看完整链路 | — | 跨 Part 串联视图，不重复计数 |
| C. 仓库、构建与边界 | 85 | 配置、脚本、包边界 |
| D. Core 基础设施 | 35 | source、test-source |
| E. Pi Agent 基础运行时 | 154 | source、test-source |
| F. RoleAgent、ProjectAgent 与认知系统 | 57 | source、test-source、documentation |
| G. Core 业务功能 | 95 | source、test-source |
| H. 协作与其他 Core Modules | 131 | source、test-source、configuration |
| I. Next.js 页面与 API 边界 | 128 | source、test-source |
| J. Web 交互、状态与窗体 | 238 | source、test-source、binary-or-static-asset |
| K. Electron、Agent 与 Service 包 | 108 | source、test-source、configuration |
| L. Skills、模板与 OpenSpec | 278 | template-or-skill、source、documentation |
| M. 数据、文档、资源与测试证据 | 782 | documentation、runtime-data、binary-or-static-asset |
| N. 全链路复盘与实战验收 | 155 | learning-material |
| **合计（不重复）** | **2257** | — |

### 遗漏检查结论

- `02-all-tracked-files-map.md` 共记录 **2257** 个 Git 已跟踪文件。
- 按上述 Part 划分后，每个文件被唯一归入 A/C/D/E/F/G/H/I/J/K/L/M/N 中的一个 Part。
- **未映射文件数：0**，即当前分类覆盖全部 2257 个文件，无遗漏。
- Part B 作为端到端串联单元，其关键链路文件同时归属于 I/J/E/K/G 等 Part；若在 Part B 中重复计数，会导致总数超过 2257，因此表中单独列出并标记为“跨 Part 串联视图”。

### 与课程轨道（T00–T99）的对应关系

| Part | 对应课程轨道 | 说明 |
|------|--------------|------|
| A | T00（文档/入口配置部分） | 产品全景与运行坐标 |
| C | T00（工程配置/脚本部分）、T01 | Monorepo、pnpm、构建边界 |
| D | T01（paths/utils/hooks 部分）、T02 | Core 基础设施与公共合同 |
| E | T04 | Pi Agent 基础运行时 |
| F | T03（agent/skills/launcher/cognitive 部分）、T06（cognitive/memory 部分） | RoleAgent、ProjectAgent、认知系统 |
| G | T03（project/interview/ontology/services/sandbox 等部分） | Core 业务功能 |
| H | T05、T06（非认知部分）、T07 | Collaboration、Memory Core、其他 Modules |
| I | T08、T09 | Next.js 页面与 API |
| J | T10、T11、T12 | Web 组件、状态、服务适配 |
| K | T13、T14、T15、T16 | Electron、Agent Adapter、Service |
| L | T17、T18 | Skills、模板、OpenSpec |
| M | T19、T20、T21、T22、T23 | 文档、构建、数据、资源、测试 |
| N | T99 | 学习笔记与全链路复盘 |
