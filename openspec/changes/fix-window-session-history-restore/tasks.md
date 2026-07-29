## 1. Proposal 门禁

- [x] 1.1 完成 Proposal、design、capability spec 和 tasks，并通过 OpenSpec strict validation。
  - **依赖：** Story OS.20 已提交到 `dev`。
  - **写入范围：** `openspec/changes/fix-window-session-history-restore/`。
  - **负责角色：** Proposal integration owner。
  - **必需测试：** `openspec validate fix-window-session-history-restore --strict`。
  - **完成证据：** 用户于 2026-07-29 明确要求“开始先实施这个 story 修复”；4/4 artifacts 完成，strict validation 通过；Proposal commit 记录本任务。
  - **执行方式：** 串行门禁。

## 2. Core restore contract

- [x] 2.1 在隔离 Git task worktree 中实现 Session restore DTO、display message 映射、ownership 校验和结构化错误。
  - **依赖：** 1.1。
  - **写入范围：** `packages/core/src/lib/integrations/pi-agent/` 的 restore 模块、公共导出和相邻测试。
  - **负责角色：** Core Runtime subagent。
  - **必需测试：** Story TC-U1、TC-U2；TypeScript strict；禁止 private Pi Session access scan。
  - **完成证据：** Task commit `c3d7a4f`；`session-restore.test.ts` 8/8 通过；公共 contract 已从 pi-agent `client`、`hooks` 和 `index` 导出。
  - **执行方式：** 与 3.1 串行，先提供 contract。

- [x] 2.2 扩展 `usePiAgent`，实现 `restoreSession()`、原子状态提交、epoch/abort guard 和旧 Session stream event 隔离。
  - **依赖：** 2.1。
  - **写入范围：** `client-hooks.ts`、hook tests 和必要的 Core Electron service 类型适配。
  - **负责角色：** 与 2.1 相同的 Core Runtime subagent。
  - **必需测试：** Story TC-U3、TC-U4、TC-I1；现有 hook session isolation 和 stream tests。
  - **完成证据：** Task commit `c3d7a4f`；`client-hooks-session-isolation.test.ts` 8/8 通过；覆盖 restore A/B 乱序、initialize/restore 竞态、旧 stream 迟到事件和失败不破坏当前状态。
  - **执行方式：** 2.1 后串行。

## 3. Desktop 与窗体接线

- [x] 3.1 在独立 Git task worktree 中审计并补齐 Session Get/restore 的 ownership、错误映射和 Pi Agent Runtime 历史重绑。
  - **依赖：** 2.1 的公开 contract commit。
  - **写入范围：** `packages/desktop/src/main/services/agent-session-service.ts`、`packages/web/src/app/api/agent/sessions/[sessionId]/route.ts`、`packages/core/src/lib/integrations/pi-agent/agent-manager.ts`、Core IPC protocol/service adapter 和相邻测试。
  - **负责角色：** Desktop Integration subagent。
  - **必需测试：** Story TC-I1、TC-I4；Electron/Web adapter contract。
  - **完成证据：** Task commit `f70ea78`；`session-restore.test.ts`、`agent-manager.test.ts`、`runtime-history-restore.test.ts` 和 Electron adapter tests 通过；覆盖 `NOT_FOUND`、`OWNERSHIP_MISMATCH`、`CORRUPT_SESSION`、`RESTORE_FAILED`，并验证首次 Runtime hydration 使用持久化历史。
  - **执行方式：** 2.1 后执行；与 3.2 同一 worktree 串行。

- [x] 3.2 接入 Skill、Agent 与 RoleAgent 窗体历史入口，修正 `isInitialized` 短路、welcome 重发、删除冒泡和 switching/error 状态。
  - **依赖：** 2.2、3.1。
  - **写入范围：** `SkillDialog.tsx`、`AgentDialogContent.tsx` 及相邻 component tests。
  - **负责角色：** 与 3.1 相同的 Desktop Integration subagent。
  - **必需测试：** Story TC-I2、TC-I3、TC-I4、TC-I5。
  - **完成证据：** Task commit `f70ea78`；Skill 与 Agent/RoleAgent 共用 `restoreSession()`；`session-transition-guard.test.ts` 5/5 通过，覆盖 switching、welcome 抑制和迟到初始化隔离。
  - **执行方式：** 串行。

