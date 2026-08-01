import {
    assertMutationRequest,
    createMutationReceipt,
    PI_TASK_MUTATION_TOOLS,
    PiTaskContractError,
    stateHash,
} from "./contracts.js";
import { createEmptyState, TASK_EVENT_CUSTOM_TYPE, } from "./model.js";
import { reduceTaskState, TaskTransitionError } from "./reducer.js";

export function createTaskRuntimeStore(initialState = createEmptyState()) {
    let state = initialState;
    let metadata = createEmptyMetadata(state);
    let requestIndex = new Map();
    return {
        getState() {
            return state;
        },
        getMetadata() {
            return cloneMetadata(metadata);
        },
        replay(branchEntries) {
            const replayed = replayBranchEntries(branchEntries);
            state = replayed.state;
            metadata = replayed.metadata;
            requestIndex = new Map(replayed.receipts.map((receipt) => [receipt.requestId, receipt]));
            return replayed;
        },
        mutate(request, event, persistence) {
            const normalized = assertMutationRequest(request);
            assertCommandEventPair(normalized.command, event);
            const previous = requestIndex.get(normalized.requestId);
            if (previous) {
                if (previous.command !== normalized.command || previous.payloadHash !== normalized.payloadHash) {
                    throw new PiTaskContractError(
                        "DUPLICATE_REQUEST_CONFLICT",
                        `requestId ${normalized.requestId} was already used with different content`,
                        { requestId: normalized.requestId },
                    );
                }
                return {
                    state,
                    metadata: cloneMetadata(metadata),
                    receipt: Object.freeze({ ...previous, replayed: true }),
                };
            }
            assertCas(normalized, metadata);
            const nextState = reduceTaskState(state, event);
            const revisionBefore = metadata.revision;
            const cursorBefore = metadata.cursor;
            const envelope = Object.freeze({
                version: 2,
                kind: "mutation",
                revision: revisionBefore + 1,
                parentCursor: cursorBefore,
                requestId: normalized.requestId,
                payloadHash: normalized.payloadHash,
                command: normalized.command,
                event,
            });
            const cursorAfter = appendAndReadCursor(envelope, persistence);
            const receipt = createMutationReceipt({
                request: normalized,
                revisionBefore,
                revisionAfter: revisionBefore + 1,
                cursorBefore,
                cursorAfter,
                event,
                nextState,
            });
            state = nextState;
            requestIndex.set(receipt.requestId, receipt);
            metadata = buildMetadata(
                state,
                receipt.revisionAfter,
                receipt.cursorAfter,
                requestIndex,
                metadata.integrity,
                receipt,
            );
            return { state, metadata: cloneMetadata(metadata), receipt };
        },
        checkpoint(event, persistence) {
            if (!isV1TaskEvent(event) || event.type !== "task.snapshot") {
                throw new PiTaskContractError(
                    "INVALID_SNAPSHOT_EVENT",
                    "Compaction checkpoint requires a v1 task.snapshot business event",
                );
            }
            const nextState = reduceTaskState(state, event);
            const envelope = Object.freeze({
                version: 2,
                kind: "snapshot",
                revision: metadata.revision,
                parentCursor: metadata.cursor,
                event,
                checkpoint: Object.freeze({
                    version: 1,
                    stateHash: stateHash(nextState),
                    receipts: [...requestIndex.values()].map((receipt) => ({ ...receipt, replayed: false })),
                }),
            });
            const cursorAfter = appendAndReadCursor(envelope, persistence);
            state = nextState;
            metadata = buildMetadata(
                state,
                metadata.revision,
                cursorAfter,
                requestIndex,
                metadata.integrity,
                metadata.latestReceipt,
            );
            return { state, metadata: cloneMetadata(metadata), envelope };
        },
    };
}

