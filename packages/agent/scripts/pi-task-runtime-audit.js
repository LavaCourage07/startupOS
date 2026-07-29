'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ADAPTER_VERSION = '0.80.10';
const PI_TASKS_VERSION = '0.2.0';
const PI_RUNTIME_PACKAGES = [
  '@earendil-works/pi-agent-core',
  '@earendil-works/pi-ai',
  '@earendil-works/pi-coding-agent',
  '@earendil-works/pi-tui',
];
const EXPECTED_PI_TASK_EXPORTS = ['TASK_STATE_EVENT', 'TASK_WIDGET_ID', 'default'];
const EXPECTED_TASK_TOOLS = [
  'task_checkpoint',
  'task_complete',
  'task_decision',
  'task_decompose',
  'task_evidence',
  'task_focus',
  'task_granularity_check',
  'task_list',
  'task_next',
  'task_plan',
  'task_resume',
  'task_update',
];
const HOST_INVOKE_METHODS = [
  'callTool',
  'executeRegisteredTool',
  'executeTool',
  'executeToolCall',
  'invokeExtensionTool',
  'invokeTool',
  'runTool',
];
const MUTATION_COMMAND_NAMES = [
  'task_checkpoint',
  'task_complete',
  'task_decision',
  'task_decompose',
  'task_evidence',
  'task_plan',
  'task_update',
];
const REVISION_FIELDS = ['cursor', 'revision', 'sequence'];
const PI_TASKS_INTEGRITY =
  'sha512-VN3fQs2khp6M0chAjpKQPeGZI4MJ0PP1XLmc368WGmccMAQOlz1dv5wMNtvUurHvyEinGSAVCNXhMGG6OUp+bw==';

