## 1. Approval And Runtime Prerequisite

- [ ] 1.1 Obtain explicit approval for Proposal `validate-pi-tasks-runtime-boundary` before any application source or dependency change.
  - **Dependencies:** proposal, design, and capability spec pass strict validation.
  - **Write scope:** Proposal artifacts only.
  - **Assigned role:** Proposal integration owner.
  - **Required tests:** `openspec validate validate-pi-tasks-runtime-boundary --strict`.
  - **Completion evidence:** recorded approval reference and clean strict-validation output.
  - **Execution:** sequential approval gate.

- [ ] 1.2 Rebase the Proposal branch onto the committed Pi Runtime upgrade and verify the exact runtime namespace/version from a clean checkout.
  - **Dependencies:** 1.1 and the separate Pi Runtime upgrade merged to `dev`.
  - **Write scope:** Proposal branch history and A-01 evidence notes only; no runtime upgrade source changes.
  - **Assigned role:** Proposal integration owner.
  - **Required tests:** clean install with the repository Node.js 24 and pnpm versions; package and lockfile consistency check.
  - **Completion evidence:** base commit SHA, resolved runtime package/version list, and clean install result.
  - **Execution:** sequential prerequisite.

## 2. Dependency And Public Export Audit

- [ ] 2.1 Create an isolated task branch/worktree, pin the candidate `pi-tasks` version, and lock its complete dependency graph.
  - **Dependencies:** 1.2.
  - **Write scope:** `package.json`, `pnpm-lock.yaml`, `packages/agent/package.json`, and package manifests that must declare a direct runtime dependency.
  - **Assigned role:** dependency audit subagent.
  - **Required tests:** frozen-lockfile install; duplicate/version inspection; package manager consistency check.
  - **Completion evidence:** task branch commit, lockfile diff, exact compatibility matrix, and install logs.
  - **Execution:** sequential foundation for 2.2, 3.1, and 3.2.

- [ ] 2.2 Audit public Pi Runtime and `pi-tasks` exports, tool registrations, schemas, state events, branch replay, and compaction hooks without importing private paths.
  - **Dependencies:** 2.1.
  - **Write scope:** `packages/agent/scripts/pi-task-runtime-audit.*`, adjacent audit tests/fixtures, and bounded machine-readable audit output schema.
  - **Assigned role:** dependency audit subagent in the same task worktree as 2.1.
  - **Required tests:** public-export resolution test; forbidden-private-import scan; audit output schema test.
  - **Completion evidence:** export inventory, selected candidate APIs, source references, report hash, and task branch commit.
  - **Execution:** sequential after 2.1; may run in parallel with package smoke preparation after its commit is merged.

## 3. Public Runtime Contract Verification

- [ ] 3.1 Create an isolated task branch/worktree and implement the same-Session, same-branch task tool invocation contract harness.
  - **Dependencies:** 2.1 and the public candidates identified by 2.2.
  - **Write scope:** `packages/core/src/lib/integrations/pi-agent/__tests__/pi-task-runtime-boundary/**` and test-only fixtures/config required by that directory.
  - **Assigned role:** Pi Runtime contract subagent.
  - **Required tests:** Story TC-C1; valid and invalid `task_plan`, `task_update`, `task_evidence`, `task_resume`, and `task_complete`; Session/branch/schema/permission assertions.
  - **Completion evidence:** task branch commit, test output, invocation/event correlation records, and forbidden-boundary scan.
  - **Execution:** parallelizable with 3.3 after 2.2.

- [ ] 3.2 Extend the contract harness with revision correlation, current-branch replay, branch isolation, process restart, and compaction preservation.
  - **Dependencies:** 3.1.
  - **Write scope:** the same contract-test directory owned by 3.1.
  - **Assigned role:** Pi Runtime contract subagent in the same task worktree as 3.1.
  - **Required tests:** Story TC-C2; missing event timeout; revision regression; duplicate/late event; branch divergence; restart replay; compaction comparison.
  - **Completion evidence:** deterministic test output, pre/post snapshot hashes, cleanup confirmation, and task branch commit.
  - **Execution:** sequential after 3.1.

- [ ] 3.3 Create an isolated task branch/worktree and implement Electron development plus packaged Windows/macOS module-resolution smoke verification.
  - **Dependencies:** 2.1 and the public entry points identified by 2.2.
  - **Write scope:** `packages/desktop/scripts/verify-pi-task-runtime-package.*`, adjacent script tests/fixtures, and the specific `.github/workflows/` release verification steps needed to run the script.
  - **Assigned role:** Electron packaging subagent.
  - **Required tests:** Story TC-C3; development CJS/ESM load; ASAR/unpacked resolution; transitive dependency checks; Windows x64 and macOS x64/arm64 smoke.
  - **Completion evidence:** task branch commit, local script tests, Windows CI artifact/log, macOS CI artifact/log, and resolved module inventory.
  - **Execution:** parallelizable with 3.1 and 3.2 after 2.2.

