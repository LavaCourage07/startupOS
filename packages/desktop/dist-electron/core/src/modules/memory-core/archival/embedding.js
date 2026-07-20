"use strict";
/**
 * Embedding Engine — ONNX all-MiniLM-L6-v2 编码 + TF-IDF 回退。
 *
 * Story M.3: ONNX embedding engine with Int8 quantization.
 *
 * 当 ONNX 模型（models/all-MiniLM-L6-v2.onnx）+ 词表（models/vocab.txt）可用时
 * 使用 all-MiniLM-L6-v2（384 维）做真正的语义 embedding。
 * 否则回退到 TF-IDF 词袋向量（同样 384 维），支持 cosine similarity 比较。
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.embeddingEngine = void 0;
exports.quantizeInt8 = quantizeInt8;
exports.dequantizeFloat32 = dequantizeFloat32;
exports.cosineSimilarity = cosineSimilarity;
exports.normalizeVector = normalizeVector;
exports.zeros = zeros;
const wordpiece_tokenizer_1 = require("./wordpiece-tokenizer");
const paths_1 = require("../../../lib/paths");
/** Int8 量化：将 Float32 向量量化为 Int8 数组 */
function quantizeInt8(vector) {
    const result = new Int8Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
        const v = vector[i] ?? 0;
        result[i] = v > 0 ? Math.min(127, Math.round(v * 127)) : Math.max(-128, Math.round(v * 127));
    }
    return result;
}
/** 反量化：Int8 → Float32 */
function dequantizeFloat32(vector) {
    const result = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
        result[i] = (vector[i] ?? 0) / 127;
    }
    return result;
}
/** 余弦相似度 */
function cosineSimilarity(a, b) {
    const len = Math.min(a.length, b.length);
    if (len === 0)
        return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < len; i++) {
        const va = a[i] ?? 0;
        const vb = b[i] ?? 0;
        dot += va * vb;
        normA += va * va;
        normB += vb * vb;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}
/** 归一化向量 */
function normalizeVector(v) {
    let norm = 0;
    for (let i = 0; i < v.length; i++)
        norm += (v[i] ?? 0) * (v[i] ?? 0);
    const s = Math.sqrt(norm);
    if (s === 0)
        return new Float32Array(v.length);
    const result = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++)
        result[i] = (v[i] ?? 0) / s;
    return result;
}
/** 生成零向量 */
function zeros(dim) {
    return new Float32Array(dim);
}
// ============================================================================
// TF-IDF fallback embedding (no external deps)
// ============================================================================
const TFIDF_DIM = 384;
function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, '')
        .split(/\s+/)
        .filter((t) => t.length > 0);
}
function hashToken(token) {
    let h = 0;
    for (let i = 0; i < token.length; i++) {
        h = ((h << 5) - h + token.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}
function computeTF(tokens) {
    const vec = new Float32Array(TFIDF_DIM);
    for (const t of tokens) {
        const idx = hashToken(t) % TFIDF_DIM;
        vec[idx] = (vec[idx] ?? 0) + 1;
    }
    const total = tokens.length || 1;
    for (let i = 0; i < TFIDF_DIM; i++)
        vec[i] = (vec[i] ?? 0) / total;
    return normalizeVector(vec);
}
// ============================================================================
// Mean pooling over token embeddings
// ============================================================================
/** 对 token embeddings 做 mean pooling（attention_mask 加权平均） */
function meanPooling(tokenEmbeddings, attentionMask, seqLen, hiddenSize) {
    const result = new Float32Array(hiddenSize);
    let maskSum = 0;
    for (let i = 0; i < seqLen; i++) {
        if ((attentionMask[i] ?? 0) === 0)
            continue;
        maskSum += 1;
        for (let j = 0; j < hiddenSize; j++) {
            result[j] = (result[j] ?? 0) + (tokenEmbeddings[i * hiddenSize + j] ?? 0);
        }
    }
    if (maskSum > 0) {
        for (let j = 0; j < hiddenSize; j++)
            result[j] = (result[j] ?? 0) / maskSum;
    }
    return normalizeVector(result);
}
// ============================================================================
// EmbeddingEngine
// ============================================================================
class EmbeddingEngineImpl {
    constructor() {
        this.session = null;
        this.available = false;
        this.loading = null;
    }
    async load() {
        if (this.available)
            return true;
        if (this.loading) {
            await this.loading;
            return this.available;
        }
        this.loading = (async () => {
            try {
                (0, wordpiece_tokenizer_1.tryLoadVocab)();
                if (!wordpiece_tokenizer_1.wordPieceTokenizer.isLoaded()) {
                    // vocab.txt 不存在，无法做 ONNX 推理
                    this.available = false;
                    return;
                }
                const { InferenceSession } = await Promise.resolve().then(() => __importStar(require('onnxruntime-node')));
                const pathMod = await Promise.resolve().then(() => __importStar(require('node:path')));
                const fsMod = await Promise.resolve().then(() => __importStar(require('node:fs')));
                const modelPath = pathMod.join((0, paths_1.getMonorepoRoot)(), 'models', 'all-MiniLM-L6-v2.onnx');
                if (!fsMod.existsSync(modelPath)) {
                    this.available = false;
                    return;
                }
                this.session = await InferenceSession.create(modelPath);
                this.available = true;
            }
            catch {
                this.available = false;
                this.session = null;
            }
        })();
        await this.loading;
        return this.available;
    }
    isAvailable() {
        return this.available;
    }
    /** 编码文本为 384 维归一化向量 */
    async encode(text) {
        if (this.available && this.session) {
            try {
                return await this.encodeOnnx(text);
            }
            catch {
                // ONNX 推理失败时降级
            }
        }
        const tokens = tokenize(text);
        return computeTF(tokens);
    }
    async encodeOnnx(text) {
        if (!this.session)
            throw new Error('ONNX session not initialized');
        const { inputIds, attentionMask, tokenTypeIds } = wordpiece_tokenizer_1.wordPieceTokenizer.encode(text);
        const seqLen = inputIds.length;
        const { Tensor } = await Promise.resolve().then(() => __importStar(require('onnxruntime-node')));
        const inputIdsTensor = new Tensor('int64', BigInt64Array.from(inputIds.map(BigInt)), [1, seqLen]);
        const attentionMaskTensor = new Tensor('int64', BigInt64Array.from(attentionMask.map(BigInt)), [1, seqLen]);
        const tokenTypeIdsTensor = new Tensor('int64', BigInt64Array.from(tokenTypeIds.map(BigInt)), [1, seqLen]);
        const result = await this.session.run({
            input_ids: inputIdsTensor,
            attention_mask: attentionMaskTensor,
            token_type_ids: tokenTypeIdsTensor,
        });
        // last_hidden_state shape: [1, seqLen, 384]
        const lastHiddenState = result['last_hidden_state'] ?? result[Object.keys(result)[0]];
        const data = new Float32Array(lastHiddenState.data);
        const hiddenSize = data.length / seqLen;
        return meanPooling(data, attentionMask, seqLen, hiddenSize);
    }
}
exports.embeddingEngine = new EmbeddingEngineImpl();
