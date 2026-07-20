/**
 * Query Engine — 基于内存索引的查询引擎
 */

import { getIndexEntries } from "./index-manager";
import { listInstances } from "./store";
import type { QueryParams, QueryResult, IndexEntry } from "./types";

export async function queryInstances(
	ontologyId: string,
	conceptId: string,
	params: QueryParams = {}
): Promise<QueryResult> {
	const entries = await getIndexEntries(ontologyId, conceptId);
	let ids = Object.keys(entries);

	// 过滤
	if (params.filters) {
		ids = ids.filter((id) => {
			const entry = entries[id];
			return entry ? matchesFilter(entry, params.filters!) : false;
		});
	}

	const total = ids.length;

	// 排序
	if (params.sortBy) {
		const order = params.sortOrder === "desc" ? -1 : 1;
		ids.sort((a, b) => {
			const aEntry = entries[a];
			const bEntry = entries[b];
			if (!aEntry || !bEntry) return 0;
			const aVal = aEntry[params.sortBy!] as string | number;
			const bVal = bEntry[params.sortBy!] as string | number;
			if (aVal < bVal) return -order;
			if (aVal > bVal) return order;
			return 0;
		});
	}

	// 分页
	const page = params.page ?? 1;
	const limit = params.limit ?? 50;
	const totalPages = Math.max(1, Math.ceil(total / limit));
	const start = (page - 1) * limit;
	const pageIds = ids.slice(start, start + limit);

	const items = await listInstances(ontologyId, conceptId, pageIds);

	return { items, total, page, limit, totalPages };
}

function matchesFilter(entry: IndexEntry, filters: Record<string, unknown>): boolean {
	for (const [field, value] of Object.entries(filters)) {
		if (entry[field] !== value) {
			return false;
		}
	}
	return true;
}