function sortStrings(values) {
  return [...values].sort();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readRepositoryEvidence() {
  const packageDir = path.join(__dirname, '..');
  const repositoryDir = path.join(packageDir, '..', '..');
  const manifestPath = path.join(packageDir, 'package.json');
  const rootManifestPath = path.join(repositoryDir, 'package.json');
  const lockfilePath = path.join(repositoryDir, 'pnpm-lock.yaml');
  const manifestText = fs.readFileSync(manifestPath, 'utf8');
  const rootManifest = JSON.parse(fs.readFileSync(rootManifestPath, 'utf8'));
  const lockfileText = fs.readFileSync(lockfilePath, 'utf8');
  const manifest = JSON.parse(manifestText);

  assert.equal(rootManifest.packageManager, 'pnpm@9.15.9');
  assert.equal(manifest.name, '@originos/pi-agent-adapter');
  assert.equal(manifest.version, ADAPTER_VERSION);
  assert.equal(manifest.dependencies['pi-tasks'], PI_TASKS_VERSION);
  for (const packageName of PI_RUNTIME_PACKAGES) {
    assert.equal(
      manifest.dependencies[packageName],
      ADAPTER_VERSION,
      `${packageName} must remain pinned to ${ADAPTER_VERSION}`,
    );
  }

  assert.match(lockfileText, /pi-tasks:\s*\n\s+specifier: 0\.2\.0\s*\n\s+version: 0\.2\.0/);
  assert.match(lockfileText, /pi-tasks@0\.2\.0:\s*\n\s+resolution: \{integrity: sha512-/);
  assert.match(lockfileText, /\n\s+pi-tasks@0\.2\.0: \{\}\n/);
  assert.equal(lockfileText.includes(PI_TASKS_INTEGRITY), true);

  return {
    adapter: {
      name: manifest.name,
      version: manifest.version,
    },
    lockfile: {
      packageIntegrity: PI_TASKS_INTEGRITY,
      sha256: sha256(lockfileText),
    },
    packageManager: rootManifest.packageManager,
    piRuntime: Object.fromEntries(
      PI_RUNTIME_PACKAGES.map((packageName) => [
        packageName,
        manifest.dependencies[packageName],
      ]),
    ),
    piTasks: {
      directDependencies: [],
      version: manifest.dependencies['pi-tasks'],
    },
    publicSources: ['@earendil-works/pi-coding-agent', 'pi-tasks'],
  };
}

function createExtensionProbe() {
  const commands = new Map();
  const emittedEvents = [];
  const handlers = new Map();
  const tools = new Map();

  const api = {
    appendEntry() {},
    events: {
      emit(name, payload) {
        emittedEvents.push({ name, payload });
      },
    },
    on(name, handler) {
      const currentHandlers = handlers.get(name) ?? [];
      currentHandlers.push(handler);
      handlers.set(name, currentHandlers);
    },
    registerCommand(name, command) {
      commands.set(name, command);
    },
    registerTool(tool) {
      tools.set(tool.name, tool);
    },
  };

  const context = {
    cwd: process.cwd(),
    hasUI: false,
    sessionManager: {
      getBranch() {
        return [];
      },
    },
    ui: {
      notify() {},
      setStatus() {},
      setWidget() {},
    },
  };

  return {
    api,
    commands,
    context,
    emittedEvents,
    handlers,
    tools,
  };
}

async function emitLifecycle(probe, name) {
  const handlers = probe.handlers.get(name) ?? [];
  for (const handler of handlers) {
    await handler({}, probe.context);
  }
}

function inspectRuntimePublicApi(runtime) {
  const runtimeExports = sortStrings(Object.keys(runtime));
  const publicTypes = ['AgentSession', 'AgentSessionRuntime', 'ExtensionRunner'];
  const publicTypeMethods = Object.fromEntries(
    publicTypes.map((typeName) => {
      const publicType = runtime[typeName];
      assert.equal(typeof publicType, 'function', `${typeName} must be a public runtime export`);
      return [
        typeName,
        sortStrings(
          Object.getOwnPropertyNames(publicType.prototype).filter(
            (name) => name !== 'constructor' && !name.startsWith('_'),
          ),
        ),
      ];
    }),
  );
  const publicMethods = Object.values(publicTypeMethods).flat();
  const possibleHostInvokeNames = sortStrings(
    new Set(
      [...runtimeExports, ...publicMethods].filter((name) =>
        /^(?:call|execute|invoke|run).*(?:extension)?tool/i.test(name),
      ),
    ),
  );
  const exposedHostInvokeMethods = HOST_INVOKE_METHODS.filter(
    (name) => runtimeExports.includes(name) || publicMethods.includes(name),
  );
  assert.deepEqual(
    exposedHostInvokeMethods,
    [],
    'runtime unexpectedly exposes a host invocation API; review the contract before proceeding',
  );
  assert.deepEqual(
    possibleHostInvokeNames,
    [],
    'runtime exposes a possible host tool invocation API; review it before retaining the negative conclusion',
  );

  return {
    exports: runtimeExports,
    hostInvoke: {
      possiblePublicNames: possibleHostInvokeNames,
      preservesStandardToolPipeline: false,
      publicMethodsFound: exposedHostInvokeMethods,
      requiredPublicMethodsChecked: HOST_INVOKE_METHODS,
    },
    publicTypeMethods,
  };
}

function inspectStateEvent(piTasks, probe) {
  const stateEvents = probe.emittedEvents.filter(
    ({ name }) => name === piTasks.TASK_STATE_EVENT,
  );
  assert.equal(piTasks.TASK_STATE_EVENT, 'pi-tasks:state');
  assert.equal(piTasks.TASK_WIDGET_ID, 'pi-tasks');
  assert.equal(stateEvents.length >= 2, true, 'session lifecycle must publish state snapshots');

  const observedReasons = sortStrings(
    new Set(stateEvents.map(({ payload }) => payload.reason)),
  );
  assert.deepEqual(observedReasons, ['session_start', 'session_tree']);

  for (const { payload } of stateEvents) {
    assert.equal(payload.version, 1);
    assert.equal(payload.widgetId, piTasks.TASK_WIDGET_ID);
    assert.equal(typeof payload.state, 'object');
    assert.equal(payload.state === null, false);
  }

  const payloadKeys = sortStrings(
    new Set(stateEvents.flatMap(({ payload }) => Object.keys(payload))),
  );
  const stateKeys = sortStrings(
    new Set(stateEvents.flatMap(({ payload }) => Object.keys(payload.state))),
  );
  const stableRevisionFields = REVISION_FIELDS.filter(
    (field) => payloadKeys.includes(field) || stateKeys.includes(field),
  );
  assert.deepEqual(stableRevisionFields, []);

  return {
    eventName: piTasks.TASK_STATE_EVENT,
    observedReasons,
    payloadKeys,
    stableRevision: {
      available: false,
      fieldsFound: stableRevisionFields,
      fieldsRequiredChecked: REVISION_FIELDS,
    },
    stateKeys,
    version: 1,
    widgetId: piTasks.TASK_WIDGET_ID,
  };
}

async function runAudit() {
  const repository = readRepositoryEvidence();
  const piTasks = await import('pi-tasks');
  const runtime = await import('@earendil-works/pi-coding-agent');
  const publicExports = sortStrings(Object.keys(piTasks));

  assert.deepEqual(publicExports, EXPECTED_PI_TASK_EXPORTS);
  assert.equal(typeof piTasks.default, 'function');

  const probe = createExtensionProbe();
  piTasks.default(probe.api);

  const toolNames = sortStrings(probe.tools.keys());
  const toolSchemas = Object.fromEntries(
    toolNames.map((name) => {
      const tool = probe.tools.get(name);
      assert.equal(typeof tool.execute, 'function', `${name} must expose an execute function`);
      assert.equal(
        typeof tool.parameters,
        'object',
        `${name} must expose a public parameter schema`,
      );
      return [
        name,
        {
          hasExecute: true,
          parameterSchemaSha256: sha256(JSON.stringify(tool.parameters)),
        },
      ];
    }),
  );
  const commandNames = sortStrings(probe.commands.keys());
  assert.deepEqual(toolNames, EXPECTED_TASK_TOOLS);
  assert.deepEqual(commandNames, ['tasks']);

  const publicMutationCommands = commandNames.filter((name) =>
    MUTATION_COMMAND_NAMES.includes(name),
  );
  assert.deepEqual(publicMutationCommands, []);

  await emitLifecycle(probe, 'session_start');
  await emitLifecycle(probe, 'session_tree');

  const report = {
    auditSchemaVersion: 1,
    capabilities: {
      hostToolInvocation: {
        result: 'unsupported',
        reason:
          'No public Runtime API preserves schema validation, permission hooks, and the standard tool lifecycle for host invocation.',
      },
      publicMutationCommandApi: {
        result: 'unsupported',
        reason: 'pi-tasks registers only the read-oriented /tasks command.',
      },
      stableRevision: {
        result: 'unsupported',
        reason:
          'The public pi-tasks state event v1 exposes no revision, sequence, or cursor.',
      },
    },
    piTasks: {
      commands: commandNames,
      publicExports,
      publicMutationCommands,
      stateEvent: inspectStateEvent(piTasks, probe),
      tools: toolNames,
      toolSchemas,
    },
    repository,
    runtime: inspectRuntimePublicApi(runtime),
  };

  return {
    ...report,
    reportSha256: sha256(JSON.stringify(report)),
  };
}

async function main() {
  const report = await runAudit();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  console.log(
    `[pi-task-runtime-audit] audited pi-tasks@${report.repository.piTasks.version} against ${report.repository.adapter.name}@${report.repository.adapter.version} (${report.reportSha256})`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[pi-task-runtime-audit] failed', error);
    process.exitCode = 1;
  });
}

module.exports = {
  runAudit,
};
