"use strict";
/**
 * 知识来源 Ingest（重构：导入到 UnifiedOntology）
 *
 * business-model.json → knowledge/business-ontology.json（业务本体）
 * 同时保持 wiki/entities/*.md 作为人类可读视图
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeIngest = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const unified_ontology_1 = require("./unified-ontology");
// ============================================================================
// KnowledgeIngest
// ============================================================================
class KnowledgeIngest {
    constructor(knowledgeDir, projectDir) {
        this.sourcesDir = path_1.default.join(knowledgeDir, 'sources');
        this.uploadedDir = path_1.default.join(this.sourcesDir, 'uploaded');
        this.externalDir = path_1.default.join(this.sourcesDir, 'external');
        this.businessOntologyPath = path_1.default.join(knowledgeDir, 'business-ontology.json');
        this.wikiDir = path_1.default.join(knowledgeDir, 'wiki');
        this.projectDir = projectDir ?? path_1.default.dirname(knowledgeDir);
        this.ensureSourceDirs();
        if (!(0, fs_1.existsSync)(this.wikiDir))
            (0, fs_1.mkdirSync)(this.wikiDir, { recursive: true });
    }
    /**
     * 将上传文件复制到 sources/uploaded/（不可变，只读）
     */
    async ingestFile(sourcePath, fileName) {
        const targetPath = path_1.default.join(this.uploadedDir, fileName);
        if (!(0, fs_1.existsSync)(targetPath)) {
            (0, fs_1.copyFileSync)(sourcePath, targetPath);
        }
    }
    /**
     * 解析 business-model.json → 写入 knowledge/business-ontology.json（业务本体）
     * 同时生成 wiki/entities/*.md 人类可读视图
     *
     * 自动查找业务模型文件（按优先级）：
     * 1. 传入的 businessModelPath（如存在）
     * 2. {projectDir}/output/business-model.json
     * 3. {projectDir}/reference/business-model.json
     * 4. {projectDir}/business-model.json
     */
    async ingestBusinessModel(businessModelPath) {
        // 优先使用传入的路径，否则自动查找
        const actualPath = businessModelPath && (0, fs_1.existsSync)(businessModelPath)
            ? businessModelPath
            : this.findBusinessModelPath();
        if (!actualPath) {
            console.log('[KnowledgeIngest] No business-model.json found, skipping');
            return;
        }
        try {
            const content = (0, fs_1.readFileSync)(actualPath, 'utf-8');
            const projectId = path_1.default.basename(this.projectDir);
            // 用 UnifiedOntology 解析业务模型
            const ontology = unified_ontology_1.UnifiedOntology.fromBusinessModel(content, projectId);
            // 写入独立的业务本体文件
            ontology.saveToFile(this.businessOntologyPath);
            // 生成 wiki 页面（人类可读视图）
            this.writeBusinessWikiPages(ontology);
        }
        catch (err) {
            console.error('[KnowledgeIngest] Failed to ingest business model:', err);
        }
    }
    /**
     * 将外部信息摘要写入 sources/external/
     */
    async ingestExternalInfo(source, summary) {
        const timestamp = Date.now();
        const fileName = `external-${timestamp}.md`;
        const targetPath = path_1.default.join(this.externalDir, fileName);
        const content = `# External Information\n\n**Source:** ${source}\n**Date:** ${new Date().toISOString()}\n\n${summary}\n`;
        (0, fs_1.writeFileSync)(targetPath, content, 'utf-8');
    }
    // ==========================================================================
    // 内部方法
    // ==========================================================================
    ensureSourceDirs() {
        if (!(0, fs_1.existsSync)(this.sourcesDir)) {
            (0, fs_1.mkdirSync)(this.sourcesDir, { recursive: true });
        }
        if (!(0, fs_1.existsSync)(this.uploadedDir)) {
            (0, fs_1.mkdirSync)(this.uploadedDir, { recursive: true });
        }
        if (!(0, fs_1.existsSync)(this.externalDir)) {
            (0, fs_1.mkdirSync)(this.externalDir, { recursive: true });
        }
    }
    /** 按优先级查找 business-model.json */
    findBusinessModelPath() {
        const candidates = [
            path_1.default.join(this.projectDir, 'output', 'business-model.json'),
            path_1.default.join(this.projectDir, 'reference', 'business-model.json'),
            path_1.default.join(this.projectDir, 'business-model.json'),
        ];
        for (const p of candidates) {
            if ((0, fs_1.existsSync)(p))
                return p;
        }
        return null;
    }
    /** 为本体中的业务实体生成 wiki 页面 */
    writeBusinessWikiPages(ontology) {
        const entitiesDir = path_1.default.join(this.wikiDir, 'entities');
        if (!(0, fs_1.existsSync)(entitiesDir))
            (0, fs_1.mkdirSync)(entitiesDir, { recursive: true });
        for (const entity of ontology.entities) {
            const fileName = `${entity.name.toLowerCase().replace(/\s+/g, '-')}.md`;
            const entityFile = path_1.default.join(entitiesDir, fileName);
            if (!(0, fs_1.existsSync)(entityFile)) {
                const attrLines = entity.attributes.map(a => `- **${a.key}**: ${formatValue(a.value)}`).join('\n');
                const related = ontology.relations
                    .filter(r => r.sourceId === entity.id || r.targetId === entity.id)
                    .map(r => {
                    const target = ontology.getEntity(r.sourceId === entity.id ? r.targetId : r.sourceId);
                    return `- ${r.type} → ${target?.name ?? r.sourceId === entity.id ? r.targetId : r.sourceId}`;
                })
                    .join('\n');
                const wikiContent = `# ${entity.name}\n\n**类型:** ${entity.type}\n\n## 属性\n\n${attrLines || '（无）'}\n\n## 关系\n\n${related || '（无）'}\n\n## 来源\n\n- business-model.json（knowledge/business-ontology.json 主存储）\n`;
                (0, fs_1.writeFileSync)(entityFile, wikiContent, 'utf-8');
            }
        }
    }
}
exports.KnowledgeIngest = KnowledgeIngest;
function formatValue(val) {
    if (typeof val === 'string')
        return val;
    return JSON.stringify(val);
}
