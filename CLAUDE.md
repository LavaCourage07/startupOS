# OriginOS 架构规约 (AGENTS.md)

**版本：** 2.6.2
**日期：** 2026-07-17
**状态：** 强制执行

---

## 📋 文档目的

本文档是 OriginOS 项目的**架构规约和项目地图**，定义了所有实施必须遵守的架构约束、技术决策和开发规范。

**所有实施工作不得违反本规约。**

**相关文档：**
- [文档协作管理规范](docs/DOCUMENTATION-MANAGEMENT.md) - Story 文档管理流程
- [文档索引](docs/index.md) - 所有文档的快速导航

---

## 🎯 项目概览

### 核心定位

OriginOS 是一个面向个人用户的 AI Native 操作系统，基于 Next.js App Router 的 Web 应用实现。核心交互由 **Pi Agent** 驱动，支持技能（Skills）和 Agent 的会话式交互。

### MVP 范围

- **首页内置应用**：配置驱动（`src/config/homeApps.ts`），支持 skill 类型和 action 类型入口
- **技能系统**：多源加载（bundled / project / user），通过 `SkillDialog` 驱动 Pi Agent 会话
- **会话交互层**：Pi Agent 流式会话，支持历史记录与会话切换
- **文件管理层**：文件目录组织和版本追溯
- **工作空间编辑器**：Markdown 编辑
- **窗体与可视化**：基于 `AppWindowManager` 的多窗体管理
- **本体构建系统**：项目访谈模块 + 手动构建 + Ontology Skills 辅助
- **多 Agent 协作运行时**（Phase 1+2）：进程隔离架构 + 协作引擎 + UI 查看器（`src/modules/collaboration-runtime/`）

### Post-MVP（不在当前实施范围）

- 技能管理系统（FR32-37）
- 认知系统自动演化（FR38-42）
- Epic 9 Phase 3 Stories（9.19-9.24）：Queen-Led 协调、HNSW 语义索引、Agent Pool 预热等

---

## 🏗️ 技术栈约束

### 必须使用的技术

| 层级 | 技术选型 | 版本要求 | 说明 |
|------|---------|---------|------|
| **Monorepo** | pnpm workspace | 9.x+ | Monorepo 包管理（v2.6.0+） |
| **构建工具** | Turborepo | 2.x+ | 可选，优化 monorepo 构建性能 |
| **框架** | Next.js (App Router) | 14.x+ | 必须使用 App Router，禁止 Pages Router |
| **桌面应用** | Electron | 32.x+ | CE 桌面版（v2.6.0+） |
| **UI 库** | React | 18.x+ | 函数式组件 + Hooks |
| **语言** | TypeScript | 5.x+ | 严格模式，禁止 any 类型 |
| **样式** | Tailwind CSS | 3.x+ | 禁止内联样式和 CSS Modules |
| **组件库** | shadcn/ui | latest | 基于 Radix UI |
| **状态管理** | Zustand | 4.x+ | 禁止 Redux、MobX 等其他方案 |
| **数据存储** | 本地文件系统 (JSON) | - | MVP 阶段禁止使用数据库 |

### 禁止使用的技术

❌ **禁止：**
- Pages Router（必须使用 App Router）
- Class 组件（必须使用函数式组件）
- CSS Modules、Styled Components（必须使用 Tailwind）
- Redux、MobX（必须使用 Zustand）
- 任何数据库（PostgreSQL、MongoDB 等）
- 任何后端框架（Express、Koa 等）

---

## 📁 目录结构规约

### 强制目录结构

#### Monorepo 架构（v2.6.0+，Story 10.7）

**顶层结构：**

```
originos/                         # Monorepo 根目录
├── packages/
│   ├── core/                     # 共享核心包 (@originos/core)
│   │   ├── src/
│   │   │   ├── lib/              # 业务逻辑层
│   │   │   │   ├── features/     # 业务功能（可跨版本复用）
│   │   │   │   ├── integrations/ # 集成层（Pi Agent 等）
│   │   │   │   ├── shared/       # 跨层共享类型
│   │   │   │   ├── storage/      # 存储层
│   │   │   │   └── utils.ts      # 工具函数
│   │   │   ├── components/       # UI 组件（可跨版本复用）
│   │   │   │   ├── framework/
│   │   │   │   ├── molecules/
│   │   │   │   ├── organisms/
│   │   │   │   ├── skills/
│   │   │   │   └── ui/
│   │   │   ├── types/            # 全局类型定义
│   │   │   └── modules/          # 独立业务模块
│   │   │       └── collaboration-runtime/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                      # 云版本 Web 应用
│   │   ├── src/
│   │   │   ├── app/              # Next.js App Router（Web 专属）
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── globals.css
│   │   │   │   └── api/          # API 路由
│   │   │   ├── components/       # Web 专属组件
│   │   │   │   ├── os/           # 浏览器窗体系统
│   │   │   │   └── window/
│   │   │   ├── config/
│   │   │   │   └── homeApps.ts   # 首页配置
│   │   │   ├── services/
│   │   │   │   └── AppWindowManager.ts  # CSS 模拟窗体管理器
│   │   │   └── lib/              # Web 专属业务逻辑（如有）
│   │   ├── public/
│   │   ├── package.json
│   │   ├── next.config.js
│   │   └── tsconfig.json
│   │
│   ├── desktop/                  # CE 桌面版（Electron）
│   │   ├── src/
│   │   │   ├── main/             # Electron 主进程
│   │   │   │   ├── index.ts      # 主进程入口
│   │   │   │   ├── window-manager.ts  # 原生窗体管理
│   │   │   │   ├── ipc-handlers.ts    # IPC 处理器
│   │   │   │   └── file-system.ts     # 本地文件系统直连
│   │   │   ├── preload/          # Preload 脚本
│   │   │   │   └── index.ts
│   │   │   ├── renderer/         # 渲染进程（Next.js）
│   │   │   │   ├── app/
│   │   │   │   ├── components/   # Desktop 专属组件
│   │   │   │   ├── config/
│   │   │   │   └── lib/          # Desktop 专属逻辑
│   │   │   └── types/            # Electron 类型定义
│   │   ├── resources/            # 应用资源（图标、安装包配置）
│   │   ├── package.json
│   │   ├── electron-builder.json
│   │   └── tsconfig.json
│   │
│   └── service/                  # 云版本后端服务（未来扩展）
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── .claude/
│   └── skills/                   # 系统内置技能定义（只读）
│
├── data/                         # 运行时数据（各版本独立或共享）
│   ├── web/                      # Web 版本数据（云存储或本地）
│   ├── desktop/                  # Desktop 版本数据（本地）
│   └── shared/                   # 共享数据（如有）
│
├── pnpm-workspace.yaml           # pnpm workspace 配置
├── turbo.json                    # Turborepo 配置（可选）
├── tsconfig.base.json            # 基础 TypeScript 配置
├── .eslintrc.json                # 共享 ESLint 配置
├── .prettierrc                   # 共享 Prettier 配置
└── package.json                  # 根 package.json
```

