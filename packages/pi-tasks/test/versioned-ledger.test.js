import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PI_TASK_EVENT_V2_SCHEMA,
  PI_TASK_STATE_EVENT_V2_SCHEMA,
  createTaskRuntimeStore,
} from '../index.js';
import { registerTaskTools } from '../src/tools.js';
import { mutationPayloadHash } from '../src/contracts.js';

const CREATED_AT = '2026-08-01T00:00:00.000Z';

function taskCreated(eventId = 'event-create-T1') {
  return {
    version: 1,
    id: eventId,
    type: 'task.created',
    taskId: 'T1',
    createdAt: CREATED_AT,
    source: 'tool',
    title: 'Versioned ledger task',
    objective: 'Verify v2 mutation semantics',
    acceptanceCriteria: ['Ledger mutation is durable'],
    planSteps: [{
      text: 'Write one ledger event',
      expectedOutput: 'One accepted Session entry',
      allowedActions: ['mutate'],
      evidenceRequired: true,
      decompositionStatus: 'atomic',
      granularityCheck: {
        isAtomic: true,
        reason: 'One mutation has one observable entry',
        canBeDoneInOneAgentAction: true,
        hasSingleObservableOutput: true,
        hasSingleVerificationMethod: true,
        hasNoHiddenSubtasks: true,
      },
    }],
    activate: true,
  };
}

function taskUpdated(nextAction, eventId) {
  return {
    version: 1,
    id: eventId,
    type: 'task.updated',
    taskId: 'T1',
    createdAt: CREATED_AT,
    source: 'tool',
    nextAction,
  };
}

function mutationRequest(overrides = {}) {
  return {
    version: 1,
    requestId: 'request-create',
    command: 'task_plan',
    expectedRevision: 0,
    expectedCursor: null,
    input: { title: 'Versioned ledger task' },
    ...overrides,
  };
}

function createPersistence(entries = [], prefix = 'cursor') {
  const branch = structuredClone(entries);
  let sequence = branch.length;
  return {
    branch,
    appendCount: 0,
    appendEntry(customType, data) {
      sequence += 1;
      this.appendCount += 1;
      branch.push({
        id: `${prefix}-${sequence}`,
        type: 'custom',
        customType,
        data: structuredClone(data),
      });
    },
    getBranch() {
      return branch;
    },
  };
}

function mutateCreated(store, persistence, request = mutationRequest()) {
  return store.mutate(request, taskCreated(), persistence);
}

function createFakePi(sessionId = 'session-1') {
  const tools = new Map();
  const branch = [];
  const stateEvents = [];
  let cursor = 0;
  const pi = {
    tools,
    branch,
    stateEvents,
    events: {
      emit(name, data) {
        stateEvents.push({ name, data });
      },
    },
    registerTool(tool) {
      tools.set(tool.name, tool);
    },
    appendEntry(customType, data) {
      cursor += 1;
      branch.push({
        id: `session-entry-${cursor}`,
        type: 'custom',
        customType,
        data: structuredClone(data),
      });
    },
  };
  const ctx = {
    mode: 'rpc',
    sessionManager: {
      getBranch: () => branch,
      getSessionId: () => sessionId,
    },
    ui: {
      notify() {},
      setStatus() {},
      setWidget() {},
    },
  };
  return { pi, ctx };
}

function taskPlanParams(overrides = {}) {
  return {
    title: 'Tool path task',
    objective: 'Exercise the registered task_plan tool',
    acceptance_criteria: ['A v2 event is written'],
    plan_steps: [{
      text: 'Invoke task_plan once',
      expectedOutput: 'Task T1 exists',
      allowedActions: ['task_plan'],
      evidenceRequired: true,
      decompositionStatus: 'atomic',
      granularityCheck: {
        isAtomic: true,
        reason: 'Single tool call',
        canBeDoneInOneAgentAction: true,
        hasSingleObservableOutput: true,
        hasSingleVerificationMethod: true,
        hasNoHiddenSubtasks: true,
      },
    }],
    ...overrides,
  };
}