export function replayBranchEntries(entries) {
    let state = createEmptyState();
    let revision = 0;
    let cursor = null;
    let latestReceipt;
    const malformedEvents = [];
    const integrity = [];
    const acceptedCursors = new Set();
    const requestIndex = new Map();
    let acceptedEntryCount = 0;

    for (const entry of entries) {
        if (entry.type !== "custom" || entry.customType !== TASK_EVENT_CUSTOM_TYPE)
            continue;
        const entryCursor = normalizeEntryCursor(entry.id);
        if (!entryCursor) {
            recordDiagnostic(malformedEvents, integrity, "Task ledger entry is missing a Session cursor");
            continue;
        }
        if (acceptedCursors.has(entryCursor)) {
            recordDiagnostic(malformedEvents, integrity, `Duplicate task ledger cursor ignored: ${entryCursor}`);
            continue;
        }
        const data = entry.data;
        if (isV1TaskEvent(data)) {
            try {
                state = reduceTaskState(state, data);
                revision += 1;
                cursor = entryCursor;
                acceptedCursors.add(entryCursor);
                acceptedEntryCount += 1;
            }
            catch (error) {
                recordDiagnostic(
                    malformedEvents,
                    integrity,
                    `Entry ${entryCursor}: ${errorText(error)}`,
                );
            }
            continue;
        }
        if (!isV2Envelope(data)) {
            recordDiagnostic(malformedEvents, integrity, `Entry ${entryCursor} is not a pi-tasks event`);
            continue;
        }
        if (data.kind === "snapshot") {
            const replayed = replaySnapshotEnvelope({
                envelope: data,
                entryCursor,
                state,
                revision,
                cursor,
                requestIndex,
                allowBootstrap: acceptedEntryCount === 0,
            });
            if (replayed.error) {
                recordDiagnostic(malformedEvents, integrity, replayed.error);
                continue;
            }
            state = replayed.state;
            revision = replayed.revision;
            cursor = entryCursor;
            latestReceipt = replayed.latestReceipt ?? latestReceipt;
            acceptedCursors.add(entryCursor);
            acceptedEntryCount += 1;
            continue;
        }
        const existing = requestIndex.get(data.requestId);
        if (existing) {
            if (existing.command !== data.command || existing.payloadHash !== data.payloadHash) {
                recordDiagnostic(
                    malformedEvents,
                    integrity,
                    `Conflicting duplicate request ignored: ${data.requestId}`,
                );
            }
            else {
                recordDiagnostic(
                    malformedEvents,
                    integrity,
                    `Duplicate request entry ignored: ${data.requestId}`,
                );
            }
            continue;
        }
        if (data.revision !== revision + 1 || data.parentCursor !== cursor) {
            recordDiagnostic(
                malformedEvents,
                integrity,
                `Out-of-order task event ignored at ${entryCursor}: expected revision ${revision + 1} and parent ${String(cursor)}`,
            );
            continue;
        }
        try {
            const nextState = reduceTaskState(state, data.event);
            const receipt = createMutationReceipt({
                request: {
                    version: 1,
                    requestId: data.requestId,
                    command: data.command,
                    expectedRevision: revision,
                    expectedCursor: cursor,
                    input: {},
                    payloadHash: data.payloadHash,
                },
                revisionBefore: revision,
                revisionAfter: data.revision,
                cursorBefore: cursor,
                cursorAfter: entryCursor,
                event: data.event,
                nextState,
            });
            state = nextState;
            revision = data.revision;
            cursor = entryCursor;
            latestReceipt = receipt;
            requestIndex.set(receipt.requestId, receipt);
            acceptedCursors.add(entryCursor);
            acceptedEntryCount += 1;
        }
        catch (error) {
            recordDiagnostic(malformedEvents, integrity, `Entry ${entryCursor}: ${errorText(error)}`);
        }
    }
    if (malformedEvents.length > 0) state.warnings.push(...malformedEvents);
    const metadata = buildMetadata(state, revision, cursor, requestIndex, integrity, latestReceipt);
    return {
        state,
        metadata,
        receipts: [...requestIndex.values()],
        malformedEvents,
    };
}

export function snapshotState(state) {
    const { events: _events, ...snapshot } = state;
    return snapshot;
}

