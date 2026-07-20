# OriginOS CE

OriginOS CE 是一个面向个人与小团队的 AI Native 工作系统，也是一个探索下一代操作系统形态的个人业务操作系统。它不是传统意义上的操作系统，而是运行在 Web / Electron 桌面壳之上的 Agent 工作台：用户通过项目、角色 Agent、技能、文件、通知和定时任务定义问题、组织工作流，让系统理解人的业务语境，并用 AI Native 的方式辅助生成应用、流程、知识和协作结构。

## 产品愿景

OriginOS CE 的使命，是为下一代操作系统建立一个可运行的原型：未来的应用不应只由预设菜单和固定软件形态决定，而应从用户定义的问题出发，由系统理解上下文、拆解任务、组织能力，并用 AI Native 的方式生产出对应的工作空间、应用界面、自动化流程和协作 Agent。

它的核心理念是让 AI 适应人的思考，而不是让人迁就 AI 的工具链。系统通过对话、项目、技能和长期记忆捕捉用户的隐性判断、业务语境和工作偏好，把分散的具身经验转化为可引用、可执行、可演化的符号结构。

在人与 AI 的关系上，OriginOS CE 不是把 AI 设计成一次性问答工具，而是设计成可长期协作的操作系统能力：人提出问题、给出目标、判断和品味，系统负责承接执行、组织知识、发现连接、生成工具，并在反馈中持续校准自己的行为。

## 核心能力

- 首页工作台：把项目、角色、技能、文件、通知和定时任务组织在统一桌面中，让用户从“定义问题”开始进入工作。
- Agent 系统：支持通用 Agent、RoleAgent、Project Agent、流式会话、工具调用、工作目录绑定、运行时 LLM 配置和会话隔离，让 AI 以长期角色参与工作。
- Skill 系统：支持 bundled / project / user 多来源技能加载、技能市场、技能窗口会话、附件上传和受控产物输出，把可复用工作流沉淀为可调用、可组合、可再生成的能力。
- 项目系统：支持项目初始化、项目 Agent、项目文件管理、业务访谈、business-model 产物和方案沉淀，让 AI 在具体业务上下文中理解问题。
- 认知沉淀：围绕 `Memory.md`、`Knowledge.md`、`Patterns.md`、实践日志和 frozen snapshot 维护 Agent/Project 维度的长期上下文，使经验能够跨会话积累和演化。
- AI Native 生产：围绕用户定义的问题，逐步把对话、知识、技能、Agent 和界面组织成新的工作应用形态，而不是只调用既有软件功能。
- 系统能力：提供文件读写、文档解析、系统通知、后台定时调度、跨窗体事件和自动更新基础设施。
- 多 Agent 协作 runtime：基于 solution manifest 启动 supervisor / worker，支持黑板、事件流、人审、指标和生产版日志。
- 桌面打包：支持 macOS arm64 / x64 DMG、Windows x64 NSIS 安装包和 zip，打包前校验 worker runtime 依赖与根目录构建产物。

## 技术栈

- Next.js 14 App Router
- React 18 + TypeScript 5
- Tailwind CSS + shadcn/Radix 基础组件
- Zustand 状态管理
- Electron 桌面运行时
- 本地文件系统 JSON 存储
- Vitest 测试
- pnpm workspace

## 仓库结构

```text
originos/
├── packages/
│   ├── web/             # Next.js Web UI
│   ├── desktop/         # Electron main/preload/打包配置
│   ├── core/            # 核心业务、Pi Agent、协作 runtime、类型
│   ├── service/         # 服务层包占位/聚合
│   └── agent/           # @mariozechner/agent workspace 兼容包
├── data/                # 本地运行时数据
├── docs/                # 架构、Story、变更记录和设计文档
├── templates/           # 模板资源（skills、project-interview 等）
├── resources/           # 桌面资源
├── release/             # 本地打包产物
├── AGENTS.md            # 架构规约，开发时必须遵守
└── README.md
```

## 环境要求

- Node.js 20+
- pnpm 9+
- macOS 桌面打包需要本机 Electron / electron-builder 依赖可用