test('成功 mutation 写入 v2 envelope 并返回真实 Session cursor receipt', () => {
  const store = createTaskRuntimeStore();
  const persistence = createPersistence();
  const result = mutateCreated(store, persistence);

  assert.equal(result.receipt.revisionBefore, 0);
  assert.equal(result.receipt.revisionAfter, 1);
  assert.equal(result.receipt.cursorBefore, null);
  assert.equal(result.receipt.cursorAfter, 'cursor-1');
  assert.equal(result.receipt.taskId, 'T1');
  assert.equal(result.receipt.replayed, false);
  assert.equal(persistence.branch[0].data.version, 2);
  assert.equal(persistence.branch[0].data.kind, 'mutation');
  assert.equal(persistence.branch[0].data.parentCursor, null);
  assert.equal(result.metadata.cursor, persistence.branch[0].id);
  assert.equal(result.state.tasks.T1.status, 'active');
});

test('相同 requestId 与 payload replay 原 receipt，不追加 event；内容冲突 fail closed', () => {
  const store = createTaskRuntimeStore();
  const persistence = createPersistence();
  const first = mutateCreated(store, persistence);
  const replay = store.mutate(mutationRequest(), taskCreated('unused-replay-event'), persistence);

  assert.equal(replay.receipt.replayed, true);
  assert.equal(replay.receipt.eventId, first.receipt.eventId);
  assert.equal(replay.receipt.taskId, 'T1');
  assert.equal(persistence.appendCount, 1);
  assert.throws(
    () => store.mutate(
      mutationRequest({ input: { title: 'different' } }),
      taskCreated('conflict-event'),
      persistence,
    ),
    (error) => error.code === 'DUPLICATE_REQUEST_CONFLICT',
  );
  assert.equal(persistence.appendCount, 1);
});

test('expectedRevision 和 expectedCursor 冲突均不 reduce、不 append', () => {
  const store = createTaskRuntimeStore();
  const persistence = createPersistence();

  assert.throws(
    () => mutateCreated(store, persistence, mutationRequest({ expectedRevision: 1 })),
    (error) => error.code === 'REVISION_CONFLICT',
  );
  assert.throws(
    () => mutateCreated(store, persistence, mutationRequest({ expectedCursor: 'stale' })),
    (error) => error.code === 'BRANCH_CONFLICT',
  );
  assert.equal(persistence.appendCount, 0);
  assert.deepEqual(store.getState().tasks, {});
});

test('重启 replay 重建相同 revision/cursor/request index 并保持幂等', () => {
  const firstStore = createTaskRuntimeStore();
  const persistence = createPersistence();
  const first = mutateCreated(firstStore, persistence);
  const restarted = createTaskRuntimeStore();
  const replay = restarted.replay(persistence.branch);

  assert.equal(replay.metadata.revision, 1);
  assert.equal(replay.metadata.cursor, first.receipt.cursorAfter);
  assert.equal(replay.metadata.requestCount, 1);
  assert.equal(replay.metadata.stateHash, first.metadata.stateHash);
  const idempotent = restarted.mutate(mutationRequest(), taskCreated('after-restart'), persistence);
  assert.equal(idempotent.receipt.replayed, true);
  assert.equal(persistence.appendCount, 1);
});

test('branch replay 只继承共同祖先，各自 revision/cursor 独立推进', () => {
  const rootStore = createTaskRuntimeStore();
  const rootPersistence = createPersistence([], 'root');
  mutateCreated(rootStore, rootPersistence);
  const common = structuredClone(rootPersistence.branch);

  const leftStore = createTaskRuntimeStore();
  leftStore.replay(common);
  const left = createPersistence(common, 'left');
  leftStore.mutate(
    mutationRequest({
      requestId: 'request-left',
      command: 'task_update',
      expectedRevision: 1,
      expectedCursor: 'root-1',
      input: { task_id: 'T1', next_action: 'left' },
    }),
    taskUpdated('left', 'event-left'),
    left,
  );

  const rightStore = createTaskRuntimeStore();
  rightStore.replay(common);
  const right = createPersistence(common, 'right');
  rightStore.mutate(
    mutationRequest({
      requestId: 'request-right',
      command: 'task_update',
      expectedRevision: 1,
      expectedCursor: 'root-1',
      input: { task_id: 'T1', next_action: 'right' },
    }),
    taskUpdated('right', 'event-right'),
    right,
  );

  assert.equal(leftStore.getMetadata().revision, 2);
  assert.equal(rightStore.getMetadata().revision, 2);
  assert.notEqual(leftStore.getMetadata().cursor, rightStore.getMetadata().cursor);
  assert.equal(leftStore.getState().tasks.T1.nextAction, 'left');
  assert.equal(rightStore.getState().tasks.T1.nextAction, 'right');
});

