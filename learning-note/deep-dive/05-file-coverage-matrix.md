# 05 全项目文件覆盖矩阵

本文件记录这次重设深入课程前的全仓逐文件扫描结果。

扫描口径：

- 全仓文件总数：2232
- 可读文本文件：2097
- 可读文本总行数：434145
- 图片或二进制资产：36
- `.git`、依赖、构建产物等排除登记项：85
- 二进制或不可按 UTF-8 读取文件：14

说明：课程会覆盖所有文件路径，但不会把每个文件都按同一强度逐字讲。学习强度分为：

- **精读**：核心源码、关键文档、关键测试，进入课程正文；
- **通读**：同模块辅助文件，在课程中归纳职责和边界；
- **索引**：历史 specs、归档记录、运行数据、资产，知道作用和查询方式；
- **登记**：二进制、图片、构建或依赖相关文件，只记录来源和用途，不逐字解释。

## 文件桶统计

| 文件桶 | 文件数 | 文本数 | 文本行数 | 测试数 | 课程覆盖 |
| --- | ---: | ---: | ---: | ---: | --- |
| `docs/specs` | 524 | 523 | 87312 | 0 | J3、J5、P4 |
| `templates/skills` | 231 | 217 | 43754 | 0 | E1-E8、P2 |
| `other` | 207 | 120 | 4748 | 2 | P2、索引和登记 |
| `web.components` | 166 | 166 | 28188 | 19 | D1-D8 |
| `core.modules` | 157 | 157 | 33658 | 27 | H1-H8 |
| `core.pi-agent` | 154 | 154 | 40254 | 58 | F3-F10 |
| `docs.other` | 136 | 129 | 40803 | 0 | A1、A6、H1、H3、H4、J5 |
| `core.features` | 126 | 126 | 26243 | 18 | E2、F1-F2、G1-G6 |
| `web.api-routes` | 118 | 118 | 13781 | 7 | C3-C8 |
| `root-tooling-and-config` | 62 | 56 | 52626 | 0 | A2、A3、B1-B6、J1 |
| `learning-note` | 44 | 24 | 3694 | 0 | 学习产物，不作为项目源码主线 |
| `desktop.main` | 39 | 39 | 9071 | 7 | I1-I3 |
| `pi-tasks` | 36 | 36 | 6875 | 0 | B2、I5、J2 |
| `openspec` | 35 | 35 | 2632 | 0 | J1-J2、P4 |
| `desktop.scripts` | 30 | 30 | 5557 | 2 | I5 |
| `agent-adapter-package` | 25 | 25 | 2769 | 0 | B2、F4、I5 |
| `core.integrations` | 23 | 23 | 3954 | 3 | F4-F7、I2 |
| `web.hooks` | 23 | 23 | 2577 | 0 | D8、F3 |
| `core.types` | 19 | 19 | 4618 | 0 | F1、G4、H4 |
| `web.store` | 13 | 13 | 1760 | 2 | D4、D8 |
| `web.app-pages` | 10 | 10 | 2380 | 0 | C1、D1 |
| `docs.test-cases` | 8 | 8 | 11406 | 0 | J4、P4 |
| `core.shared` | 7 | 7 | 90 | 0 | A3、B3 |
| `desktop.lib` | 6 | 6 | 602 | 0 | I4 |
| `docs.templates` | 6 | 6 | 1962 | 0 | J3 |
| `templates.project-interview` | 6 | 6 | 383 | 0 | G3 |
| `tests` | 6 | 6 | 1007 | 2 | J4、P3、P4 |
| `web.modules-adapters` | 6 | 6 | 197 | 2 | H6-H8 |
| `web.services` | 4 | 4 | 873 | 1 | D3、D8 |
| `core.storage` | 2 | 2 | 221 | 0 | G5、H1 |
| `web.config` | 2 | 2 | 142 | 0 | C2、P1 |
| `service` | 1 | 1 | 8 | 0 | B2 |

## 精读优先级

### P0：必须精读

- `AGENTS.md`
- `README.md`
- `README_CN.md`
- 根 `package.json`
- `pnpm-workspace.yaml`
- `tsconfig*.json`
- `packages/web/src/app/layout.tsx`
- `packages/web/src/app/page.tsx`
- `packages/web/src/config/homeApps.ts`
- `packages/web/src/components/skills/SkillDialog.tsx`
- `packages/web/src/services/AppWindowManager*`
- `packages/web/src/store/*`
- `packages/web/src/app/api/agent/**`
- `packages/web/src/app/api/skills/**`
- `packages/web/src/app/api/projects/**`
- `packages/web/src/app/api/ontology-data/**`
- `packages/web/src/app/api/workspace/**`
- `packages/core/src/lib/features/agent/**`
- `packages/core/src/lib/features/skills/**`
- `packages/core/src/lib/features/project/**`
- `packages/core/src/lib/features/interview/**`
- `packages/core/src/lib/features/ontology/**`
- `packages/core/src/lib/features/ontology-data-store/**`
- `packages/core/src/lib/integrations/pi-agent/core/**`
- `packages/core/src/lib/integrations/pi-agent/tools/**`
- `packages/core/src/lib/integrations/pi-agent/role-agent/**`
- `packages/core/src/lib/integrations/pi-agent/project-agent/**`
- `packages/core/src/modules/memory-core/**`
- `packages/core/src/modules/collaboration-runtime/**`
- `packages/desktop/src/main/main.ts`
- `packages/desktop/src/main/preload.ts`
- `packages/desktop/src/main/ipc-protocol.ts`
- `packages/desktop/src/main/services/**`
- `openspec/config.yaml`
- `.codex/skills/openspec-*`

### P1：必须通读

- `packages/web/src/components/os/**`
- `packages/web/src/components/interview/**`
- `packages/web/src/components/solution/**`
- `packages/web/src/components/project/**`
- `packages/web/src/hooks/**`
- `packages/web/src/services/**`
- `packages/core/src/lib/integrations/electron/**`
- `packages/core/src/lib/features/system/**`
- `packages/core/src/lib/features/taste/**`
- `packages/core/src/lib/features/culture/**`
- `packages/core/src/modules/scheduler/**`
- `packages/core/src/modules/neural-channel/**`
- `packages/core/src/modules/view-manager/**`
- `packages/core/src/modules/view-reconciler/**`
- `packages/core/src/modules/mcp-in-browser/**`
- `packages/desktop/scripts/**`
- `packages/pi-tasks/**`
- `packages/agent/**`

### P2：索引阅读

- `docs/specs/**`
- `docs/changes/**`
- `docs/QA/**`
- `docs/diagrams/**`
- `docs/test-cases/**`
- `openspec/changes/archive/**`
- `packages/web/data/**`
- `packages/desktop/data/**`
- `templates/skills/*/assets/**`
- `learning-note/**`

## 课程覆盖原则

1. 每章必须列出“本章覆盖文件”。
2. 每章必须说明覆盖强度：精读、通读、索引。
3. 每章必须至少有一张 Mermaid 图。
4. 核心概念章必须配小黑图。
5. 每章必须能追到测试入口或说明为什么没有测试。
6. 每个阶段结束必须有验收题。
7. 综合实战必须改真实代码或真实文档，并留下验证证据。

## 不能偷换概念

以下说法都不合格：

- “列出了目录，所以已经掌握。”
- “统计了文件数量，所以已经读懂。”
- “画了架构图，所以可以改代码。”
- “读了 README，所以理解了 Agent runtime。”
- “看过 specs，所以知道测试闭环。”

合格标准是：能把文件路径、源码职责、调用链、关键类型、测试入口和练习验收对应起来。
