import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { instanceRelationsPath, isValidId } from "./config";
import { loadOntology } from "./ontology-ops";
import type { InstanceRelation, InstanceRelationsData } from "./types";

export interface CreateInstanceRelationInput {
	sourceInstanceId: string;
	targetInstanceId: string;
	type: string;
	sourceConceptId: string;
	targetConceptId: string;
}

async function readInstanceRelations(ontologyId: string): Promise<InstanceRelationsData> {
	if (!isValidId(ontologyId)) {
		throw new Error("Invalid ontology ID: path traversal detected");
	}

	const filePath = instanceRelationsPath(ontologyId);
	if (!existsSync(filePath)) {
		return { relations: [] };
	}

	const content = await fs.readFile(filePath, "utf-8");
	const parsed = JSON.parse(content) as Partial<InstanceRelationsData>;
	return { relations: Array.isArray(parsed.relations) ? parsed.relations : [] };
}

async function writeInstanceRelations(
	ontologyId: string,
	data: InstanceRelationsData
): Promise<void> {
	const filePath = instanceRelationsPath(ontologyId);
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function listInstanceRelations(
	ontologyId: string
): Promise<{ relations: InstanceRelation[]; constraints: Awaited<ReturnType<typeof loadOntology>>["relations"] }> {
	const [stored, ontology] = await Promise.all([
		readInstanceRelations(ontologyId),
		loadOntology(ontologyId),
	]);

	return {
		relations: stored.relations,
		constraints: ontology.relations ?? [],
	};
}

export async function createInstanceRelation(
	ontologyId: string,
	input: CreateInstanceRelationInput
): Promise<InstanceRelation> {
	const stored = await readInstanceRelations(ontologyId);
	const relation: InstanceRelation = {
		id: `irel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		sourceInstanceId: input.sourceInstanceId,
		targetInstanceId: input.targetInstanceId,
		type: input.type,
		sourceConceptId: input.sourceConceptId,
		targetConceptId: input.targetConceptId,
	};

	await writeInstanceRelations(ontologyId, {
		relations: [...stored.relations, relation],
	});

	return relation;
}

export async function deleteInstanceRelation(
	ontologyId: string,
	relationId: string
): Promise<void> {
	const stored = await readInstanceRelations(ontologyId);
	const relations = stored.relations.filter((relation) => relation.id !== relationId);

	if (relations.length === stored.relations.length) {
		throw new Error(`实例关系 "${relationId}" 不存在`);
	}

	await writeInstanceRelations(ontologyId, { relations });
}