test('重复 cursor 与乱序 envelope 被忽略，后续合法 entry 仍可 replay', () => {
  const sourceStore = createTaskRuntimeStore();
  const source = createPersistence();
  mutateCreated(sourceStore, source);
  sourceStore.mutate(
    mutationRequest({
      requestId: 'request-update',
      command: 'task_update',
      expectedRevision: 1,
      expectedCursor: 'cursor-1',
      input: { task_id: 'T1', next_action: 'accepted' },
    }),
    taskUpdated('accepted', 'event-update'),
    source,
  );
  const duplicate = structuredClone(source.branch[0]);
  const outOfOrder = structuredClone(source.branch[1]);
  outOfOrder.id = 'cursor-out-of-order';
  outOfOrder.data.revision = 4;
  const replayStore = createTaskRuntimeStore();
  const replay = replayStore.replay([
    source.branch[0],
    duplicate,
    outOfOrder,
    source.branch[1],
  ]);

  assert.equal(replay.metadata.revision, 2);
  assert.equal(replay.metadata.cursor, 'cursor-2');
  assert.equal(replay.state.tasks.T1.nextAction, 'accepted');
  assert.equal(replay.malformedEvents.length, 2);
  assert.match(replay.malformedEvents[0], /Duplicate task ledger cursor/);
  assert.match(replay.malformedEvents[1], /Out-of-order task event/);
});

test('compaction v2 snapshot 不递增 revision，并可单 entry 恢复 state 与 request receipt', () => {
  const store = createTaskRuntimeStore();
  const persistence = createPersistence();
  const first = mutateCreated(store, persistence);
  const checkpointEvent = {
    version: 1,
    id: 'snapshot-compaction',
    type: 'task.snapshot',
    taskId: 'T1',
    createdAt: '2026-08-01T00:01:00.000Z',
    source: 'system',
    state: (() => {
      const { events, ...snapshot } = store.getState();
      void events;
      return snapshot;
    })(),
    resume: {
      currentStepLineage: [],
      evidenceIds: [],
      criterionIds: [],
      allowedActions: [],
      nextAllowedActions: [],
      verificationGaps: [],
      blockers: [],
      decisions: [],
      warnings: [],
      resumeInstruction: 'resume',
    },
    reason: 'compaction',
  };
  const checkpoint = store.checkpoint(checkpointEvent, persistence);
  const snapshotEntry = persistence.branch.at(-1);

  assert.equal(checkpoint.metadata.revision, 1);
  assert.equal(checkpoint.metadata.cursor, 'cursor-2');
  assert.equal(snapshotEntry.data.kind, 'snapshot');
  assert.equal(snapshotEntry.data.revision, 1);
  const compactedStore = createTaskRuntimeStore();
  const replay = compactedStore.replay([snapshotEntry]);
  assert.equal(replay.metadata.revision, 1);
  assert.equal(replay.metadata.cursor, 'cursor-2');
  assert.equal(replay.metadata.requestCount, 1);
  assert.equal(replay.state.tasks.T1.title, 'Versioned ledger task');
  const idempotent = compactedStore.mutate(mutationRequest(), taskCreated('after-compaction'), persistence);
  assert.equal(idempotent.receipt.replayed, true);
  assert.equal(idempotent.receipt.eventId, first.receipt.eventId);
  assert.equal(persistence.appendCount, 2);
});

test('schema snapshot 固定 v2 envelope/state event 和 7 个 mutation tool reserved 参数', async () => {
  const { pi } = createFakePi();
  registerTaskTools(pi, createTaskRuntimeStore());
  const mutationNames = [
    'task_plan',
    'task_checkpoint',
    'task_decompose',
    'task_update',
    'task_evidence',
    'task_decision',
    'task_complete',
  ];
  const reservedSchemas = mutationNames.map((name) => pi.tools.get(name).parameters.properties.originos_command);
  for (const schema of reservedSchemas.slice(1)) assert.deepEqual(schema, reservedSchemas[0]);
  const actual = {
    eventEnvelope: {
      id: PI_TASK_EVENT_V2_SCHEMA.$id,
      kinds: PI_TASK_EVENT_V2_SCHEMA.oneOf.map((schema) => schema.properties.kind.const),
      mutationRequired: PI_TASK_EVENT_V2_SCHEMA.oneOf[0].required,
      snapshotRequired: PI_TASK_EVENT_V2_SCHEMA.oneOf[1].required,
    },
    stateEvent: {
      id: PI_TASK_STATE_EVENT_V2_SCHEMA.$id,
      required: PI_TASK_STATE_EVENT_V2_SCHEMA.required,
      reasons: PI_TASK_STATE_EVENT_V2_SCHEMA.properties.reason.enum,
      sessionIdType: PI_TASK_STATE_EVENT_V2_SCHEMA.properties.scope.properties.sessionId.type,
    },
    originosCommand: reservedSchemas[0],
  };
  const expected = JSON.parse(await readFile(
    new URL('./snapshots/versioned-ledger-schema.json', import.meta.url),
    'utf8',
  ));
  assert.deepEqual(actual, expected);
});

