/**
 * Unit tests for Ontology Data Store
 *
 * Tests cover:
 * - Config (isValidId)
 * - Index manager (loadIndex, updateIndexEntry, removeIndexEntry, getAllInstanceIds)
 * - Schema validator (required fields, type checking, enum validation)
 * - Store CRUD (createInstance, getInstance, updateInstance, deleteInstance)
 * - Query engine (filter, sort, pagination)
 * - Version manager (saveVersion, getVersions, getVersion, revertToVersion)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fsModule from "fs/promises";

// Mock fs module
vi.mock("fs/promises");
const mockedFs = vi.mocked(fsModule);

// ────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ────────────────────────────────────────────────────────────────────────────

const TEST = {
	ontologyId: "test-ontology",
	domainId: "test-domain",
	conceptId: "test-concept",
	instanceId: "inst-001",
};

const ONTOLOGY_JSON = {
	ontologyId: TEST.ontologyId,
	version: "1.0.0",
	domains: [{ id: TEST.domainId, name: "Test Domain" }],
	concepts: [
		{
			id: TEST.conceptId,
			name: "Person",
			domainId: TEST.domainId,
			attributes: {
				name: { type: "string", required: true },
				age: { type: "number", required: false },
				status: { type: "string", required: true, enum: ["active", "inactive"] },
			},
		},
	],
	instances: [],
	relations: [],
};

function createInstanceData(overrides = {}) {
	return {
		id: TEST.instanceId,
		conceptId: TEST.conceptId,
		domainId: TEST.domainId,
		ontologyId: TEST.ontologyId,
		fields: { name: "张三", age: 30, status: "active" },
		meta: {
			createdAt: 1717603200000,
			updatedAt: 1717603200000,
			createdBy: "user" as const,
			version: 1,
		},
		...overrides,
	};
}

function pathMatches(p: string, pattern: string): boolean {
	return p.includes(pattern);
}

// ────────────────────────────────────────────────────────────────────────────
// Test setup
// ────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.resetModules();
	mockedFs.readFile.mockReset();
	mockedFs.writeFile.mockReset();
	mockedFs.unlink.mockReset();
	mockedFs.mkdir.mockReset();
	mockedFs.access.mockReset();
	mockedFs.readdir.mockReset();

	// Default: all reads succeed
	mockedFs.readFile.mockImplementation(async (p: string) => {
		if (pathMatches(p, "ontology.json")) return JSON.stringify(ONTOLOGY_JSON);
		if (pathMatches(p, "_index.json")) {
			return JSON.stringify({ conceptId: TEST.conceptId, updatedAt: 0, entries: {} });
		}
		if (pathMatches(p, "versions")) {
			return JSON.stringify({ version: 1, instanceId: TEST.instanceId, savedAt: 0, data: createInstanceData() });
		}
		if (pathMatches(p, TEST.instanceId)) {
			return JSON.stringify(createInstanceData());
		}
		throw new Error(`ENOENT: ${p}`);
	});

	mockedFs.writeFile.mockResolvedValue(undefined);
	mockedFs.unlink.mockResolvedValue(undefined);
	mockedFs.mkdir.mockResolvedValue(undefined);
	mockedFs.access.mockResolvedValue(undefined);
	mockedFs.readdir.mockResolvedValue(["1.json", "2.json"]);
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe("Ontology Data Store", () => {
	// ─────────────────────────────────────────────────────────────────────
	// Config
	// ─────────────────────────────────────────────────────────────────────

	describe("config", () => {
		it("isValidId returns true for normal IDs", async () => {
			const { isValidId } = await import("../config");
			expect(isValidId("test-id")).toBe(true);
			expect(isValidId("concept-123")).toBe(true);
		});

		it("isValidId rejects path traversal", async () => {
			const { isValidId } = await import("../config");
			expect(isValidId("../etc/passwd")).toBe(false);
			expect(isValidId("/absolute/path")).toBe(false);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Index Manager
	// ─────────────────────────────────────────────────────────────────────

	describe("index-manager", () => {
		it("loadIndex returns empty entries when file not found", async () => {
			mockedFs.readFile.mockRejectedValueOnce(new Error("ENOENT"));

			const { loadIndex, clearCache } = await import("../index-manager");
			clearCache();
			const data = await loadIndex(TEST.ontologyId, TEST.conceptId);

			expect(data.entries).toEqual({});
			expect(data.conceptId).toBe(TEST.conceptId);
		});

		it("loadIndex parses existing index file", async () => {
			const indexData = {
				conceptId: TEST.conceptId,
				updatedAt: 1717603200000,
				entries: {
					"inst-001": { name: "张三", createdAt: 1717603200000 },
				},
			};
			mockedFs.readFile.mockResolvedValueOnce(JSON.stringify(indexData));

			const { loadIndex, clearCache } = await import("../index-manager");
			clearCache();
			const data = await loadIndex(TEST.ontologyId, TEST.conceptId);

			expect(data.entries["inst-001"]).toEqual({ name: "张三", createdAt: 1717603200000 });
		});

		it("updateIndexEntry writes entry and persists to disk", async () => {
			const indexData = { conceptId: TEST.conceptId, updatedAt: 0, entries: {} };
			mockedFs.readFile.mockResolvedValue(JSON.stringify(indexData));

			const { updateIndexEntry, clearCache } = await import("../index-manager");
			clearCache();
			await updateIndexEntry(
				TEST.ontologyId, TEST.conceptId,
				"inst-001",
				{ name: "李四", createdAt: 1717603200000 }
			);

			const writeCalls = mockedFs.writeFile.mock.calls;
			expect(writeCalls.length).toBeGreaterThanOrEqual(1);
		});

		it("removeIndexEntry deletes entry from index", async () => {
			const indexData = {
				conceptId: TEST.conceptId,
				updatedAt: 0,
				entries: { "inst-001": { name: "张三" }, "inst-002": { name: "李四" } },
			};
			mockedFs.readFile.mockResolvedValue(JSON.stringify(indexData));

			const { removeIndexEntry, clearCache } = await import("../index-manager");
			clearCache();
			await removeIndexEntry(TEST.ontologyId, TEST.conceptId, "inst-001");

			const lastWrite = mockedFs.writeFile.mock.calls[mockedFs.writeFile.mock.calls.length - 1];
			const written = JSON.parse(lastWrite[1] as string);
			expect(written.entries["inst-001"]).toBeUndefined();
			expect(written.entries["inst-002"]).toBeDefined();
		});

		it("getAllInstanceIds returns all keys from entries", async () => {
			const indexData = {
				conceptId: TEST.conceptId,
				updatedAt: 0,
				entries: { "a": {}, "b": {}, "c": {} },
			};
			mockedFs.readFile.mockResolvedValue(JSON.stringify(indexData));

			const { getAllInstanceIds, clearCache } = await import("../index-manager");
			clearCache();
			const ids = await getAllInstanceIds(TEST.ontologyId, TEST.conceptId);

			expect(ids).toHaveLength(3);
			expect(ids).toContain("a");
			expect(ids).toContain("b");
			expect(ids).toContain("c");
		});

		it("loadIndex uses cache for subsequent calls", async () => {
			const indexData = { conceptId: TEST.conceptId, updatedAt: 0, entries: {} };
			mockedFs.readFile.mockResolvedValue(JSON.stringify(indexData));

			const { loadIndex, clearCache } = await import("../index-manager");
			clearCache();
			await loadIndex(TEST.ontologyId, TEST.conceptId);
			await loadIndex(TEST.ontologyId, TEST.conceptId);

			// Only one fs.readFile call for _index.json (second call uses cache)
			const readCalls = mockedFs.readFile.mock.calls.filter(
				(c) => pathMatches(c[0]?.toString(), "_index.json")
			);
			expect(readCalls.length).toBe(1);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Schema Validator
	// ─────────────────────────────────────────────────────────────────────

	describe("schema-validator", () => {
		it("validateInstance passes valid instance", async () => {
			const { validateInstance, loadConceptSchema } = await import("../schema-validator");

			const schema = await loadConceptSchema(TEST.ontologyId, TEST.conceptId);
			expect(() => validateInstance({ name: "张三", status: "active" }, schema)).not.toThrow();
		});

		it("validateInstance fails on missing required field", async () => {
			const { validateInstance, loadConceptSchema } = await import("../schema-validator");

			const schema = await loadConceptSchema(TEST.ontologyId, TEST.conceptId);
			expect(() => validateInstance({ status: "active" }, schema)).toThrow("必填项");
		});

		it("validateInstance fails on wrong type", async () => {
			const { validateInstance, loadConceptSchema } = await import("../schema-validator");

			const schema = await loadConceptSchema(TEST.ontologyId, TEST.conceptId);
			expect(() => validateInstance({ name: 123, status: "active" }, schema)).toThrow("字符串");
		});

		it("validateInstance fails on invalid enum value", async () => {
			const { validateInstance, loadConceptSchema } = await import("../schema-validator");

			const schema = await loadConceptSchema(TEST.ontologyId, TEST.conceptId);
			expect(() => validateInstance({ name: "张三", status: "unknown" }, schema)).toThrow("不在允许范围内");
		});

		it("validateInstance allows optional fields to be omitted", async () => {
			const { validateInstance, loadConceptSchema } = await import("../schema-validator");

			const schema = await loadConceptSchema(TEST.ontologyId, TEST.conceptId);
			expect(() => validateInstance({ name: "张三", status: "active" }, schema)).not.toThrow();
		});

		it("loadConceptSchema throws when concept not found", async () => {
			const { loadConceptSchema } = await import("../schema-validator");

			await expect(loadConceptSchema(TEST.ontologyId, "non-existent")).rejects.toThrow("不存在");
		});

		it("loadConceptSchema throws on path traversal", async () => {
			const { loadConceptSchema } = await import("../schema-validator");

			await expect(loadConceptSchema("../etc", "passwd")).rejects.toThrow("path traversal");
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Store (CRUD)
	// ─────────────────────────────────────────────────────────────────────

	describe("store", () => {
		it("createInstance writes file and updates index", async () => {
			const { createInstance } = await import("../store");
			const { clearCache } = await import("../index-manager");

			clearCache();

			const instance = await createInstance(
				TEST.ontologyId, TEST.conceptId,
				{ name: "张三", status: "active" },
				"user"
			);

			expect(instance.id).toBeDefined();
			expect(instance.fields.name).toBe("张三");
			expect(instance.meta.version).toBe(1);
			expect(instance.meta.createdBy).toBe("user");

			expect(mockedFs.writeFile).toHaveBeenCalled();
		});

		it("createInstance rejects invalid fields", async () => {
			const { createInstance } = await import("../store");
			const { clearCache } = await import("../index-manager");

			clearCache();

			await expect(
				createInstance(TEST.ontologyId, TEST.conceptId, { status: "active" }, "user")
			).rejects.toThrow("必填项");
		});

		it("createInstance rejects path traversal", async () => {
			const { createInstance } = await import("../store");
			const { clearCache } = await import("../index-manager");

			clearCache();

			await expect(
				createInstance("../etc", "shadow", {}, "user")
			).rejects.toThrow("path traversal");
		});

		it("getInstance reads instance file", async () => {
			const { getInstance } = await import("../store");
			const result = await getInstance(TEST.ontologyId, TEST.conceptId, TEST.instanceId);

			expect(result.id).toBe(TEST.instanceId);
			expect(result.fields.name).toBe("张三");
		});

		it("updateInstance merges fields and increments version", async () => {
			const existing = createInstanceData();
			mockedFs.readFile.mockImplementation(async (p: string) => {
				if (pathMatches(p, TEST.instanceId) && !pathMatches(p, "versions")) {
					return JSON.stringify(existing);
				}
				if (pathMatches(p, "ontology.json")) return JSON.stringify(ONTOLOGY_JSON);
				if (pathMatches(p, "_index.json")) return JSON.stringify({ conceptId: TEST.conceptId, updatedAt: 0, entries: {} });
				throw new Error(`ENOENT: ${p}`);
			});

			const { updateInstance } = await import("../store");
			const { clearCache } = await import("../index-manager");

			clearCache();

			const updated = await updateInstance(
				TEST.ontologyId, TEST.conceptId, TEST.instanceId,
				{ age: 31 }
			);

			expect(updated.fields.age).toBe(31);
			expect(updated.fields.name).toBe("张三"); // preserved
			expect(updated.meta.version).toBe(2);
		});

		it("deleteInstance removes file and index entry", async () => {
			const { deleteInstance } = await import("../store");
			const { clearCache } = await import("../index-manager");

			clearCache();

			await deleteInstance(TEST.ontologyId, TEST.conceptId, TEST.instanceId);

			expect(mockedFs.unlink).toHaveBeenCalled();
		});

		it("listInstances loads multiple instances and skips missing ones", async () => {
			mockedFs.readFile.mockImplementation(async (p: string) => {
				if (pathMatches(p, "ontology.json")) return JSON.stringify(ONTOLOGY_JSON);
				if (pathMatches(p, "_index.json")) return JSON.stringify({ conceptId: TEST.conceptId, updatedAt: 0, entries: {} });
				if (pathMatches(p, "inst-001")) return JSON.stringify(createInstanceData({ id: "inst-001" }));
				// inst-002 doesn't exist
				throw new Error(`ENOENT: ${p}`);
			});

			const { listInstances } = await import("../store");
			const results = await listInstances(TEST.ontologyId, TEST.conceptId, ["inst-001", "inst-002"]);

			expect(results).toHaveLength(1);
			expect(results[0].id).toBe("inst-001");
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Query Engine
	// ─────────────────────────────────────────────────────────────────────

	describe("query-engine", () => {
		it("queryInstances returns all instances without filters", async () => {
			const indexData = {
				conceptId: TEST.conceptId,
				updatedAt: 0,
				entries: {
					"inst-001": { name: "张三", status: "active", createdAt: 100 },
					"inst-002": { name: "李四", status: "inactive", createdAt: 200 },
				},
			};

			mockedFs.readFile.mockImplementation(async (p: string) => {
				if (pathMatches(p, "_index.json")) return JSON.stringify(indexData);
				if (pathMatches(p, "ontology.json")) return JSON.stringify(ONTOLOGY_JSON);
				if (pathMatches(p, "inst-001")) return JSON.stringify(createInstanceData({ id: "inst-001" }));
				if (pathMatches(p, "inst-002")) return JSON.stringify(createInstanceData({ id: "inst-002", fields: { name: "李四", status: "inactive" } }));
				throw new Error(`ENOENT: ${p}`);
			});

			const { queryInstances } = await import("../query-engine");
			const { clearCache } = await import("../index-manager");
			clearCache();

			const result = await queryInstances(TEST.ontologyId, TEST.conceptId);

			expect(result.total).toBe(2);
			expect(result.items).toHaveLength(2);
		});

		it("queryInstances filters by field", async () => {
			const indexData = {
				conceptId: TEST.conceptId,
				updatedAt: 0,
				entries: {
					"inst-001": { name: "张三", status: "active", createdAt: 100 },
					"inst-002": { name: "李四", status: "inactive", createdAt: 200 },
				},
			};

			mockedFs.readFile.mockImplementation(async (p: string) => {
				if (pathMatches(p, "_index.json")) return JSON.stringify(indexData);
				if (pathMatches(p, "ontology.json")) return JSON.stringify(ONTOLOGY_JSON);
				if (pathMatches(p, "inst-001")) return JSON.stringify(createInstanceData({ id: "inst-001" }));
				throw new Error(`ENOENT: ${p}`);
			});

			const { queryInstances } = await import("../query-engine");
			const { clearCache } = await import("../index-manager");
			clearCache();

			const result = await queryInstances(TEST.ontologyId, TEST.conceptId, {
				filters: { status: "active" },
			});

			expect(result.total).toBe(1);
			expect(result.items).toHaveLength(1);
		});

		it("queryInstances sorts results", async () => {
			const indexData = {
				conceptId: TEST.conceptId,
				updatedAt: 0,
				entries: {
					"inst-001": { name: "张三", createdAt: 200 },
					"inst-002": { name: "李四", createdAt: 100 },
				},
			};

			mockedFs.readFile.mockImplementation(async (p: string) => {
				if (pathMatches(p, "_index.json")) return JSON.stringify(indexData);
				if (pathMatches(p, "ontology.json")) return JSON.stringify(ONTOLOGY_JSON);
				if (pathMatches(p, "inst-001")) return JSON.stringify(createInstanceData({ id: "inst-001" }));
				if (pathMatches(p, "inst-002")) return JSON.stringify(createInstanceData({ id: "inst-002", fields: { name: "李四" } }));
				throw new Error(`ENOENT: ${p}`);
			});

			const { queryInstances } = await import("../query-engine");
			const { clearCache } = await import("../index-manager");
			clearCache();

			const result = await queryInstances(TEST.ontologyId, TEST.conceptId, {
				sortBy: "createdAt",
				sortOrder: "asc",
			});

			expect(result.items).toHaveLength(2);
			expect(result.items[0].id).toBe("inst-002"); // 100 < 200
		});

		it("queryInstances paginates results", async () => {
			const entries: Record<string, Record<string, unknown>> = {};
			for (let i = 1; i <= 10; i++) {
				entries[`inst-${String(i).padStart(3, "0")}`] = { name: `User${i}`, createdAt: i * 100 };
			}
			const indexData = { conceptId: TEST.conceptId, updatedAt: 0, entries };

			mockedFs.readFile.mockImplementation(async (p: string) => {
				if (pathMatches(p, "_index.json")) return JSON.stringify(indexData);
				if (pathMatches(p, "ontology.json")) return JSON.stringify(ONTOLOGY_JSON);
				// Return instance data for any inst-XXX path
				for (let i = 1; i <= 10; i++) {
					const id = `inst-${String(i).padStart(3, "0")}`;
					if (pathMatches(p, id)) return JSON.stringify(createInstanceData({ id, fields: { name: `User${i}` } }));
				}
				throw new Error(`ENOENT: ${p}`);
			});

			const { queryInstances } = await import("../query-engine");
			const { clearCache } = await import("../index-manager");
			clearCache();

			const result = await queryInstances(TEST.ontologyId, TEST.conceptId, {
				page: 1,
				limit: 3,
			});

			expect(result.total).toBe(10);
			expect(result.items).toHaveLength(3);
			expect(result.totalPages).toBe(4);
			expect(result.page).toBe(1);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Version Manager
	// ─────────────────────────────────────────────────────────────────────

	describe("version", () => {
		it("saveVersion writes snapshot to version file", async () => {
			const instanceData = createInstanceData();
			mockedFs.readFile.mockImplementation(async (p: string) => {
				if (pathMatches(p, TEST.instanceId) && !pathMatches(p, "versions")) {
					return JSON.stringify(instanceData);
				}
				if (pathMatches(p, "ontology.json")) return JSON.stringify(ONTOLOGY_JSON);
				if (pathMatches(p, "versions")) return JSON.stringify({ version: 1, instanceId: TEST.instanceId, savedAt: 0, data: instanceData });
				throw new Error(`ENOENT: ${p}`);
			});

			const { saveVersion } = await import("../version");
			const snapshot = await saveVersion(TEST.ontologyId, TEST.conceptId, TEST.instanceId, "v1 snapshot");

			expect(snapshot.version).toBe(1);
			expect(snapshot.label).toBe("v1 snapshot");
			expect(mockedFs.writeFile).toHaveBeenCalled();
		});

		it("getVersions returns version list", async () => {
			mockedFs.readdir.mockResolvedValueOnce(["1.json", "2.json", "3.json"]);

			const { getVersions } = await import("../version");
			const versions = await getVersions(TEST.ontologyId, TEST.instanceId);

			expect(versions).toHaveLength(3);
			expect(versions.map((v) => v.version)).toEqual([1, 2, 3]);
		});

		it("getVersions returns empty array when no versions directory", async () => {
			mockedFs.readdir.mockRejectedValueOnce(new Error("ENOENT"));

			const { getVersions } = await import("../version");
			const versions = await getVersions(TEST.ontologyId, TEST.instanceId);

			expect(versions).toEqual([]);
		});

		it("getVersion reads specific version snapshot", async () => {
			const snapshotData = {
				version: 2,
				instanceId: TEST.instanceId,
				savedAt: 1717603300000,
				data: createInstanceData({ meta: { createdAt: 1717603200000, updatedAt: 1717603300000, createdBy: "user", version: 2 } }),
			};
			mockedFs.readFile.mockResolvedValueOnce(JSON.stringify(snapshotData));

			const { getVersion } = await import("../version");
			const version = await getVersion(TEST.ontologyId, TEST.instanceId, 2);

			expect(version.version).toBe(2);
			expect(version.data.fields.name).toBe("张三");
		});

		it("revertToVersion restores data and increments version", async () => {
			const oldData = createInstanceData({ meta: { createdAt: 1717603200000, updatedAt: 1717603200000, createdBy: "user", version: 2 } });
			const snapshotData = { version: 2, instanceId: TEST.instanceId, savedAt: 0, data: oldData };
			mockedFs.readFile.mockImplementation(async (p: string) => {
				if (pathMatches(p, "versions")) return JSON.stringify(snapshotData);
				if (pathMatches(p, "ontology.json")) return JSON.stringify(ONTOLOGY_JSON);
				throw new Error(`ENOENT: ${p}`);
			});

			const { revertToVersion } = await import("../version");
			const reverted = await revertToVersion(TEST.ontologyId, TEST.conceptId, TEST.instanceId, 2);

			expect(reverted.meta.version).toBe(3);
			expect(mockedFs.writeFile).toHaveBeenCalled();
		});
	});
});
