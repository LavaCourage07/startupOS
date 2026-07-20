/**
 * 知识来源 Ingest（重构：导入到 UnifiedOntology）
 *
 * business-model.json → knowledge/business-ontology.json（业务本体）
 * 同时保持 wiki/entities/*.md 作为人类可读视图
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import path from 'path';
import { UnifiedOntology } from './unified-ontology';

// ============================================================================
// KnowledgeIngest
// ============================================================================

export class KnowledgeIngest {
  private readonly sourcesDir: string;
  private readonly uploadedDir: string;
  private readonly externalDir: string;
  private readonly businessOntologyPath: string;
  private readonly wikiDir: string;
  private readonly projectDir: string; // agentDir 或 projectDir（用于查找 business-model.json）

  constructor(knowledgeDir: string, projectDir?: string) {
    this.sourcesDir = path.join(knowledgeDir, 'sources');
    this.uploadedDir = path.join(this.sourcesDir, 'uploaded');
    this.externalDir = path.join(this.sourcesDir, 'external');
    this.businessOntologyPath = path.join(knowledgeDir, 'business-ontology.json');
    this.wikiDir = path.join(knowledgeDir, 'wiki');
    this.projectDir = projectDir ?? path.dirname(knowledgeDir);
    this.ensureSourceDirs();
    if (!existsSync(this.wikiDir)) mkdirSync(this.wikiDir, { recursive: true });
  }

  /**
   * 将上传文件复制到 sources/uploaded/（不可变，只读）
   */
  async ingestFile(sourcePath: string, fileName: string): Promise<void> {
    const targetPath = path.join(this.uploadedDir, fileName);
    if (!existsSync(targetPath)) {
      copyFileSync(sourcePath, targetPath);
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
  async ingestBusinessModel(businessModelPath?: string): Promise<void> {
    // 优先使用传入的路径，否则自动查找
    const actualPath = businessModelPath && existsSync(businessModelPath)
      ? businessModelPath
      : this.findBusinessModelPath();

    if (!actualPath) {
      console.log('[KnowledgeIngest] No business-model.json found, skipping');
      return;
    }

    try {
      const content = readFileSync(actualPath, 'utf-8');
      const projectId = path.basename(this.projectDir);

      // 用 UnifiedOntology 解析业务模型
      const ontology = UnifiedOntology.fromBusinessModel(content, projectId);

      // 写入独立的业务本体文件
      ontology.saveToFile(this.businessOntologyPath);

      // 生成 wiki 页面（人类可读视图）
      this.writeBusinessWikiPages(ontology);
    } catch (err) {
      console.error('[KnowledgeIngest] Failed to ingest business model:', err);
    }
  }

  /**
   * 将外部信息摘要写入 sources/external/
   */
  async ingestExternalInfo(source: string, summary: string): Promise<void> {
    const timestamp = Date.now();
    const fileName = `external-${timestamp}.md`;
    const targetPath = path.join(this.externalDir, fileName);

    const content = `# External Information\n\n**Source:** ${source}\n**Date:** ${new Date().toISOString()}\n\n${summary}\n`;
    writeFileSync(targetPath, content, 'utf-8');
  }

  // ==========================================================================
  // 内部方法
  // ==========================================================================

  private ensureSourceDirs(): void {
    if (!existsSync(this.sourcesDir)) {
      mkdirSync(this.sourcesDir, { recursive: true });
    }
    if (!existsSync(this.uploadedDir)) {
      mkdirSync(this.uploadedDir, { recursive: true });
    }
    if (!existsSync(this.externalDir)) {
      mkdirSync(this.externalDir, { recursive: true });
    }
  }

  /** 按优先级查找 business-model.json */
  private findBusinessModelPath(): string | null {
    const candidates = [
      path.join(this.projectDir, 'output', 'business-model.json'),
      path.join(this.projectDir, 'reference', 'business-model.json'),
      path.join(this.projectDir, 'business-model.json'),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    return null;
  }

  /** 为本体中的业务实体生成 wiki 页面 */
  private writeBusinessWikiPages(ontology: UnifiedOntology): void {
    const entitiesDir = path.join(this.wikiDir, 'entities');
    if (!existsSync(entitiesDir)) mkdirSync(entitiesDir, { recursive: true });

    for (const entity of ontology.entities) {
      const fileName = `${entity.name.toLowerCase().replace(/\s+/g, '-')}.md`;
      const entityFile = path.join(entitiesDir, fileName);

      if (!existsSync(entityFile)) {
        const attrLines = entity.attributes.map(a => `- **${a.key}**: ${formatValue(a.value)}`).join('\n');
        const related = ontology.relations
          .filter(r => r.sourceId === entity.id || r.targetId === entity.id)
          .map(r => {
            const target = ontology.getEntity(r.sourceId === entity.id ? r.targetId : r.sourceId);
            return `- ${r.type} → ${target?.name ?? r.sourceId === entity.id ? r.targetId : r.sourceId}`;
          })
          .join('\n');

        const wikiContent = `# ${entity.name}\n\n**类型:** ${entity.type}\n\n## 属性\n\n${attrLines || '（无）'}\n\n## 关系\n\n${related || '（无）'}\n\n## 来源\n\n- business-model.json（knowledge/business-ontology.json 主存储）\n`;
        writeFileSync(entityFile, wikiContent, 'utf-8');
      }
    }
  }
}

function formatValue(val: unknown): string {
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}
