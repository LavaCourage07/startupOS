"use strict";
/**
 * HNSW Index — Hierarchical Navigable Small World 图构建 + 搜索。
 *
 * Story M.3: HNSW 向量索引，复用 Story 9.20 设计。
 *
 * 参数: m=16, ef_construction=200
 * 支持: insert, search, persistence, index rebuild
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HNSWIndex = void 0;
const embedding_1 = require("./embedding");
class HNSWIndex {
    constructor(options = {}) {
        this.nodes = [];
        this.idToIndex = new Map();
        this.m = options.m ?? 16;
        this.efConstruction = options.efConstruction ?? 200;
        this.efSearch = options.efSearch ?? 10;
    }
    /** 插入新条目 */
    insert(id, embedding) {
        const nodeIndex = this.nodes.length;
        const node = {
            id,
            embedding,
            layers: [],
        };
        // 随机层数（geometric distribution）
        let level = 0;
        while (Math.random() < 1 / Math.log2(this.m + 1) && level < 3)
            level++;
        for (let i = 0; i <= level; i++) {
            node.layers.push(new Set());
        }
        // 在每层连接到最近邻居
        for (let layer = 0; layer < node.layers.length; layer++) {
            const neighbors = this.findNearestInLayer(node.embedding, layer, this.m);
            for (const n of neighbors) {
                node.layers[layer].add(n);
                // 双向连接
                const targetNode = this.nodes[n];
                if (targetNode && targetNode.layers[layer]) {
                    targetNode.layers[layer].add(nodeIndex);
                    // 限制最大连接数
                    while (targetNode.layers[layer].size > this.m * 2) {
                        const first = targetNode.layers[layer].values().next().value;
                        if (first !== undefined)
                            targetNode.layers[layer].delete(first);
                    }
                }
            }
        }
        this.nodes.push(node);
        this.idToIndex.set(id, nodeIndex);
    }
    /** 搜索最近邻居 */
    search(query, k) {
        if (this.nodes.length === 0)
            return [];
        // 简化实现：对中小型索引使用暴力搜索（HNSW 搜索逻辑复杂，
        // 小规模场景下暴力搜索足够快且更可靠）
        if (this.nodes.length <= 1000) {
            return this.bruteForceSearch(query, k);
        }
        // HNSW 搜索：从顶层开始向下导航
        let currentIdx = Math.floor(Math.random() * this.nodes.length);
        for (let layer = this.getMaxLayer(); layer >= 0; layer--) {
            let improved = true;
            while (improved) {
                improved = false;
                const currentNode = this.nodes[currentIdx];
                const currentLayer = currentNode?.layers[layer];
                if (!currentLayer)
                    continue;
                let bestDist = -Infinity;
                for (const neighborIdx of currentLayer) {
                    const neighbor = this.nodes[neighborIdx];
                    if (!neighbor)
                        continue;
                    const score = (0, embedding_1.cosineSimilarity)(query, neighbor.embedding);
                    if (score > bestDist) {
                        bestDist = score;
                        currentIdx = neighborIdx;
                        improved = true;
                    }
                }
            }
        }
        // 从最终位置进行 efSearch 扩展
        return this.expandSearch(currentIdx, k);
    }
    /** 删除条目 */
    delete(id) {
        const idx = this.idToIndex.get(id);
        if (idx === undefined)
            return;
        this.nodes[idx] = null;
        this.idToIndex.delete(id);
    }
    /** 获取节点数量 */
    count() {
        return this.nodes.filter((n) => n !== null).length;
    }
    /** 序列化到 JSON（用于持久化） */
    toJSON() {
        return {
            m: this.m,
            efConstruction: this.efConstruction,
            nodes: this.nodes.filter(Boolean).map((n) => ({
                id: n.id,
                embedding: Array.from(n.embedding),
                layers: n.layers.map((l) => Array.from(l)),
            })),
        };
    }
    /** 从 JSON 反序列化 */
    fromJSON(data) {
        const json = data;
        this.m = json.m ?? 16;
        this.efConstruction = json.efConstruction ?? 200;
        this.nodes = json.nodes.map((n) => ({
            id: n.id,
            embedding: new Float32Array(n.embedding),
            layers: n.layers.map((l) => new Set(l)),
        }));
        this.idToIndex.clear();
        this.nodes.forEach((n, i) => {
            if (n)
                this.idToIndex.set(n.id, i);
        });
    }
    // ==========================================================================
    // Internal
    // ==========================================================================
    getMaxLayer() {
        let max = 0;
        for (const node of this.nodes) {
            if (node && node.layers.length > max)
                max = node.layers.length;
        }
        return max;
    }
    findNearestInLayer(query, layer, k) {
        const candidates = [];
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            if (!node || node.layers.length <= layer)
                continue;
            const score = (0, embedding_1.cosineSimilarity)(query, node.embedding);
            candidates.push({ idx: i, score });
        }
        candidates.sort((a, b) => b.score - a.score);
        return new Set(candidates.slice(0, k).map((c) => c.idx));
    }
    bruteForceSearch(query, k) {
        const results = [];
        for (const node of this.nodes) {
            if (!node)
                continue;
            const score = (0, embedding_1.cosineSimilarity)(query, node.embedding);
            results.push({ id: node.id, score });
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, k);
    }
    expandSearch(entryIdx, k) {
        const visited = new Set();
        const candidates = new Map(); // idx -> score
        const entry = this.nodes[entryIdx];
        if (!entry)
            return [];
        candidates.set(entryIdx, -Infinity);
        for (let i = 0; i < this.efSearch; i++) {
            let bestIdx = -1;
            let bestScore = -Infinity;
            for (const [idx, score] of candidates) {
                if (visited.has(idx))
                    continue;
                if (score > bestScore) {
                    bestScore = score;
                    bestIdx = idx;
                }
            }
            if (bestIdx === -1)
                break;
            visited.add(bestIdx);
            candidates.delete(bestIdx);
            // 扩展邻居
            const node = this.nodes[bestIdx];
            if (!node)
                continue;
            const entryNode = this.nodes[entryIdx];
            if (!entryNode)
                continue;
            const score = (0, embedding_1.cosineSimilarity)(entryNode.embedding, node.embedding);
            candidates.set(bestIdx, score);
            for (let layer = 0; layer < node.layers.length; layer++) {
                for (const neighborIdx of node.layers[layer]) {
                    if (!visited.has(neighborIdx) && !candidates.has(neighborIdx)) {
                        const neighbor = this.nodes[neighborIdx];
                        if (!neighbor)
                            continue;
                        const s = (0, embedding_1.cosineSimilarity)(entryNode.embedding, neighbor.embedding);
                        candidates.set(neighborIdx, s);
                    }
                }
            }
        }
        const results = Array.from(candidates.entries())
            .map(([idx, score]) => ({ id: this.nodes[idx]?.id ?? '', score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, k);
        return results;
    }
}
exports.HNSWIndex = HNSWIndex;
