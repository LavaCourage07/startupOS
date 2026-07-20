"use strict";
/**
 * History Store — JSONL 历史存储，按 Session 拆分文件。
 *
 * Story M.4: 每个 session 独立文件存储在 history/ 目录下，
 * 支持旧文件自动迁移，readAll() 自动合并目录下所有 .jsonl 文件。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryStore = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
class HistoryStore {
    constructor(historyDir, sessionId) {
        this.historyDir = historyDir;
        this.sessionId = sessionId;
        // 旧文件迁移：memory/history.jsonl → memory/history/default.jsonl
        this.migrateLegacyFile();
    }
    sessionFilePath() {
        return node_path_1.default.join(this.historyDir, `${this.sessionId}.jsonl`);
    }
    /** 追加写入一条记录到当前 session 文件 */
    append(entry) {
        if (!node_fs_1.default.existsSync(this.historyDir)) {
            node_fs_1.default.mkdirSync(this.historyDir, { recursive: true });
        }
        node_fs_1.default.appendFileSync(this.sessionFilePath(), JSON.stringify(entry) + '\n', 'utf-8');
    }
    /** 读取目录下所有 session 的记录，按 turnNumber 排序 */
    readAll() {
        if (!node_fs_1.default.existsSync(this.historyDir))
            return [];
        try {
            const files = node_fs_1.default.readdirSync(this.historyDir).filter((f) => f.endsWith('.jsonl'));
            const entries = [];
            for (const file of files) {
                const content = node_fs_1.default.readFileSync(node_path_1.default.join(this.historyDir, file), 'utf-8');
                const lines = content.split('\n').filter((l) => l.trim());
                for (const line of lines) {
                    try {
                        const entry = JSON.parse(line);
                        entries.push(entry);
                    }
                    catch {
                        // skip corrupted lines
                    }
                }
            }
            entries.sort((a, b) => a.turnNumber - b.turnNumber);
            return entries;
        }
        catch {
            return [];
        }
    }
    /** 只读取当前 session 的记录 */
    readSession() {
        const filePath = this.sessionFilePath();
        if (!node_fs_1.default.existsSync(filePath))
            return [];
        try {
            const content = node_fs_1.default.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').filter((l) => l.trim());
            const entries = [];
            for (const line of lines) {
                try {
                    entries.push(JSON.parse(line));
                }
                catch {
                    // skip corrupted lines
                }
            }
            return entries;
        }
        catch {
            return [];
        }
    }
    /** 读取指定范围后的记录（所有 session） */
    readSince(turnNumber) {
        return this.readAll().filter((e) => e.turnNumber >= turnNumber);
    }
    /** 旧文件迁移：memory/history.jsonl → memory/history/default.jsonl */
    migrateLegacyFile() {
        // Check if legacy file exists at the parent of historyDir
        const legacySingleFile = node_path_1.default.join(node_path_1.default.dirname(this.historyDir), 'history.jsonl');
        if (node_fs_1.default.existsSync(legacySingleFile) && !node_fs_1.default.existsSync(this.historyDir)) {
            node_fs_1.default.mkdirSync(this.historyDir, { recursive: true });
            node_fs_1.default.renameSync(legacySingleFile, node_path_1.default.join(this.historyDir, 'default.jsonl'));
        }
    }
}
exports.HistoryStore = HistoryStore;
