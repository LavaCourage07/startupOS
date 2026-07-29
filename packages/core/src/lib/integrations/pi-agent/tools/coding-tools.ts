/**
 * Coding 工具
 * 提供代码搜索和文件发现能力，参考 Claude Code GrepTool / GlobTool 实现
 */

import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import type { AgentToolResult, AgentToolUpdateCallback } from "@originos/pi-agent-adapter";
import type { ToolRegistration } from "../types";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { getDataRoot } from '../../../paths';
import { getToolContext } from "./context";

// ============================================================================
// 工具目录解析
// ============================================================================

function resolveBaseDir(): string {
	const ctx = getToolContext();
	return ctx.workingDirectory || getDataRoot();
}

function checkAbort(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new DOMException("Tool execution was aborted", "AbortError");
	}
}

function sendProgress(
	onUpdate: AgentToolUpdateCallback<unknown> | undefined,
	signal: AbortSignal | undefined,
	message: string,
): void {
	if (!onUpdate || signal?.aborted) return;
	onUpdate({
		content: [{ type: "text" as const, text: message }],
		details: { status: "in_progress", message, timestamp: Date.now() },
	});
}

// ============================================================================
// 工具: search_code (ripgrep)
// 参考 Claude Code GrepTool — 正则搜索，按 mtime 排序，自动排除 VCS 目录
// ============================================================================

const SearchCodeParamsSchema = Type.Object({
	pattern: Type.String({
		description: "正则表达式搜索模式",
	}),
	path: Type.Optional(Type.String({
		description: "搜索目录或文件路径（相对于项目根目录），默认为项目根目录",
	})),
	glob: Type.Optional(Type.String({
		description: "文件过滤 glob 模式，例如 '*.ts' 或 '**/*.tsx'",
	})),
	output_mode: Type.Optional(Type.Union([
		Type.Literal("files_with_matches"),
		Type.Literal("content"),
		Type.Literal("count"),
	], {
		description: "输出模式：files_with_matches（默认，仅文件路径）、content（匹配行内容）、count（匹配数量）",
		default: "files_with_matches",
	})),
	case_insensitive: Type.Optional(Type.Boolean({
		description: "是否忽略大小写，默认 false",
		default: false,
	})),
	context_lines: Type.Optional(Type.Number({
		description: "content 模式下，匹配行前后显示的上下文行数",
		default: 0,
	})),
	head_limit: Type.Optional(Type.Number({
		description: "最多返回的结果数量，默认 50，0 表示不限制",
		default: 50,
	})),
	multiline: Type.Optional(Type.Boolean({
		description: "是否启用多行匹配模式（. 匹配换行符），默认 false",
		default: false,
	})),
});

// VCS 目录排除列表（参考 Claude Code GrepTool）
const VCS_EXCLUDE_DIRS = [".git", ".svn", ".hg", ".bzr", ".jj", ".sl", "node_modules", ".next", "dist", "build"];

async function runRipgrep(
	args: string[],
	cwd: string,
	signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
	return new Promise((resolve, reject) => {
		const rg = spawn("rg", args, { cwd, env: process.env });

		let stdout = "";
		let stderr = "";

		rg.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
		rg.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

		rg.on("close", (code) => resolve({ stdout, stderr, exitCode: code }));
		rg.on("error", reject);

		signal?.addEventListener("abort", () => {
			rg.kill();
			reject(new DOMException("Aborted", "AbortError"));
		});
	});
}

const SearchCodeTool: ToolRegistration = {
	name: "search_code",
	label: "搜索代码",
	description: "使用正则表达式在代码库中搜索内容。支持文件过滤、上下文行、大小写忽略等选项。结果按最近修改时间排序。",
	parameters: SearchCodeParamsSchema,
	category: "file",
	enabled: true,
	async execute(
		_toolCallId: string,
		params: Static<typeof SearchCodeParamsSchema>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<unknown>,
	): Promise<AgentToolResult<unknown>> {
		try {
			checkAbort(signal);
			const baseDir = resolveBaseDir();
			const searchPath = params.path
				? path.resolve(baseDir, params.path)
				: baseDir;

			sendProgress(onUpdate, signal, `搜索: ${params.pattern}`);

			const outputMode = params.output_mode ?? "files_with_matches";
			const headLimit = params.head_limit ?? 50;

			// 构建 rg 参数
			const args: string[] = [
				"--no-heading",
				"--max-columns", "500",   // 防止 base64/minified 噪音
			];

			// 排除 VCS 和构建目录
			for (const dir of VCS_EXCLUDE_DIRS) {
				args.push("--glob", `!${dir}/**`);
			}

			if (params.case_insensitive) args.push("--ignore-case");
			if (params.multiline) args.push("--multiline", "--multiline-dotall");
			if (params.glob) args.push("--glob", params.glob);

			switch (outputMode) {
				case "files_with_matches":
					args.push("--files-with-matches");
					break;
				case "count":
					args.push("--count");
					break;
				case "content":
					args.push("--line-number");
					if (params.context_lines && params.context_lines > 0) {
						args.push("--context", String(params.context_lines));
					}
					break;
			}

			args.push(params.pattern, searchPath);

			const { stdout, exitCode } = await runRipgrep(args, baseDir, signal);
			checkAbort(signal);

			if (exitCode === 2) {
				return {
					content: [{ type: "text", text: JSON.stringify({ success: false, error: "ripgrep 未安装或搜索出错" }) }],
					details: { success: false },
				};
			}

			// 解析结果
			let lines = stdout.trim() ? stdout.trim().split("\n") : [];

			// 对 files_with_matches 按 mtime 排序（最近修改优先，参考 Claude Code）
			if (outputMode === "files_with_matches" && lines.length > 0) {
				const withMtime = await Promise.all(
					lines.map(async (f) => {
						try {
							const stat = await fs.stat(path.isAbsolute(f) ? f : path.join(baseDir, f));
							return { file: f, mtime: stat.mtimeMs };
						} catch {
							return { file: f, mtime: 0 };
						}
					})
				);
				withMtime.sort((a, b) => b.mtime - a.mtime);
				lines = withMtime.map((x) => x.file);
			}

			// 限制结果数量
			const truncated = headLimit > 0 && lines.length > headLimit;
			if (truncated) lines = lines.slice(0, headLimit);

			// 转换为相对路径（节省 token）
			lines = lines.map((l) =>
				path.isAbsolute(l) ? path.relative(baseDir, l) : l
			);

			const result = {
				success: true,
				pattern: params.pattern,
				output_mode: outputMode,
				count: lines.length,
				truncated,
				results: lines,
			};

			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
				details: result,
			};
		} catch (error: any) {
			const msg = error instanceof Error ? error.message : String(error);
			return {
				content: [{ type: "text", text: JSON.stringify({ success: false, error: msg }) }],
				details: { success: false, error: msg },
			};
		}
	},
};

