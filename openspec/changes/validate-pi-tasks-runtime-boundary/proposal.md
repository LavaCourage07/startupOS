## Traceability

- **epic-id:** 9
- **story-id:** 9.41
- **task-id:** A-01
- **owner:** Agent Runtime
- **source Story documents:**
  - `docs/specs/epic-9/story-9.41/README.md`
  - `docs/specs/epic-9/story-9.41/requirements.md`
  - `docs/specs/epic-9/story-9.41/architecture.md`
  - `docs/specs/epic-9/story-9.41/implementation.md`
  - `docs/specs/epic-9/story-9.41/testing.md`

## Why

Story 9.41 cannot safely enter product implementation until OriginOS proves that a locked `pi-tasks` release can be driven through supported Pi extension APIs in the current Session and branch. The committed `dev` baseline still uses deprecated Pi `0.55.3` packages, so the runtime version, task extension version, state replay contract, and Electron packaging behavior must be made explicit before task UI or execution control code depends on them.

## What Changes

- Establish and validate a compatibility matrix for the Pi Runtime and `pi-tasks`, including the complete dependency tree and the exact versions that Story 9.41 may consume.
- Add a contract-level spike and automated harness that proves host-triggered task tool calls use the same Session, branch, schema validation, permission checks, custom entry path, and public state event path as model-triggered calls.
- Verify public current-branch replay and compaction behavior for Task, Step, Criterion, Evidence, Blocker, status, and monotonically advancing state revision.
- Verify Electron development loading and packaged Windows/macOS CJS/ESM resolution for the selected packages.
- Produce an ADR that selects one supported command boundary:
  - direct host invocation through a public Pi extension tool execution API;
  - an upstream public `pi-tasks` command API; or
  - a versioned, controlled fork when neither public boundary exists.
- Fail the gate and stop Story 9.41 product implementation when no maintainable public boundary can be proven.
- Explicitly prohibit importing private `pi-tasks` reducers/stores, parsing or modifying Pi Session files, forging custom entries, or copying the `pi-tasks` state machine into OriginOS.

## Capabilities

### New Capabilities

- `pi-task-runtime-boundary`: Defines the compatibility, invocation, state replay, failure, compaction, and Electron packaging contract required before OriginOS can integrate `pi-tasks`.

### Modified Capabilities

None.

## Non-Goals

- Implementing the Agent/RoleAgent task composer, task card, IPC surface, execution lease, continuation controller, Evidence verifier, or recovery UI.
- Creating a production Task Runtime adapter before the selected boundary is approved.
- Adding Workflow, DAG, Worker, sub-Agent, multi-Agent execution, or a second Goal/Task state machine.
- Migrating existing chat sessions or enabling Task Runtime for ordinary chat.
- Publishing a desktop release.

## Impact

- **Packages:** the investigation and contract harness may touch `packages/agent/`, public Pi integration test seams under `packages/core/src/lib/integrations/pi-agent/`, and package verification scripts under `packages/desktop/scripts/`. Product feature and Web UI packages remain unchanged.
- **Public APIs:** no OriginOS product API is introduced. The ADR will define the approved internal `PiTaskCommandGateway` and state subscription boundary for later proposals.
- **Persistence:** no OriginOS task persistence schema is introduced. Tests may create isolated temporary Pi Sessions and must delete them after validation.
- **IPC:** no product IPC channel is introduced.
- **Dependencies:** execution depends on the Pi Runtime upgrade being merged into `dev` and version-locked before the compatibility matrix is finalized. `pi-tasks` and transitive dependencies must be frozen in `pnpm-lock.yaml` by an isolated implementation task.
- **Platform packaging:** Electron development, Windows package, and macOS package resolution are mandatory gate evidence; code signing and release publication are outside this proposal.

## Rollout

1. Audit the selected Pi Runtime and candidate `pi-tasks` public surfaces.
2. Run the same-session invocation, state event, replay, compaction, and packaging contract suites.
3. Record the selected boundary and compatibility matrix in the ADR.
4. Mark A-01 passed only when all P0 contract cases and platform loading checks have evidence.
5. Allow subsequent Story 9.41 proposals to depend only on the approved public boundary.

## Rollback

- Remove the candidate dependency and contract spike if the gate fails.
- Restore the pre-proposal lockfile and package manifests without changing product behavior.
- Keep Story 9.41 behind the A-01 gate and document the failed boundary plus the next approved route.
- If a later upstream version invalidates the selected contract, disable Task Runtime integration and rerun A-01 before adopting the new version.
