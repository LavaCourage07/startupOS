import { describe, expect, it } from "vitest";
import { getToolEventStatus } from "../tool-event-status";

describe("getToolEventStatus", () => {
	it("treats a successful structured result as successful", () => {
		expect(getToolEventStatus({
			result: {
				details: { success: true, exitCode: 0 },
			},
		})).toEqual({ failed: false });
	});

	it("recognizes an SDK tool error", () => {
		expect(getToolEventStatus({ isError: true })).toMatchObject({
			failed: true,
			reason: "SDK reported tool execution error",
		});
	});

	it("retains plain-text SDK failure details", () => {
		expect(getToolEventStatus({
			isError: true,
			result: {
				content: [{
					type: "text",
					text: "Access denied while reading the attachment",
				}],
			},
		})).toEqual({
			failed: true,
			reason: "Access denied while reading the attachment",
		});
	});

	it("retains structured failure details when the SDK also marks an error", () => {
		expect(getToolEventStatus({
			isError: true,
			result: {
				details: {
					success: false,
					exitCode: 9,
					error: "spawn failed",
				},
			},
		})).toEqual({
			failed: true,
			exitCode: 9,
			reason: "spawn failed",
		});
	});

	it("recognizes a business failure in result details", () => {
		expect(getToolEventStatus({
			result: {
				details: {
					success: false,
					exitCode: 1,
					stderr: "PowerShell parser error",
				},
			},
		})).toEqual({
			failed: true,
			exitCode: 1,
			reason: "PowerShell parser error",
		});
	});

	it("recognizes a non-zero exit code without an explicit success flag", () => {
		expect(getToolEventStatus({
			result: {
				details: { exitCode: 127 },
			},
		})).toEqual({
			failed: true,
			exitCode: 127,
			reason: "exitCode=127",
		});
	});

	it("recognizes a structured JSON result in a text content block", () => {
		expect(getToolEventStatus({
			result: {
				content: [{
					type: "text",
					text: JSON.stringify({
						success: false,
						error: "command timed out",
					}),
				}],
			},
		})).toEqual({
			failed: true,
			exitCode: undefined,
			reason: "command timed out",
		});
	});

	it("ignores non-JSON tool output that contains error-like text", () => {
		expect(getToolEventStatus({
			result: {
				content: [{ type: "text", text: "error examples in documentation" }],
			},
		})).toEqual({ failed: false });
	});
});