## 4. Boundary Decision And Integration

- [ ] 4.1 Merge the dependency, runtime-contract, and packaging task branches into the Proposal integration branch without squashing away task evidence.
  - **Dependencies:** 2.2, 3.2, and 3.3.
  - **Write scope:** Proposal integration branch merge commits and conflict resolutions limited to files owned by the completed work packages.
  - **Assigned role:** Proposal integration owner.
  - **Required tests:** frozen install, package audit, runtime contract suite, packaging script tests, and architecture guard.
  - **Completion evidence:** merge commit SHAs, conflict-resolution notes, and combined test output.
  - **Execution:** sequential integration.

- [ ] 4.2 Write the A-01 ADR and select public host invocation, an upstream command API, or a controlled fork; mark the gate failed when none is maintainable.
  - **Dependencies:** 4.1.
  - **Write scope:** `docs/architecture/decisions/` and Proposal evidence references only.
  - **Assigned role:** Proposal integration owner with architecture review subagent.
  - **Required tests:** ADR completeness check against the capability spec; forbidden-private-boundary scan.
  - **Completion evidence:** ADR containing versions, selected boundary, evidence links, limitations, ownership, migration, and rollback.
  - **Execution:** sequential decision point.

## 5. Regression And Story Verification

- [ ] 5.1 Run the OriginOS Agent/RoleAgent regression suite and verify that A-01 introduces no product Task Runtime, UI, IPC, persistence, or chat behavior changes.
  - **Dependencies:** 4.2 with a passing boundary decision.
  - **Write scope:** test fixes only through a dedicated regression subagent worktree; no acceptance weakening.
  - **Assigned role:** regression verification subagent.
  - **Required tests:** core unit/integration tests, Agent/RoleAgent session tests, Chat Completion Guard tests, Desktop development smoke, `pnpm lint`, and `pnpm type-check`.
  - **Completion evidence:** command matrix with exit codes, regression report, and any isolated fix commit.
  - **Execution:** sequential after integration.

- [ ] 5.2 Create and execute the automated verification Goal: “通过 Story 9.41 testing.md 中 A-01 定义的 TC-C1、TC-C2、TC-C3 测试 case”.
  - **Dependencies:** 5.1.
  - **Write scope:** Goal execution state and Proposal evidence references; application fixes require a new isolated subagent task worktree.
  - **Assigned role:** verification Goal runner.
  - **Required tests:** TC-C1, TC-C2, TC-C3 and all capability scenarios in `specs/pi-task-runtime-boundary/spec.md`.
  - **Completion evidence:** Goal completion record mapping every test case to command, output hash, platform evidence, manual exception, and residual risk.
  - **Execution:** sequential verification gate.

- [ ] 5.3 Run final strict OpenSpec validation and architecture compliance checks.
  - **Dependencies:** 5.2.
  - **Write scope:** Proposal artifacts and evidence corrections only.
  - **Assigned role:** Proposal integration owner.
  - **Required tests:** `openspec validate validate-pi-tasks-runtime-boundary --strict`, `pnpm agents:check`, and the architecture guard skill.
  - **Completion evidence:** successful command output and zero unresolved architecture violations.
  - **Execution:** sequential final gate.

## 6. Merge And Cleanup

- [ ] 6.1 Update Story 9.41 A-01 status and Epic progress with the approved ADR outcome and evidence links.
  - **Dependencies:** 5.3.
  - **Write scope:** `docs/specs/epic-9/story-9.41/`, `docs/specs/epic-9/README.md`, and changelog files.
  - **Assigned role:** documentation integration subagent.
  - **Required tests:** documentation placeholder/link checks and docs index validation.
  - **Completion evidence:** documentation commit and reviewed status diff.
  - **Execution:** sequential.

- [ ] 6.2 Merge the Proposal integration branch into `dev`, verify the resulting commit, and remove completed task worktrees/branches after retention checks.
  - **Dependencies:** 6.1 and explicit merge approval.
  - **Write scope:** Git integration and worktree metadata only.
  - **Assigned role:** Proposal integration owner.
  - **Required tests:** post-merge strict OpenSpec validation and focused A-01 smoke suite from `dev`.
  - **Completion evidence:** `dev` merge commit SHA, post-merge test output, and `git worktree list` cleanup record.
  - **Execution:** final sequential task.
