"use strict";
/**
 * Patterns.md 渲染器
 *
 * 从 ArchivalMemory 查询 positive / negative / reflection 条目，
 * 重建 Patterns.md（可随时重建，无状态）。
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternRenderer = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const TOP_K = 10;
const MAX_SAMPLE_CHARS = 1200;
class PatternRenderer {
    constructor(agentDir, archival, summarizer = summarizeWithAgent) {
        this.snapshotPath = path_1.default.join(agentDir, 'Patterns.md');
        this.archival = archival;
        this.summarizer = summarizer;
    }
    async regenerate() {
        const positives = this.archival.getAll(TOP_K * 2)
            .filter(e => e.tags.includes('positive') && e.tags.includes('pattern'))
            .slice(0, TOP_K);
        const negatives = this.archival.getAll(TOP_K * 2)
            .filter(e => e.tags.includes('negative') && e.tags.includes('pattern')
            && !e.tags.includes('reflection'))
            .slice(0, TOP_K);
        const reflections = this.archival.getAll(TOP_K * 2)
            .filter(e => e.tags.includes('reflection'))
            .slice(0, TOP_K);
        const lines = ['# Experience Patterns\n'];
        if (positives.length === 0 && negatives.length === 0 && reflections.length === 0) {
            lines.push('（尚无经验模式，待积累）\n');
            (0, fs_1.writeFileSync)(this.snapshotPath, lines.join('\n'), 'utf-8');
            return;
        }
        const summary = await this.summarizer({ positives, negatives, reflections });
        const cleanSummary = summary.trim();
        if (cleanSummary.length > 0) {
            lines.push(cleanSummary.replace(/^#\s+Experience Patterns\s*/i, '').trim());
            lines.push('');
            (0, fs_1.writeFileSync)(this.snapshotPath, lines.join('\n'), 'utf-8');
            return;
        }
        if ((0, fs_1.existsSync)(this.snapshotPath) && (0, fs_1.readFileSync)(this.snapshotPath, 'utf-8').trim()) {
            return;
        }
        lines.push('（暂无法生成经验模式摘要：等待 Agent 总结可用后重试）\n');
        (0, fs_1.writeFileSync)(this.snapshotPath, lines.join('\n'), 'utf-8');
    }
}
exports.PatternRenderer = PatternRenderer;
async function summarizeWithAgent(input) {
    try {
        const factory = await Promise.resolve().then(() => __importStar(require('../../server-config')));
        const model = factory.createAutoModel(undefined, { maxTokens: 4096 });
        const { complete } = await Promise.resolve().then(() => __importStar(require('@mariozechner/pi-ai')));
        const result = await complete(model, {
            messages: [{ role: 'user', content: buildSummaryPrompt(input), timestamp: Date.now() }],
        });
        return extractText(result.content);
    }
    catch (error) {
        console.error('[PatternRenderer] Agent summary failed:', error);
        return '';
    }
}
function buildSummaryPrompt(input) {
    return `你是 OriginOS 的经验模式整理 Agent。请根据下面的原始实践样本，重写 Patterns.md 的正文。

目标：
- 输出中文 Markdown。
- 不要逐条复述工具调用日志。
- 不要输出原始 JSON、命令长参数、完整文件内容或被截断的片段。
- 将重复样本合并成少量可执行经验。
- 格式固定为：
## 最佳实践
1. <标题>
   - 适用场景：...
   - 推荐做法：...
   - 关键约束：...

## 反模式
- <不要做什么>：原因...；替代做法...

## 反思记录
- <日期或场景>：问题...；根因...；教训...

如果某一类没有有效信息，可以省略该小节。

原始样本：

${formatSamples('positive', input.positives)}

${formatSamples('negative', input.negatives)}

${formatSamples('reflection', input.reflections)}
`;
}
function formatSamples(label, entries) {
    if (entries.length === 0)
        return `### ${label}\n（无）`;
    const lines = [`### ${label}`];
    entries.slice(0, TOP_K).forEach((entry, index) => {
        lines.push(`样本 ${index + 1}:`);
        lines.push(entry.text.slice(0, MAX_SAMPLE_CHARS));
        lines.push('');
    });
    return lines.join('\n');
}
function extractText(content) {
    if (typeof content === 'string')
        return content;
    if (Array.isArray(content)) {
        return content
            .map((part) => {
            if (typeof part === 'string')
                return part;
            if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
                return part.text;
            }
            return '';
        })
            .join('');
    }
    if (content && typeof content === 'object' && 'text' in content && typeof content.text === 'string') {
        return content.text;
    }
    return '';
}
