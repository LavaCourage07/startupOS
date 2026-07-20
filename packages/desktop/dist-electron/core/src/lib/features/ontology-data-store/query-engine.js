"use strict";
/**
 * Query Engine — 基于内存索引的查询引擎
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryInstances = queryInstances;
const index_manager_1 = require("./index-manager");
const store_1 = require("./store");
async function queryInstances(ontologyId, conceptId, params = {}) {
    const entries = await (0, index_manager_1.getIndexEntries)(ontologyId, conceptId);
    let ids = Object.keys(entries);
    // 过滤
    if (params.filters) {
        ids = ids.filter((id) => {
            const entry = entries[id];
            return entry ? matchesFilter(entry, params.filters) : false;
        });
    }
    const total = ids.length;
    // 排序
    if (params.sortBy) {
        const order = params.sortOrder === "desc" ? -1 : 1;
        ids.sort((a, b) => {
            const aEntry = entries[a];
            const bEntry = entries[b];
            if (!aEntry || !bEntry)
                return 0;
            const aVal = aEntry[params.sortBy];
            const bVal = bEntry[params.sortBy];
            if (aVal < bVal)
                return -order;
            if (aVal > bVal)
                return order;
            return 0;
        });
    }
    // 分页
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const pageIds = ids.slice(start, start + limit);
    const items = await (0, store_1.listInstances)(ontologyId, conceptId, pageIds);
    return { items, total, page, limit, totalPages };
}
function matchesFilter(entry, filters) {
    for (const [field, value] of Object.entries(filters)) {
        if (entry[field] !== value) {
            return false;
        }
    }
    return true;
}
