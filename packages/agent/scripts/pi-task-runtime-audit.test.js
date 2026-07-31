'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { runAudit } = require('./pi-task-runtime-audit');

test('公共 package exports 审计生成稳定的机器可读契约', async () => {
  const report = await runAudit();
  const repeatedReport = await runAudit();

  assert.equal(report.auditSchemaVersion, 1);
  assert.equal(report.repository.adapter.version, '0.80.10');
  assert.equal(report.repository.piTasks.version, '0.2.0');
  assert.deepEqual(report.repository.piTasks.directDependencies, []);
  assert.deepEqual(report.piTasks.publicExports, [
    'TASK_STATE_EVENT',
    'TASK_WIDGET_ID',
    'default',
  ]);
  assert.equal(report.piTasks.stateEvent.version, 1);
  assert.deepEqual(report.piTasks.stateEvent.observedReasons, [
    'session_start',
    'session_tree',
  ]);
  assert.equal(report.piTasks.stateEvent.stableRevision.available, false);
  assert.deepEqual(report.piTasks.publicMutationCommands, []);
  assert.equal(Object.keys(report.piTasks.toolSchemas).length, 12);
  for (const contract of Object.values(report.piTasks.toolSchemas)) {
    assert.equal(contract.hasExecute, true);
    assert.match(contract.parameterSchemaSha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(report.runtime.hostInvoke.preservesStandardToolPipeline, false);
  assert.deepEqual(report.runtime.hostInvoke.publicMethodsFound, []);
  assert.equal(report.capabilities.hostToolInvocation.result, 'unsupported');
  assert.equal(report.capabilities.publicMutationCommandApi.result, 'unsupported');
  assert.equal(report.capabilities.stableRevision.result, 'unsupported');
  assert.match(report.reportSha256, /^[a-f0-9]{64}$/);
  assert.equal(repeatedReport.reportSha256, report.reportSha256);
});

test('审计实现不使用 pi-tasks 私有路径或 Session 文件', () => {
  const sourcePath = path.join(__dirname, 'pi-task-runtime-audit.js');
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.equal(
    /(?:from\s+|require\s*\(|import\s*\()['"]pi-tasks\//.test(source),
    false,
  );
  assert.equal(/session(?:Data|File|Path)|sessions?[\\/].*\.json/i.test(source), false);
  assert.equal(/pi-tasks:(?:event|snapshot)/.test(source), false);
});

test('未导出的 pi-tasks 子路径不能被解析', () => {
  assert.throws(
    () => require.resolve('pi-tasks/private-runtime'),
    (error) =>
      error instanceof Error &&
      ['ERR_PACKAGE_PATH_NOT_EXPORTED', 'MODULE_NOT_FOUND'].includes(error.code),
  );
});
