"use strict";
/**
 * 知识库 Provider（重构：UnifiedOntology 为主存储）
 *
 * 主存储：knowledge/ontology.json（UnifiedOntology JSON 序列化）
 * 衍生视图：knowledge/wiki/*.md、knowledge/index.md、knowledge/log.md
 * Frozen Snapshot：Knowledge.md（启动时加载到 prompt）
 *
 * 所有知识最终都以文件形式持久化到 agent/project 目录。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeProvider = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const unified_ontology_1 = require("./unified-ontology");
// ============================================================================
// KnowledgeProvider
// ============================================================================
class KnowledgeProvider {
    constructor(agentDir) {
        this.name = 'knowledge';
        this.agentDir = agentDir;
        this.knowledgeDir = path_1.default.join(agentDir, 'knowledge');
        this.ontologyPath = path_1.default.join(this.knowledgeDir, 'ontology.json');
        this.businessOntologyPath = path_1.default.join(this.knowledgeDir, 'business-ontology.json');
        this.wikiDir = path_1.default.join(this.knowledgeDir, 'wiki');
        this.indexMdPath = path_1.default.join(this.knowledgeDir, 'index.md');
        this.logMdPath = path_1.default.join(this.knowledgeDir, 'log.md');
        this.snapshotMdPath = path_1.default.join(agentDir, 'Knowledge.md');
        // 加载两份本体
        this.ontology = this.loadOrCreateOntology();
        this.businessOntology = this.loadBusinessOntology();
        this.ensureKnowledgeDir();
    }
    /** 获取对话知识本体（可写） */
    getOntology() {
        return this.ontology;
    }
    /** 获取业务本体（只读） */
    getBusinessOntology() {
        return this.businessOntology;
    }
    /** 联合查询：对话知识 + 业务本体 */
    queryCombined(filter) {
        const results = this.ontology.query(filter);
        if (this.businessOntology) {
            results.push(...this.businessOntology.query(filter));
        }
        return results;
    }
    async sync_turn(data) {
        const extracted = this.extractKnowledge(data);
        if (extracted.entities.length === 0 && extracted.facts.length === 0)
            return;
        // 1. 写入统一本体
        for (const ent of extracted.entities) {
            // 避免重复创建同名同类型实体
            const existing = this.ontology.entities.find(e => e.name === ent.name && e.type === ent.type);
            if (!existing) {
                this.ontology.createEntity(ent.type, ent.name, ent.attributes);
            }
        }
        this.saveOntology();
        // 2. 更新衍生 wiki 页面
        this.writeWikiPages(extracted);
        this.updateIndex(extracted);
        this.appendLog(data.turnNumber, extracted);
        // 3. 更新 Frozen Snapshot
        this.exportSnapshot();
    }
    async prefetch(query) {
        const keywords = query.split(/\s+/).filter(w => w.length > 2);
        if (keywords.length === 0)
            return null;
        // 联合查询
        const matched = [];
        for (const kw of keywords) {
            matched.push(...this.ontology.query({ type: kw }));
            matched.push(...this.ontology.query({ attributeKey: 'name', attributeValue: kw }));
            if (this.businessOntology) {
                matched.push(...this.businessOntology.query({ type: kw }));
                matched.push(...this.businessOntology.query({ attributeKey: 'name', attributeValue: kw }));
            }
        }
        if (matched.length === 0) {
            const firstKw = keywords[0];
            return firstKw ? this.searchWikiForMatch(firstKw) : null;
        }
        const unique = new Map();
        for (const e of matched)
            unique.set(e.id, e);
        const lines = [];
        for (const e of unique.values()) {
            const attrs = e.attributes.map(a => `${a.key}: ${formatAttrValue(a.value)}`).join(', ');
            lines.push(`- **${e.name}** (type: ${e.type}) ${attrs ? `— ${attrs}` : ''}`);
        }
        return lines.join('\n');
    }
    async system_prompt_block() {
        if ((0, fs_1.existsSync)(this.snapshotMdPath)) {
            try {
                const content = (0, fs_1.readFileSync)(this.snapshotMdPath, 'utf-8');
                if (content.trim()) {
                    return `## Knowledge Base Snapshot\n\n以下是知识库快照（Knowledge.md），包含当前认知世界的知识索引：\n\n${content}`;
                }
            }
            catch {
                // ignore
            }
        }
        return '';
    }
    async ingestCandidates(candidates) {
        if (candidates.length === 0) {
            return;
        }
        const merged = {
            entities: [],
            facts: [],
        };
        for (const candidate of candidates) {
            for (const entity of candidate.entities) {
                if (!merged.entities.some((existing) => existing.name === entity.name && existing.type === entity.type)) {
                    merged.entities.push(entity);
                }
            }
            for (const fact of candidate.facts) {
                if (!merged.facts.includes(fact)) {
                    merged.facts.push(fact);
                }
            }
        }
        for (const entity of merged.entities) {
            const existing = this.ontology.entities.find((current) => current.name === entity.name && current.type === entity.type);
            if (!existing) {
                this.ontology.createEntity(entity.type, entity.name, entity.attributes);
            }
        }
        this.saveOntology();
        this.writeWikiPages(merged);
        this.updateIndex(merged);
        this.exportSnapshot();
    }
    // ==========================================================================
    // 内部方法
    // ==========================================================================
    loadOrCreateOntology() {
        if ((0, fs_1.existsSync)(this.ontologyPath)) {
            try {
                const content = (0, fs_1.readFileSync)(this.ontologyPath, 'utf-8');
                return unified_ontology_1.UnifiedOntology.fromJSON(content);
            }
            catch (err) {
                console.warn('[KnowledgeProvider] Failed to load ontology.json, creating new:', err);
            }
        }
        return new unified_ontology_1.UnifiedOntology({
            id: 'knowledge-ontology',
            projectId: path_1.default.basename(this.agentDir),
            name: 'Knowledge Ontology',
        });
    }
    loadBusinessOntology() {
        if ((0, fs_1.existsSync)(this.businessOntologyPath)) {
            try {
                const content = (0, fs_1.readFileSync)(this.businessOntologyPath, 'utf-8');
                return unified_ontology_1.UnifiedOntology.fromJSON(content);
            }
            catch (err) {
                console.warn('[KnowledgeProvider] Failed to load business-ontology.json:', err);
            }
        }
        return null;
    }
    saveOntology() {
        this.ontology.saveToFile(this.ontologyPath);
    }
    ensureKnowledgeDir() {
        if (!(0, fs_1.existsSync)(this.knowledgeDir)) {
            (0, fs_1.mkdirSync)(this.knowledgeDir, { recursive: true });
        }
        if (!(0, fs_1.existsSync)(this.wikiDir)) {
            (0, fs_1.mkdirSync)(this.wikiDir, { recursive: true });
        }
        if (!(0, fs_1.existsSync)(this.indexMdPath)) {
            (0, fs_1.writeFileSync)(this.indexMdPath, this.getDefaultIndex(), 'utf-8');
        }
        if (!(0, fs_1.existsSync)(this.logMdPath)) {
            (0, fs_1.writeFileSync)(this.logMdPath, this.getDefaultLog(), 'utf-8');
        }
        // 初始化时如无 snapshot，从当前本体导出一份
        if (!(0, fs_1.existsSync)(this.snapshotMdPath)) {
            this.exportSnapshot();
        }
    }
    /** 导出 Frozen Snapshot：合并对话知识 + 业务本体 */
    exportSnapshot() {
        try {
            let markdown = this.ontology.toMarkdown();
            if (this.businessOntology) {
                markdown += '\n\n---\n\n# Business Ontology\n\n' + this.businessOntology.toMarkdown();
            }
            (0, fs_1.writeFileSync)(this.snapshotMdPath, markdown, 'utf-8');
        }
        catch (err) {
            console.error('[KnowledgeProvider] Failed to export snapshot:', err);
        }
    }
    /** 简单的知识提取（启发式） */
    extractKnowledge(data) {
        const entities = [];
        const facts = [];
        // 从用户消息中提取专有名词
        const entityRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
        let match;
        while ((match = entityRegex.exec(data.userMessage)) !== null) {
            if (match[1] && !entities.some(e => e.name === match[1]) && match[1].length > 2) {
                entities.push({ name: match[1], type: 'Concept', attributes: { source: 'conversation', turn: data.turnNumber } });
            }
        }
        // 从助手思考过程中提取关键信息
        if (data.assistantThinking && data.assistantThinking.length > 20 && data.assistantThinking.length < 2000) {
            facts.push(`Turn #${data.turnNumber}: [thinking] ${data.assistantThinking.slice(0, 500)}`);
        }
        // 从工具调用结果中提取关键信息
        for (const toolCall of data.toolCalls) {
            if (toolCall.success && toolCall.result.length > 50 && toolCall.result.length < 2000) {
                facts.push(`Turn #${data.turnNumber}: ${toolCall.name} → ${toolCall.result.slice(0, 200)}`);
            }
        }
        return { entities, facts };
    }
    writeWikiPages(extracted) {
        for (const ent of extracted.entities) {
            const fileName = `${ent.name.toLowerCase().replace(/\s+/g, '-')}.md`;
            const entityFile = path_1.default.join(this.wikiDir, fileName);
            if (!(0, fs_1.existsSync)(entityFile)) {
                const content = this.buildEntityWiki(ent);
                (0, fs_1.writeFileSync)(entityFile, content, 'utf-8');
            }
        }
    }
    buildEntityWiki(ent) {
        const attrLines = Object.entries(ent.attributes)
            .map(([k, v]) => `- **${k}**: ${formatAttrValue(v)}`)
            .join('\n');
        return `# ${ent.name}\n\n**类型:** ${ent.type}\n\n## 属性\n\n${attrLines || '（无）'}\n\n## 关系\n\n- 待补充\n\n## 来源\n\n- 对话提取（knowledge/ontology.json 主存储）\n`;
    }
    updateIndex(extracted) {
        if (extracted.entities.length === 0)
            return;
        try {
            let indexContent = (0, fs_1.readFileSync)(this.indexMdPath, 'utf-8');
            for (const ent of extracted.entities) {
                if (!indexContent.includes(ent.name)) {
                    const fileName = ent.name.toLowerCase().replace(/\s+/g, '-');
                    indexContent += `\n- [\`${ent.name}\`](wiki/${fileName}.md) — ${ent.type}`;
                }
            }
            (0, fs_1.writeFileSync)(this.indexMdPath, indexContent, 'utf-8');
        }
        catch {
            // ignore
        }
    }
    appendLog(turnNumber, extracted) {
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const names = extracted.entities.map(e => e.name).join(', ') || '无';
        const logEntry = `## Turn #${turnNumber} (${timestamp})\n\n**新增实体:** ${names}\n\n---\n\n`;
        try {
            (0, fs_1.appendFileSync)(this.logMdPath, logEntry, 'utf-8');
        }
        catch {
            // ignore
        }
    }
    searchWikiForMatch(keyword) {
        if (!(0, fs_1.existsSync)(this.wikiDir))
            return null;
        try {
            const files = require('fs').readdirSync(this.wikiDir);
            for (const file of files) {
                if (!file.endsWith('.md'))
                    continue;
                const content = (0, fs_1.readFileSync)(path_1.default.join(this.wikiDir, file), 'utf-8');
                if (content.toLowerCase().includes(keyword.toLowerCase())) {
                    return content.slice(0, 1500);
                }
            }
        }
        catch {
            // ignore
        }
        return null;
    }
    getDefaultIndex() {
        return `# Knowledge Index\n\n## 实体\n\n（尚无实体）\n\n## 概念\n\n（尚无概念）\n\n> 结构化数据见 \`knowledge/ontology.json\`\n`;
    }
    getDefaultLog() {
        return `# Knowledge Log\n\n（暂无变更记录）\n`;
    }
}
exports.KnowledgeProvider = KnowledgeProvider;
function formatAttrValue(val) {
    if (typeof val === 'string')
        return val;
    if (typeof val === 'number' || typeof val === 'boolean')
        return String(val);
    return JSON.stringify(val);
}
