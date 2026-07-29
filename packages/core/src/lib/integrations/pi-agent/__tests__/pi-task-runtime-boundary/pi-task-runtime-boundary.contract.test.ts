import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  boundedContractResult,
  getTaskCount,
  inspectForceCompletion,
  inspectRevision,
  inspectRuntimeBoundary,
  PublicPiTasksHarness,
  VALID_TASK_BLOCKER,
  VALID_TASK_EVIDENCE,
  VALID_TASK_PLAN,
  type PublicBranchEntry,
} from './public-extension-harness';

describe('pi-tasks@0.2.0 public runtime boundary', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports unsupported host mutation and force completion boundaries', async () => {
    const harness = await PublicPiTasksHarness.create();
    const runtime = await inspectRuntimeBoundary();
    const taskComplete = harness.tools.get('task_complete');
    const taskPlan = harness.tools.get('task_plan');

    expect(taskComplete).toBeDefined();
    expect(taskPlan).toBeDefined();

    const forceCompletion = inspectForceCompletion(taskComplete!);
    const beforeToolCall = vi.fn();
    const afterToolCall = vi.fn();
    const diagnostic = await harness.diagnosticRawExecute(
      'task_plan',
      VALID_TASK_PLAN,
      { beforeToolCall, afterToolCall },
    );

    expect(diagnostic.result.isError).not.toBe(true);
    expect(diagnostic.standardHooksObserved).toBe(false);
    expect(beforeToolCall).not.toHaveBeenCalled();
    expect(afterToolCall).not.toHaveBeenCalled();
    expect(runtime.hostInvocation.status).toBe('unsupported');
    expect(forceCompletion).toEqual({
      status: 'unsupported',
      reason:
        'Stock task_complete exposes force_with_reason, which Story 9.41 first release forbids.',
    });

    const result = boundedContractResult({
      schemaVersion: 1,
      stockBoundary: 'unsupported',
      capabilities: {
        forceCompletion,
        hostInvocation: runtime.hostInvocation,
        rawToolExecute: {
          status: 'diagnostic_only',
          reason:
            'Raw tool.execute did not invoke standard host before/after tool lifecycle hooks.',
        },
      },
    });

    expect(JSON.parse(result)).toMatchObject({
      stockBoundary: 'unsupported',
      capabilities: {
        forceCompletion: { status: 'unsupported' },
        hostInvocation: { status: 'unsupported' },
      },
    });
    expect(result).not.toMatch(/api[_-]?key|authorization|bearer|prompt/i);
  });

  it('publishes public state and replays only the current branch', async () => {
    const source = await PublicPiTasksHarness.create();
    await source.diagnosticRawExecute('task_plan', VALID_TASK_PLAN, {
      beforeToolCall: () => undefined,
      afterToolCall: () => undefined,
    });
    const branchA = source.getBranch();
    const sourceState = source.latestStateEvent('task_mutation');

    expect(source.extensionModule.TASK_STATE_EVENT).toBe('pi-tasks:state');
    expect(sourceState?.payload.version).toBe(1);
    expect(getTaskCount(sourceState)).toBe(1);

    const replay = await PublicPiTasksHarness.create(branchA);
    await replay.emitLifecycle('session_start');
    const replayedState = replay.latestStateEvent('session_start');

    expect(getTaskCount(replayedState)).toBe(1);
    expect(replayedState?.payload.state).toEqual(sourceState?.payload.state);

    replay.setBranch([]);
    await replay.emitLifecycle('session_tree');
    expect(getTaskCount(replay.latestStateEvent('session_tree'))).toBe(0);

    replay.setBranch(branchA);
    await replay.emitLifecycle('session_tree');
    expect(getTaskCount(replay.latestStateEvent('session_tree'))).toBe(1);
  });

  it('preserves snapshot state across repeatable compaction lifecycle triggers', async () => {
    const source = await PublicPiTasksHarness.create();
    const diagnosticHooks = {
      beforeToolCall: () => undefined,
      afterToolCall: () => undefined,
    };
    const plan = await source.diagnosticRawExecute(
      'task_plan',
      VALID_TASK_PLAN,
      diagnosticHooks,
    );
    const evidence = await source.diagnosticRawExecute(
      'task_evidence',
      VALID_TASK_EVIDENCE,
      diagnosticHooks,
    );
    const blocker = await source.diagnosticRawExecute(
      'task_update',
      VALID_TASK_BLOCKER,
      diagnosticHooks,
    );
    expect(plan.result.isError).not.toBe(true);
    expect(evidence.result.isError).not.toBe(true);
    expect(blocker.result.isError).not.toBe(true);

    const stateBeforeCompaction = source.latestStateEvent('task_mutation');
    const taskBeforeCompaction = stateBeforeCompaction?.payload.state?.tasks as
      | Record<string, Record<string, unknown>>
      | undefined;
    expect(taskBeforeCompaction?.T1.planSteps).toHaveLength(1);
    expect(taskBeforeCompaction?.T1.acceptanceCriteria).toHaveLength(1);
    expect(taskBeforeCompaction?.T1.evidence).toHaveLength(1);
    expect(taskBeforeCompaction?.T1.blockers).toHaveLength(1);

    await source.emitLifecycle('session_before_compact');
    await new Promise((resolve) => setTimeout(resolve, 2));
    await source.emitLifecycle('session_before_compact');

    const snapshotEntries = source.entries.filter(
      (entry) =>
        entry.customType === 'pi-tasks:event'
        && typeof entry.data === 'object'
        && entry.data !== null
        && 'type' in entry.data
        && entry.data.type === 'task.snapshot',
    );
    expect(snapshotEntries).toHaveLength(2);

    const originalEntries = source.getBranch().filter(
      (entry) => !snapshotEntries.includes(entry),
    );
    const normalReplay = await PublicPiTasksHarness.create(source.getBranch());
    await normalReplay.emitLifecycle('session_start');
    expect(normalReplay.latestStateEvent('session_start')?.payload.state?.tasks).toEqual(
      stateBeforeCompaction?.payload.state?.tasks,
    );

    const duplicateAndOutOfOrder: PublicBranchEntry[] = [
      snapshotEntries[1],
      snapshotEntries[0],
      snapshotEntries[1],
      ...originalEntries,
    ];
    const replay = await PublicPiTasksHarness.create(duplicateAndOutOfOrder);

    await replay.emitLifecycle('session_start');

    const state = replay.latestStateEvent('session_start');
    expect(getTaskCount(state)).toBe(1);
    const replayedTasks = state?.payload.state?.tasks as
      | Record<string, Record<string, unknown>>
      | undefined;
    expect(replayedTasks?.T1.evidence).toHaveLength(1);
    expect(replayedTasks?.T1.blockers).toHaveLength(2);

    const replayIdempotency = boundedContractResult({
      schemaVersion: 1,
      capability: {
        status: 'unsupported',
        reason:
          'Duplicate out-of-order snapshots replay the same blocker more than once.',
      },
    });
    expect(JSON.parse(replayIdempotency)).toMatchObject({
      capability: { status: 'unsupported' },
    });

    const runtime = await inspectRuntimeBoundary();
    expect(runtime.compactionTrigger.status).toBe('supported');
    expect(replay.lifecycle.has('session_before_compact')).toBe(true);
  });

  it('fails stable revision and restart correlation contracts structurally', async () => {
    const firstProcess = await PublicPiTasksHarness.create();
    await firstProcess.diagnosticRawExecute('task_plan', VALID_TASK_PLAN, {
      beforeToolCall: () => undefined,
      afterToolCall: () => undefined,
    });
    const firstEvent = firstProcess.latestStateEvent('task_mutation');
    expect(firstEvent).toBeDefined();

    const restartedProcess = await PublicPiTasksHarness.create(firstProcess.getBranch());
    await restartedProcess.emitLifecycle('session_start');
    const restartedEvent = restartedProcess.latestStateEvent('session_start');
    expect(restartedEvent).toBeDefined();

    const firstRevision = inspectRevision(firstEvent!);
    const restartRevision = inspectRevision(restartedEvent!);

    expect(firstRevision.status).toBe('unsupported');
    expect(restartRevision.status).toBe('unsupported');
    expect(restartedEvent?.payload.state).toEqual(firstEvent?.payload.state);

    const result = boundedContractResult({
      schemaVersion: 1,
      capabilities: {
        mutationCorrelation: {
          status: 'unsupported',
          reason:
            'Matching snapshots have no stable public revision across replay or process restart.',
        },
        stableRevision: restartRevision,
      },
    });
    expect(JSON.parse(result)).toMatchObject({
      capabilities: {
        mutationCorrelation: { status: 'unsupported' },
        stableRevision: { status: 'unsupported' },
      },
    });
  });

  it('returns a bounded timeout when a required public state event is missing', async () => {
    vi.useFakeTimers();
    const harness = await PublicPiTasksHarness.create();
    const pending = harness.waitForStateEvent(
      (event) => event.payload.reason === 'task_mutation',
      25,
    );

    const rejection = expect(pending).rejects.toThrow(
      'pi-tasks state event timeout after 25ms',
    );
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
  });
});