function replaySnapshotEnvelope({
    envelope,
    entryCursor,
    state,
    revision,
    cursor,
    requestIndex,
    allowBootstrap,
}) {
    if (!isV1TaskEvent(envelope.event) || envelope.event.type !== "task.snapshot") {
        return { error: `Snapshot entry ${entryCursor} has an invalid business event` };
    }
    if (!isCheckpoint(envelope.checkpoint)) {
        return { error: `Snapshot entry ${entryCursor} has invalid checkpoint metadata` };
    }
    if (!allowBootstrap && (envelope.revision !== revision || envelope.parentCursor !== cursor)) {
        return {
            error: `Out-of-order task snapshot ignored at ${entryCursor}: expected revision ${revision} and parent ${String(cursor)}`,
        };
    }
    try {
        const nextState = reduceTaskState(state, envelope.event);
        if (stateHash(nextState) !== envelope.checkpoint.stateHash) {
            return { error: `Snapshot entry ${entryCursor} failed state hash validation` };
        }
        if (allowBootstrap) requestIndex.clear();
        let latestReceipt;
        for (const receipt of envelope.checkpoint.receipts) {
            if (!isMutationReceipt(receipt)) {
                return { error: `Snapshot entry ${entryCursor} contains an invalid receipt` };
            }
            const existing = requestIndex.get(receipt.requestId);
            if (existing &&
                (existing.command !== receipt.command || existing.payloadHash !== receipt.payloadHash)) {
                return { error: `Snapshot entry ${entryCursor} contains conflicting request ${receipt.requestId}` };
            }
            const normalized = Object.freeze({ ...receipt, replayed: false });
            requestIndex.set(receipt.requestId, normalized);
            if (!latestReceipt || normalized.revisionAfter > latestReceipt.revisionAfter) {
                latestReceipt = normalized;
            }
        }
        return {
            state: nextState,
            revision: allowBootstrap ? envelope.revision : revision,
            latestReceipt,
        };
    }
    catch (error) {
        return { error: `Snapshot entry ${entryCursor}: ${errorText(error)}` };
    }
}

function appendAndReadCursor(envelope, persistence) {
    if (!persistence || typeof persistence.appendEntry !== "function" || typeof persistence.getBranch !== "function") {
        throw new PiTaskContractError(
            "INVALID_PERSISTENCE",
            "Task mutation persistence requires appendEntry() and getBranch()",
        );
    }
    persistence.appendEntry(TASK_EVENT_CUSTOM_TYPE, envelope);
    const branch = persistence.getBranch();
    const tail = Array.isArray(branch) ? branch.at(-1) : undefined;
    if (!tail ||
        tail.type !== "custom" ||
        tail.customType !== TASK_EVENT_CUSTOM_TYPE ||
        !sameEnvelope(tail.data, envelope)) {
        throw new PiTaskContractError(
            "CURSOR_CONFIRMATION_FAILED",
            "Appended task event is not the current Session branch tail",
        );
    }
    const cursor = normalizeEntryCursor(tail.id);
    if (!cursor) {
        throw new PiTaskContractError(
            "CURSOR_CONFIRMATION_FAILED",
            "Appended task event has no stable Session entry cursor",
        );
    }
    return cursor;
}

function sameEnvelope(actual, expected) {
    if (!actual || typeof actual !== "object") return false;
    if (actual.version !== 2 || actual.kind !== expected.kind || actual.revision !== expected.revision)
        return false;
    if (expected.kind === "mutation") {
        return actual.requestId === expected.requestId && actual.payloadHash === expected.payloadHash;
    }
    return actual.event?.id === expected.event.id && actual.checkpoint?.stateHash === expected.checkpoint.stateHash;
}

function assertCas(request, metadata) {
    if (request.expectedRevision !== metadata.revision) {
        throw new PiTaskContractError(
            "REVISION_CONFLICT",
            `Expected revision ${request.expectedRevision}, current revision is ${metadata.revision}`,
            { expectedRevision: request.expectedRevision, actualRevision: metadata.revision },
        );
    }
    if (request.expectedCursor !== metadata.cursor) {
        throw new PiTaskContractError(
            "BRANCH_CONFLICT",
            `Expected cursor ${String(request.expectedCursor)}, current cursor is ${String(metadata.cursor)}`,
            { expectedCursor: request.expectedCursor, actualCursor: metadata.cursor },
        );
    }
}