**包依赖关系：**

```
packages/web/     ──depends on──> packages/core/
packages/desktop/ ──depends on──> packages/core/
packages/service/ ──depends on──> packages/core/ (未来)
```

### 目录规则

#### Monorepo 架构规则（v2.6.0+）

1. **包依赖必须单向**
   - `packages/web/` 和 `packages/desktop/` 只能依赖 `packages/core/`
   - 禁止 `packages/core/` 依赖 `packages/web/` 或 `packages/desktop/`
   - 禁止 `packages/web/` 和 `packages/desktop/` 之间互相依赖

2. **共享代码必须放在 `packages/core/`**
   - 可跨版本复用的业务逻辑：`packages/core/src/lib/features/`
   - 可跨版本复用的 UI 组件：`packages/core/src/components/`
   - 类型定义：`packages/core/src/types/`
   - 独立业务模块：`packages/core/src/modules/`

3. **版本专属代码放在各自的包内**
   - Web 版本专属：`packages/web/src/` （App Router、API 路由、CSS 窗体管理器）
   - Desktop 版本专属：`packages/desktop/src/` （Electron 主进程、原生窗体、IPC）
   - 禁止在 `packages/core/` 中放置版本专属代码

4. **导入规则**
   - 从 core 包导入：`import { X } from '@originos/core'`
   - 包内相对导入：`import { X } from '../lib/features/...'`
   - 禁止绕过包边界直接访问其他包的内部实现

5. **数据存储隔离**
   - Web 版本数据：`data/web/`
   - Desktop 版本数据：`data/desktop/`
   - 共享数据（如技能定义）：`data/shared/`
   - 各版本数据路径通过环境变量或配置指定

#### 通用规则（适用于所有包）

6. **禁止在 `app/` 下放置业务逻辑**
   - `app/` 仅用于路由和页面组件
   - 所有业务逻辑必须在 `lib/features/` 中

7. **组件分层必须严格遵守**
   - atoms/molecules: 不依赖业务逻辑组件
   - organisms: 可依赖 lib/features/ 中的业务逻辑

8. **功能模块必须独立**
   - 每个 feature 必须有独立的 types.ts
   - 禁止跨 feature 直接导入内部实现
   - 必须通过 index.ts 导出公共 API

9. **`lib/features/` 是业务逻辑的唯一归属**
   - 禁止在 `lib/` 顶层放置业务子目录
   - 新增业务功能必须放入 `lib/features/<feature-name>/`

10. **`lib/shared/` 是跨层共享类型的唯一归属**
    - Layer 0 类型定义（被多个层级引用的 interfaces、types）
    - 禁止在 `lib/features/` 中定义被基础设施层引用的类型

11. **`.claude/skills/` 是只读定义目录**
    - 仅存放技能定义文件（skill.md、参考文件）
    - Agent 不得向此目录写入任何产物

---

## 🔗 模块依赖规约

### 单向按序依赖原则（强制）

**核心原则：** 服务端的模块依赖只能是单向按序依赖，严格禁止双向依赖和循环依赖。

### 依赖层级定义

#### Monorepo 包级别依赖（v2.6.0+）

**包之间的依赖（横向依赖）：**

```
packages/web/     ──单向依赖──> packages/core/
packages/desktop/ ──单向依赖──> packages/core/
packages/service/ ──单向依赖──> packages/core/ (未来)

禁止：
- packages/core/ 依赖 packages/web/ 或 packages/desktop/
- packages/web/ 与 packages/desktop/ 之间互相依赖
```

#### 包内模块依赖（纵向依赖）

**在 `packages/core/`、`packages/web/`、`packages/desktop/` 内部，模块按照以下层级组织，只能依赖同层或下层模块**：

```
Layer 5: app/                    # 应用层（页面、路由）
         ↓ 单向依赖
Layer 4: components/             # 组件层
         ↓ 单向依赖
Layer 3: services/               # 服务层（AppWindowManager 等）
         ↓ 单向依赖
Layer 2: lib/features/           # 业务功能层
         modules/                # 独立业务模块（collaboration-runtime 等）
         ↓ 单向依赖
Layer 1: lib/storage/            # 存储层
         lib/integrations/       # 集成层
         lib/utils/              # 工具层
```

### 依赖规则

#### 1. 包级别依赖规则（Monorepo v2.6.0+）

