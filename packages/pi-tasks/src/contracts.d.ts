export declare const ORIGINOS_PI_TASKS_VERSION = "0.2.0-originos.1";
export declare const UPSTREAM_PI_TASKS_VERSION = "0.2.0";
export declare const PI_TASK_EVENT_VERSION = 2;
export declare const PI_TASK_STATE_EVENT_VERSION = 2;
export declare const PI_TASK_PUBLIC_API_VERSION = 1;
export declare const PI_TASKS_UPSTREAM_ENTRY_SHA256: string;
export declare const PI_TASKS_UPSTREAM_REDUCER_SHA256: string;
export declare const PI_TASK_MUTATION_TOOLS: readonly PiTaskMutationTool[];
export declare const PI_TASK_SCHEMA_FINGERPRINT: string;

export type PiTaskMutationTool =
    | "task_plan"
    | "task_checkpoint"
    | "task_decompose"
    | "task_update"
    | "task_evidence"
    | "task_decision"
    | "task_complete";

export interface PiTaskMutationRequest {
    version: 1;
    requestId: string;
    command: PiTaskMutationTool;
    expectedRevision: number;
    expectedCursor: string | null;
    input: Record<string, unknown>;
}

export interface PiTaskMutationReceipt {
    version: 1;
    requestId: string;
    command: PiTaskMutationTool;
    revisionBefore: number;
    revisionAfter: number;
    cursorBefore: string | null;
    cursorAfter: string;
    eventId: string;
    eventType: string;
    stateHash: string;
    payloadHash: string;
    replayed: boolean;
}

export interface PiTaskRuntimeMetadata {
    revision: number;
    cursor: string | null;
    stateHash: string;
    requestCount: number;
    integrity: string[];
    latestReceipt?: PiTaskMutationReceipt;
}

export declare class PiTaskContractError extends Error {
    readonly code: string;
    readonly details: Record<string, unknown>;
    constructor(code: string, message: string, details?: Record<string, unknown>);
}

export declare function canonicalize(value: unknown): unknown;
export declare function stableJson(value: unknown): string;
export declare function sha256(value: unknown): string;
export declare function mutationPayloadHash(command: string, input: Record<string, unknown>): string;
export declare function stateHash(state: Record<string, unknown>): string;
export declare function assertMutationCommand(command: unknown): asserts command is PiTaskMutationTool;
export declare function assertMutationRequest(request: PiTaskMutationRequest): PiTaskMutationRequest & {
    payloadHash: string;
};
