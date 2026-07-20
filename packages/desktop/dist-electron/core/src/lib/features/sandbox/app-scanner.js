"use strict";
/**
 * Sandbox app scanner — discovers HTML apps under /data
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSandboxApps = listSandboxApps;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const paths_1 = require("../../paths");
function listSandboxApps() {
    const dataDir = (0, paths_1.getDataRoot)();
    const apps = [];
    const scanRoots = ['skills', 'agents'];
    function scan(dir, relPath) {
        let entries;
        try {
            entries = (0, fs_1.readdirSync)(dir);
        }
        catch {
            return;
        }
        if (entries.includes('index.html')) {
            const stat = (0, fs_1.statSync)(dir);
            const appId = relPath.replace(/^data\//, '');
            apps.push({
                id: appId,
                name: path_1.default.basename(dir),
                path: relPath,
                updatedAt: stat.mtimeMs,
            });
        }
        for (const entry of entries) {
            if (entry.endsWith('.html') && entry !== 'index.html') {
                const htmlPath = path_1.default.join(dir, entry);
                const stat = (0, fs_1.statSync)(htmlPath);
                const appId = relPath.replace(/^data\//, '') + '/' + entry;
                apps.push({
                    id: appId,
                    name: entry.replace(/\.html$/, ''),
                    path: relPath + '/' + entry,
                    updatedAt: stat.mtimeMs,
                });
            }
        }
        for (const entry of entries) {
            if (entry.startsWith('.') || entry === 'node_modules')
                continue;
            const entryPath = path_1.default.join(dir, entry);
            const entryStat = (0, fs_1.statSync)(entryPath);
            if (entryStat.isDirectory()) {
                const depth = relPath.split('/').length;
                if (depth < 4) {
                    scan(entryPath, path_1.default.join(relPath, entry));
                }
            }
        }
    }
    for (const root of scanRoots) {
        const rootPath = path_1.default.join(dataDir, root);
        if ((0, fs_1.existsSync)(rootPath)) {
            scan(rootPath, path_1.default.join('data', root));
        }
    }
    apps.sort((a, b) => b.updatedAt - a.updatedAt);
    return apps;
}
