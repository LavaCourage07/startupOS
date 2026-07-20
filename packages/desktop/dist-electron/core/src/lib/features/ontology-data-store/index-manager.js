"use strict";
/**
 * Index Manager — NeDB 风格 _index.json 内存索引管理
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadIndex = loadIndex;
exports.saveIndex = saveIndex;
exports.updateIndexEntry = updateIndexEntry;
exports.removeIndexEntry = removeIndexEntry;
exports.getIndexEntries = getIndexEntries;
exports.getAllInstanceIds = getAllInstanceIds;
exports.clearCache = clearCache;
const promises_1 = __importDefault(require("fs/promises"));
const config_1 = require("./config");
// ============================================================================
// 内存索引缓存
// ============================================================================
const cache = new Map();
function cacheKey(ontologyId, conceptId) {
    return `${ontologyId}:${conceptId}`;
}
// ============================================================================
// 加载
// ============================================================================
async function loadIndex(ontologyId, conceptId) {
    const key = cacheKey(ontologyId, conceptId);
    if (cache.has(key)) {
        return cache.get(key);
    }
    const file = (0, config_1.indexPath)(ontologyId, conceptId);
    let data;
    try {
        const content = await promises_1.default.readFile(file, "utf-8");
        const parsed = JSON.parse(content);
        // Handle legacy format {"instanceIds": [...]}
        if (parsed.instanceIds && !parsed.entries) {
            data = {
                conceptId: parsed.conceptId ?? conceptId,
                updatedAt: parsed.updatedAt ?? 0,
                entries: Object.fromEntries(parsed.instanceIds.map(id => [id, {}])),
            };
        }
        else {
            data = parsed;
        }
    }
    catch {
        data = { conceptId, updatedAt: 0, entries: {} };
    }
    cache.set(key, data);
    return data;
}
// ============================================================================
// 保存
// ============================================================================
async function saveIndex(ontologyId, conceptId) {
    const key = cacheKey(ontologyId, conceptId);
    const data = cache.get(key);
    if (!data)
        return;
    data.updatedAt = Date.now();
    await promises_1.default.writeFile((0, config_1.indexPath)(ontologyId, conceptId), JSON.stringify(data, null, 2), "utf-8");
}
// ============================================================================
// 更新
// ============================================================================
async function updateIndexEntry(ontologyId, conceptId, instanceId, entry) {
    const data = await loadIndex(ontologyId, conceptId);
    data.entries[instanceId] = entry;
    await saveIndex(ontologyId, conceptId);
}
async function removeIndexEntry(ontologyId, conceptId, instanceId) {
    const data = await loadIndex(ontologyId, conceptId);
    delete data.entries[instanceId];
    await saveIndex(ontologyId, conceptId);
}
// ============================================================================
// 查询
// ============================================================================
async function getIndexEntries(ontologyId, conceptId) {
    const data = await loadIndex(ontologyId, conceptId);
    return { ...data.entries };
}
async function getAllInstanceIds(ontologyId, conceptId) {
    const entries = await getIndexEntries(ontologyId, conceptId);
    return Object.keys(entries);
}
// ============================================================================
// 清除缓存（用于测试）
// ============================================================================
function clearCache() {
    cache.clear();
}