function createEmptyMetadata(state) {
    return buildMetadata(state, 0, null, new Map(), [], undefined);
}

function buildMetadata(state, revision, cursor, requestIndex, integrity, latestReceipt) {
    return Object.freeze({
        revision,
        cursor,
        stateHash: stateHash(state),
        requestCount: requestIndex.size,
        integrity: Object.freeze([...integrity]),
        ...(latestReceipt ? { latestReceipt } : {}),
    });
}

function cloneMetadata(metadata) {
    return {
        ...metadata,
        integrity: [...metadata.integrity],
        ...(metadata.latestReceipt ? { latestReceipt: { ...metadata.latestReceipt } } : {}),
    };
}

function recordDiagnostic(malformedEvents, integrity, message) {
    malformedEvents.push(message);
    integrity.push(message);
}

function normalizeEntryCursor(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}

function isV1TaskEvent(value) {
    if (!value || typeof value !== "object") return false;
    return value.version === 1 && typeof value.id === "string" && typeof value.type === "string";
}

function isV2Envelope(value) {
    if (!value || typeof value !== "object" || value.version !== 2) return false;
    if (value.kind === "mutation") {
        return Number.isSafeInteger(value.revision) &&
            value.revision > 0 &&
            (value.parentCursor === null || typeof value.parentCursor === "string") &&
            typeof value.requestId === "string" &&
            value.requestId.length > 0 &&
            typeof value.payloadHash === "string" &&
            /^[a-f0-9]{64}$/.test(value.payloadHash) &&
            PI_TASK_MUTATION_TOOLS.includes(value.command) &&
            isV1TaskEvent(value.event) &&
            expectedEventType(value.command) === value.event.type;
    }
    return value.kind === "snapshot" &&
        Number.isSafeInteger(value.revision) &&
        value.revision >= 0 &&
        (value.parentCursor === null || typeof value.parentCursor === "string") &&
        isV1TaskEvent(value.event) &&
        isCheckpoint(value.checkpoint);
}

function assertCommandEventPair(command, event) {
    if (!isV1TaskEvent(event) || expectedEventType(command) !== event.type) {
        throw new PiTaskContractError(
            "COMMAND_EVENT_MISMATCH",
            `Task command ${command} cannot persist event ${String(event?.type)}`,
        );
    }
}

function expectedEventType(command) {
    switch (command) {
        case "task_plan": return "task.created";
        case "task_checkpoint": return "task.snapshot";
        case "task_decompose": return "task.steps_decomposed";
        case "task_update": return "task.updated";
        case "task_evidence": return "task.evidence_added";
        case "task_decision": return "task.decision_recorded";
        case "task_complete": return "task.completed";
        default: return undefined;
    }
}

function isCheckpoint(value) {
    return Boolean(value &&
        typeof value === "object" &&
        value.version === 1 &&
        typeof value.stateHash === "string" &&
        Array.isArray(value.receipts));
}

function isMutationReceipt(value) {
    return Boolean(value &&
        typeof value === "object" &&
        value.version === 1 &&
        typeof value.requestId === "string" &&
        typeof value.command === "string" &&
        Number.isInteger(value.revisionBefore) &&
        Number.isInteger(value.revisionAfter) &&
        (value.cursorBefore === null || typeof value.cursorBefore === "string") &&
        typeof value.cursorAfter === "string" &&
        typeof value.taskId === "string" &&
        typeof value.eventId === "string" &&
        typeof value.eventType === "string" &&
        typeof value.stateHash === "string" &&
        typeof value.payloadHash === "string");
}

export function errorText(error) {
    if (error instanceof TaskTransitionError || error instanceof PiTaskContractError)
        return error.message;
    if (error instanceof Error) return error.message;
    return String(error);
}
