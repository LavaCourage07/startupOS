import { describe, expect, it } from "vitest";

import {
	buildCompletionJudgePrompt,
	parseCompletionJudgeDecision,
} from "../completion-judge";

describe("completion judge", () => {
	it("builds context from the user goal, response, and tool trace", () => {
		const prompt = buildCompletionJudgePrompt({
			userRequest: "生成候选人评估报告",
			assistantResponse: "我会先读取简历，然后生成报告。",
			toolTrace: ["read_file: succeeded"],
		});

		expect(prompt).toContain("生成候选人评估报告");
		expect(prompt).toContain("我会先读取简历");
		expect(prompt).toContain("read_file: succeeded");
	});

	it("parses strict JSON and fenced JSON decisions", () => {
		expect(parseCompletionJudgeDecision(
			'{"status":"incomplete","reason":"only promised future work"}',
		)).toEqual({
			status: "incomplete",
			reason: "only promised future work",
		});
		expect(parseCompletionJudgeDecision(
			'```json\n{"status":"blocked","reason":"missing file"}\n```',
		)).toEqual({
			status: "blocked",
			reason: "missing file",
		});
	});

	it("rejects invalid judge output", () => {
		expect(() => parseCompletionJudgeDecision("not json")).toThrow(
			"no JSON object",
		);
		expect(() => parseCompletionJudgeDecision(
			'{"status":"unknown","reason":"invalid"}',
		)).toThrow("invalid status");
	});
});
