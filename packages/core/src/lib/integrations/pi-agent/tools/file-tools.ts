/**
 * 文件系统工具
 * 提供基础的文件操作功能，参考 Claude Code FileReadTool/FileWriteTool/FileEditTool 实现
 */

import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import type { AgentToolResult, AgentToolUpdateCallback } from "@mariozechner/agent";
import type { ToolRegistration } from "../types";
import { promises as fs } from "fs";
import path from "path";
import { joinToolDisplayPath, normalizeToolDisplayPath, resolveToolPath } from "./path-utils";

// ============================================================================
// 数据目录配置
// ============================================================================

async function ensureDir(dirPath: string): Promise<void> {
	await fs.mkdir(dirPath, { recursive: true });
}

/**
 * 解析工具调用传入的相对路径，并强制限制在工具边界之内。
 *
 * - boundary 必须由上游（agent-manager / persistent-agent / skill-tools 等）
 *   通过 setToolContext / setDefaultContext 显式注入，工具层不再 fallback 到 process.cwd()。
 * - workingDirectory 是文件工具的唯一语义根。
 * - 传入路径不能是绝对路径，且 resolve 之后必须仍位于 boundary 内（防止 `..` 越界、
 *   symlink 越界等情形）。
 */
const resolveInsideBoundary = resolveToolPath;

function checkAbort(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new DOMException("Tool execution was aborted", "AbortError");
	}
}

// ============================================================================
// 工具执行辅助
// ============================================================================

interface ToolExecutionContext {
	toolCallId: string;
	toolName: string;
	signal?: AbortSignal;
	onUpdate?: AgentToolUpdateCallback<unknown>;
}

function createToolContext(
	toolCallId: string,
	toolName: string,
	signal?: AbortSignal,
	onUpdate?: AgentToolUpdateCallback<unknown>
): ToolExecutionContext {
	return { toolCallId, toolName, signal, onUpdate };
}

function sendProgress(ctx: ToolExecutionContext, message: string, progress?: number): void {
	if (!ctx.onUpdate || ctx.signal?.aborted) return;
	ctx.onUpdate({
		content: [{ type: "text" as const, text: message }],
		details: { status: "in_progress", message, progress, timestamp: Date.now() },
	});
}

function logToolStart(ctx: ToolExecutionContext, params: Record<string, unknown>): void {
	console.error(`[Tool:${ctx.toolName}] START_CALL_ID=${ctx.toolCallId}`, JSON.stringify(params, null, 2));
}

function logToolEnd(ctx: ToolExecutionContext, result: Record<string, unknown>): void {
	console.error(`[Tool:${ctx.toolName}] END_CALL_ID=${ctx.toolCallId}`, JSON.stringify(result, null, 2));
}

function logToolError(ctx: ToolExecutionContext, error: unknown): void {
	console.error(`[Tool:${ctx.toolName}] ERROR_CALL_ID=${ctx.toolCallId}`, error);
}

/**
 * 给文件内容添加行号（参考 Claude Code addLineNumbers）
 */
function addLineNumbers(content: string, startLine = 1): string {
	const lines = content.split("\n");
	const width = String(startLine + lines.length - 1).length;
	return lines
		.map((line, i) => `${String(startLine + i).padStart(width, " ")}\t${line}`)
		.join("\n");
}

// ============================================================================
// 文件内容校验
// 写入文件后按类型验证内容格式是否正确，避免产生脏数据
// ============================================================================

interface ValidationResult {
	valid: boolean;
	error?: string;
}