**允许的依赖方向：**
- ✅ `packages/web/` → `packages/core/`
- ✅ `packages/desktop/` → `packages/core/`
- ✅ `packages/service/` → `packages/core/` (未来)

**禁止的依赖方向：**
- ❌ `packages/core/` → `packages/web/` 或 `packages/desktop/`
- ❌ `packages/web/` ↔ `packages/desktop/` (互相依赖)
- ❌ 绕过包边界直接访问其他包的文件系统路径

#### 2. 包内模块依赖规则（适用于所有包）

##### 2.1 应用层 (app/)
- ✅ 可以依赖：components/, services/, lib/
- ❌ 禁止依赖：无上层
- ❌ 禁止：在 app/ 中定义业务逻辑

##### 2.2 组件层 (components/)
- ✅ 可以依赖：services/, lib/
- ❌ 禁止依赖：app/

##### 2.3 服务层 (services/)
- ✅ 可以依赖：lib/
- ❌ 禁止依赖：app/, components/

##### 2.4 业务功能层 (lib/features/)
- ✅ 可以依赖：lib/storage/, lib/integrations/, lib/utils/
- ❌ 禁止依赖：app/, components/, services/
- **Feature 之间依赖规则：**
  - 必须通过 index.ts 导出公共 API
  - 禁止直接导入其他 feature 的内部实现

##### 2.5 基础设施层 (lib/storage/, lib/integrations/, lib/utils/)
- ✅ 可以依赖：lib/utils/（仅限工具函数）
- ❌ 禁止依赖：app/, components/, services/, lib/features/

#### 4. 业务功能层 (lib/features/)
- ✅ 可以依赖：lib/storage/, lib/integrations/, lib/utils/
- ❌ 禁止依赖：app/, components/, services/
- **Feature 之间依赖规则：**
  - 必须通过 index.ts 导出公共 API
  - 禁止直接导入其他 feature 的内部实现

#### 5. 基础设施层 (lib/storage/, lib/integrations/, lib/utils/)
- ✅ 可以依赖：lib/utils/（仅限工具函数）
- ❌ 禁止依赖：app/, components/, services/, lib/features/

### 依赖检查规则

#### ❌ 禁止的依赖模式

```typescript
// ❌ 错误：core 包依赖 web 或 desktop 包
// packages/core/src/lib/features/ontology/index.ts
import { WebSpecificComponent } from '@originos/web'; // 禁止！

// ❌ 错误：web 和 desktop 包之间互相依赖
// packages/web/src/lib/utils.ts
import { DesktopUtil } from '@originos/desktop'; // 禁止！

// ❌ 错误：绕过包边界直接访问文件系统
// packages/web/src/app/page.tsx
import { DesktopComponent } from '../../../desktop/src/components/Desktop'; // 禁止！

// ❌ 错误：双向依赖
// ontology.ts
import { queryGraph } from './knowledge';
// knowledge.ts
import { buildOntology } from './ontology'; // 禁止！形成循环

// ❌ 错误：上层依赖下层
// lib/features/ontology/index.ts
import { CUIComponent } from '@/components/organisms/CommandInterface'; // 禁止！

// ❌ 错误：跨 feature 直接导入内部实现
// lib/features/ontology/ontology-builder.ts
import { GraphStore } from '@/lib/features/knowledge/graph-store'; // 禁止！
```

#### ✅ 正确的依赖模式

```typescript
// ✅ 正确：从 core 包导入共享代码
// packages/web/src/app/page.tsx
import { OntologyService } from '@originos/core';
import { Button } from '@originos/core/components/ui';

// ✅ 正确：packages/desktop 从 core 导入
// packages/desktop/src/renderer/app/page.tsx
import { OntologyService } from '@originos/core';

// ✅ 正确：单向依赖
// lib/features/knowledge/index.ts
import { OntologyService } from '@/lib/features/ontology'; // 通过公共 API

// ✅ 正确：依赖下层
// lib/features/ontology/ontology-store.ts
import { JsonStore } from '@/lib/storage/json-store';

// ✅ 正确：组件依赖业务逻辑
// components/skills/SkillDialog.tsx
import { usePiAgent } from '@/lib/integrations/pi-agent/hooks';
```

### 依赖验证

**在每次提交前必须运行：**

```bash
npm run lint  # 自动检查依赖违规
```

### 违规处理

**如果发现依赖违规：**

1. **立即停止开发**
2. **重构代码以符合单向依赖原则**
3. **可能的重构方案：**
   - **包级别违规**：将共享代码移动到 `packages/core/`
   - **模块级别违规**：提取共享逻辑到下层模块
   - 使用依赖注入
   - 使用事件总线解耦
   - 重新设计模块边界

**Monorepo 特定检查：**

```bash
# 检查包依赖是否正确
pnpm why @originos/web   # 不应该被 core 依赖
pnpm why @originos/desktop  # 不应该被 core 或 web 依赖

# 检查循环依赖
npm run lint  # 自动检查依赖违规
```

---

## 🔧 核心架构约束

### 1. 本体构建系统架构

**三层结构（强制）：**

