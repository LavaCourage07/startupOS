export type PiTaskToolName =
  | 'task_plan'
  | 'task_checkpoint'
  | 'task_decompose'
  | 'task_update'
  | 'task_evidence'
  | 'task_decision'
  | 'task_complete';

export interface PiTaskExecutionScope {
  sessionId: string;
  expectedCursor: string | null;
  expectedRevision: number;
  bridgeEpoch: number;
}

export interface PiTaskCommand {
  version: 1;
  requestId: string;
  toolName: PiTaskToolName;
  scope: PiTaskExecutionScope;
  input: Record<string, unknown>;
}

export interface NormalizedPiTaskCommand extends PiTaskCommand {
  inputHash: string;
}

export interface PiTaskCompatibilityDescriptor {
  adapterContractVersion: number;
  runtimePackage: string;
  runtimeVersion: string;
  runtimeHostInvokeContractVersion: number;
  runtimePatchHash: string;
  taskExtensionPackage: string;
  taskExtensionVersion: string;
  taskExtensionContractVersion: number;
  taskExtensionFingerprint: string;
  taskLedgerEventVersion: number;
  taskStateEventVersion: number;
}

export interface PiTaskRuntimeError {
  version: 1;
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export interface PiTaskCompatibilityResult {
  compatible: boolean;
  mismatches: string[];
  error?: PiTaskRuntimeError;
}

export interface PiTaskSnapshot {
  version: 1;
  scope: unknown;
  stateHash: string;
  state: unknown;
  mutation?: unknown;
  truncation?: {
    originalSanitizedBytes: number;
    maxSnapshotBytes: number;
  };
}

export interface PiTaskRuntimeBridgeOptions<TResult = unknown> {
  expectedCompatibility: PiTaskCompatibilityDescriptor;
  bridgeEpoch?: number;
  getCompatibility(): PiTaskCompatibilityDescriptor | Promise<PiTaskCompatibilityDescriptor>;
  invokeRegisteredTool(command: NormalizedPiTaskCommand): TResult | Promise<TResult>;
}

export interface PiTaskRuntimeBridge<TResult = unknown> {
  readonly bridgeEpoch: number;
  extension(pi: { on(event: string, handler: (payload: unknown) => unknown): unknown }): void;
  gateway: {
    readonly bridgeEpoch: number;
    invoke(command: PiTaskCommand): Promise<TResult>;
  };
  invalidate(): void;
}

export const DEFAULT_SANITIZE_LIMITS: Readonly<{
  maxArrayItems: number;
  maxDepth: number;
  maxObjectKeys: number;
  maxSnapshotBytes: number;
  maxStringLength: number;
}>;
export const PI_TASK_COMPATIBILITY_REQUIREMENTS: Readonly<Record<string, string | number>>;
export const PI_TASK_CONTRACT_VERSION: 1;
export const PI_TASK_SNAPSHOT_VERSION: 1;
export const PI_TASK_STATE_EVENT_VERSION: 2;
export const PI_TASK_TOOL_NAMES: readonly PiTaskToolName[];

export function isAllowedPiTaskTool(value: unknown): value is PiTaskToolName;
export function assertAllowedPiTaskTool(value: unknown): PiTaskToolName;
export function normalizePiTaskCommand(command: PiTaskCommand): NormalizedPiTaskCommand;
export function evaluatePiTaskCompatibility(
  actual: PiTaskCompatibilityDescriptor,
  expected: PiTaskCompatibilityDescriptor,
): PiTaskCompatibilityResult;
export function assertPiTaskCompatibility(
  actual: PiTaskCompatibilityDescriptor,
  expected: PiTaskCompatibilityDescriptor,
): PiTaskCompatibilityDescriptor;
export function createPiTaskCompatibilityGuard(expected: PiTaskCompatibilityDescriptor): {
  readonly expected: Readonly<PiTaskCompatibilityDescriptor>;
  evaluate(actual: PiTaskCompatibilityDescriptor): PiTaskCompatibilityResult;
  assert(actual: PiTaskCompatibilityDescriptor): PiTaskCompatibilityDescriptor;
};
export function createPiTaskRuntimeBridge<TResult = unknown>(
  options: PiTaskRuntimeBridgeOptions<TResult>,
): PiTaskRuntimeBridge<TResult>;
export function mapPiTaskRuntimeError(error: unknown, fallbackCode?: string): PiTaskRuntimeError;
export function sanitizeTaskRuntimeValue(value: unknown, options?: Record<string, number>): unknown;
export function createBoundedPiTaskSnapshot(
  snapshot: Record<string, unknown>,
  options?: Record<string, number>,
): PiTaskSnapshot;
export function stableJsonStringify(value: unknown): string;
export function stableJsonHash(value: unknown): string;
