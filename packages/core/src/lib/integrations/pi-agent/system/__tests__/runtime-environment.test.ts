import { describe, expect, it } from "vitest";
import {
	appendRuntimeEnvironmentPrompt,
	buildRuntimeEnvironmentPrompt,
	getRuntimeEnvironment,
} from "../runtime-environment";

describe("runtime environment prompt", () => {
	it("describes Windows PowerShell and forbids Bash heredoc", () => {
		const environment = getRuntimeEnvironment({
			platform: "win32",
			arch: "x64",
			env: {},
		});
		const prompt = buildRuntimeEnvironmentPrompt(environment);

		expect(environment).toMatchObject({
			os: "Windows",
			arch: "x64",
			pathSeparator: "\\",
		});
		expect(prompt).toContain("PowerShell");
		expect(prompt).toContain("python - <<'PY'");
		expect(prompt).toContain("Never use Bash heredoc");
		expect(prompt).toContain("Windows paths");
	});

	it("uses the configured POSIX shell and forward-slash paths", () => {
		const environment = getRuntimeEnvironment({
			platform: "linux",
			arch: "arm64",
			env: { SHELL: "/bin/zsh" },
		});

		expect(environment.defaultShell).toBe("/bin/zsh");
		expect(environment.pathSeparator).toBe("/");
		expect(buildRuntimeEnvironmentPrompt(environment)).toContain("Linux");
	});

	it("uses cmd-specific constraints when cmd is the selected Windows shell", () => {
		const environment = getRuntimeEnvironment({
			platform: "win32",
			arch: "x64",
			env: {},
			defaultShell: "C:\\Windows\\System32\\cmd.exe",
		});
		const prompt = buildRuntimeEnvironmentPrompt(environment);

		expect(environment.defaultShell).toContain("cmd.exe");
		expect(prompt).toContain("cmd-compatible");
		expect(prompt).not.toContain("PowerShell here-string (@'");
	});

	it("appends environment constraints without replacing the caller prompt", () => {
		const environment = getRuntimeEnvironment({
			platform: "win32",
			arch: "x64",
			env: {},
		});

		const prompt = appendRuntimeEnvironmentPrompt(
			"Original system instruction",
			environment,
		);

		expect(prompt).toContain("Original system instruction");
		expect(prompt).toContain("## Runtime Environment");
	});

	it("replaces an existing runtime block instead of appending duplicates", () => {
		const windows = getRuntimeEnvironment({
			platform: "win32",
			arch: "x64",
			env: {},
		});
		const first = appendRuntimeEnvironmentPrompt("Base prompt", windows);
		const second = appendRuntimeEnvironmentPrompt(first, windows);

		expect(second.match(/## Runtime Environment/g)).toHaveLength(1);
		expect(second.match(/originos-runtime-environment:start/g)).toHaveLength(1);
	});
});
