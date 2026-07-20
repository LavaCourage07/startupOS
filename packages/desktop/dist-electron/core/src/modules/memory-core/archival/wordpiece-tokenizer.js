"use strict";
/**
 * WordPiece Tokenizer — 用于 all-MiniLM-L6-v2 ONNX 推理。
 *
 * 加载 models/vocab.txt（BERT 标准词表），将文本转为 input_ids / attention_mask / token_type_ids。
 * 最大序列长度 128（模型训练配置）。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wordPieceTokenizer = exports.WordPieceTokenizer = void 0;
exports.tryLoadVocab = tryLoadVocab;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const paths_1 = require("../../../lib/paths");
const MAX_SEQ_LEN = 128;
const UNK_TOKEN = '[UNK]';
const CLS_TOKEN = '[CLS]';
const SEP_TOKEN = '[SEP]';
const PAD_TOKEN = '[PAD]';
class WordPieceTokenizer {
    constructor() {
        this.vocab = new Map();
        this.ids = new Map();
        this.loaded = false;
    }
    load(vocabPath) {
        const lines = node_fs_1.default.readFileSync(vocabPath, 'utf-8').split('\n');
        for (let i = 0; i < lines.length; i++) {
            const token = lines[i]?.trim() ?? '';
            if (!token)
                continue;
            this.vocab.set(token, i);
            this.ids.set(i, token);
        }
        this.loaded = true;
    }
    isLoaded() {
        return this.loaded;
    }
    encode(text) {
        const clsId = this.vocab.get(CLS_TOKEN) ?? 101;
        const sepId = this.vocab.get(SEP_TOKEN) ?? 102;
        const padId = this.vocab.get(PAD_TOKEN) ?? 0;
        const unkId = this.vocab.get(UNK_TOKEN) ?? 100;
        const tokens = this.tokenize(text);
        // [CLS] tokens [SEP], truncate to MAX_SEQ_LEN - 2
        const truncated = tokens.slice(0, MAX_SEQ_LEN - 2);
        const ids = [clsId, ...truncated.map((t) => this.vocab.get(t) ?? unkId), sepId];
        const attentionMask = new Array(ids.length).fill(1);
        // Pad to MAX_SEQ_LEN
        while (ids.length < MAX_SEQ_LEN) {
            ids.push(padId);
            attentionMask.push(0);
        }
        return {
            inputIds: ids,
            attentionMask,
            tokenTypeIds: new Array(MAX_SEQ_LEN).fill(0),
        };
    }
    tokenize(text) {
        const result = [];
        // Basic whitespace + punctuation pre-tokenization
        const words = text
            .toLowerCase()
            .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 0);
        for (const word of words) {
            result.push(...this.wordPiece(word));
        }
        return result;
    }
    wordPiece(word) {
        if (this.vocab.has(word))
            return [word];
        const tokens = [];
        let start = 0;
        while (start < word.length) {
            let end = word.length;
            let found = '';
            while (start < end) {
                const substr = (start === 0 ? '' : '##') + word.slice(start, end);
                if (this.vocab.has(substr)) {
                    found = substr;
                    break;
                }
                end--;
            }
            if (!found)
                return [UNK_TOKEN];
            tokens.push(found);
            start = end;
        }
        return tokens;
    }
}
exports.WordPieceTokenizer = WordPieceTokenizer;
exports.wordPieceTokenizer = new WordPieceTokenizer();
/** 尝试从 models/vocab.txt 加载词表，失败则静默跳过（TF-IDF fallback 仍可用） */
function tryLoadVocab() {
    const vocabPath = node_path_1.default.join((0, paths_1.getMonorepoRoot)(), 'models', 'vocab.txt');
    if (node_fs_1.default.existsSync(vocabPath)) {
        try {
            exports.wordPieceTokenizer.load(vocabPath);
        }
        catch {
            // vocab 加载失败不影响 TF-IDF fallback
        }
    }
}
