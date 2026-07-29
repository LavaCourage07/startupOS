## 1. 审批与 Runtime 前置依赖

- [x] 1.1 在修改任何应用源码或依赖前，获得 Proposal `validate-pi-tasks-runtime-boundary` 的显式批准。
  - **依赖：** proposal、design 和 capability spec 通过 strict validation。
  - **写入范围：** 仅限 Proposal artifacts。
  - **负责角色：** Proposal integration owner。
  - **必需测试：** `openspec validate validate-pi-tasks-runtime-boundary --strict`。
  - **完成证据：** 用户于 2026-07-29 明确回复“可以，开始实施”，并在实施前完成 strict validation。
  - **执行方式：** 串行审批门禁。

- [x] 1.2 把 Proposal branch rebase 到已提交 Pi Runtime upgrade 的最新 `dev`，并从 clean checkout 验证精确 runtime namespace/version。
  - **依赖：** 1.1，以及独立 Pi Runtime upgrade 已合并到 `dev`。
  - **写入范围：** 仅限 Proposal branch history 和 A-01 evidence notes；不得修改 runtime upgrade 源码。
  - **负责角色：** Proposal integration owner。
  - **必需测试：** 使用仓库指定 Node.js 24 和 pnpm 完成 clean install；执行 package 与 lockfile 一致性检查。
  - **完成证据：** Proposal merge-base 为 `db459ec84a15d81f088aa5212cf37bf11cd24eeb`；Runtime upgrade commit `505d157c408dc3e27ef1c09f11bf860a92cc0203` 可达；Node.js `24.14.0`、pnpm `9.15.9` 下 `pnpm install --frozen-lockfile` 成功；`pnpm --filter @originos/pi-agent-adapter test` 通过。首次 install 在 WSL 挂载盘发生一次 `undici` 临时目录 rename `EACCES`，清理未完成临时项后重试成功，未修改 lockfile。
  - **执行方式：** 串行前置任务。

## 2. 依赖与 Public Export 审计

- [x] 2.1 创建隔离 Task branch/worktree，锁定候选 `pi-tasks` 版本及其完整依赖图。
  - **依赖：** 1.2。
  - **写入范围：** `package.json`、`pnpm-lock.yaml`、`packages/agent/package.json`，以及必须声明直接 runtime dependency 的 package manifests。
  - **负责角色：** dependency audit subagent。
  - **必需测试：** frozen-lockfile install、重复/版本检查、package manager 一致性检查。
  - **完成证据：** Task branch `proposal-task/validate-pi-tasks-runtime-boundary-2-audit`，commit `95d33628090992fb63129f22878dc6dc818349a5`；`pi-tasks@0.2.0` 以精确版本写入 adapter manifest 和 lockfile，frozen install 通过。
  - **执行方式：** 2.2、3.1 和 3.3 的串行基础任务。

- [x] 2.2 审计公共 Pi Runtime 与 `pi-tasks` exports、tool registrations、schemas、state events、branch replay 和 compaction hooks，不导入 private paths。
  - **依赖：** 2.1。
  - **写入范围：** `packages/agent/scripts/pi-task-runtime-audit.*`、相邻 audit tests/fixtures，以及有界的机器可读 audit output schema。
  - **负责角色：** 与 2.1 使用同一 Task worktree 的 dependency audit subagent。
  - **必需测试：** public-export resolution test、forbidden-private-import scan、audit output schema test。
  - **完成证据：** `pnpm --filter @originos/pi-agent-adapter test` 的审计测试 3/3 通过；report hash `08d3c8c1992f328f9d543eacd5b6af5e4966a0d8b757ef4c2b542a42d1f393dd`；确认 12 个公开 tools、state event v1，并把 host invocation、public mutation command、stable revision 标记为 `unsupported`。
  - **执行方式：** 2.1 后串行执行；其 commit 合并后可与 package smoke 准备并行。

## 3. Public Runtime 契约验证

- [ ] 3.1 创建隔离 Task branch/worktree，实现 same-Session、same-branch task tool invocation contract harness。
  - **依赖：** 2.1，以及 2.2 识别出的公共候选边界。
  - **写入范围：** `packages/core/src/lib/integrations/pi-agent/__tests__/pi-task-runtime-boundary/**`，以及该目录所需的 test-only fixtures/config。
  - **负责角色：** Pi Runtime contract subagent。
  - **必需测试：** Story TC-C1；有效和无效的 `task_plan`、`task_update`、`task_evidence`、`task_resume`、`task_complete`；Session/branch/schema/permission assertions。
  - **完成证据：** Task branch commit、test output、invocation/event correlation records 和 forbidden-boundary scan。
  - **执行方式：** 2.2 后可与 3.3 并行。

- [ ] 3.2 扩展 contract harness，验证 revision correlation、current-branch replay、branch isolation、process restart 和 compaction preservation。
  - **依赖：** 3.1。
  - **写入范围：** 与 3.1 相同的 contract-test 目录。
  - **负责角色：** 与 3.1 使用同一 Task worktree 的 Pi Runtime contract subagent。
  - **必需测试：** Story TC-C2；missing event timeout、revision regression、duplicate/late event、branch divergence、restart replay、compaction comparison。
  - **完成证据：** deterministic test output、pre/post snapshot hashes、cleanup confirmation 和 Task branch commit。
  - **执行方式：** 3.1 后串行执行。