test('普通模型路径用 toolCallId；宿主 scope 路径执行 CAS 且 replay 返回原 receipt 中性提示', async () => {
  const modelRuntime = createFakePi('model-session');
  const modelStore = createTaskRuntimeStore();
  registerTaskTools(modelRuntime.pi, modelStore);
  const modelResult = await modelRuntime.pi.tools.get('task_plan').execute(
    'model-tool-call-1',
    taskPlanParams(),
    undefined,
    undefined,
    modelRuntime.ctx,
  );
  assert.equal(modelResult.isError, undefined);
  assert.equal(modelResult.details.mutationReceipt.requestId, 'model-tool-call-1');
  assert.equal(modelRuntime.pi.branch[0].data.version, 2);
  assert.equal(modelRuntime.pi.stateEvents[0].data.version, 2);
  assert.equal(modelRuntime.pi.stateEvents[0].data.scope.sessionId, 'model-session');
  assert.equal(
    modelRuntime.pi.stateEvents[0].data.stateHash,
    modelResult.details.mutationReceipt.stateHash,
  );

  const hostRuntime = createFakePi('host-session');
  const hostStore = createTaskRuntimeStore();
  registerTaskTools(hostRuntime.pi, hostStore);
  const hostParams = taskPlanParams({
    originos_command: {
      version: 1,
      request_id: 'host-request-1',
      expected_revision: 0,
      expected_cursor: null,
    },
  });
  const first = await hostRuntime.pi.tools.get('task_plan').execute(
    'host-request-1',
    hostParams,
    undefined,
    undefined,
    hostRuntime.ctx,
  );
  const replay = await hostRuntime.pi.tools.get('task_plan').execute(
    'host-request-1',
    hostParams,
    undefined,
    undefined,
    hostRuntime.ctx,
  );
  assert.equal(first.details.mutationReceipt.taskId, 'T1');
  const { originos_command: _reserved, ...businessInput } = hostParams;
  assert.equal(
    hostRuntime.pi.branch[0].data.payloadHash,
    mutationPayloadHash('task_plan', businessInput),
  );
  assert.notEqual(
    hostRuntime.pi.branch[0].data.payloadHash,
    mutationPayloadHash('task_plan', hostParams),
  );
  assert.equal(replay.details.mutationReceipt.replayed, true);
  assert.equal(replay.details.mutationReceipt.taskId, 'T1');
  assert.match(replay.content[0].text, /already committed task\.created for task T1/);
  assert.doesNotMatch(replay.content[0].text, /Created task T2/);
  assert.equal(hostRuntime.pi.branch.length, 1);
  assert.equal(hostRuntime.pi.stateEvents.at(-1).data.mutation, undefined);
});

