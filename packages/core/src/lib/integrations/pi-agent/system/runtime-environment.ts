export interface RuntimeEnvironment {
	platform: NodeJS.Platform;
	os: string;
	arch: string;
	defaultShell: string;
	pathSeparator: "/" | "\\";
	syntaxConstraints: string[];
}

export interface RuntimeEnvironmentInput {
	platform?: NodeJS.Platform;
	arch?: string;
	env?: NodeJS.ProcessEnv;
	defaultShell?: string;
}

const RUNTIME_PROMPT_START = "<!-- originos-runtime-environment:start -->";
const RUNTIME_PROMPT_END = "<!-- originos-runtime-environment:end -->";

function getOperatingSystemName(platform: NodeJS.Platform): string {
	switch (platform) {
		case "win32":
			return "Windows";
		case "darwin":
			return "macOS";
		case "linux":
			return "Linux";
		default:
			return platform;
	}
}

function getDefaultShell(
	platform: NodeJS.Platform,
	env: NodeJS.ProcessEnv,
): string {
	if (platform === "win32") {
		return "PowerShell (pwsh.exe/powershell.exe; cmd.exe fallback)";
	}
	return env["SHELL"] || "/bin/sh";
}

export function getRuntimeEnvironment(
	input: RuntimeEnvironmentInput = {},
): RuntimeEnvironment {
	const platform = input.platform ?? process.platform;
	const arch = input.arch ?? process.arch;
	const env = input.env ?? process.env;
	const isWindows = platform === "win32";

	return {
		platform,
		os: getOperatingSystemName(platform),
		arch,
		defaultShell: input.defaultShell || getDefaultShell(platform, env),
		pathSeparator: isWindows ? "\\" : "/",
		syntaxConstraints: isWindows
			? environmentConstraintsForWindows(input.defaultShell)
			: [
						"Use POSIX-compatible shell syntax unless the reported default shell requires otherwise.",
						"Quote paths containing spaces and use forward-slash paths.",
						"If a command fails because of shell syntax, retry with syntax compatible with the reported shell.",
					],
	};
}

function environmentConstraintsForWindows(defaultShell?: string): string[] {
	const shell = (defaultShell || "PowerShell").toLowerCase();
	if (shell.includes("cmd")) {
		return [
			"execute_command uses cmd.exe. Write cmd-compatible commands.",
			"Never use Bash heredoc syntax, PowerShell here-strings, or Unix-only commands.",
			"Use Windows paths and quote paths containing spaces.",
			"If a command fails because of shell syntax, immediately retry with an equivalent cmd.exe command.",
		];
	}
	if (shell.includes("bash")) {
		return [
			"execute_command uses Bash on Windows. Write Bash-compatible commands while preserving Windows path semantics.",
			"Quote paths containing spaces and do not assume PowerShell cmdlets are available.",
			"If a command fails because of shell syntax, immediately retry with syntax compatible with Bash.",
		];
	}
	return [
						"execute_command uses PowerShell. Write PowerShell-compatible commands.",
						"Never use Bash heredoc syntax such as <<EOF or python - <<'PY'. PowerShell cannot parse it.",
						"For multiline stdin, use a PowerShell here-string (@' ... '@) piped to the command, or use a PowerShell-native command.",
						"Use Windows paths and quote paths containing spaces. Do not assume bash, grep, sed, find, or other Unix commands exist.",
						"If a command fails because of shell syntax, immediately retry with an equivalent PowerShell command instead of only promising to continue.",
					];
}

export function buildRuntimeEnvironmentPrompt(
	environment: RuntimeEnvironment = getRuntimeEnvironment(),
): string {
	const constraints = environment.syntaxConstraints
		.map((constraint) => `- ${constraint}`)
		.join("\n");

	return [
		"## Runtime Environment",
		"",
		`- Operating system: ${environment.os} (${environment.platform})`,
		`- Architecture: ${environment.arch}`,
		`- Default command shell: ${environment.defaultShell}`,
		`- Native path separator: ${environment.pathSeparator}`,
		"",
		"### Command and path constraints",
		constraints,
	].join("\n");
}

export function appendRuntimeEnvironmentPrompt(
	systemPrompt: string,
	environment: RuntimeEnvironment = getRuntimeEnvironment(),
): string {
	const startIndex = systemPrompt.indexOf(RUNTIME_PROMPT_START);
	const endIndex = systemPrompt.indexOf(RUNTIME_PROMPT_END);
	const withoutExistingBlock =
		startIndex >= 0 && endIndex > startIndex
			? `${systemPrompt.slice(0, startIndex)}${systemPrompt.slice(
					endIndex + RUNTIME_PROMPT_END.length,
				)}`
			: systemPrompt;
	const basePrompt = withoutExistingBlock.trimEnd();
	const runtimeBlock = [
		RUNTIME_PROMPT_START,
		buildRuntimeEnvironmentPrompt(environment),
		RUNTIME_PROMPT_END,
	].join("\n");

	return basePrompt ? `${basePrompt}\n\n${runtimeBlock}` : runtimeBlock;
}