```typescript
// 领域层 (Domain)
interface Domain {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 概念对象层 (Concept)
interface Concept {
  id: string;
  domainId: string;
  name: string;
  type: string;
  attributes: Record<string, unknown>;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 实例数据层 (Instance)
interface Instance {
  id: string;
  conceptId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

**存储约束：**
- 所有本体数据存储在 `{project-root}/data/ontology/` 目录
- 每个项目一个独立的 JSON 文件

### 2. 项目访谈模块架构

**访谈流程（强制）：**

```typescript
interface InterviewSession {
  id: string;
  projectId: string;
  questions: InterviewQuestion[];
  answers: Record<string, unknown>;
  status: 'in_progress' | 'completed' | 'skipped';
  createdAt: Date;
  completedAt?: Date;
}
```

**本体生成约束：**
- 访谈结果必须在 5 秒内生成初始本体
- 至少生成 1 个领域层和 2-3 个概念对象

### 3. 窗体管理架构

**基于 `AppWindowManager` 服务（强制）：**

```typescript
interface WindowState {
  id: string;
  title: string;
  component: React.ComponentType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
}
```

**窗体约束：**
- 最小尺寸：400x300px
- 窗体必须支持拖拽、调整大小、最小化、最大化
- 窗体渲染必须在 < 1 秒内完成

### 4. Ontology Skills 架构

**推荐系统（强制）：**

```typescript
interface OntologySkill {
  id: string;
  type: 'domain_recommendation' | 'concept_recommendation' | 'relation_inference';
  execute: (context: OntologyContext) => Promise<Recommendation[]>;
}
```

**性能约束：**
- Ontology Skill 响应时间必须 < 5 秒
- MVP 阶段使用基于规则的推荐算法
- 禁止使用复杂的机器学习模型

---

## 🔌 集成架构约束

### 1. Claude Code 集成

**用途：**
- 意图理解和自然语言处理
- 本体图谱查询
- 虚拟团队进程管理

**集成约束：**
- 必须通过统一的抽象层 `lib/integrations/claude-code/`
- 禁止在业务逻辑中直接调用 Claude Code API

### 2. OpenClaw 集成

**用途：**
- 全渠道运维网关（WhatsApp/Telegram/iMessage）
- 虚拟团队进程通信

**集成约束：**
- 必须通过统一的抽象层 `lib/integrations/openclaw/`（如适用）
- 进程通信必须使用 OpenClaw 内置机制

### 3. Pi Agent 核心架构

**已实施，位于 `lib/integrations/pi-agent/`，包含：**

- `core/agent.ts`：OriginOSAgent 主体，管理会话生命周期
- `core/skills.ts`：技能多源加载（bundled / project / user）
- `hooks/`：React 端 `usePiAgent` Hook
- `tools/`：Agent 工具集（bash、file、skill、ontology、url）
- `agent-manager.ts`：Agent 实例管理，按 scope 过滤工具
- `session-store.ts`：会话持久化

### 4. RoleAgent 架构

**RoleAgent 专用的思维循环体系，位于 `lib/integrations/pi-agent/role-agent/`，包含：**

- `role-context.ts`：角色上下文加载器（7 个 .md 文件 + 技能扫描）
- `state-machine.ts`：角色状态机解析与推进
- `skill-resolver.ts`：技能解析器（扫描 .skills/ 软链接，提取 icon/category/tags/frontmatter）
- `system-prompt.ts`：RoleAgent 专用 7 层分层 system prompt 构建
- `memory-tracker.ts`：内存累积器，每 N 轮落盘 Memory.md + JSONL 历史存储
- `dream.ts`：Dream 两阶段自动记忆维护（LLM 分析 + 精准文件编辑）
- `consolidator.ts`：Consolidator 预留接口（token 预算触发式压缩）
- `index.ts`：模块统一导出

**RoleAgent 7 层 System Prompt（`system-prompt.ts`）：**

1. **角色身份**（Agent.md 全文）
2. **状态与记忆**（阶段名 + 行为特征 + Memory.md + Knowledge.md + Patterns.md）
3. **思维循环指令**（5 步思考流程）
4. **工具箱**（已安装技能清单 + registry 驱动系统工具列表，含描述）
5. **风格指南**（Taste.md，无内容时跳过）
6. **工作目录 + 权限授权**
7. **安全约束**（固定 section）

**RoleAgent 工作目录文件：**

| 文件 | 说明 | 生命周期 |
|------|------|---------|
| `Agent.md` | 角色身份定义 | 创建时写入，手动维护 |
| `Role.md` | 状态机定义（阶段、转换条件） | 创建时写入，可更新 |
| `Tool.md` | 工具配置（allowedTools frontmatter） | 创建时写入，自动更新 |
| `Taste.md` | 风格指南 | 创建时写入，手动维护 |
| `Memory.md` | 历史会话摘要 | 每 N 轮落盘（Dream 自动整理） |
| `Knowledge.md` | 知识库索引快照 | 周期更新（session-end 或每 N 轮） |
| `Patterns.md` | 经验模式索引快照 | 周期更新（session-end 或每 N 轮） |

**RoleAgent Dream 自动记忆维护：**

```
turn_end hook
  ├─ 状态机检查 + 阶段转换（现有）
  ├─ MemoryTracker：记录 turn，JSONL 追加写入 memory/history.jsonl
  │   └─ 达到 flush 阈值 → 追加到 Memory.md
  └─ Dream：每 20 turn 触发
      ├─ Phase 1: LLM 分析对话历史 → [ADD]/[UPDATE]/[REMOVE]/[SKILL] 指令
      └─ Phase 2: 解析指令 → 精准编辑 Memory.md
