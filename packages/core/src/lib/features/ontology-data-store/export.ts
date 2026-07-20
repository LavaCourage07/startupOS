/**
 * Export — 导出为 JSON / CSV
 */

import type { ExportOptions } from "./types";

export async function exportInstances(options: ExportOptions): Promise<string> {
	// 先获取所有实例
	const allInstances = await getInstancesForConcept(options);

	if (options.format === "json") {
		return exportJSON(allInstances, options.fields);
	}
	return exportCSV(allInstances, options.fields);
}

async function getInstancesForConcept(options: ExportOptions) {
	// 从索引获取所有 ID，然后加载实例
	const { queryInstances } = await import("./query-engine");
	const result = await queryInstances(options.ontologyId, options.conceptId, {
		limit: 10000,
		page: 1,
	});
	return result.items;
}

function exportJSON(
	instances: Array<{ id: string; fields: Record<string, unknown> }>,
	fields?: string[]
): string {
	const data = instances.map((inst) => {
		if (!fields) return { id: inst.id, ...inst.fields };
		const row: Record<string, unknown> = { id: inst.id };
		for (const f of fields) {
			row[f] = inst.fields[f];
		}
		return row;
	});
	return JSON.stringify(data, null, 2);
}

function exportCSV(
	instances: Array<{ id: string; fields: Record<string, unknown> }>,
	fields?: string[]
): string {
	const allFields = fields ?? extractAllFields(instances);
	const header = ["id", ...allFields].join(",");
	const rows = instances.map((inst) => {
		return ["id", ...allFields].map((f) => {
			const value = f === "id" ? inst.id : inst.fields[f];
			return csvEscape(value);
		}).join(",");
	});
	return [header, ...rows].join("\n");
}

function extractAllFields(instances: Array<{ fields: Record<string, unknown> }>): string[] {
	const fieldSet = new Set<string>();
	for (const inst of instances) {
		for (const key of Object.keys(inst.fields)) {
			fieldSet.add(key);
		}
	}
	return Array.from(fieldSet);
}

function csvEscape(value: unknown): string {
	if (value === null || value === undefined) return "";
	const str = typeof value === "object" ? JSON.stringify(value) : String(value);
	if (str.includes(",") || str.includes('"') || str.includes("\n")) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}