test('task_evidence reserved replay 不走语义 duplicate 快速返回', async () => {
  const runtime = createFakePi('evidence-session');
  const store = createTaskRuntimeStore();
  registerTaskTools(runtime.pi, store);
  await runtime.pi.tools.get('task_plan').execute(
    'model-plan',
    taskPlanParams(),
    undefined,
    undefined,
    runtime.ctx,
  );
  const evidenceParams = {
    originos_command: {
      version: 1,
      request_id: 'host-evidence-1',
      expected_revision: 1,
      expected_cursor: 'session-entry-1',
    },
    task_id: 'T1',
    type: 'test',
    level: 'unit_test',
    summary: 'Ledger tests pass',
    passed: 'true',
    references: ['versioned-ledger.test.js'],
    criterion_ids: ['T1-AC1'],
    step_ids: ['T1-S1'],
    quality: {
      source: 'node:test',
      reproducible: true,
      verifier: 'tool',
      artifactRefs: ['versioned-ledger.test.js'],
      observedOutput: '12 tests passed',
    },
  };
  const first = await runtime.pi.tools.get('task_evidence').execute(
    'host-evidence-1',
    evidenceParams,
    undefined,
    undefined,
    runtime.ctx,
  );
  assert.equal(first.isError, undefined, first.content[0].text);
  const replay = await runtime.pi.tools.get('task_evidence').execute(
    'host-evidence-1',
    evidenceParams,
    undefined,
    undefined,
    runtime.ctx,
  );
  assert.equal(first.details.mutationReceipt.replayed, false);
  assert.equal(replay.details.mutationReceipt.replayed, true);
  assert.equal(replay.details.mutationReceipt.eventId, first.details.mutationReceipt.eventId);
  assert.equal(runtime.pi.branch.length, 2);
  assert.match(replay.content[0].text, /Idempotent replay/);
});

test('宿主 reserved scope 缺 cursor 或 ExtensionContext 缺 Session id 时 fail closed', async () => {
  const missingCursorRuntime = createFakePi();
  const missingCursorStore = createTaskRuntimeStore();
  registerTaskTools(missingCursorRuntime.pi, missingCursorStore);
  const missingCursor = await missingCursorRuntime.pi.tools.get('task_plan').execute(
    'host-missing-cursor',
    taskPlanParams({
      originos_command: {
        version: 1,
        request_id: 'host-missing-cursor',
        expected_revision: 0,
      },
    }),
    undefined,
    undefined,
    missingCursorRuntime.ctx,
  );
  assert.equal(missingCursor.isError, true);
  assert.equal(missingCursor.details.code, 'INVALID_EXPECTED_CURSOR');
  assert.match(missingCursor.content[0].text, /expectedCursor must be a string or null/);
  assert.equal(missingCursorRuntime.pi.branch.length, 0);

  const wrongVersionRuntime = createFakePi();
  const wrongVersionStore = createTaskRuntimeStore();
  registerTaskTools(wrongVersionRuntime.pi, wrongVersionStore);
  const wrongVersion = await wrongVersionRuntime.pi.tools.get('task_plan').execute(
    'host-wrong-version',
    taskPlanParams({
      originos_command: {
        version: 2,
        request_id: 'host-wrong-version',
        expected_revision: 0,
        expected_cursor: null,
      },
    }),
    undefined,
    undefined,
    wrongVersionRuntime.ctx,
  );
  assert.equal(wrongVersion.isError, true);
  assert.equal(wrongVersion.details.code, 'UNSUPPORTED_REQUEST_VERSION');
  assert.equal(wrongVersionRuntime.pi.branch.length, 0);

  const mismatchedRequestRuntime = createFakePi();
  const mismatchedRequestStore = createTaskRuntimeStore();
  registerTaskTools(mismatchedRequestRuntime.pi, mismatchedRequestStore);
  const mismatchedRequest = await mismatchedRequestRuntime.pi.tools.get('task_plan').execute(
    'runtime-tool-call-id',
    taskPlanParams({
      originos_command: {
        version: 1,
        request_id: 'different-request-id',
        expected_revision: 0,
        expected_cursor: null,
      },
    }),
    undefined,
    undefined,
    mismatchedRequestRuntime.ctx,
  );
  assert.equal(mismatchedRequest.isError, true);
  assert.equal(mismatchedRequest.details.code, 'INVALID_REQUEST_ID');
  assert.equal(mismatchedRequestRuntime.pi.branch.length, 0);

  const missingSessionRuntime = createFakePi();
  delete missingSessionRuntime.ctx.sessionManager.getSessionId;
  const missingSessionStore = createTaskRuntimeStore();
  registerTaskTools(missingSessionRuntime.pi, missingSessionStore);
  const missingSession = await missingSessionRuntime.pi.tools.get('task_plan').execute(
    'model-without-session',
    taskPlanParams(),
    undefined,
    undefined,
    missingSessionRuntime.ctx,
  );
  assert.equal(missingSession.isError, true);
  assert.match(missingSession.content[0].text, /requires a non-empty public Session id/);
  assert.equal(missingSessionRuntime.pi.branch.length, 0);
});
