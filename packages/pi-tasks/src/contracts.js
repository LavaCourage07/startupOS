import { createHash } from "node:crypto";

export const ORIGINOS_PI_TASKS_VERSION = "0.2.0-originos.1";
export const UPSTREAM_PI_TASKS_VERSION = "0.2.0";
export const PI_TASK_EVENT_VERSION = 2;
export const PI_TASK_STATE_EVENT_VERSION = 2;
export const PI_TASK_PUBLIC_API_VERSION = 1;
export const PI_TASKS_UPSTREAM_ENTRY_SHA256 =
    "3a99294bcc034cd63bc245132e7b3c429acf31fd0b2bd6058e4be85eb0b94136";
export const PI_TASKS_UPSTREAM_REDUCER_SHA256 =
    "53dc26325e818fec1841cb40a5736f67404adafd021171b7e0976ff7a1e5ea64";

export const PI_TASK_MUTATION_TOOLS = Object.freeze([
    "task_plan",
    "task_checkpoint",
    "task_decompose",
    "task_update",
    "task_evidence",
    "task_decision",
    "task_complete",
]);

export const PI_TASK_SCHEMA_FINGERPRINT =
    "originos-pi-tasks/v1:event-v2:cas:receipt:evidence-gate-no-force";

export class PiTaskContractError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = "PiTaskContractError";
        this.code = code;
        this.details = details;
    }
}

export function canonicalize(value) {
    if (value === null || typeof value !== "object") {
        if (typeof value === "number" && !Number.isFinite(value)) {
            throw new PiTaskContractError(
                "INVALID_CANONICAL_VALUE",
                "Task mutation payload cannot contain non-finite numbers",
            );
        }
        return value;
    }
    if (Array.isArray(value)) return value.map(canonicalize);
    const result = {};
    for (const key of Object.keys(value).sort()) {
        const child = value[key];
        if (child !== undefined) result[key] = canonicalize(child);
    }
    return result;
}

export function stableJson(value) {
    return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
    return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function mutationPayloadHash(command, input) {
    return sha256({ command, input });
}

export function stateHash(state) {
    const { events: _events, lastUpdatedAt: _lastUpdatedAt, ...stableState } = state;
    return sha256(stableState);
}

export function assertMutationCommand(command) {
    if (!PI_TASK_MUTATION_TOOLS.includes(command)) {
        throw new PiTaskContractError(
            "UNSUPPORTED_TASK_COMMAND",
            `Unsupported task mutation command: ${String(command)}`,
        );
    }
}

export function assertMutationRequest(request) {
    if (!request || typeof request !== "object") {
        throw new PiTaskContractError("INVALID_REQUEST", "Task mutation request is required");
    }
    if (request.version !== 1) {
        throw new PiTaskContractError(
            "UNSUPPORTED_REQUEST_VERSION",
            `Unsupported task mutation request version: ${String(request.version)}`,
        );
    }
    if (typeof request.requestId !== "string" || !request.requestId.trim()) {
        throw new PiTaskContractError("INVALID_REQUEST_ID", "requestId is required");
    }
    assertMutationCommand(request.command);
    if (!Number.isInteger(request.expectedRevision) || request.expectedRevision < 0) {
        throw new PiTaskContractError(
            "INVALID_EXPECTED_REVISION",
            "expectedRevision must be a non-negative integer",
        );
    }
    if (request.expectedCursor !== null && typeof request.expectedCursor !== "string") {
        throw new PiTaskContractError(
            "INVALID_EXPECTED_CURSOR",
            "expectedCursor must be a string or null",
        );
    }
    if (!request.input || typeof request.input !== "object" || Array.isArray(request.input)) {
        throw new PiTaskContractError("INVALID_INPUT", "input must be an object");
    }
    return {
        ...request,
        requestId: request.requestId.trim(),
        payloadHash: mutationPayloadHash(request.command, request.input),
    };
}
