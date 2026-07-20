/**
 * Version Manager — 版本管理系统
 */

import fs from "fs/promises";
import { versionPath, versionDir, instancePath, isValidId } from "./config";
import type { InstanceData, VersionSnapshot } from "./types";

// ============================================================================
// Save Version
// ============================================================================

export async function saveVersion(
	ontologyId: string,
	conceptId: string,
	instanceId: string,
	label?: string
): Promise<VersionSnapshot> {
	if (!isValidId(ontologyId) || !isValidId(instanceId)) {
		throw new Error("Invalid IDs: path traversal detected");
	}

	const filePath = instancePath(ontologyId, conceptId, instanceId);
	const content = await fs.readFile(filePath, "utf-8");
	const instance = JSON.parse(content) as InstanceData;

	const version = instance.meta.version;
	const vDir = versionDir(ontologyId, instanceId);
	await fs.mkdir(vDir, { recursive: true });

	const snapshot: VersionSnapshot = {
		version,
		instanceId,
		label,
		savedAt: Date.now(),
		data: instance,
	};

	await fs.writeFile(versionPath(ontologyId, instanceId, version), JSON.stringify(snapshot, null, 2), "utf-8");
	return snapshot;
}

// ============================================================================
// Get Versions
// ============================================================================

export async function getVersions(
	ontologyId: string,
	instanceId: string
): Promise<Array<{ version: number; label?: string; savedAt: number }>> {
	if (!isValidId(ontologyId) || !isValidId(instanceId)) {
		throw new Error("Invalid IDs: path traversal detected");
	}

	const vDir = versionDir(ontologyId, instanceId);
	let files: string[];
	try {
		files = await fs.readdir(vDir);
	} catch {
		return [];
	}

	return files
		.filter((f) => f.endsWith(".json"))
		.map((f) => ({
			version: parseInt(f.replace(".json", ""), 10),
			label: undefined,
			savedAt: 0,
		}))
		.filter((v) => !isNaN(v.version))
		.sort((a, b) => a.version - b.version);
}

// ============================================================================
// Get Version
// ============================================================================

export async function getVersion(
	ontologyId: string,
	instanceId: string,
	version: number
): Promise<VersionSnapshot> {
	const filePath = versionPath(ontologyId, instanceId, version);
	const content = await fs.readFile(filePath, "utf-8");
	return JSON.parse(content) as VersionSnapshot;
}

// ============================================================================
// Revert to Version
// ============================================================================

export async function revertToVersion(
	ontologyId: string,
	conceptId: string,
	instanceId: string,
	version: number
): Promise<InstanceData> {
	const snapshot = await getVersion(ontologyId, instanceId, version);
	const reverted: InstanceData = {
		...snapshot.data,
		meta: {
			...snapshot.data.meta,
			updatedAt: Date.now(),
			version: snapshot.data.meta.version + 1,
		},
	};

	const filePath = instancePath(ontologyId, conceptId, instanceId);
	await fs.writeFile(filePath, JSON.stringify(reverted, null, 2), "utf-8");
	return reverted;
}