```

- 运行记忆：pi-agent 消息历史（每轮自动）
- 持久记忆：Memory.md（每 N 轮落盘，默认 50）
- 自动整理：Dream 每 20 turn 触发，去重/过时清理/事实提取
- 历史存储：JSONL 格式，支持 cursor 增量读取

**RoleAgent 通过 `launcher/role-agent.ts` 启动，不影响其他 Agent 类型。**

### 5. Project Agent 架构

**Project Agent（interview 类型项目），位于 `lib/integrations/pi-agent/project-agent/`，包含：**

- `project-context.ts`：项目上下文加载器（7 个 .md 文件 + 技能扫描）
- `project-prompt.ts`：7 层分层 prompt 构建器（与 RoleAgent 对齐）
- `index.ts`：模块统一导出

**Project Agent 7 层 System Prompt（`project-prompt.ts`）：**

1. **身份**（Agent.md 全文）
2. **状态与记忆**（Memory.md + business-model.json + Knowledge.md + Patterns.md）
3. **思维循环指令**（5 步思考流程，project-agent 版本）
4. **工具箱**（已安装技能 + registry 驱动系统工具列表，`project` scope）
5. **风格指南**（Taste.md，无内容时跳过）
6. **工作目录 + 权限授权**
7. **安全约束**（固定 section）

**Project Agent 工作目录文件：**

| 文件 | 说明 | 生命周期 |
|------|------|---------|
| `Agent.md` | 项目身份定义 | 创建时写入 |
| `Tool.md` | 工具配置（allowedTools frontmatter） | 创建时写入，自动更新 |
| `Taste.md` | 风格指南 | 创建时写入，可手动维护 |
| `Memory.md` | 历史会话记录 | 每轮/周期更新 |
| `Knowledge.md` | 知识库索引快照 | 周期更新 |
| `Patterns.md` | 经验模式索引快照 | 周期更新 |

**Project Agent 通过 `persistent-agent-manager.ts` 启动，在 `startAgent()` 时加载 `ProjectContext`，构建 7 层 prompt，传入 `PersistentAgent`。**

**Frozen Snapshot 模式**：Knowledge.md 和 Patterns.md 在 Agent 启动时加载到 system prompt（Layer 2: StateMemory），中途生成的知识只写入磁盘，不修改内存中的快照，保持 LLM prefix cache 稳定。

### 6. 多 Agent 协作运行时架构

**已实施，位于 `src/modules/collaboration-runtime/`（Epic 9 Phase 1+2 Complete），包含：**

- **Session 层**：事件存储（JSONL）、共享黑板（Blackboard + Provenance + Append-Only）
- **协作引擎**：拓扑解析器、DAG 执行器（Workflow 模式）、Supervisor 模式
- **协议层**：ACL 消息协议、Contract Net 招标-投标、Subscribe-Notify 订阅-通知
- **冲突检测**：ConflictDetector（resource/data/goal/deadlock）+ Circuit Breaker
- **能力匹配**：CapabilityMatcher（基于 Agent Card 发现）
- **沙箱层**：Node.js 沙箱（`@anthropic-ai/sandbox-runtime`）、Agent Spawner
- **桥接层**：Agent Registry（从 Solution Manifest 加载）、PI Agent Bridge
- **可观测性**：Logging、Metrics、Tracing、Cost Controller
- **UI 查看器**：事件时间线、SSE 实时更新、Zustand 状态管理

**协作运行时架构要点：**

| 维度 | 实现 |
|------|------|
| **进程隔离** | Web (Next.js) → Runtime (collaboration-runtime) → Agent (sandbox 子进程) |
| **通信** | HTTP + SSE（Web↔Runtime），stdio（Runtime↔Agent 子进程） |
| **依赖注入** | `CollaborationRuntimeDeps` 接口，模块内部不 import 外部模块 |
| **执行模式** | Workflow（DAG 单向触发）vs System（黑板协作、notify/depend） |
| **沙箱** | `@anthropic-ai/sandbox-runtime` v0.0.51 |

**待实施（Phase 3，Epic 9 Stories 9.19-9.24）：**
- 9.19: Queen-Led 层级协调（动态治理模式）
- 9.20: 黑板 HNSW 语义索引
- 9.21: Agent Pool 预热机制
- 9.22: 三层模型路由（Agent Booster → Haiku → Sonnet/Opus）
- 9.23: 共识投票机制（BFT/Raft/Quorum）
- 9.24: PID 孤儿会话回收

### 7. 认知系统架构

**认知系统使 Agent 在服务用户过程中积累知识、沉淀经验、持续进化。位于 `docs/specs/epic-C/`，包含 Stories C.1-C.7。**

**三个核心组件：**

| 组件 | 职责 | 目录 |
|------|------|------|
| **知识库 (Knowledge Base)** | 理解世界 — 领域知识、事实、概念的结构化存储 | `{agentOrProject}/knowledge/` |
| **实践日志 (Practice Log)** | 记录行为 — Agent 决策、工具选择、执行结果的日志 | `{agentOrProject}/practice/` |
| **经验模式库 (Pattern Library)** | 优化行为 — 从实践中提炼的最佳路径、反模式 | `{agentOrProject}/patterns/` |

**每轮 vs 周期性职责分离：**

| 触发时机 | 操作 | 重量级 |
|----------|------|--------|
| `on_turn_end` | 记录实践日志到 JSONL | 轻量（只写磁盘） |
| `on_session_end` | 批量分析日志 → 提取知识 + 沉淀模式 | 重量（LLM 分析） |
| 每 N 轮（可选） | 增量分析最近未处理的日志 | 重量（LLM 分析） |
| Agent 启动 | 加载 Knowledge.md + Patterns.md 快照到 prompt | 轻量（读文件） |

**Frozen Snapshot 模式（借鉴 hermes-agent MemoryManager）：**

```
Agent 启动
  └─ 加载 knowledge/ 快照 → Knowledge.md → Layer 2: StateMemory
  └─ 加载 patterns/ 快照 → Patterns.md → Layer 2: StateMemory

每轮 (on_turn_end)
  └─ 记录实践日志 → practice/turns/turn-{N}.json

Session 结束 / 每 N 轮 (on_session_end)
  ├─ 批量分析实践日志 → 提取新知识
  │   ├─ 创建/更新 knowledge/wiki/ 实体页面
  │   └─ 创建/更新 knowledge/ontology/ 本体知识
  └─ 提炼经验模式 → 沉淀到 patterns/
      ├─ 更新 patterns/registry.json
      └─ 生成 pattern-{id}.md
