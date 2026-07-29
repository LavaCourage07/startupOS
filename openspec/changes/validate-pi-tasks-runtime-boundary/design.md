## Context

Story 9.41 requires `pi-tasks` to be the sole authority for Task, Step, Criterion, Evidence, Blocker, and completion state. OriginOS therefore needs a supported write boundary for task tools and a public read boundary for current-branch state before it can implement task planning, continuation, UI projection, or persistence.

The committed `dev` baseline still resolves deprecated `@mariozechner/pi-agent-core` and `@mariozechner/pi-ai` version `0.55.3`. A separate Pi Runtime upgrade is expected to land first. A-01 validates the version that is actually committed to `dev`; it does not infer compatibility from an uncommitted workspace or from package names alone.

The affected stakeholders are Agent Runtime maintainers, Electron packaging maintainers, Story 9.41 implementers, and QA. This proposal is a compatibility and architectural gate. It does not expose a product Task API.

### Architecture constraints

- Integration code remains under `packages/core/src/lib/integrations/pi-agent/` and cannot depend on core features, Web, or Desktop.
- Desktop verification scripts may depend on public package exports and built application artifacts, but business logic cannot move into Desktop.
- Generated `.next`, `dist-electron`, `node_modules`, release artifacts, and runtime data are evidence inputs only, never source edit targets.
- `pi-tasks` private reducers, stores, Session files, and custom entry encodings are outside the allowed boundary.
- All source implementation is delegated to isolated task worktrees. The Proposal worktree owns planning, integration, ADR consolidation, and validation.

## Goals / Non-Goals

**Goals:**

- Lock one compatible Pi Runtime and `pi-tasks` dependency graph.
- Prove that the host can invoke the required registered task tools in the same Pi Session and branch through a supported public boundary.
- Prove that mutations pass public schema validation and permissions and become observable through the public state event with a new revision.
- Prove current-branch replay, branch isolation, and compaction preservation.
- Prove Electron development, Windows package, and macOS package module resolution.
- Select and document the maintainable command boundary for subsequent Story 9.41 proposals.
- Produce repeatable automated evidence rather than a manual source inspection only.

**Non-Goals:**

- Product task UI, IPC, persistence, execution leases, completion policy routing, continuation, or evidence verification.
- Multi-Agent, Workflow, Worker, DAG, or Goal mode integration.
- A second task state machine or compatibility shim around private `pi-tasks` internals.
- Desktop signing, notarization, release upload, or publication.
- Supporting multiple Pi Runtime or `pi-tasks` versions simultaneously.

## Decisions

### 1. Validate the committed Pi Runtime baseline

A-01 SHALL run against an exact Pi Runtime version already committed to the Proposal branch. If the prerequisite Pi upgrade has not landed, implementation stops after recording the mismatch; it does not modify A-01 to silently absorb an unrelated runtime upgrade.

**Rationale:** compatibility evidence tied to a dirty or transitional workspace cannot be reproduced by CI or another worktree.

**Alternative considered:** combine the Pi Runtime upgrade and `pi-tasks` validation in one Proposal. Rejected because they are independently reviewable changes with different rollback boundaries.

### 2. Public extension execution is the preferred command path

The preferred path is a public Pi Runtime API that invokes a registered extension tool with the same Session, branch, schema validation, permissions, and custom entry behavior as an Agent-originated tool call.

The boundary selected by the ADR MUST be one of:

1. supported host invocation of registered extension tools;
2. an upstream public `pi-tasks` command API;
3. a controlled fork with a narrow, versioned public command API.

The third option requires ownership, upstream sync, compatibility, and removal criteria in the ADR.

**Alternatives considered:**

- Importing a private reducer/store: rejected because package upgrades can silently corrupt task semantics.
- Parsing or modifying Session files: rejected because it bypasses Pi branch ownership, validation, events, and compaction.
- Forging custom entries: rejected because OriginOS would become a second writer of undocumented state.
- Copying the state machine: rejected because it creates a second canonical Task model.

### 3. Public state events and branch replay are the read authority

The harness consumes the extension's public state event for live snapshots and reconstructs state from the current Pi branch using public replay/session APIs. Each snapshot must identify its Session, branch, Task, schema version, and revision.

Mutation success requires both a successful tool result and a matching state event with a later revision. A process-local cache can coordinate tests but is never canonical and must be reconstructible after restart.

### 4. Contract harness instead of product adapter

A-01 introduces only:

- version and export audits;
- an executable contract harness;
- fixtures needed to create isolated test Sessions;
- Electron package resolution smoke checks;
- an ADR and machine-readable compatibility report.

The harness may define minimal test-only types resembling the future `PiTaskCommandGateway`, but production services, feature state, IPC, and renderer code remain outside this Proposal.

**Rationale:** a failed gate must be removable without leaving a partially implemented Task Runtime in the product.

### 5. Required contract sequence

The same isolated Pi Session and branch executes:

1. `task_plan`;
2. at least one step mutation through `task_update`;
3. Evidence registration through `task_evidence`;
4. pause/block and recovery when the selected version exposes the corresponding public tool contract;
5. `task_resume`;
6. rejected `task_complete` with insufficient evidence;
7. accepted `task_complete` after valid evidence.