安装依赖：

```bash
pnpm install
```

## LLM 配置

LLM 配置跟随用户在应用设置页中的选择。桌面端和 Web 端运行时会读取当前用户配置，包括 provider、base URL、模型 ID、凭证、最大输出 token 和字段映射等。

支持的 provider 包括 Anthropic、OpenAI-compatible、Google Gemini 和 Azure OpenAI。配置更新后，新的 Agent/Skill 会话会使用最新设置；多 Agent 协作子进程也会继承父进程下发的运行时模型配置。

## 开发

启动 Web 开发服务：

```bash
pnpm dev
```

启动 Electron 桌面开发模式：

```bash
pnpm desktop:dev
```

常用命令：

```bash
pnpm build                 # 构建 Web 应用
pnpm desktop:build         # 构建 Web + Desktop，并校验 worker runtime 依赖
pnpm desktop:dist          # 生成桌面安装包
pnpm lint                  # Next lint
pnpm type-check            # Web TypeScript 检查
pnpm test                  # Web Vitest
pnpm agents:check          # AGENTS 架构规约检查
pnpm build:check-root-artifacts # 检查根目录是否出现误生成的构建产物
```

## 打包

生成桌面安装包：

```bash
pnpm desktop:dist                              # 按 electron-builder 配置生成默认平台产物
pnpm desktop:dist:mac                          # 生成 macOS arm64 / x64 DMG
pnpm --filter @originos/desktop dist:win        # 生成 Windows x64 NSIS 安装包和 zip
```

产物默认输出到 `release/`：

```text
release/
├── OriginOS CE-<version>-arm64.dmg
├── OriginOS CE-<version>-x64.dmg
├── OriginOS CE-<version>-x64.exe
├── OriginOS CE-<version>-x64.zip
├── mac-arm64/
├── mac/
└── win-unpacked/
```

桌面 `build:app` 会执行：

1. `@originos/web` Next build
2. `@originos/desktop` TypeScript build
3. `scripts/check-root-build-artifacts.js`
4. `packages/desktop/scripts/verify-agent-worker-runtime.js`
5. 同步 `dist-electron/` 到桌面包目录
6. 再次检查根目录构建产物

## 数据目录

运行时数据默认写入 `data/` 或桌面应用的 Application Support 数据根目录。主要目录：

- `data/projects/`：项目、会话、文件、solutions、本体数据。
- `data/skills/`：首页技能入口产物。
- `data/agents/`：内置/用户 Agent 的运行时文件和认知数据。
- `data/sessions/`：全局 Agent 会话。

## 测试与验证

推荐变更后至少运行：

```bash
pnpm --filter @originos/web build
pnpm --filter @originos/desktop build
```

多 Agent 打包链路验证：

```bash
node packages/desktop/scripts/verify-agent-worker-runtime.js
```

根目录构建产物检查：

```bash
pnpm build:check-root-artifacts
```

定向运行 Vitest：

```bash
pnpm --filter @originos/core exec vitest run <test-file>
pnpm --filter @originos/web test
```

注意：当前 `packages/core` 直接运行 `tsc --noEmit` 可能会暴露历史类型问题；以具体变更影响范围选择验证命令。

## 架构约束

开发必须遵守 `AGENTS.md`：

- `packages/web/src/app/` 只放路由、页面和 API 边界，业务逻辑进入 `packages/core/src/lib/` 或 `packages/core/src/modules/`。
- 服务端模块依赖必须单向，禁止循环依赖。
- MVP 阶段使用本地文件系统 JSON 存储，禁止引入数据库。
- 技能/Agent 产物必须写入对应 `data/` 子目录。
- 每次需求变更或 bug 修复需更新 `docs/changes/changelog.md`。

## 文档入口

- `AGENTS.md`：架构规约和项目地图。
- `docs/index.md`：文档索引。
- `docs/changes/changelog.md`：变更记录。
- `docs/specs/`：Epic / Story 规格。
- `docs/desktop-runtime-logs.md`：桌面 runtime 日志说明。