function validateFileContent(filePath: string, content: string): ValidationResult {
	const ext = path.extname(filePath).toLowerCase();

	switch (ext) {
		case ".json":
			try {
				JSON.parse(content);
				return { valid: true };
			} catch (e) {
				return { valid: false, error: `JSON 格式无效: ${(e as Error).message}` };
			}

		case ".md":
			// Markdown 校验：检查是否包含常见的格式问题
			// 1. 检查未闭合的代码块
			const codeBlockCount = (content.match(/```/g) || []).length;
			if (codeBlockCount % 2 !== 0) {
				return { valid: false, error: "Markdown 存在未闭合的代码块（``` 数量应为偶数）" };
			}
			return { valid: true };

		case ".yml":
		case ".yaml":
			// YAML 基础校验：检查缩进是否混合了 tab 和空格
			const hasTab = /^\t/m.test(content);
			const hasIndent = /^ {1,}/m.test(content);
			if (hasTab && hasIndent) {
				return { valid: false, error: "YAML 缩进混用了 tab 和空格" };
			}
			return { valid: true };

		case ".js":
		case ".ts":
		case ".jsx":
		case ".tsx":
			// JS/TS 基础校验：检查大括号是否匹配（简单启发式）
			const openBraces = (content.match(/{/g) || []).length;
			const closeBraces = (content.match(/}/g) || []).length;
			if (openBraces !== closeBraces) {
				return { valid: false, error: `JS/TS 大括号不匹配: { ${openBraces} 个, } ${closeBraces} 个` };
			}
			return { valid: true };

		default:
			// 未知类型，不做校验
			return { valid: true };
	}
}

// ============================================================================
// 工具: 读取文件
// 参考 Claude Code FileReadTool — 支持 offset/limit 分段读取大文件
// ============================================================================

const ReadFileParamsSchema = Type.Object({
	filePath: Type.String({ minLength: 1, description: "文件路径，相对于工作目录（system prompt 中已告知）。不要拼接 `data/projects/...` 等绝对路径，直接写相对路径如 `output/report.md`。" }),
	offset: Type.Optional(Type.Number({ description: "从第几行开始读取（1-based），用于读取大文件的特定部分" })),
	limit: Type.Optional(Type.Number({ description: "最多读取多少行，与 offset 配合使用" })),
});

const ReadFileTool: ToolRegistration = {
	name: "read_file",
	label: "读取文件",
	description: "读取指定文件的内容。支持 offset/limit 参数分段读取大文件。返回带行号的内容，便于后续 edit_file 精确定位。",
	parameters: ReadFileParamsSchema,
	category: "file",
	enabled: true,
	async execute(
		toolCallId: string,
		params: Static<typeof ReadFileParamsSchema>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<unknown>
	): Promise<AgentToolResult<unknown>> {
		const ctx = createToolContext(toolCallId, "read_file", signal, onUpdate);

		try {
			logToolStart(ctx, params);
			checkAbort(ctx.signal);

			const { fullPath, boundary: workingDir, displayPath } = resolveInsideBoundary(params.filePath);

			console.error(`[read_file] Resolving: "${params.filePath}" -> "${fullPath}" (workingDir=${workingDir})`);

			sendProgress(ctx, `正在读取文件: ${displayPath}`, 0.3);

			// 检查文件是否存在
			try {
				await fs.access(fullPath);
			} catch {
				// 尝试列出父目录帮助调试
				const parentDir = path.dirname(fullPath);
				try {
					const entries = await fs.readdir(parentDir, { withFileTypes: true });
					const files = entries.filter(e => e.isFile()).map(e => e.name);
					console.error(`[read_file] Parent dir (${parentDir}) contents: ${files.join(', ') || '(empty)'}`);
				} catch {
					console.error(`[read_file] Parent dir does not exist: ${parentDir}`);
				}
				throw new Error(`File not found: ${displayPath}`);
			}

			checkAbort(ctx.signal);
			sendProgress(ctx, `读取文件内容...`, 0.6);

			const rawContent = await fs.readFile(fullPath, "utf-8");
			const allLines = rawContent.split("\n");
			const totalLines = allLines.length;

			// 处理 offset/limit 分段读取
			let content: string;
			let startLine: number;
			let isPartialView = false;

			if (params.offset !== undefined || params.limit !== undefined) {
				const offset = Math.max(1, params.offset ?? 1);
				const limit = params.limit ?? 2000;
				const startIdx = offset - 1; // 转为 0-based
				const endIdx = Math.min(startIdx + limit, totalLines);
				const selectedLines = allLines.slice(startIdx, endIdx);
				content = addLineNumbers(selectedLines.join("\n"), offset);
				startLine = offset;
				isPartialView = endIdx < totalLines || startIdx > 0;
			} else {
				content = addLineNumbers(rawContent);
				startLine = 1;
			}

			checkAbort(ctx.signal);
			sendProgress(ctx, `文件读取完成`, 1);

			const result = {
				success: true,
				filePath: displayPath,
				content,
				totalLines,
				startLine,
				isPartialView,
				...(isPartialView && {
					note: `显示第 ${startLine} 行起的内容，共 ${totalLines} 行。使用 offset/limit 参数读取其他部分。`,
				}),
			};

			logToolEnd(ctx, { ...result, content: `[${content.length} chars]` });

			return {
				details: result,
				content: [{ type: "text" as const, text: JSON.stringify(result) }],
			};
		} catch (error) {
			logToolError(ctx, error);
			const errorResult = {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				filePath: normalizeToolDisplayPath(params.filePath),
			};
			return {
				details: errorResult,
				content: [{
					type: "text" as const,
					text: JSON.stringify(errorResult),
				}],
			};
		}
	},
};

// ============================================================================
// 工具: 写入文件
// 参考 Claude Code FileWriteTool — 区分 create/update，返回操作类型
// ============================================================================

const WriteFileParamsSchema = Type.Object({
	filePath: Type.String({ minLength: 1, description: "文件路径，相对于工作目录。不要拼接绝对路径。不存在的目录会自动创建。" }),
	content: Type.String({ description: "要写入的完整内容。注意：会完整覆盖原文件，如需追加请先 read_file 再 write_file。" }),
});

const WriteFileTool: ToolRegistration = {
	name: "write_file",
	label: "写入文件",
	description: "将内容写入指定文件（完整覆盖）。如果文件不存在则创建，如果已存在则更新。目录不存在时自动创建。返回操作类型（create/update）。",
	parameters: WriteFileParamsSchema,
	category: "file",
	enabled: true,
	async execute(
		toolCallId: string,
		params: Static<typeof WriteFileParamsSchema>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<unknown>
	): Promise<AgentToolResult<unknown>> {
		const ctx = createToolContext(toolCallId, "write_file", signal, onUpdate);

		try {
			logToolStart(ctx, { filePath: params.filePath, contentLength: params.content.length });
			checkAbort(ctx.signal);

			const { fullPath, displayPath } = resolveInsideBoundary(params.filePath);
			const dirPath = path.dirname(fullPath);

			// 检查文件是否已存在（区分 create/update）
			let operationType: "create" | "update" = "create";
			try {
				await fs.access(fullPath);
				operationType = "update";
			} catch {
				// 文件不存在，将创建
			}

			sendProgress(ctx, `准备目录: ${path.dirname(displayPath)}`, 0.2);
			await ensureDir(dirPath);

			checkAbort(ctx.signal);

			sendProgress(ctx, `${operationType === "create" ? "创建" : "更新"}文件: ${displayPath}`, 0.6);
			const bytesWritten = Buffer.byteLength(params.content, "utf8");
			await fs.writeFile(fullPath, params.content, "utf-8");

			checkAbort(ctx.signal);

			// 文件内容校验（按类型验证格式正确性）
			const validationResult = validateFileContent(params.filePath, params.content);
			if (!validationResult.valid) {
				console.warn(`[write_file] Validation failed for ${params.filePath}: ${validationResult.error}`);
				// 删除写入的无效文件，避免产生脏数据
				try {
					await fs.unlink(fullPath);
				} catch {
					// ignore
				}
				throw new Error(`文件写入后校验失败: ${validationResult.error}`);
			}

			sendProgress(ctx, `文件${operationType === "create" ? "创建" : "更新"}完成 (${bytesWritten} bytes)`, 1);

			const result = {
				success: true,
				type: operationType,
				filePath: displayPath,
				bytesWritten,
				message: operationType === "create"
					? `文件已创建: ${displayPath}`
					: `文件已更新: ${displayPath}`,
			};

			logToolEnd(ctx, result);

			return {
				details: result,
				content: [{ type: "text" as const, text: JSON.stringify(result) }],
			};
		} catch (error) {
			logToolError(ctx, error);
			const errorResult = {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				filePath: normalizeToolDisplayPath(params.filePath),
			};
			return {
				details: errorResult,
				content: [{
					type: "text" as const,
					text: JSON.stringify(errorResult),
				}],
			};
		}
	},
};

// ============================================================================
// 工具: 编辑文件
// 参考 Claude Code FileEditTool — 查找替换，多匹配时要求明确 replaceAll
// ============================================================================

const EditFileParamsSchema = Type.Object({
	filePath: Type.String({ minLength: 1, description: "文件路径，相对于工作目录。不要拼接绝对路径。" }),
	oldString: Type.String({ minLength: 1, description: "要查找的字符串，必须是文件内唯一存在的子串。如果有多处相同内容，需提供更多上下文或设置 replaceAll=true。" }),
	newString: Type.String({ description: "替换后的字符串。可以为空字符串（表示删除 oldString）。" }),
	replaceAll: Type.Optional(Type.Boolean({ description: "是否替换所有匹配项，默认 false（只替换第一处且要求唯一）" })),
});

const EditFileTool: ToolRegistration = {
	name: "edit_file",
	label: "编辑文件",
	description: "通过查找替换来编辑文件内容。查找 oldString 并替换为 newString。如果有多个匹配项但 replaceAll=false，工具会报错要求提供更多上下文或设置 replaceAll=true。适合对已有文件做局部修改，避免全量重写。",
	parameters: EditFileParamsSchema,
	category: "file",
	enabled: true,
	async execute(
		toolCallId: string,
		params: Static<typeof EditFileParamsSchema>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<unknown>
	): Promise<AgentToolResult<unknown>> {
		const ctx = createToolContext(toolCallId, "edit_file", signal, onUpdate);

		try {
			logToolStart(ctx, params);
			checkAbort(ctx.signal);

			if (params.oldString === params.newString) {
				throw new Error("No changes to make: oldString and newString are exactly the same");
			}

			const { fullPath, boundary: workingDir, displayPath } = resolveInsideBoundary(params.filePath);

			console.error(`[edit_file] Editing: "${params.filePath}" -> "${fullPath}" (workingDir=${workingDir})`);

			sendProgress(ctx, `读取文件: ${displayPath}`, 0.2);

			let originalContent: string;
			try {
				originalContent = await fs.readFile(fullPath, "utf-8");
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
					throw new Error(`File not found: ${displayPath}`);
				}
				throw error;
			}

			checkAbort(ctx.signal);
			sendProgress(ctx, `查找匹配内容...`, 0.4);

			if (!originalContent.includes(params.oldString)) {
				const preview = params.oldString.length > 100
					? params.oldString.substring(0, 100) + '...'
					: params.oldString;
				throw new Error(`String to replace not found in file.\nString: ${preview}`);
			}

			const matches = originalContent.split(params.oldString).length - 1;

			// 多个匹配但未设置 replaceAll — 报错要求明确（参考 Claude Code 行为）
			if (matches > 1 && !params.replaceAll) {
				const preview = params.oldString.length > 100
					? params.oldString.substring(0, 100) + '...'
					: params.oldString;
				throw new Error(
					`Found ${matches} matches of the string to replace, but replaceAll is false. ` +
					`To replace all occurrences, set replaceAll to true. ` +
					`To replace only one occurrence, please provide more context to uniquely identify the instance.\n` +
					`String: ${preview}`
				);
			}

			checkAbort(ctx.signal);

			let newContent: string;
			let replacementCount: number;

			if (params.replaceAll) {
				newContent = originalContent.split(params.oldString).join(params.newString);
				replacementCount = matches;
			} else {
				const index = originalContent.indexOf(params.oldString);
				newContent =
					originalContent.substring(0, index) +
					params.newString +
					originalContent.substring(index + params.oldString.length);
				replacementCount = 1;
			}

			if (originalContent === newContent) {
				throw new Error("No changes made after replacement");
			}

			checkAbort(ctx.signal);
			sendProgress(ctx, `写入修改后的内容...`, 0.7);

			const dirPath = path.dirname(fullPath);
			await ensureDir(dirPath);
			await fs.writeFile(fullPath, newContent, "utf-8");

			checkAbort(ctx.signal);

			// 文件内容校验（按类型验证格式正确性）
			const validationResult = validateFileContent(params.filePath, newContent);
			if (!validationResult.valid) {
				console.warn(`[edit_file] Validation failed for ${params.filePath}: ${validationResult.error}`);
				throw new Error(`文件编辑后校验失败: ${validationResult.error}`);
			}

			sendProgress(ctx, `文件编辑完成 (${replacementCount} 处替换)`, 1);

			const result = {
				success: true,
				filePath: displayPath,
				replacementCount,
				originalLength: originalContent.length,
				newLength: newContent.length,
				message: params.replaceAll
					? `已替换所有 ${replacementCount} 处匹配内容`
					: `已替换 1 处匹配内容`,
			};

			logToolEnd(ctx, result);

			return {
				details: result,
				content: [{ type: "text" as const, text: JSON.stringify(result) }],
			};
		} catch (error) {
			logToolError(ctx, error);
			const errorResult = {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				filePath: normalizeToolDisplayPath(params.filePath),
			};
			return {
				details: errorResult,
				content: [{
					type: "text" as const,
					text: JSON.stringify(errorResult),
				}],
			};
		}
	},
};

