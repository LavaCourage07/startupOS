## ADDED Requirements

### Requirement: Locked runtime compatibility
OriginOS MUST validate Story 9.41 against exact, committed versions of the Pi Runtime, `pi-tasks`, and their complete dependency graph. The gate MUST fail when the committed Pi Runtime prerequisite is absent, deprecated relative to the approved baseline, or incompatible with the selected `pi-tasks` release.

#### Scenario: Compatible versions are reproducible
- **WHEN** the A-01 compatibility suite runs from a clean checkout
- **THEN** it resolves the exact approved Pi Runtime and `pi-tasks` versions from the lockfile and produces the same public export and dependency inventory

#### Scenario: Runtime prerequisite is missing
- **WHEN** the Proposal branch does not contain the approved Pi Runtime upgrade
- **THEN** the gate fails with a prerequisite error and does not install or substitute an unrelated runtime version

#### Scenario: Unknown compatibility is rejected
- **WHEN** the runtime or extension version differs from the approved compatibility matrix
- **THEN** Task Runtime integration remains disabled until A-01 is rerun for that version pair

### Requirement: Supported task mutation boundary
OriginOS MUST mutate `pi-tasks` state only through a documented public command boundary that preserves Pi Session identity, current branch identity, tool schema validation, permissions, and custom entry semantics.

#### Scenario: Host invokes a registered task tool
- **WHEN** the contract harness invokes `task_plan` through the approved public boundary for an isolated Pi Session and branch
- **THEN** the call uses the registered tool schema and permission path and writes state only to that Session and branch

#### Scenario: Invalid tool arguments are rejected
- **WHEN** the host invokes a task tool with arguments that violate its public schema
- **THEN** the invocation returns a structured validation failure and no Task state revision is created

#### Scenario: No supported public mutation boundary exists
- **WHEN** neither public host tool invocation nor a public `pi-tasks` command API can preserve the required execution context
- **THEN** A-01 fails and product implementation stops until an upstream API or controlled fork is explicitly approved

#### Scenario: Private state access is detected
- **WHEN** source or dependency checks find an import of a private `pi-tasks` reducer/store, Pi Session file parsing, or custom entry forgery
- **THEN** strict validation fails regardless of functional test results

### Requirement: Mutation and public state event correlation
Every successful task mutation MUST be confirmed by a public `pi-tasks` state event for the same Session, branch, and Task with a monotonically later revision. A tool result without a matching event MUST NOT be treated as committed state.

#### Scenario: Mutation produces a matching snapshot
- **WHEN** `task_update` succeeds for the current Task
- **THEN** the harness observes a matching public state event with the same Session, branch, and Task and a revision greater than the pre-mutation revision

#### Scenario: State event is missing
- **WHEN** a task tool returns success but no matching state event arrives before the bounded timeout
- **THEN** the mutation is classified as unconfirmed and the gate fails

#### Scenario: Revision regresses
- **WHEN** a state event for the active scope has a revision older than the latest accepted revision
- **THEN** the event is ignored for state advancement and a contract violation is recorded

### Requirement: Evidence-gated completion contract
The approved boundary MUST preserve `pi-tasks` completion semantics so that incomplete steps, missing or invalid Criterion Evidence, and unresolved Blockers prevent completion. OriginOS MUST NOT expose or validate a force-completion path.

#### Scenario: Completion is rejected without evidence
- **WHEN** `task_complete` is invoked while a required Criterion lacks valid Evidence
- **THEN** the public tool rejects completion with a structured reason and the Task remains non-terminal

#### Scenario: Completion succeeds after evidence
- **WHEN** all required Steps are complete, all Criteria have accepted Evidence, and no unresolved Blocker remains
- **THEN** `task_complete` transitions the Task exactly once to its public completed state

#### Scenario: Force completion is requested
- **WHEN** a caller attempts to pass an undocumented force flag or bypass the registered completion tool
- **THEN** the command is rejected and no completed state is written

