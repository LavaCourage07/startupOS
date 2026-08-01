'use strict';

const { stableJsonHash, stableJsonStringify } = require('./canonical-json');
const {
  DEFAULT_SANITIZE_LIMITS,
  createBoundedPiTaskSnapshot,
  sanitizeTaskRuntimeValue,
} = require('./sanitize');

const PI_TASK_CONTRACT_VERSION = 1;
const PI_TASK_SNAPSHOT_VERSION = 1;
const PI_TASK_STATE_EVENT_VERSION = 2;

const PI_TASK_TOOL_NAMES = Object.freeze([
  'task_plan',
  'task_checkpoint',
  'task_decompose',
  'task_update',
  'task_evidence',
  'task_decision',
  'task_complete',
]);

const PI_TASK_TOOL_ALLOWLIST = new Set(PI_TASK_TOOL_NAMES);

const PI_TASK_COMPATIBILITY_REQUIREMENTS = Object.freeze({
  adapterContractVersion: 1,
  runtimePackage: '@earendil-works/pi-coding-agent',
  runtimeVersion: '0.80.10',
  runtimeHostInvokeContractVersion: 1,
  taskExtensionPackage: '@originos/pi-tasks',
  taskExtensionVersion: '0.2.0-originos.1',
  taskExtensionContractVersion: 2,
  taskLedgerEventVersion: 2,
  taskStateEventVersion: 2,
});

const ERROR_CODE_ALIASES = Object.freeze({
  ABORT_ERR: 'ABORTED',
  ABORTED: 'ABORTED',
  BRANCH_CONFLICT: 'BRANCH_CONFLICT',
  BRIDGE_EPOCH_STALE: 'BRIDGE_EPOCH_STALE',
  CONTRACT_VIOLATION: 'CONTRACT_VIOLATION',
  DUPLICATE_REQUEST_CONFLICT: 'DUPLICATE_REQUEST_CONFLICT',
  INCOMPATIBLE_RUNTIME: 'INCOMPATIBLE_RUNTIME',
  INVALID_COMMAND: 'INVALID_COMMAND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  REVISION_CONFLICT: 'REVISION_CONFLICT',
  SESSION_BUSY: 'SESSION_BUSY',
  SESSION_MISMATCH: 'SESSION_MISMATCH',
  STATE_EVENT_TIMEOUT: 'STATE_EVENT_TIMEOUT',
  TOOL_NOT_ALLOWED: 'TOOL_NOT_ALLOWED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
});

function createTaskRuntimeError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function isAllowedPiTaskTool(value) {
  return typeof value === 'string' && PI_TASK_TOOL_ALLOWLIST.has(value);
}

function assertAllowedPiTaskTool(value) {
  if (!isAllowedPiTaskTool(value)) {
    const error = new Error('Task tool is not allowed by the adapter contract');
    error.code = 'TOOL_NOT_ALLOWED';
    throw error;
  }
  return value;
}

function normalizeText(value, field, maxLength = 256) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    const error = new TypeError(`${field} must be a non-empty string up to ${maxLength} characters`);
    error.code = 'INVALID_COMMAND';
    throw error;
  }
  return value;
}