- [ ] 3.3 创建隔离 Task branch/worktree，实现 Electron 开发态与 Windows/macOS package module-resolution smoke verification。
  - **依赖：** 2.1，以及 2.2 识别出的 public entry points。
  - **写入范围：** `packages/desktop/scripts/verify-pi-task-runtime-package.*`、相邻 script tests/fixtures，以及运行该 script 所需的特定 `.github/workflows/` release verification steps。
  - **负责角色：** Electron packaging subagent。
  - **必需测试：** Story TC-C3；development CJS/ESM load、ASAR/unpacked resolution、transitive dependency checks、Windows x64 和 macOS x64/arm64 smoke。
  - **完成证据：** Task branch commit、local script tests、Windows CI artifact/log、macOS CI artifact/log 和 resolved module inventory。
  - **执行方式：** 2.2 后可与 3.1、3.2 并行。

## 4. 边界决策与集成

- [ ] 4.1 把 dependency、runtime-contract 和 packaging Task branches 合并到 Proposal integration branch，不得通过 squash 丢失 Task evidence。
  - **依赖：** 2.2、3.2 和 3.3。
  - **写入范围：** Proposal integration branch merge commits，以及仅限已完成工作包 owner files 的 conflict resolution。
  - **负责角色：** Proposal integration owner。
  - **必需测试：** frozen install、package audit、runtime contract suite、packaging script tests 和 architecture guard。
  - **完成证据：** merge commit SHAs、conflict-resolution notes 和 combined test output。
  - **执行方式：** 串行集成。

- [ ] 4.2 编写 A-01 ADR，并选择 public host invocation、upstream command API 或 controlled fork；没有可维护方案时把门禁标记为失败。
  - **依赖：** 4.1。
  - **写入范围：** 仅限 `docs/architecture/decisions/` 和 Proposal evidence references。
  - **负责角色：** Proposal integration owner 与 architecture review subagent。
  - **必需测试：** 对照 capability spec 检查 ADR 完整性；执行 forbidden-private-boundary scan。
  - **完成证据：** 包含 versions、selected boundary、evidence links、limitations、ownership、migration 和 rollback 的 ADR。
  - **执行方式：** 串行决策点。

## 5. 回归与 Story 验证

- [ ] 5.1 运行 OriginOS Agent/RoleAgent regression suite，验证 A-01 未引入产品 Task Runtime、UI、IPC、persistence 或 chat behavior 变更。
  - **依赖：** 4.2，且边界决策通过。
  - **写入范围：** 只能由独立 regression subagent worktree 修改测试；不得削弱 acceptance。
  - **负责角色：** regression verification subagent。
  - **必需测试：** core unit/integration tests、Agent/RoleAgent session tests、Chat Completion Guard tests、Desktop development smoke、`pnpm lint` 和 `pnpm type-check`。
  - **完成证据：** 带 exit code 的 command matrix、regression report 和必要的隔离 fix commit。
  - **执行方式：** 集成后串行执行。

- [ ] 5.2 创建并执行自动化 verification Goal：“通过 Story 9.41 testing.md 中 A-01 定义的 TC-C1、TC-C2、TC-C3 测试 case”。
  - **依赖：** 5.1。
  - **写入范围：** Goal execution state 和 Proposal evidence references；应用修复必须创建新的隔离 subagent Task worktree。
  - **负责角色：** verification Goal runner。
  - **必需测试：** TC-C1、TC-C2、TC-C3，以及 `specs/pi-task-runtime-boundary/spec.md` 中的全部 capability scenarios。
  - **完成证据：** Goal completion record，把每个 test case 映射到 command、output hash、platform evidence、manual exception 和 residual risk。
  - **执行方式：** 串行验证门禁。

- [ ] 5.3 运行最终 OpenSpec strict validation 和 architecture compliance checks。
  - **依赖：** 5.2。
  - **写入范围：** 仅限 Proposal artifacts 和 evidence correction。
  - **负责角色：** Proposal integration owner。
  - **必需测试：** `openspec validate validate-pi-tasks-runtime-boundary --strict`、`pnpm agents:check` 和 architecture guard skill。
  - **完成证据：** 成功的 command output，且没有未解决 architecture violation。
  - **执行方式：** 串行最终门禁。

## 6. 合并与清理

- [ ] 6.1 使用获批 ADR 结果和 evidence links 更新 Story 9.41 A-01 status 与 Epic progress。
  - **依赖：** 5.3。
  - **写入范围：** `docs/specs/epic-9/story-9.41/`、`docs/specs/epic-9/README.md` 和 changelog files。
  - **负责角色：** documentation integration subagent。
  - **必需测试：** documentation placeholder/link checks 和 docs index validation。
  - **完成证据：** documentation commit 和已审查的 status diff。
  - **执行方式：** 串行。

- [ ] 6.2 把 Proposal integration branch 合并到 `dev`，验证 resulting commit，并在 retention check 后移除已完成的 Task worktrees/branches。
  - **依赖：** 6.1 和 explicit merge approval。
  - **写入范围：** 仅限 Git integration 和 worktree metadata。
  - **负责角色：** Proposal integration owner。
  - **必需测试：** 从 `dev` 运行 post-merge OpenSpec strict validation 和聚焦的 A-01 smoke suite。
  - **完成证据：** `dev` merge commit SHA、post-merge test output 和 `git worktree list` cleanup record。
  - **执行方式：** 最终串行任务。
