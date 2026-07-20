"use strict";
/**
 * URL 生成工具
 * 为生成的文件提供可访问的 URL
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.urlTools = void 0;
const typebox_1 = require("@sinclair/typebox");
const context_1 = require("./context");
const path_1 = __importDefault(require("path"));
const paths_1 = require("../../../paths");
function createToolContext(toolCallId, toolName, signal, onUpdate) {
    return { toolCallId, toolName, signal, onUpdate };
}
function checkAbort(signal) {
    if (signal?.aborted) {
        throw new DOMException("Tool execution was aborted", "AbortError");
    }
}
function logToolStart(ctx, params) {
    console.error(`[Tool:${ctx.toolName}] START_CALL_ID=${ctx.toolCallId}`, JSON.stringify(params, null, 2));
}
function logToolEnd(ctx, result) {
    console.error(`[Tool:${ctx.toolName}] END_CALL_ID=${ctx.toolCallId}`, JSON.stringify(result, null, 2));
}
// ============================================================================
// 工具: 生成文件访问 URL
// ============================================================================
const GenerateFileUrlParamsSchema = typebox_1.Type.Object({
    filePath: typebox_1.Type.String({
        description: "文件路径（相对于当前工作目录或绝对路径）",
    }),
    baseUrl: typebox_1.Type.Optional(typebox_1.Type.String({
        description: "基础 URL（默认使用当前域名）",
    })),
});
/**
 * 生成文件访问 URL 工具
 *
 * 将生成的文件转换为可通过 HTTP 访问的 URL
 * 支持的文件类型：图片、PDF、JSON、文本等
 */
const GenerateFileUrlTool = {
    name: "generate_file_url",
    label: "生成文件访问 URL",
    description: "为生成的文件创建可通过 HTTP 访问的 URL。支持图片、PDF、JSON 等文件类型。返回完整的访问地址，用户可以直接在浏览器中打开。",
    parameters: GenerateFileUrlParamsSchema,
    category: "system",
    enabled: true,
    async execute(toolCallId, params, signal, onUpdate) {
        const ctx = createToolContext(toolCallId, "generate_file_url", signal, onUpdate);
        try {
            logToolStart(ctx, params);
            checkAbort(ctx.signal);
            const toolContext = (0, context_1.getToolContext)();
            const cwd = (0, paths_1.getDataRoot)();
            // 解析文件路径（统一用 path.resolve 确保得到绝对路径）
            let absolutePath;
            if (path_1.default.isAbsolute(params.filePath)) {
                absolutePath = params.filePath;
            }
            else if (params.filePath.startsWith('data/') || params.filePath.startsWith('skills/') || params.filePath.startsWith('tmp/')) {
                absolutePath = path_1.default.resolve(cwd, params.filePath);
            }
            else {
                const baseDir = toolContext.workingDirectory || cwd;
                absolutePath = path_1.default.resolve(baseDir, params.filePath);
            }
            // 计算相对于项目根目录的路径
            if (!absolutePath.startsWith(cwd)) {
                throw new Error(`File must be under project directory. Got: ${absolutePath}`);
            }
            const relativePath = path_1.default.relative(cwd, absolutePath);
            // 检查是否在允许的目录下
            const allowedPrefixes = ['data/', 'skills/', 'tmp/'];
            const isAllowed = allowedPrefixes.some(prefix => relativePath.startsWith(prefix));
            if (!isAllowed) {
                throw new Error(`File must be under data/, skills/, or tmp/ directory. Got: ${relativePath}`);
            }
            // 构建静态资源 URL（使用 /api/files/ 直接返回二进制流）
            const baseUrl = params.baseUrl || "http://localhost:3000";
            const apiUrl = `${baseUrl}/api/files/${relativePath}`;
            // 获取文件扩展名
            const ext = path_1.default.extname(params.filePath).toLowerCase();
            const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico', '.tiff', '.tif', '.avif'].includes(ext);
            const result = {
                success: true,
                url: apiUrl,
                filePath: absolutePath,
                relativePath,
                fileType: isImage ? "image" : "file",
                extension: ext,
            };
            logToolEnd(ctx, result);
            // 直接返回 URL，方便 LLM 使用
            const message = isImage
                ? `文件 URL: ${apiUrl}\n\n这是一个图片文件，可以直接在浏览器中打开，或在前端使用 <img src="${apiUrl}" /> 显示。`
                : `文件 URL: ${apiUrl}\n\n可以直接在浏览器中打开或下载。`;
            return {
                content: [{
                        type: "text",
                        text: message,
                    }],
                details: result,
            };
        }
        catch (error) {
            console.error(`[Tool:generate_file_url] ERROR_CALL_ID=${toolCallId}`, error);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error instanceof Error ? error.message : String(error),
                        }),
                    }],
                details: {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                },
            };
        }
    },
};
// ============================================================================
// 导出
// ============================================================================
exports.urlTools = [
    GenerateFileUrlTool,
];