```

**认知管理器（CognitiveManager）设计（借鉴 hermes-agent Provider 模式）：**

```
CognitiveManager
├── KnowledgeProvider
│   ├── load_snapshot()     → 启动时加载知识快照
│   ├── run_periodic(logs)  → 周期分析日志，提取知识
│   └── system_prompt_block() → 静态指令注入
├── PatternProvider
│   ├── load_snapshot()     → 启动时加载模式快照
│   ├── run_periodic(logs)  → 周期分析日志，沉淀模式
│   └── system_prompt_block() → 模式使用指南
└── 生命周期钩子
    ├── on_turn_end(turn_data)     → 每轮：记录实践日志
    ├── on_session_end(messages)   → 周期：知识提取 + 模式沉淀
    └── on_delegation(task, result) → 子任务完成后知识合并
```

**知识体系：**
- 结构化知识通过 Ontology 系统存储（实体-关系-属性）
- 非结构化知识通过 wiki markdown 文件存储（LLM 自动编写、更新、交叉引用）
- Agent/Project 维度知识隔离
- 模式有效性评估：工具调用链越短→效率越高，用户纠正次数越多→效果越差

**RoleAgent/Project Agent 通过 7 层 System Prompt 的 Layer 2: StateMemory 注入 Knowledge.md 和 Patterns.md 快照。**

**Agent 工作目录（CWD）优先级（`bash-tools.ts`，从高到低）：**

1. `agentBaseDir`（会话级覆盖，最高优先级）
2. `projectContext.currentPath`
3. 工具调用参数 `workingDirectory`
4. `process.cwd()`

**技能调用流程：**

```
首页 AppCard (type:'skill')
  → SkillDialog 加载技能内容（GET /api/skills/{name}/content）
  → buildSkillSystemPrompt（注入 CLAUDE_SKILL_DIR、工作目录）
  → initialize()（POST /api/agent/sessions，设置 agentBaseDir）
  → 流式会话（POST /api/agent/sessions/{id}/messages）
```

---

## 📊 性能约束

### 强制性能指标

| 指标 | 要求 | 验证方式 |
|------|------|---------|
| CUI 消息响应 | < 500ms | 自动化测试 |
| 本体图谱查询 | < 5s (MVP) | 性能测试 |
| Ontology Skill 响应 | < 5s (MVP) | 性能测试 |
| 窗体渲染 | < 1s | 性能测试 |
| 首次页面加载 | < 3s | Lighthouse |
| 并发用户支持 | ≥ 10 (MVP) | 负载测试 |
| 协作运行时 DAG 执行 | DAG 拓扑排序 < 100ms | 自动化测试 |
| 黑板读写延迟 | < 10ms（单操作） | 性能测试 |
| Agent 子进程启动 | < 2s（冷启动） | 性能测试 |

### 性能优化策略

**必须实施：**
- 本体图谱虚拟化渲染（>50 节点时）
- 图谱查询索引优化
- 窗体内容懒加载
- 代码分割和动态导入

**禁止：**
- 阻塞主线程的同步操作
- 未优化的大规模数据渲染
- 内存泄漏

---

## 🔒 数据存储规约

### 文件系统结构（强制）

#### Monorepo 架构数据存储（v2.6.0+）

```
data/                             # 运行时数据根目录
├── web/                          # Web 版本数据（云存储或本地）
│   ├── projects/                 # 项目数据
│   │   └── {project-id}/
│   │       ├── project.json
│   │       ├── sessions/
│   │       └── files/
│   ├── sessions/                 # 全局会话
│   ├── skills/                   # 技能产物
│   ├── agents/                   # Agent 产物
│   ├── interviews/               # 访谈数据
│   ├── ontology/                 # 本体数据
│   ├── chats/                    # 聊天历史
│   └── tmp/                      # 临时文件
│
├── desktop/                      # Desktop 版本数据（本地存储）
│   ├── projects/                 # 项目数据（同 web 结构）
│   ├── sessions/
│   ├── skills/
│   ├── agents/
│   ├── interviews/
│   ├── ontology/
│   ├── chats/
│   └── tmp/
│
└── shared/                       # 跨版本共享数据（可选）
    └── .claude/
        └── skills/               # 系统内置技能定义（只读）
```

**数据路径解析规则（v2.6.0+）：**

| 环境 | 数据根目录 | 说明 |
|------|-----------|------|
| Web 版本 | `data/web/` | 可配置为云存储路径或本地路径 |
| Desktop 版本 | `data/desktop/` 或用户数据目录 | 遵循操作系统数据存储规范 |
| 共享数据 | `data/shared/` 或 `.claude/` | 技能定义等只读资源 |

**Desktop 版本数据目录（遵循各平台规范）：**

- **macOS**: `~/Library/Application Support/OriginOS/`
- **Windows**: `%APPDATA%/OriginOS/`
- **Linux**: `~/.config/originos/`


    │   └── {agentName}/
    │       ├── Agent.md            # Agent 角色定义（身份）
    │       ├── Role.md             # 状态机定义（阶段、转换）
    │       ├── Tool.md             # 工具配置（allowedTools 声明）
    │       ├── Taste.md            # 风格指南
    │       ├── Memory.md           # 历史记忆（每 N 轮落盘）
    │       ├── Knowledge.md        # 知识库索引快照（周期更新）
    │       ├── Patterns.md         # 经验模式索引快照（周期更新）
    │       ├── .skills/            # 已安装技能（软链接）
    │       ├── memory/             # 记忆存储
    │       │   └── history.jsonl   # JSONL 历史记录
    │       ├── knowledge/          # 知识库（认知系统）
    │       │   ├── schema.md
    │       │   ├── index.md
    │       │   ├── log.md
    │       │   ├── sources/        # 原始来源
    │       │   ├── ontology/       # 本体知识
    │       │   └── wiki/           # 非结构化 wiki
    │       ├── patterns/           # 经验模式（认知系统）
    │       │   ├── registry.json
    │       │   └── analysis/
    │       └── practice/           # 实践日志
    │           ├── turns/          # 按 turn 编号组织
    │           └── summary.json
    │
    ├── interviews/               # 访谈数据
    │   └── {session-id}.json
    │
    ├── projects/
    │   └── {projectId}/
    │       └── collaboration-sessions/   # 多 Agent 协作运行时数据（Epic 9）
    │           └── {sessionId}/
    │               ├── events.jsonl      # 事件日志
    │               ├── blackboard.json   # 黑板快照
    │               └── artifacts/        # 协作产出工件
    │
    ├── ontology/                 # 本体数据
    ├── chats/                    # 聊天历史
    └── tmp/                      # 临时文件
```

