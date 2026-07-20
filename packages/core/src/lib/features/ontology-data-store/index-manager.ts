/**
 * Index Manager — NeDB 风格 _index.json 内存索引管理
 */

import fs from "fs/promises";
import { indexPath } from "./config";
import type { IndexData, IndexEntry } from "./types";

export type { IndexEntry };

// ============================================================================
// 内存索引缓存
// ============================================================================

const cache = new Map<string, IndexData>();

function cacheKey(ontologyId: string, conceptId: string): string {
	return `${ontologyId}:${conceptId}`;
}

// ============================================================================
// 加载
// ============================================================================

export async function loadIndex(
	ontologyId: string,
	conceptId: string
): Promise<IndexData> {
	const key = cacheKey(ontologyId, conceptId);
	if (cache.has(key)) {
		return cache.get(key)!;
	}

	const file = indexPath(ontologyId, conceptId);
	let data: IndexData;
	try {
		const content = await fs.readFile(file, "utf-8");
		const parsed = JSON.parse(content) as Partial<IndexData> & { instanceIds?: string[] };
		// Handle legacy format {"instanceIds": [...]}
		if (parsed.instanceIds && !parsed.entries) {
			data = {
				conceptId: parsed.conceptId ?? conceptId,
				updatedAt: parsed.updatedAt ?? 0,
				entries: Object.fromEntries(parsed.instanceIds.map(id => [id, {} as IndexEntry])),
			};
		} else {
			data = parsed as IndexData;
		}
	} catch {
		data = { conceptId, updatedAt: 0, entries: {} };
	}

	cache.set(key, data);
	return data;
}

// ============================================================================
// 保存
// ============================================================================

export async function saveIndex(
	ontologyId: string,
	conceptId: string
): Promise<void> {
	const key = cacheKey(ontologyId, conceptId);
	const data = cache.get(key);
	if (!data) return;

	data.updatedAt = Date.now();
	await fs.writeFile(indexPath(ontologyId, conceptId), JSON.stringify(data, null, 2), "utf-8");
}

// ============================================================================
// 更新
// ============================================================================

export async function updateIndexEntry(
	ontologyId: string,
	conceptId: string,
	instanceId: string,
	entry: IndexEntry
): Promise<void> {
	const data = await loadIndex(ontologyId, conceptId);
	data.entries[instanceId] = entry;
	await saveIndex(ontologyId, conceptId);
}

export async function removeIndexEntry(
	ontologyId: string,
	conceptId: string,
	instanceId: string
): Promise<void> {
	const data = await loadIndex(ontologyId, conceptId);
	delete data.entries[instanceId];
	await saveIndex(ontologyId, conceptId);
}

// ============================================================================
// 查询
// ============================================================================

export async function getIndexEntries(
	ontologyId: string,
	conceptId: string
): Promise<Record<string, IndexEntry>> {
	const data = await loadIndex(ontologyId, conceptId);
	return { ...data.entries };
}

export async function getAllInstanceIds(
	ontologyId: string,
	conceptId: string
): Promise<string[]> {
	const entries = await getIndexEntries(ontologyId, conceptId);
	return Object.keys(entries);
}

// ============================================================================
// 清除缓存（用于测试）
// ============================================================================

export function clearCache(): void {
	cache.clear();
}