// ============================================================================
// 工具: 列出文件
// 支持 recursive 递归列出子目录
// ============================================================================

const ListFilesParamsSchema = Type.Object({
	directory: Type.Optional(Type.String({ default: "." })),
	recursive: Type.Optional(Type.Boolean({ description: "是否递归列出子目录，默认 false" })),
});

const ListFilesTool: ToolRegistration = {
	name: "list_files",
	label: "列出文件",
	description: "列出指定目录中的文件和子目录。设置 recursive=true 可递归列出所有子目录内容。",
	parameters: ListFilesParamsSchema,
	category: "file",
	enabled: true,
	async execute(
		toolCallId: string,
		params: Static<typeof ListFilesParamsSchema>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<unknown>
	): Promise<AgentToolResult<unknown>> {
		const ctx = createToolContext(toolCallId, "list_files", signal, onUpdate);

		try {
			logToolStart(ctx, params);
			checkAbort(ctx.signal);

			const dirPath = params.directory || ".";
			const { fullPath, boundary, displayPath } = resolveInsideBoundary(dirPath);

			sendProgress(ctx, `扫描目录: ${displayPath}`, 0.3);

			await fs.access(fullPath);
			checkAbort(ctx.signal);

			// 递归列目录时通过 realpath 检查每个 entry，防止 symlink 指向 boundary 外。
			let realBoundary: string;
			try {
				realBoundary = await fs.realpath(boundary);
			} catch {
				realBoundary = boundary;
			}

			async function readDirRecursive(dir: string, base: string): Promise<Array<{ name: string; path: string; type: string }>> {
				const entries = await fs.readdir(dir, { withFileTypes: true });
				const items: Array<{ name: string; path: string; type: string }> = [];
				for (const entry of entries) {
					const entryAbs = path.join(dir, entry.name);
					let realEntry: string;
					try {
						realEntry = await fs.realpath(entryAbs);
					} catch {
						continue; // 损坏的 symlink 或权限不足，跳过
					}
					if (realEntry !== realBoundary && !realEntry.startsWith(realBoundary + path.sep)) {
						continue; // entry 通过 symlink 越界，跳过
					}
					const relativePath = joinToolDisplayPath(base, entry.name);
					const type = entry.isDirectory() ? "directory" : "file";
					items.push({ name: entry.name, path: relativePath, type });
					if (entry.isDirectory() && params.recursive) {
						const children = await readDirRecursive(entryAbs, relativePath);
						items.push(...children);
					}
				}
				return items;
			}

			const files = await readDirRecursive(fullPath, "");

			checkAbort(ctx.signal);
			sendProgress(ctx, `找到 ${files.length} 个项目`, 1);

			const result = {
				success: true,
				directory: displayPath,
				files,
				count: files.length,
			};

			logToolEnd(ctx, result);

			return {
				details: result,
				content: [{ type: "text" as const, text: JSON.stringify(result) }],
			};
		} catch (error) {
			logToolError(ctx, error);
			const errorResult = {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				directory: normalizeToolDisplayPath(params.directory || "."),
			};
			return {
				details: errorResult,
				content: [{
					type: "text" as const,
					text: JSON.stringify(errorResult),
				}],
			};
		}
	},
};