### 技能与 Agent 产物目录规则（强制）

#### Monorepo 多版本规则（v2.6.0+）

| 调用来源 | Web 版本产物目录 | Desktop 版本产物目录 |
|---------|----------------|-------------------|
| **首页内置应用入口**（系统内置技能） | `data/web/skills/{skillName}/` | `data/desktop/skills/{skillName}/` |
| **首页内置应用入口**（内置 Agent） | `data/web/agents/{agentName}/` | `data/desktop/agents/{agentName}/` |
| **项目上下文** | `projectContext.currentPath` | `projectContext.currentPath` |
| **RoleAgent / Agent 调用技能** | 继承调用方的 CWD | 继承调用方的 CWD |

**环境变量配置：**

```bash
# Web 版本
DATA_ROOT=./data/web

# Desktop 版本（macOS）
DATA_ROOT=~/Library/Application Support/OriginOS

# Desktop 版本（Windows）
DATA_ROOT=%APPDATA%/OriginOS

# Desktop 版本（Linux）
DATA_ROOT=~/.config/originos
```

**规则：**
- **`.claude/skills/`** 是只读的技能定义目录，Agent 绝对不得向此目录写入产物
- `CLAUDE_SKILL_DIR` 变量指向技能**源目录**（供读取参考文件），与产物输出目录无关
- 会话创建时（`POST /api/agent/sessions`），若 `agentBaseDir` 不存在则必须自动创建
- 各版本使用各自的数据目录，避免冲突

### 数据格式约束

**所有 JSON 文件必须包含：**
```typescript
interface DataFile {
  version: string;        // 数据格式版本
  createdAt: string;      // ISO 8601 格式
  updatedAt: string;      // ISO 8601 格式
  data: unknown;          // 实际数据
}
```

### 版本追溯约束

**文件版本管理：**
- 每次保存创建新版本
- 版本文件命名：`{filename}.v{version}.json`
- 保留最近 10 个版本
- 版本元数据存储在 `{filename}.versions.json`

---

## 🎨 UI/UX 规约

### 设计系统约束

**颜色系统（强制使用 Tailwind 预设）：**
- Primary: `blue-600`
- Secondary: `gray-600`
- Success: `green-600`
- Warning: `yellow-600`
- Error: `red-600`

**字体系统：**
- 标题：`font-bold`
- 正文：`font-normal`
- 代码：`font-mono`

**间距系统：**
- 必须使用 Tailwind 间距单位（4px 基准）
- 禁止使用任意值（如 `p-[13px]`）

### 交互规约

**CUI 交互：**
- 输入框必须自动获得焦点
- 支持 Enter 发送，Shift+Enter 换行
- 消息响应必须 < 500ms

**窗体交互：**
- 拖拽必须流畅（60fps）
- 调整大小必须实时预览
- 最小化/最大化必须有动画过渡

**本体图谱交互：**
- 支持鼠标滚轮缩放
- 支持拖拽平移
- 节点点击必须高亮显示关联

---

## 🧪 测试规约

### 测试覆盖率要求

| 层级 | 覆盖率要求 | 测试类型 |
|------|-----------|---------|
| 核心业务逻辑 | ≥ 80% | 单元测试 |
| UI 组件 | ≥ 60% | 组件测试 |
| 集成点 | 100% | 集成测试 |
| 关键用户流程 | 100% | E2E 测试 |

### 必须测试的场景

**本体构建系统：**
- 创建领域、概念、实例
- 定义关系
- 查询和过滤
- 编辑和删除

**项目访谈模块：**
- 完整访谈流程
- 跳过访谈
- 本体生成算法

**窗体管理：**
- 打开、关闭、最小化、最大化
- 拖拽和调整大小
- 多窗体管理

**多 Agent 协作运行时：**
- 协作会话创建、执行、终止
- Workflow 模式 DAG 执行（线性 + 并行 + 汇总）
- System 模式黑板协作
- ACL 消息路由（定向 + 广播）
- 冲突检测与消解
- 拓扑解析（循环依赖检测 + 模式判定）
- Supervisor 模式（任务分解 + Worker 分配 + 失败重分配）
- 子进程隔离（文件系统权限 + 超时）
- SSE 事件流实时推送

### Epic / Story 测试闭环

- 实施任何 Epic 中的 Story 前，必须先确认 Story 文档中包含该功能的测试 case 或验收用例；若缺失，必须先补齐测试 case 后再开始实现。
- Story 测试 case 必须覆盖核心成功路径、关键失败路径、边界条件，以及涉及 UI/接口/持久化/跨进程通信时的集成验证点。
- Story 功能实现完成后，必须创建一个自动化测试验证 goal；该 goal 的目标必须明确为“通过该 Story 中定义的测试 case”。
- 自动化测试验证 goal 必须执行对应单元测试、集成测试、E2E 或脚本化验收；若某项无法自动化，必须在 goal 输出中说明原因、人工验证步骤和剩余风险。

