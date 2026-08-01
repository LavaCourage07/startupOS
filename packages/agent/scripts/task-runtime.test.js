'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const taskRuntime = require('../src/task-runtime');

const digest = 'a'.repeat(64);

function compatibility(overrides = {}) {
  return {
    ...taskRuntime.PI_TASK_COMPATIBILITY_REQUIREMENTS,
    runtimePatchHash: digest,
    taskExtensionFingerprint: digest,
    ...overrides,
  };
}

function command(overrides = {}) {
  return {
    version: 1,
    requestId: 'request-1',
    toolName: 'task_plan',
    scope: {
      sessionId: 'session-1',
      expectedCursor: null,
      expectedRevision: 0,
      bridgeEpoch: 3,
    },
    input: { objective: '验证 Task Runtime' },
    ...overrides,
  };
}

test('公共子路径、类型声明和 allowlist 保持显式', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
  );
  assert.deepEqual(manifest.exports['./task-runtime'], {
    types: './task-runtime.d.ts',
    require: './task-runtime.js',
    default: './task-runtime.js',
  });
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'task-runtime.d.ts')), true);
  assert.equal(taskRuntime.isAllowedPiTaskTool('task_complete'), true);
  assert.equal(taskRuntime.isAllowedPiTaskTool('task_force_complete'), false);
  assert.throws(() => taskRuntime.assertAllowedPiTaskTool('read_file'), {
    code: 'TOOL_NOT_ALLOWED',
  });
});

test('command canonical hash 与 compatibility guard 可重复且 fail closed', () => {
  const left = taskRuntime.normalizePiTaskCommand(command());
  const right = taskRuntime.normalizePiTaskCommand(command({
    input: { objective: '验证 Task Runtime' },
  }));
  assert.equal(left.inputHash, right.inputHash);
  assert.equal(taskRuntime.evaluatePiTaskCompatibility(compatibility(), compatibility()).compatible, true);
  const mismatch = taskRuntime.evaluatePiTaskCompatibility(
    compatibility({ runtimeVersion: '0.80.11' }),
    compatibility(),
  );
  assert.equal(mismatch.compatible, false);
  assert.deepEqual(mismatch.mismatches, ['runtimeVersion']);
});

test('敏感字段被裁剪且 oversized snapshot 有界', () => {
  const sanitized = taskRuntime.sanitizeTaskRuntimeValue({
    authorization: 'Bearer secret',
    nested: { apiKey: 'secret', value: 'ok' },
  });
  assert.deepEqual(sanitized, {
    authorization: '[REDACTED]',
    nested: { apiKey: '[REDACTED]', value: 'ok' },
  });

  const snapshot = taskRuntime.createBoundedPiTaskSnapshot({
    scope: { sessionId: 'session-1' },
    stateHash: digest,
    state: { output: 'x'.repeat(10000) },
  }, { maxSnapshotBytes: 512, maxStringLength: 10000 });
  assert.equal(snapshot.state.truncated, true);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot), 'utf8') <= 512);
});

test('companion extension 拒绝未知 task tool，gateway 绑定 epoch 与兼容矩阵', async () => {
  const handlers = new Map();
  const invocations = [];
  const bridge = taskRuntime.createPiTaskRuntimeBridge({
    bridgeEpoch: 3,
    expectedCompatibility: compatibility(),
    getCompatibility: () => compatibility(),
    invokeRegisteredTool: async (normalized) => {
      invocations.push(normalized);
      return { ok: true };
    },
  });
  bridge.extension({
    on(name, handler) {
      handlers.set(name, handler);
    },
  });

  assert.equal(handlers.get('tool_call')({ toolName: 'task_plan' }), undefined);
  assert.equal(handlers.get('tool_call')({ toolName: 'task_force_complete' }).block, true);
  assert.deepEqual(await bridge.gateway.invoke(command()), { ok: true });
  assert.equal(invocations.length, 1);
  assert.match(invocations[0].inputHash, /^[a-f0-9]{64}$/);

  bridge.invalidate();
  await assert.rejects(() => bridge.gateway.invoke(command()), {
    code: 'BRIDGE_EPOCH_STALE',
  });
});

test('runtime error mapping 不泄露 message、token 或路径', () => {
  const source = new Error('provider leaked text');
  source.code = 'SESSION_BUSY';
  source.details = {
    token: 'secret',
    filePath: 'C:\\Users\\secret\\task.json',
    safe: 'visible',
  };
  assert.deepEqual(taskRuntime.mapPiTaskRuntimeError(source), {
    version: 1,
    code: 'SESSION_BUSY',
    message: 'Task Runtime error: SESSION_BUSY',
    retryable: true,
    details: {
      filePath: '[REDACTED]',
      safe: 'visible',
      token: '[REDACTED]',
    },
  });
});