// ============================================================================
// 工具: 删除文件
// ============================================================================

const DeleteFileParamsSchema = Type.Object({
	filePath: Type.String({ minLength: 1, description: "文件或目录路径，相对于工作目录。注意：目录会被递归删除，操作不可逆。" }),
});

const DeleteFileTool: ToolRegistration = {
	name: "delete_file",
	label: "删除文件",
	description: "删除指定的文件或目录（目录会递归删除，不可逆）。返回 JSON：{ success, message }；失败时 { success: false, error }。",
	parameters: DeleteFileParamsSchema,
	category: "file",
	enabled: true,
	async execute(
		toolCallId: string,
		params: Static<typeof DeleteFileParamsSchema>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<unknown>
	): Promise<AgentToolResult<unknown>> {
		const ctx = createToolContext(toolCallId, "delete_file", signal, onUpdate);

		try {
			logToolStart(ctx, params);
			checkAbort(ctx.signal);

			const { fullPath, displayPath } = resolveInsideBoundary(params.filePath);

			sendProgress(ctx, `删除文件: ${displayPath}`, 0.5);

			await fs.access(fullPath);
			checkAbort(ctx.signal);

			const stats = await fs.stat(fullPath);
			const type = stats.isDirectory() ? "directory" : "file";

			if (stats.isDirectory()) {
				await fs.rm(fullPath, { recursive: true });
			} else {
				await fs.unlink(fullPath);
			}

			sendProgress(ctx, `删除完成: ${displayPath}`, 1);

			const result = {
				success: true,
				filePath: displayPath,
				type,
				message: `已删除: ${displayPath}`,
			};

			logToolEnd(ctx, result);

			return {
				details: result,
				content: [{ type: "text" as const, text: JSON.stringify(result) }],
			};
		} catch (error) {
			logToolError(ctx, error);
			const errorResult = {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				filePath: normalizeToolDisplayPath(params.filePath),
			};
			return {
				details: errorResult,
				content: [{
					type: "text" as const,
					text: JSON.stringify(errorResult),
				}],
			};
		}
	},
};

// ============================================================================
// 导出所有文件工具
// ============================================================================

export const fileTools: ToolRegistration[] = [
	ReadFileTool,
	WriteFileTool,
	EditFileTool,
	ListFilesTool,
	DeleteFileTool,
];