## 4. 集成与回归

- [x] 4.1 使用 `--no-ff` 把 Core 与 Desktop task branches 合并到 Proposal worktree，保留 Task commits 并解决公共 contract 冲突。
  - **依赖：** 2.2、3.2。
  - **写入范围：** Proposal branch merge commits；仅允许 owner files 的冲突修正。
  - **负责角色：** Proposal integration owner。
  - **必需测试：** Core hook/session tests、Desktop service/component tests、`git diff --check`。
  - **完成证据：** Core merge `c34c31a`、Desktop merge `09404ea`、QA merge `71fefb4`；无源码冲突；合并态聚焦回归 39/39 通过，`git diff --check` 通过。
  - **执行方式：** 串行集成。

- [ ] 4.2 运行 Session、stream、Chat Completion Guard、新建/删除和 Desktop development 回归。
  - **依赖：** 4.1。
  - **写入范围：** 只读验证；发现修复时必须新建隔离 task worktree。
  - **负责角色：** Regression subagent。
  - **必需测试：** Story 回归矩阵、`pnpm type-check`、`pnpm lint`、相关 package tests。
  - **完成证据：** Session restore/Runtime/hook/UI/Electron 39/39 通过；SessionStore、长会话和 Completion Guard 51/51 通过；Core/Web type-check、Desktop build、Web lint 通过。Windows `desktop:dev` 尚未执行，因此本项保持未完成。
  - **执行方式：** 串行。

- [ ] 4.3 运行 Story TC-E1、TC-E2、TC-E3；无法自动化的 Electron 真实历史数据验证交给用户执行。
  - **依赖：** 4.2。
  - **写入范围：** E2E fixtures/tests；源码修复使用新 task worktree。
  - **负责角色：** QA/E2E subagent。
  - **必需测试：** 三类窗体切换、乱序完成、长历史性能。
  - **完成证据：** QA task commit `ba64b32` 验证 1,000 条历史投影，低层预算 `<500ms`；TC-E2 的乱序 restore/旧 stream 隔离由 hook tests 自动化覆盖。TC-E1 与 TC-E3 的真实 Electron renderer 首屏、滚动和内存验证待用户执行。
  - **执行方式：** 串行。

## 5. Story 验证与合并

- [ ] 5.1 创建并执行自动化验证 Goal：“通过 Story OS.20 testing.md 中定义的测试 case”。
  - **依赖：** 4.3。
  - **写入范围：** Goal evidence 与 Proposal 文档；修复必须使用独立 task worktree。
  - **负责角色：** Verification Goal runner。
  - **必需测试：** AC1-AC6 与 TC-U1 至 TC-E3 映射。
  - **完成证据：** 自动化命令与 AC/TC 映射记录在 `verification.md`；当前线程存在 paused 的旧性能 Goal，Goal runtime 拒绝创建第二个 Goal，因此本项保持未完成。
  - **执行方式：** 串行门禁。

- [ ] 5.2 运行最终 OpenSpec strict validation、`pnpm agents:check` 和 architecture guard，并更新 Story OS.20/Epic OS 状态。
  - **依赖：** 5.1。
  - **写入范围：** Proposal artifacts、Story OS.20 和 Epic OS 文档。
  - **负责角色：** Proposal integration owner。
  - **必需测试：** strict validation、架构依赖扫描、文档占位符/链接检查。
  - **完成证据：** OpenSpec strict、类型检查、Desktop build、Web lint 和人工 monorepo architecture guard 已通过；`pnpm agents:check` 因只扫描根 `src/` 而跳过，不能作为有效架构证据。待 4.3/5.1 完成后更新为 Done。
  - **执行方式：** 串行。

- [ ] 5.3 获得显式 merge approval 后，把 Proposal branch 合并到 `dev`，执行 post-merge smoke 并清理已完成 worktrees/branches。
  - **依赖：** 5.2 和用户显式合并批准。
  - **写入范围：** Git integration 与 worktree metadata。
  - **负责角色：** Proposal integration owner。
  - **必需测试：** `dev` 上 strict validation 与聚焦 Session restore smoke。
  - **完成证据：** `dev` merge commit、post-merge 输出和 cleanup record。
  - **执行方式：** 最终串行任务。