function normalizePiTaskCommand(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    const error = new TypeError('Task command must be an object');
    error.code = 'INVALID_COMMAND';
    throw error;
  }
  if (command.version !== PI_TASK_CONTRACT_VERSION) {
    const error = new TypeError('Unsupported task command version');
    error.code = 'INVALID_COMMAND';
    throw error;
  }
  const toolName = assertAllowedPiTaskTool(command.toolName);
  const scope = command.scope;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    const error = new TypeError('Task command scope must be an object');
    error.code = 'INVALID_COMMAND';
    throw error;
  }
  if (!Number.isSafeInteger(scope.expectedRevision) || scope.expectedRevision < 0) {
    const error = new TypeError('expectedRevision must be a non-negative safe integer');
    error.code = 'INVALID_COMMAND';
    throw error;
  }
  if (scope.expectedCursor !== null && typeof scope.expectedCursor !== 'string') {
    const error = new TypeError('expectedCursor must be a string or null');
    error.code = 'INVALID_COMMAND';
    throw error;
  }
  if (!Number.isSafeInteger(scope.bridgeEpoch) || scope.bridgeEpoch < 0) {
    const error = new TypeError('bridgeEpoch must be a non-negative safe integer');
    error.code = 'INVALID_COMMAND';
    throw error;
  }
  if (!command.input || typeof command.input !== 'object' || Array.isArray(command.input)) {
    const error = new TypeError('Task command input must be a JSON object');
    error.code = 'INVALID_COMMAND';
    throw error;
  }

  const normalized = {
    version: PI_TASK_CONTRACT_VERSION,
    requestId: normalizeText(command.requestId, 'requestId'),
    toolName,
    scope: {
      sessionId: normalizeText(scope.sessionId, 'scope.sessionId'),
      expectedCursor:
        scope.expectedCursor === null
          ? null
          : normalizeText(scope.expectedCursor, 'scope.expectedCursor', 512),
      expectedRevision: scope.expectedRevision,
      bridgeEpoch: scope.bridgeEpoch,
    },
    input: command.input,
  };
  normalized.inputHash = stableJsonHash({ toolName, input: command.input });
  return normalized;
}

function validateCompatibilityDescriptor(descriptor, label) {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new TypeError(`${label} compatibility descriptor must be an object`);
  }
  for (const key of Object.keys(PI_TASK_COMPATIBILITY_REQUIREMENTS)) {
    if (!(key in descriptor)) {
      throw new TypeError(`${label} compatibility descriptor is missing ${key}`);
    }
  }
  if (typeof descriptor.runtimePatchHash !== 'string' || !/^[a-f0-9]{64}$/.test(descriptor.runtimePatchHash)) {
    throw new TypeError(`${label} runtimePatchHash must be a SHA-256 hex digest`);
  }
  if (
    typeof descriptor.taskExtensionFingerprint !== 'string' ||
    !/^[a-f0-9]{64}$/.test(descriptor.taskExtensionFingerprint)
  ) {
    throw new TypeError(`${label} taskExtensionFingerprint must be a SHA-256 hex digest`);
  }
}

function evaluatePiTaskCompatibility(actual, expected) {
  try {
    validateCompatibilityDescriptor(expected, 'Expected');
    validateCompatibilityDescriptor(actual, 'Actual');
  } catch (error) {
    return {
      compatible: false,
      error: mapPiTaskRuntimeError(error, 'INCOMPATIBLE_RUNTIME'),
      mismatches: ['MATRIX_INCOMPLETE'],
    };
  }

  const keys = [
    ...Object.keys(PI_TASK_COMPATIBILITY_REQUIREMENTS),
    'runtimePatchHash',
    'taskExtensionFingerprint',
  ];
  const mismatches = keys.filter((key) => actual[key] !== expected[key]);
  if (mismatches.length > 0) {
    return {
      compatible: false,
      error: {
        version: 1,
        code: 'INCOMPATIBLE_RUNTIME',
        message: 'Task Runtime compatibility check failed',
        retryable: false,
        details: { mismatches },
      },
      mismatches,
    };
  }
  return { compatible: true, mismatches: [] };
}

function assertPiTaskCompatibility(actual, expected) {
  const result = evaluatePiTaskCompatibility(actual, expected);
  if (!result.compatible) {
    const error = new Error(result.error.message);
    error.code = result.error.code;
    error.details = result.error.details;
    throw error;
  }
  return actual;
}

function createPiTaskCompatibilityGuard(expected) {
  validateCompatibilityDescriptor(expected, 'Expected');
  return Object.freeze({
    expected: Object.freeze({ ...expected }),
    evaluate(actual) {
      return evaluatePiTaskCompatibility(actual, expected);
    },
    assert(actual) {
      return assertPiTaskCompatibility(actual, expected);
    },
  });
}

