"use strict";
/**
 * Upload Tracker — 记录用户上传文件到 agent 的 Memory.md
 *
 * 当用户通过前端上传文件时，将文件元数据追加写入
 * `<agent-dir>/MEMORY.md`，复用已有的状态记忆加载机制。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordUploads = recordUploads;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
/**
 * 将上传文件记录追加到 MEMORY.md 末尾
 * @param agentDir agent 的工作目录（data/agents/{id} 或 data/projects/{id}）
 * @param files 上传的文件列表
 */
async function recordUploads(agentDir, files) {
    const memoryPath = path_1.default.join(agentDir, 'MEMORY.md');
    // 读取已有内容
    let existing = '';
    if ((0, fs_1.existsSync)(memoryPath)) {
        try {
            existing = (0, fs_1.readFileSync)(memoryPath, 'utf-8');
        }
        catch {
            existing = '';
        }
    }
    // 追加上传记录区块
    const timestamp = new Date().toISOString();
    const records = files.map(f => `- **${f.name}** | 路径: \`${f.path}\` | 大小: ${formatSize(f.size)} | 上传时间: ${timestamp}`).join('\n');
    const uploadBlock = existing
        ? `\n\n## Uploaded Files\n\n${records}\n`
        : `# Memory\n\n## Uploaded Files\n\n${records}\n`;
    (0, fs_1.writeFileSync)(memoryPath, existing + uploadBlock, 'utf-8');
}
function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
