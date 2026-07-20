"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveToolPath = resolveToolPath;
exports.normalizeToolDisplayPath = normalizeToolDisplayPath;
exports.joinToolDisplayPath = joinToolDisplayPath;
const path_1 = __importDefault(require("path"));
const paths_1 = require("../../../paths");
const context_1 = require("./context");
function toPosixPath(value) {
    return value.replace(/\\/g, "/").replace(/\/+/g, "/");
}
function stripLeadingDotSlash(value) {
    return value.replace(/^\.\/+/, "");
}
function isWindowsAbsolutePath(value) {
    return /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value);
}
function isInsidePath(child, parent) {
    const relative = path_1.default.relative(parent, child);
    return relative === "" || (!!relative && !relative.startsWith("..") && !path_1.default.isAbsolute(relative));
}
function displayPathFor(fullPath, boundary) {
    const dataRoot = path_1.default.resolve((0, paths_1.getDataRoot)());
    if (isInsidePath(fullPath, dataRoot)) {
        const relative = toPosixPath(path_1.default.relative(dataRoot, fullPath));
        return relative ? `data/${relative}` : "data";
    }
    if (isInsidePath(fullPath, boundary)) {
        const relative = toPosixPath(path_1.default.relative(boundary, fullPath));
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
function resolveToolPath(rawPath) {
    const toolContext = (0, context_1.getToolContext)();
    const boundary = toolContext.workingDirectory;
    if (!boundary) {
        throw new Error("Tool boundary not configured: workingDirectory must be injected via tool context");
    }
    const boundaryAbs = path_1.default.resolve(boundary);
    const dataRootAbs = path_1.default.resolve((0, paths_1.getDataRoot)());
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
        const fullPath = path_1.default.resolve(dataRootAbs, relativeToData);
        if (!isInsidePath(fullPath, dataRootAbs)) {
            throw new Error(`Invalid path: "${rawPath}" escapes data directory boundary`);
        }
        return {
            fullPath,
            boundary: dataRootAbs,
            displayPath: displayPathFor(fullPath, dataRootAbs),
        };
    }
    if (path_1.default.isAbsolute(rawPath)) {
        const fullPath = path_1.default.resolve(rawPath);
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
    const fullPath = path_1.default.resolve(boundaryAbs, normalizedInput);
    if (!isInsidePath(fullPath, boundaryAbs)) {
        throw new Error(`Invalid path: "${rawPath}" escapes working directory boundary`);
    }
    return {
        fullPath,
        boundary: boundaryAbs,
        displayPath: displayPathFor(fullPath, boundaryAbs),
    };
}
function normalizeToolDisplayPath(rawPath) {
    const normalizedInput = stripLeadingDotSlash(toPosixPath(rawPath.trim()));
    return normalizedInput || ".";
}
function joinToolDisplayPath(...segments) {
    return toPosixPath(path_1.default.posix.join(...segments.map((segment) => toPosixPath(segment))));
}
