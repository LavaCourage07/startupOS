type UnknownRecord = Record<string, unknown>;

export interface ToolEventStatus {
	failed: boolean;
	exitCode?: number | null;
	reason?: string;
}

function asRecord(value: unknown): UnknownRecord | undefined {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? value as UnknownRecord
		: undefined;
}

function parseStructuredText(value: unknown): UnknownRecord | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	try {
		return asRecord(JSON.parse(value));
	} catch {
		return undefined;
	}
}

function getStructuredResult(result: unknown): UnknownRecord[] {
	const resultRecord = asRecord(result);
	if (!resultRecord) {
		return [];
	}

	const candidates = [resultRecord];
	const details = asRecord(resultRecord["details"]);
	if (details) {
		candidates.unshift(details);
	}

	const content = resultRecord["content"];
	if (Array.isArray(content)) {
		for (const block of content) {
			const blockRecord = asRecord(block);
			const parsed = parseStructuredText(blockRecord?.["text"]);
			if (parsed) {
				candidates.push(parsed);
			}
		}
	}

	return candidates;
}

function getTextResult(result: unknown): string | undefined {
	const resultRecord = asRecord(result);
	const content = resultRecord?.["content"];
	if (!Array.isArray(content)) {
		return undefined;
	}
	const text = content
		.map((block) => {
			const record = asRecord(block);
			return typeof record?.["text"] === "string" ? record["text"] : "";
		})
		.filter(Boolean)
		.join("\n")
		.trim();
	return text || undefined;
}

function getReason(record: UnknownRecord, exitCode?: number | null): string | undefined {
	for (const key of ["error", "message", "stderr"] as const) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}

	return exitCode !== undefined && exitCode !== null
		? `exitCode=${exitCode}`
		: undefined;
}

export function getToolEventStatus(event: {
	isError?: boolean;
	result?: unknown;
}): ToolEventStatus {
	for (const candidate of getStructuredResult(event.result)) {
		const exitCode = typeof candidate["exitCode"] === "number"
			? candidate["exitCode"]
			: undefined;
		const failed = candidate["success"] === false
			|| (exitCode !== undefined && exitCode !== 0)
			|| (typeof candidate["error"] === "string" && candidate["error"].trim().length > 0);

		if (failed) {
			return {
				failed: true,
				exitCode,
				reason: getReason(candidate, exitCode),
			};
		}
	}

	if (event.isError) {
		return {
			failed: true,
			reason: getTextResult(event.result) || "SDK reported tool execution error",
		};
	}

	return { failed: false };
}