// ============================================================================
// 工具: glob_files
// 参考 Claude Code GlobTool — glob 模式文件发现，按 mtime 排序
// ============================================================================

const GlobFilesParamsSchema = Type.Object({
	pattern: Type.String({
		description: "glob 模式，例如 '**/*.ts'、'src/**/*.tsx'、'*.json'",
	}),
	path: Type.Optional(Type.String({
		description: "搜索根目录（相对于项目根目录），默认为项目根目录",
	})),
	head_limit: Type.Optional(Type.Number({
		description: "最多返回的文件数量，默认 100",
		default: 100,
	})),
});

const GlobFilesTool: ToolRegistration = {
	name: "glob_files",
	label: "文件发现",
	description: "使用 glob 模式查找文件。结果按最近修改时间排序，适合快速定位相关文件。",
	parameters: GlobFilesParamsSchema,
	category: "file",
	enabled: true,
	async execute(
		_toolCallId: string,
		params: Static<typeof GlobFilesParamsSchema>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<unknown>,
	): Promise<AgentToolResult<unknown>> {
		try {
			checkAbort(signal);
			const baseDir = resolveBaseDir();
			const searchRoot = params.path
				? path.resolve(baseDir, params.path)
				: baseDir;

			sendProgress(onUpdate, signal, `查找文件: ${params.pattern}`);

			// 验证搜索根目录存在
			try {
				const stat = await fs.stat(searchRoot);
				if (!stat.isDirectory()) {
					return {
						content: [{ type: "text", text: JSON.stringify({ success: false, error: `路径不是目录: ${params.path}` }) }],
						details: { success: false },
					};
				}
			} catch {
				return {
					content: [{ type: "text", text: JSON.stringify({ success: false, error: `目录不存在: ${params.path}` }) }],
					details: { success: false },
				};
			}

			// 使用 rg --files + glob 过滤（比 node glob 更快）
			const args = [
				"--files",
				"--glob", params.pattern,
				"--glob", "!.git/**",
				"--glob", "!node_modules/**",
				"--glob", "!.next/**",
				"--glob", "!dist/**",
				searchRoot,
			];

			const { stdout, exitCode } = await runRipgrep(args, baseDir, signal);
			checkAbort(signal);

			if (exitCode === 2) {
				return {
					content: [{ type: "text", text: JSON.stringify({ success: false, error: "ripgrep 未安装" }) }],
					details: { success: false },
				};
			}

			let files = stdout.trim() ? stdout.trim().split("\n") : [];

			// 按 mtime 排序（最近修改优先）
			if (files.length > 0) {
				const withMtime = await Promise.all(
					files.map(async (f) => {
						try {
							const stat = await fs.stat(f);
							return { file: f, mtime: stat.mtimeMs };
						} catch {
							return { file: f, mtime: 0 };
						}
					})
				);
				withMtime.sort((a, b) => b.mtime - a.mtime);
				files = withMtime.map((x) => x.file);
			}

			const limit = params.head_limit ?? 100;
			const truncated = files.length > limit;
			if (truncated) files = files.slice(0, limit);

			// 转换为相对路径
			files = files.map((f) =>
				path.isAbsolute(f) ? path.relative(baseDir, f) : f
			);

			const result = {
				success: true,
				pattern: params.pattern,
				count: files.length,
				truncated,
				files,
			};

			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
				details: result,
			};
		} catch (error: any) {
			const msg = error instanceof Error ? error.message : String(error);
			return {
				content: [{ type: "text", text: JSON.stringify({ success: false, error: msg }) }],
				details: { success: false, error: msg },
			};
		}
	},
};

// ============================================================================
// 导出
// ============================================================================

export const codingTools: ToolRegistration[] = [
	SearchCodeTool,
	GlobFilesTool,
];