---

## 🚫 禁止事项清单

### 架构层面

❌ **严格禁止：**
1. 违反目录结构规约
2. 使用禁止的技术栈
3. 在 MVP 阶段实施 Post-MVP 功能
4. 跨 feature 直接导入内部实现
5. 在 `src/app/` 中放置业务逻辑
6. 使用数据库（MVP 阶段）
7. 向 `.claude/skills/` 目录写入任何产物（只读定义目录）
8. 系统内置技能在首页入口场景下将产物写入技能源目录
9. collaboration-runtime 模块内部直接 import `src/lib/` 或 `src/components/` 的模块
10. 在 `lib/` 顶层放置业务子目录（必须放入 `lib/features/`）
11. 基础设施层（storage、integrations、utils）依赖业务功能层（features）
12. **Monorepo 违规（v2.6.0+）：**
    - `packages/core/` 依赖 `packages/web/` 或 `packages/desktop/`
    - `packages/web/` 与 `packages/desktop/` 之间互相依赖
    - 绕过包边界直接访问其他包的文件系统路径
    - 在 `packages/core/` 中放置版本专属代码

### 代码层面

❌ **严格禁止：**
1. 使用 `any` 类型
2. 使用 Class 组件
3. 内联样式和 CSS Modules
4. 阻塞主线程的同步操作
5. 未处理的 Promise rejection
6. 内存泄漏
7. 硬编码的配置值

### 性能层面

❌ **严格禁止：**
1. 超过性能指标的实现
2. 未优化的大规模数据渲染
3. 不必要的重渲染
4. 未使用虚拟化的长列表

---

## ✅ 实施检查清单

### 开始实施前必须确认

- [ ] 已阅读并理解本架构规约
- [ ] 已确认技术栈符合要求
- [ ] 已确认目录结构符合规约
- [ ] 已确认不会实施 Post-MVP 功能
- [ ] 已确认性能指标可达成
- [ ] 若正在实施 Epic/Story，已确认 Story 文档包含功能测试 case；缺失时已先补齐

### 实施过程中必须遵守

- [ ] 每个 PR 必须符合架构规约
- [ ] 每个功能必须有对应测试
- [ ] Epic/Story 的实现必须对齐 Story 中定义的测试 case
- [ ] 每个性能指标必须验证
- [ ] 每个集成必须通过抽象层
- [ ] 每个数据文件必须符合格式约束
- [ ] 技能/Agent 产物输出到正确的 `data/` 子目录

### 实施完成后必须验证

- [ ] 已创建自动化测试验证 goal，且 goal 目标为通过该 Story 的测试 case
- [ ] 所有性能指标达标
- [ ] 所有测试通过
- [ ] 代码覆盖率达标
- [ ] 无架构规约违反
- [ ] 文档已更新

---

## 📝 变更管理

### 每次变更必须完成的文档更新

每次需求变更或 bug 修复完成后，**必须**在 `docs/changes/` 下更新变更记录，并按发布版本归档：

- **全量流水**：在 `docs/changes/changelog.md` 追加一条变更摘要（日期、类型、影响模块、简述）
- **版本归档**：在当前发布版本目录 `docs/changes/releases/v<version>/changelog.md` 追加对应变更；目录名必须带版本号，例如 `docs/changes/releases/v0.1.14/changelog.md`
- **架构调整**：同时更新 AGENTS.md 对应章节，并升级版本号
- **Bug 修复**：记录根因和修复方式，更新受影响模块的说明

变更摘要格式（同时用于 `docs/changes/changelog.md` 和 `docs/changes/releases/v<version>/changelog.md`）：

```
## YYYY-MM-DD — <类型>：<标题>

**类型**：feat / fix / refactor / docs
**影响模块**：<模块路径列表>
**摘要**：<1-3 句话描述变更原因和结果>
```

### 架构规约变更流程

1. **提出变更请求**
   - 说明变更原因
   - 评估影响范围
   - 提供替代方案

2. **架构评审**
   - 技术负责人审核
   - 团队讨论
   - 决策记录

3. **更新文档**
   - 在 `docs/changes/changelog.md` 追加变更摘要
   - 在当前版本目录 `docs/changes/releases/v<version>/changelog.md` 追加或整理版本更新说明
   - 更新 AGENTS.md 相关章节及版本号
   - 通知所有开发者

### 紧急变更

如遇到阻塞性问题需要紧急变更架构规约：
1. 立即通知技术负责人
2. 在 `docs/changes/changelog.md` 和当前版本目录 `docs/changes/releases/v<version>/changelog.md` 记录问题和解决方案
3. 24 小时内完成 AGENTS.md 更新

---

## 📞 联系方式

**架构问题咨询：**
- 技术负责人：Archersado
- 文档维护：BMAD 工作流

**规约违反报告：**
- 通过 PR Review 流程
- 通过 Issue 跟踪

---

## 📚 相关文档

- [PRD 文档](/_bmad-output/planning-artifacts/prd.md)
- [架构文档](/_bmad-output/planning-artifacts/architecture.md)
- [UX 设计规范](/_bmad-output/planning-artifacts/ux-design-specification.md)
- [Epic 和 Story](/_bmad-output/planning-artifacts/epics.md)

---

**最后更新：** 2026-07-17（v2.6.2：Epic/Story 实施新增测试 case 前置检查与自动化测试验证 goal）
**下次审查：** 实施完成后
