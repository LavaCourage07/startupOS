"use strict";
/**
 * JSON File Store
 *
 * Simple file-based storage for MVP phase
 * All data is stored in {project-root}/data/ directory
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonStore = exports.JsonStore = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const paths_1 = require("../paths");
function dataRoot() { return (0, paths_1.getDataRoot)(); }
function interviewsDir() { return path_1.default.join(dataRoot(), 'interviews'); }
function ontologyDir() { return path_1.default.join(dataRoot(), 'ontology'); }
function chatDir() { return path_1.default.join(dataRoot(), 'chats'); }
function projectsDir() { return path_1.default.join(dataRoot(), 'projects'); }
/**
 * JSON Store class
 */
class JsonStore {
    constructor() {
        this.version = '1.0.0';
        this.directoriesInitialized = false;
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!JsonStore.instance) {
            JsonStore.instance = new JsonStore();
        }
        return JsonStore.instance;
    }
    async ensureInitialized() {
        if (this.directoriesInitialized)
            return;
        await this.initializeDirectories();
        this.directoriesInitialized = true;
    }
    /**
     * Initialize data directories
     */
    async initializeDirectories() {
        const dirs = [
            dataRoot(),
            interviewsDir(),
            ontologyDir(),
            chatDir(),
            projectsDir(),
            path_1.default.join(projectsDir(), 'files'),
        ];
        for (const dir of dirs) {
            try {
                await fs_1.promises.mkdir(dir, { recursive: true });
            }
            catch (error) {
                console.error(`Failed to create directory ${dir}:`, error);
            }
        }
    }
    /**
     * Read JSON file
     */
    async read(filePath) {
        try {
            const fullPath = path_1.default.join(dataRoot(), filePath);
            const content = await fs_1.promises.readFile(fullPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            if (error instanceof SyntaxError) {
                console.warn(`[JsonStore] Malformed JSON in ${filePath}:`, error.message);
                return null;
            }
            throw error;
        }
    }
    /**
     * Write JSON file
     */
    async write(filePath, data) {
        await this.ensureInitialized();
        const now = new Date().toISOString();
        const fileData = {
            version: this.version,
            createdAt: now,
            updatedAt: now,
            data,
        };
        const fullPath = path_1.default.join(dataRoot(), filePath);
        await fs_1.promises.mkdir(path_1.default.dirname(fullPath), { recursive: true });
        await fs_1.promises.writeFile(fullPath, JSON.stringify(fileData, null, 2), 'utf-8');
    }
    /**
     * Update JSON file
     */
    async update(filePath, data) {
        const existing = await this.read(filePath);
        if (!existing) {
            return false;
        }
        const now = new Date().toISOString();
        const updatedData = {
            ...existing,
            updatedAt: now,
            data: {
                ...existing.data,
                ...data,
            },
        };
        const fullPath = path_1.default.join(dataRoot(), filePath);
        await fs_1.promises.writeFile(fullPath, JSON.stringify(updatedData, null, 2), 'utf-8');
        return true;
    }
    /**
     * Delete JSON file
     */
    async delete(filePath) {
        try {
            await fs_1.promises.unlink(path_1.default.join(dataRoot(), filePath));
            return true;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return true;
            }
            return false;
        }
    }
    /**
     * Check if file exists
     */
    async exists(filePath) {
        try {
            await fs_1.promises.access(path_1.default.join(dataRoot(), filePath));
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * List all files in a directory
     */
    async listFiles(dirPath, extension = '.json') {
        try {
            const fullPath = path_1.default.join(dataRoot(), dirPath);
            const files = await fs_1.promises.readdir(fullPath);
            return files.filter((file) => file.endsWith(extension));
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Get interviews path
     */
    getInterviewPath(interviewId) {
        return path_1.default.join(interviewsDir(), `${interviewId}.json`);
    }
    /**
     * Get ontology path
     */
    getOntologyPath(ontologyId) {
        return path_1.default.join(ontologyDir(), `${ontologyId}-ontology.json`);
    }
    /**
     * Get chat path
     */
    getChatPath(chatId) {
        return path_1.default.join(chatDir(), `${chatId}.json`);
    }
    /**
     * Get project metadata path
     */
    getProjectPath(projectId) {
        return path_1.default.join(projectsDir(), `${projectId}.json`);
    }
}
exports.JsonStore = JsonStore;
JsonStore.instance = null;
/**
 * Export singleton instance
 */
exports.jsonStore = JsonStore.getInstance();