### Requirement: Current-branch replay and isolation
The integration MUST reconstruct canonical Task state from public current-branch replay and MUST preserve branch isolation. Process-local caches MUST NOT be treated as canonical.

#### Scenario: State is replayed after restart
- **WHEN** the harness process exits after task mutations and restarts against the same Pi Session and branch
- **THEN** replay reconstructs the same Task, Steps, Criteria, Evidence, Blockers, status, and latest revision without a cache

#### Scenario: Branches diverge
- **WHEN** a Pi Session creates two branches and only one branch mutates the Task
- **THEN** replay of the other branch does not include the mutation

#### Scenario: Wrong branch mutation is attempted
- **WHEN** a command scope does not match the Task's current branch
- **THEN** the command is rejected or isolated by the public runtime and cannot alter the original branch state

### Requirement: Compaction preservation
The locked Pi Runtime and `pi-tasks` combination MUST preserve the canonical Task contract across the supported public compaction lifecycle.

#### Scenario: Task survives compaction
- **WHEN** a Session containing a non-terminal Task is compacted through the supported lifecycle and replayed
- **THEN** Task identity, Step state, Criteria, Evidence, Blockers, status, branch identity, and revision continuity remain equivalent

#### Scenario: Compaction behavior cannot be reproduced
- **WHEN** no supported deterministic lifecycle can demonstrate Task preservation
- **THEN** A-01 remains failed and the limitation is recorded in the ADR

### Requirement: Electron module loading
The selected dependency graph MUST load through supported exports in Electron development and in packaged Windows and macOS applications. Verification MUST cover CJS/ESM resolution, transitive runtime dependencies, and ASAR placement.

#### Scenario: Development runtime loads task packages
- **WHEN** the Electron development main process loads the approved public runtime and task extension exports
- **THEN** all runtime imports resolve without private paths, dynamic dependency warnings that affect execution, or missing modules

#### Scenario: Windows package resolves dependencies
- **WHEN** the Windows package verification script inspects and smoke-loads the packaged application
- **THEN** the Pi Runtime, `pi-tasks`, and every required transitive runtime dependency resolve from the packaged layout

#### Scenario: macOS package resolves dependencies
- **WHEN** the macOS package verification job inspects and smoke-loads both supported architectures
- **THEN** the Pi Runtime, `pi-tasks`, and every required transitive runtime dependency resolve from the packaged layout

#### Scenario: Packaged module is missing
- **WHEN** a required export or transitive module is absent from a package
- **THEN** A-01 fails with the module, platform, architecture, and resolution path identified

### Requirement: Bounded and safe contract diagnostics
The contract harness MUST use bounded waits and bounded redacted diagnostics. It MUST clean up subscriptions and temporary Sessions after execution and MUST NOT record credentials, prompts, task content, user home paths, or complete tool output.

#### Scenario: Event wait times out
- **WHEN** a required public event does not arrive within the configured timeout
- **THEN** the harness terminates the wait, removes its subscription, reports a redacted timeout, and exits non-zero

#### Scenario: Diagnostic evidence is published
- **WHEN** a contract or packaging check completes
- **THEN** its report contains version, capability, platform, result, revision metadata, and hashes within configured size limits without sensitive content

### Requirement: Explicit gate decision
A-01 MUST produce an ADR that records the selected public command boundary, exact compatibility matrix, evidence links, limitations, migration policy, rollback policy, and ownership. Story 9.41 product implementation MUST NOT begin until strict validation passes and the Proposal is explicitly approved.

#### Scenario: Gate passes
- **WHEN** all mandatory contract, replay, compaction, and platform checks pass and the ADR selects a maintainable boundary
- **THEN** A-01 is marked passed and downstream Story 9.41 Proposals may depend on that boundary

#### Scenario: Gate fails
- **WHEN** any P0 contract fails or the ADR cannot select a maintainable public boundary
- **THEN** A-01 is marked failed, the candidate dependency can be rolled back, and downstream product implementation remains blocked