function createPiTaskRuntimeBridge(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Task Runtime bridge options must be an object');
  }
  if (typeof options.getCompatibility !== 'function') {
    throw new TypeError('getCompatibility must be a function');
  }
  if (typeof options.invokeRegisteredTool !== 'function') {
    throw new TypeError('invokeRegisteredTool must be a function');
  }

  const compatibilityGuard = createPiTaskCompatibilityGuard(options.expectedCompatibility);
  const bridgeEpoch = Number.isSafeInteger(options.bridgeEpoch) && options.bridgeEpoch >= 0
    ? options.bridgeEpoch
    : 0;
  let active = true;

  function assertActive(commandEpoch) {
    if (!active || commandEpoch !== bridgeEpoch) {
      throw createTaskRuntimeError(
        'BRIDGE_EPOCH_STALE',
        'Task Runtime bridge epoch is stale',
        { bridgeEpoch, commandEpoch },
      );
    }
  }

  function extension(pi) {
    if (!pi || typeof pi.on !== 'function') {
      throw new TypeError('Task Runtime extension requires pi.on()');
    }
    pi.on('tool_call', (event) => {
      const toolName = event && typeof event === 'object'
        ? event.toolName ?? event.name
        : undefined;
      if (typeof toolName !== 'string' || !toolName.startsWith('task_')) return undefined;
      if (!isAllowedPiTaskTool(toolName)) {
        return {
          block: true,
          reason: 'Task tool is not allowed by the OriginOS Task Runtime contract',
        };
      }
      return undefined;
    });
  }

  const gateway = Object.freeze({
    get bridgeEpoch() {
      return bridgeEpoch;
    },
    async invoke(command) {
      const normalized = normalizePiTaskCommand(command);
      assertActive(normalized.scope.bridgeEpoch);
      const actualCompatibility = await options.getCompatibility();
      compatibilityGuard.assert(actualCompatibility);
      return options.invokeRegisteredTool(normalized);
    },
  });

  return Object.freeze({
    bridgeEpoch,
    extension,
    gateway,
    invalidate() {
      active = false;
    },
  });
}

function inferErrorCode(error, fallbackCode) {
  const explicitCode = error && typeof error === 'object' ? error.code : undefined;
  if (typeof explicitCode === 'string' && ERROR_CODE_ALIASES[explicitCode]) {
    return ERROR_CODE_ALIASES[explicitCode];
  }
  const message = error instanceof Error ? error.message : String(error || '');
  if (/schema|validation|invalid argument/i.test(message)) return 'VALIDATION_FAILED';
  if (/permission|denied|forbidden/i.test(message)) return 'PERMISSION_DENIED';
  if (/abort/i.test(message)) return 'ABORTED';
  if (/timeout/i.test(message)) return 'STATE_EVENT_TIMEOUT';
  return fallbackCode;
}

function mapPiTaskRuntimeError(error, fallbackCode = 'HOST_INVOCATION_FAILED') {
  const code = inferErrorCode(error, fallbackCode);
  const retryable = ['SESSION_BUSY', 'STATE_EVENT_TIMEOUT'].includes(code);
  const sourceDetails = error && typeof error === 'object' ? error.details : undefined;
  const details = sourceDetails ? sanitizeTaskRuntimeValue(sourceDetails) : undefined;
  return {
    version: 1,
    code,
    message: code === 'HOST_INVOCATION_FAILED' ? 'Task Runtime host invocation failed' : `Task Runtime error: ${code}`,
    retryable,
    ...(details === undefined ? {} : { details }),
  };
}

module.exports = {
  DEFAULT_SANITIZE_LIMITS,
  PI_TASK_COMPATIBILITY_REQUIREMENTS,
  PI_TASK_CONTRACT_VERSION,
  PI_TASK_SNAPSHOT_VERSION,
  PI_TASK_STATE_EVENT_VERSION,
  PI_TASK_TOOL_NAMES,
  assertAllowedPiTaskTool,
  assertPiTaskCompatibility,
  createBoundedPiTaskSnapshot,
  createPiTaskCompatibilityGuard,
  createPiTaskRuntimeBridge,
  evaluatePiTaskCompatibility,
  isAllowedPiTaskTool,
  mapPiTaskRuntimeError,
  normalizePiTaskCommand,
  sanitizeTaskRuntimeValue,
  stableJsonHash,
  stableJsonStringify,
};
