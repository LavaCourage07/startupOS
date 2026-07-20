"use strict";
/**
 * 系统级文档读取工具（OS.12）
 *
 * 提供受工作目录边界保护的 Word / Excel / CSV / 文本文档读取能力。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentTools = void 0;
const typebox_1 = require("@sinclair/typebox");
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const path_utils_1 = require("./path-utils");
const document_1 = require("../../../features/document");
const DEFAULT_TEXT_LIMIT = 12000;
const DEFAULT_ROW_LIMIT = 200;
const MAX_TEXT_LIMIT = 60000;
const MAX_ROW_LIMIT = 1000;
function checkAbort(signal) {
    if (signal?.aborted) {
        throw new DOMException("Tool execution was aborted", "AbortError");
    }
}
const resolveInsideBoundary = path_utils_1.resolveToolPath;
async function ensureFile(fullPath) {
    const stat = await fs_1.promises.stat(fullPath);
    if (!stat.isFile()) {
        throw new Error(`Path is not a file: ${fullPath}`);
    }
}
function clampNumber(value, fallback, min, max) {
    if (value == null || Number.isNaN(value))
        return fallback;
    return Math.min(max, Math.max(min, Math.floor(value)));
}
function parseCursor(cursor) {
    if (!cursor)
        return undefined;
    const parsed = Number(cursor);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}
function toTextResult(text, details) {
    return {
        content: [{ type: "text", text }],
        details,
    };
}
function summarizeDocumentStructure(ast) {
    const headings = ast.blocks
        .filter((block) => block.type === "heading")
        .map((block) => `${"  ".repeat(Math.max(0, (block.level ?? 1) - 1))}- ${block.text}`)
        .join("\n");
    const lines = [
        `文件: ${ast.metadata.fileName}`,
        `类型: ${ast.type}`,
        `段落/标题块: ${ast.blocks.length}`,
        `表格数量: ${ast.tables.length}`,
    ];
    if (headings) {
        lines.push("\n## 章节", headings);
    }
    if (ast.tables.length > 0) {
        lines.push("\n## 表格", ...ast.tables.map((table) => `- Table ${table.index + 1}: ${table.rows.length} rows`));
    }
    return lines.join("\n");
}
function summarizeWorkbookStructure(sheets, fileName, type) {
    return [
        `文件: ${fileName}`,
        `类型: ${type}`,
        `工作表数量: ${sheets.length}`,
        "",
        "## 工作表",
        ...sheets.map((sheet) => `- ${sheet.name}: ${sheet.rowCount} rows x ${sheet.columnCount} columns${sheet.merges.length ? `, merges=${sheet.merges.length}` : ""}`),
    ].join("\n");
}
function rowsToTsv(rows) {
    return rows.map((row) => row.join("\t")).join("\n");
}
function getRangeRows(sheet, offset, limit) {
    const rows = sheet.rows.slice(offset, offset + limit);
    const nextOffset = offset + rows.length;
    const truncated = nextOffset < sheet.rows.length;
    return {
        rows,
        truncated,
        ...(truncated ? { nextCursor: String(nextOffset) } : {}),
    };
}
const ReadDocumentParamsSchema = typebox_1.Type.Object({
    filePath: typebox_1.Type.String({
        description: "文件路径。必须是相对当前工作目录的路径，不要拼接 data/projects/...，不允许绝对路径或 .. 越界。",
        minLength: 1,
    }),
    offset: typebox_1.Type.Optional(typebox_1.Type.Number({
        description: "字符读取起点，默认 0。用于长文档分页读取。",
        minimum: 0,
    })),
    limit: typebox_1.Type.Optional(typebox_1.Type.Number({
        description: `本次最多返回字符数，默认 ${DEFAULT_TEXT_LIMIT}，最大 ${MAX_TEXT_LIMIT}。超限会返回 truncated=true 和 nextCursor。`,
        minimum: 1,
        maximum: MAX_TEXT_LIMIT,
    })),
    cursor: typebox_1.Type.Optional(typebox_1.Type.String({
        description: "上一次返回的 nextCursor。传入后会从该字符偏移继续读取。",
    })),
});
const ReadDocumentTool = {
    name: "read_document",
    label: "读取文档",
    description: "读取 Word(.docx)、Markdown(.md)、Text(.txt)、JSON/XML/HTML 文本文件，返回分页文本内容和表格文本。路径受当前工作目录边界保护；大文件必须通过 cursor/offset 分页读取。返回 JSON details: { filePath, extension, totalChars, returnedChars, truncated, nextCursor?, tablesCount }。",
    parameters: ReadDocumentParamsSchema,
    category: "file",
    enabled: true,
    async execute(toolCallId, params, signal, onUpdate) {
        console.error(`[Tool:read_document] START_CALL_ID=${toolCallId}`, JSON.stringify(params));
        try {
            checkAbort(signal);
            const { fullPath, displayPath } = resolveInsideBoundary(params.filePath);
            await ensureFile(fullPath);
            onUpdate?.({ content: [{ type: "text", text: `正在读取文档: ${displayPath}` }], details: { status: "in_progress" } });
            const ast = await (0, document_1.parseDocument)(fullPath);
            const slice = (0, document_1.sliceDocumentText)(ast, {
                offset: parseCursor(params.cursor) ?? params.offset,
                limit: clampNumber(params.limit, DEFAULT_TEXT_LIMIT, 1, MAX_TEXT_LIMIT),
            });
            const text = slice.text || "(文件内容为空)";
            console.error(`[Tool:read_document] END_CALL_ID=${toolCallId} chars=${slice.returnedChars}/${slice.totalChars}`);
            return toTextResult(text, {
                filePath: displayPath,
                extension: ast.metadata.extension,
                totalChars: slice.totalChars,
                returnedChars: slice.returnedChars,
                offset: slice.offset,
                limit: slice.limit,
                truncated: slice.truncated,
                nextCursor: slice.nextCursor,
                tablesCount: ast.tables.length,
            });
        }
        catch (error) {
            console.error(`[Tool:read_document] ERROR_CALL_ID=${toolCallId}`, error);
            return toTextResult(`读取文档失败: ${error instanceof Error ? error.message : String(error)}`, { error: true });
        }
    },
};
const ReadSpreadsheetParamsSchema = typebox_1.Type.Object({
    filePath: typebox_1.Type.String({
        description: "Excel/CSV 文件路径。必须是相对当前工作目录的路径，不要拼接 data/projects/...，不允许绝对路径或 .. 越界。",
        minLength: 1,
    }),
    sheetName: typebox_1.Type.Optional(typebox_1.Type.String({
        description: "工作表名称。省略时读取第一个工作表；可先用 list_document_structure 查看可用工作表。",
    })),
    offset: typebox_1.Type.Optional(typebox_1.Type.Number({
        description: "起始行偏移，0 表示第一行。用于分页读取大表。",
        minimum: 0,
    })),
    limit: typebox_1.Type.Optional(typebox_1.Type.Number({
        description: `本次最多返回行数，默认 ${DEFAULT_ROW_LIMIT}，最大 ${MAX_ROW_LIMIT}。超限会返回 truncated=true 和 nextCursor。`,
        minimum: 1,
        maximum: MAX_ROW_LIMIT,
    })),
    cursor: typebox_1.Type.Optional(typebox_1.Type.String({
        description: "上一次返回的 nextCursor。传入后会从该行偏移继续读取。",
    })),
});
const ReadSpreadsheetTool = {
    name: "read_spreadsheet",
    label: "读取表格",
    description: "读取 Excel(.xlsx) 或 CSV(.csv)，按 sheetName 和行范围返回 TSV 文本。适合读取业务台账、设备清单、人员表、需求矩阵。路径受工作目录边界保护；大表必须分页读取。返回 JSON details: { filePath, sheetName, rowCount, columnCount, offset, limit, truncated, nextCursor? }。",
    parameters: ReadSpreadsheetParamsSchema,
    category: "file",
    enabled: true,
    async execute(toolCallId, params, signal, onUpdate) {
        console.error(`[Tool:read_spreadsheet] START_CALL_ID=${toolCallId}`, JSON.stringify(params));
        try {
            checkAbort(signal);
            const { fullPath, displayPath } = resolveInsideBoundary(params.filePath);
            await ensureFile(fullPath);
            onUpdate?.({ content: [{ type: "text", text: `正在读取表格: ${displayPath}` }], details: { status: "in_progress" } });
            const workbook = await (0, document_1.parseWorkbook)(fullPath);
            const sheet = params.sheetName
                ? workbook.sheets.find((candidate) => candidate.name === params.sheetName)
                : workbook.sheets[0];
            if (!sheet) {
                return toTextResult(`未找到工作表: ${params.sheetName ?? "(第一个工作表)"}`, {
                    filePath: displayPath,
                    availableSheets: workbook.sheets.map((candidate) => candidate.name),
                });
            }
            const offset = parseCursor(params.cursor) ?? clampNumber(params.offset, 0, 0, Number.MAX_SAFE_INTEGER);
            const limit = clampNumber(params.limit, DEFAULT_ROW_LIMIT, 1, MAX_ROW_LIMIT);
            const range = getRangeRows(sheet, offset, limit);
            const text = rowsToTsv(range.rows) || "(表格为空)";
            console.error(`[Tool:read_spreadsheet] END_CALL_ID=${toolCallId} rows=${range.rows.length}/${sheet.rowCount}`);
            return toTextResult(text, {
                filePath: displayPath,
                extension: workbook.metadata.extension,
                sheetName: sheet.name,
                rowCount: sheet.rowCount,
                columnCount: sheet.columnCount,
                offset,
                limit,
                returnedRows: range.rows.length,
                truncated: range.truncated,
                nextCursor: range.nextCursor,
                merges: sheet.merges,
            });
        }
        catch (error) {
            console.error(`[Tool:read_spreadsheet] ERROR_CALL_ID=${toolCallId}`, error);
            return toTextResult(`读取表格失败: ${error instanceof Error ? error.message : String(error)}`, { error: true });
        }
    },
};
const ListDocumentStructureParamsSchema = typebox_1.Type.Object({
    filePath: typebox_1.Type.String({
        description: "文档、Excel 或 CSV 文件路径。必须相对当前工作目录，不允许绝对路径或 .. 越界。",
        minLength: 1,
    }),
});
const ListDocumentStructureTool = {
    name: "list_document_structure",
    label: "查看文档结构",
    description: "读取文件结构而非全文。对 Word/文本返回标题、块数量、表格数量；对 Excel/CSV 返回工作表列表、行列规模、合并单元格数量。用于大文件读取前探测结构。返回 JSON details: { filePath, kind, sheets? / blocksCount?, tablesCount? }。",
    parameters: ListDocumentStructureParamsSchema,
    category: "file",
    enabled: true,
    async execute(toolCallId, params, signal) {
        console.error(`[Tool:list_document_structure] START_CALL_ID=${toolCallId}`, JSON.stringify(params));
        try {
            checkAbort(signal);
            const { fullPath, displayPath } = resolveInsideBoundary(params.filePath);
            await ensureFile(fullPath);
            const ext = path_1.default.extname(fullPath).toLowerCase();
            if (ext === ".xlsx" || ext === ".csv") {
                const workbook = await (0, document_1.parseWorkbook)(fullPath);
                return toTextResult(summarizeWorkbookStructure(workbook.sheets, workbook.metadata.fileName, workbook.type), {
                    filePath: displayPath,
                    kind: "workbook",
                    sheets: workbook.sheets.map((sheet) => ({
                        name: sheet.name,
                        rowCount: sheet.rowCount,
                        columnCount: sheet.columnCount,
                        mergesCount: sheet.merges.length,
                    })),
                });
            }
            const document = await (0, document_1.parseDocument)(fullPath);
            return toTextResult(summarizeDocumentStructure(document), {
                filePath: displayPath,
                kind: "document",
                blocksCount: document.blocks.length,
                tablesCount: document.tables.length,
                title: document.title,
            });
        }
        catch (error) {
            console.error(`[Tool:list_document_structure] ERROR_CALL_ID=${toolCallId}`, error);
            return toTextResult(`读取文档结构失败: ${error instanceof Error ? error.message : String(error)}`, { error: true });
        }
    },
};
const ExtractDocumentTablesParamsSchema = typebox_1.Type.Object({
    filePath: typebox_1.Type.String({
        description: "Word、Excel 或 CSV 文件路径。必须相对当前工作目录，不允许绝对路径或 .. 越界。",
        minLength: 1,
    }),
    sheetName: typebox_1.Type.Optional(typebox_1.Type.String({
        description: "仅 Excel/CSV 生效：工作表名称。省略时读取所有表格/工作表。",
    })),
    limit: typebox_1.Type.Optional(typebox_1.Type.Number({
        description: "每个表格最多返回行数，默认 200，最大 1000。",
        minimum: 1,
        maximum: MAX_ROW_LIMIT,
    })),
});
const ExtractDocumentTablesTool = {
    name: "extract_document_tables",
    label: "提取表格",
    description: "只提取 Word/Excel/CSV 中的表格内容，按 TSV 返回。适合从业务文档、台账、清单中抽取结构化数据。返回 JSON details: { filePath, tablesCount, truncatedTables[] }。",
    parameters: ExtractDocumentTablesParamsSchema,
    category: "file",
    enabled: true,
    async execute(toolCallId, params, signal) {
        console.error(`[Tool:extract_document_tables] START_CALL_ID=${toolCallId}`, JSON.stringify(params));
        try {
            checkAbort(signal);
            const { fullPath, displayPath } = resolveInsideBoundary(params.filePath);
            await ensureFile(fullPath);
            const ext = path_1.default.extname(fullPath).toLowerCase();
            const limit = clampNumber(params.limit, DEFAULT_ROW_LIMIT, 1, MAX_ROW_LIMIT);
            const parts = [];
            const truncatedTables = [];
            if (ext === ".xlsx" || ext === ".csv") {
                const workbook = await (0, document_1.parseWorkbook)(fullPath);
                const sheets = params.sheetName ? workbook.sheets.filter((sheet) => sheet.name === params.sheetName) : workbook.sheets;
                for (const sheet of sheets) {
                    const rows = sheet.rows.slice(0, limit);
                    if (sheet.rows.length > rows.length)
                        truncatedTables.push(sheet.name);
                    parts.push(`## ${sheet.name}\n${rowsToTsv(rows)}`);
                }
                return toTextResult(parts.join("\n\n") || "(未找到表格)", {
                    filePath: displayPath,
                    tablesCount: sheets.length,
                    truncatedTables,
                });
            }
            const document = await (0, document_1.parseDocument)(fullPath);
            for (const table of document.tables) {
                const rows = table.rows.slice(0, limit);
                if (table.rows.length > rows.length)
                    truncatedTables.push(`Table ${table.index + 1}`);
                parts.push(`## Table ${table.index + 1}\n${rowsToTsv(rows)}`);
            }
            return toTextResult(parts.join("\n\n") || "(未找到表格)", {
                filePath: displayPath,
                tablesCount: document.tables.length,
                truncatedTables,
            });
        }
        catch (error) {
            console.error(`[Tool:extract_document_tables] ERROR_CALL_ID=${toolCallId}`, error);
            return toTextResult(`提取表格失败: ${error instanceof Error ? error.message : String(error)}`, { error: true });
        }
    },
};
exports.documentTools = [
    ReadDocumentTool,
    ReadSpreadsheetTool,
    ListDocumentStructureTool,
    ExtractDocumentTablesTool,
];