Every mutation captures tool name, redacted arguments, result classification, pre/post revision, Session identity, branch identity, and state event correlation. The harness MUST also attempt invalid schema input, stale or wrong branch input where supported, duplicate replay, and process restart.

### 6. Compaction and branch behavior are tested as invariants

The harness creates a branch divergence and proves that Task state from one branch does not leak to another. It triggers or simulates the public compaction lifecycle supported by the locked Pi Runtime and compares canonical Task fields before and after replay.

If the runtime does not expose a deterministic compaction trigger, the ADR records the limitation and the test uses the closest supported lifecycle hook. P0 replay and branch isolation cannot be waived.

### 7. Packaging validation uses source-driven verification scripts

Electron development smoke runs under Node.js 24 and the repository package manager. Windows and macOS checks build or inspect platform artifacts using repository scripts and verify that every runtime import is resolvable from the packaged application.

Package checks MUST cover CJS/ESM entry points, transitive dependencies, ASAR/unpacked placement, and dynamic import behavior. Platform execution that cannot run locally is delegated to CI, and its artifact/log evidence is attached before A-01 passes.

### 8. Data ownership and persistence

`pi-tasks` owns all Task state in Pi Session custom entries. A-01 writes no OriginOS production persistence. Test Sessions and compatibility reports live under temporary test directories or tracked documentation locations, respectively.

The compatibility report contains versions, export names, capability results, and hashes only. It MUST NOT contain prompts, task content, credentials, home paths, or complete tool output.

### 9. Concurrency, recovery, performance, and security

- Tests isolate Session and branch identifiers and reject cross-test reuse.
- Correlation waits are bounded by explicit timeouts and clean up subscriptions in `finally`.
- A crashed harness can restart and replay the same branch without forging state.
- Event payload logging is bounded and redacted.
- No synchronous filesystem/network work is added to Electron production paths.
- Dependency installation scripts and package exports are reviewed before execution.
- The harness fails closed on unknown schema versions, missing public exports, revision regression, or ambiguous branch identity.

### 10. Subagent implementation seams

Application source and test changes use non-overlapping worktrees:

| Work package | Write scope | Integration contract |
|---|---|---|
| Runtime/dependency audit | package manifests, lockfile, compatibility audit script/report | exact version matrix and public export inventory |
| Pi task contract harness | test-only Pi integration harness and fixtures | machine-readable pass/fail results keyed by Session/branch/revision |
| Electron packaging smoke | Desktop verification scripts and package tests | platform resolution report using locked dependency graph |
| ADR/integration | Proposal artifacts and ADR only in Proposal worktree | consumes all three evidence outputs; no product source |

The first three can run in parallel after the Pi Runtime prerequisite is present. The Proposal integration owner merges each task branch, resolves conflicts without rewriting task evidence, runs the full suite, and updates the ADR.

## Risks / Trade-offs

- **The selected Pi Runtime has no public host tool invocation API** → Stop product implementation and evaluate an upstream API or controlled fork; never fall back to private state access.
- **The Pi Runtime upgrade is not committed before A-01 starts** → Keep A-01 blocked and preserve the compatibility proposal without modifying unrelated runtime dependencies.
- **`pi-tasks` changes public event or schema behavior between releases** → Pin exact versions and lockfile, record export/schema fingerprints, and rerun A-01 for upgrades.
- **A controlled fork creates maintenance burden** → Require an owner, upstream sync cadence, compatibility suite, and removal trigger in the ADR.
- **macOS package execution is unavailable in the local Windows/WSL environment** → Run the same smoke contract in GitHub Actions macOS runners and retain CI evidence.
- **A test-only harness diverges from future production calls** → Define its command/state interfaces from public APIs and require later adapters to reuse the same contract tests.
- **Compaction is nondeterministic** → Use public lifecycle hooks and fail the gate when state preservation cannot be demonstrated reproducibly.

## Migration Plan

1. Merge the prerequisite Pi Runtime upgrade to `dev` and rebase this Proposal branch.
2. Pin the candidate `pi-tasks` version and generate the complete lockfile dependency graph in an isolated task worktree.
3. Run runtime, replay/compaction, and Electron packaging work packages.
4. Merge evidence into the Proposal branch and select the command boundary in the ADR.
5. Run Story 9.41 A-01 contract cases and strict OpenSpec validation.
6. Mark A-01 passed and allow downstream Story 9.41 Proposals only when all mandatory evidence exists.

Rollback removes the candidate dependency, harness, and verification scripts through the Proposal merge commit. Since no product API or persistence is introduced, ordinary chat and Agent runtime behavior remain unchanged.

## Open Questions

- Which exact Pi Runtime upgrade commit and package namespace will be the committed prerequisite for A-01?
- Does that runtime publicly expose host invocation of extension-registered tools with the original Session/branch execution context?
- Which `pi-tasks` release is compatible with that runtime's extension, event, and compaction APIs?
- Can the selected public API expose a stable state revision, or must the controlled public adapter derive one from an upstream event sequence?
- Is a deterministic public compaction trigger available for contract tests on all supported platforms?
