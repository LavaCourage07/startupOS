import path from "path";
import { getDataRoot } from "../../../paths";
import { getToolContext } from "./context";

export interface ResolvedToolPath {
	fullPath: string;
	boundary: string;
	displayPath: string;
}

function toPosixPath(value: string): string {
	return value.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function stripLeadingDotSlash(value: string): string {
	return value.replace(/^\.\/+/, "");
}

function isWindowsAbsolutePath(value: string): boolean {
	return /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value);
}

function isInsidePath(child: string, parent: string): boolean {
	const relative = path.relative(parent, child);
	return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function isSkillRuntimeDirectory(boundary: string, dataRoot: string): boolean {
	const skillsRoot = path.resolve(dataRoot, "skills");
	return isInsidePath(boundary, skillsRoot) && boundary !== skillsRoot;
}

function displayPathFor(fullPath: string, boundary: string): string {
	const dataRoot = path.resolve(getDataRoot());
	if (isInsidePath(fullPath, dataRoot)) {
		const relative = toPosixPath(path.relative(dataRoot, fullPath));
		return relative ? `data/${relative}` : "data";
	}

	if (isInsidePath(fullPath, boundary)) {
		const relative = toPosixPath(path.relative(boundary, fullPath));
		return relative || ".";
	}

	return toPosixPath(fullPath);
}

/**
 * Resolve a tool path while hiding OS path differences from the agent.
 *
 * Execution paths stay native for the host OS. Paths returned to the model are
 * always POSIX-like and, for data artifacts, rooted at `data/...`.
 */
export function resolveToolPath(rawPath: string): ResolvedToolPath {
	const toolContext = getToolContext();
	const boundary = toolContext.workingDirectory;
	if (!boundary) {
		throw new Error("Tool boundary not configured: workingDirectory must be injected via tool context");
	}

	const boundaryAbs = path.resolve(boundary);
	const dataRootAbs = path.resolve(getDataRoot());
	const normalizedInput = stripLeadingDotSlash(toPosixPath(rawPath.trim()));

	if (normalizedInput === "data") {
		return {
			fullPath: dataRootAbs,
			boundary: dataRootAbs,
			displayPath: "data",
		};
	}

	if (normalizedInput.startsWith("data/")) {
		const relativeToData = normalizedInput.slice("data/".length);
		const fullPath = path.resolve(dataRootAbs, relativeToData);
		if (!isInsidePath(fullPath, dataRootAbs)) {
			throw new Error(`Invalid path: "${rawPath}" escapes data directory boundary`);
		}
		return {
			fullPath,
			boundary: dataRootAbs,
			displayPath: displayPathFor(fullPath, dataRootAbs),
		};
	}

	if (
		isSkillRuntimeDirectory(boundaryAbs, dataRootAbs) &&
		(normalizedInput === "agents" ||
			normalizedInput.startsWith("agents/") ||
			normalizedInput === "skills" ||
			normalizedInput.startsWith("skills/"))
	) {
		const fullPath = path.resolve(dataRootAbs, normalizedInput);
		if (!isInsidePath(fullPath, dataRootAbs)) {
			throw new Error(`Invalid path: "${rawPath}" escapes data directory boundary`);
		}
		return {
			fullPath,
			boundary: dataRootAbs,
			displayPath: displayPathFor(fullPath, dataRootAbs),
		};
	}

	if (path.isAbsolute(rawPath)) {
		const fullPath = path.resolve(rawPath);
		if (!isInsidePath(fullPath, boundaryAbs) && !isInsidePath(fullPath, dataRootAbs)) {
			throw new Error(`Invalid path: "${rawPath}" escapes working directory boundary`);
		}
		return {
			fullPath,
			boundary: isInsidePath(fullPath, dataRootAbs) ? dataRootAbs : boundaryAbs,
			displayPath: displayPathFor(fullPath, boundaryAbs),
		};
	}

	if (isWindowsAbsolutePath(rawPath)) {
		throw new Error(`Invalid path: Windows absolute paths are not accepted by this runtime (${rawPath})`);
	}

	const fullPath = path.resolve(boundaryAbs, normalizedInput);
	if (!isInsidePath(fullPath, boundaryAbs)) {
		throw new Error(`Invalid path: "${rawPath}" escapes working directory boundary`);
	}

	return {
		fullPath,
		boundary: boundaryAbs,
		displayPath: displayPathFor(fullPath, boundaryAbs),
	};
}

export function normalizeToolDisplayPath(rawPath: string): string {
	const normalizedInput = stripLeadingDotSlash(toPosixPath(rawPath.trim()));
	return normalizedInput || ".";
}

export function joinToolDisplayPath(...segments: string[]): string {
	return toPosixPath(path.posix.join(...segments.map((segment) => toPosixPath(segment))));
}
