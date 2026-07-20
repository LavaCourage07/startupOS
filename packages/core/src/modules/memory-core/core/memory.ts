/**
 * Memory — Block 集合 + compile/render。
 *
 * Story M.2: 管理 Block Map，支持 markdown/xml 两种输出格式，
 * CRUD 操作，以及持久化到 Memory.md + blocks.json 版本快照。
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  Block,
  BlockDefinition,
  DEFAULT_BLOCKS,
  createBlock,
  serializeBlock,
  validateBlock,
} from './block';

export interface CompileOptions {
  format?: 'markdown' | 'xml';
  includeHidden?: boolean;
  labels?: string[];
}

export interface BlocksVersionSnapshot {
  version: number;
  timestamp: number;
  blocks: Array<Record<string, unknown>>;
  changedBlocks?: string[];
}

export class Memory {
  private blocks = new Map<string, Block>();
  private agentDir: string;

  constructor(agentDir: string, definitions?: BlockDefinition[]) {
    this.agentDir = agentDir;
    this.loadFromDisk();
    if (this.blocks.size === 0) {
      this.initializeDefaults(definitions);
    }
  }

  // ==========================================================================
  // CRUD
  // ==========================================================================

  getBlock(label: string): Block | null {
    return this.blocks.get(label) ?? null;
  }

  /** 设置 block 的完整内容 */
  setBlock(label: string, value: string): void {
    const block = this.blocks.get(label);
    if (!block) throw new Error(`Block '${label}' does not exist`);
    if (block.readOnly) throw new Error(`Block '${label}' is read-only`);
    if (value.length > block.limit) {
      throw new Error(`Content exceeds block limit (${block.limit} chars)`);
    }
    block.value = value;
    block.updatedAt = Date.now();
    block.version += 1;
    block.metadata = {
      ...block.metadata,
      lastEdited: Date.now(),
      lastEditedBy: block.metadata.lastEditedBy ?? 'agent',
    };
    this.save();
  }

  /** 追加内容到 block 末尾 */
  appendBlock(label: string, content: string): void {
    const block = this.blocks.get(label);
    if (!block) throw new Error(`Block '${label}' does not exist`);
    if (block.readOnly) throw new Error(`Block '${label}' is read-only`);
    const newValue = block.value + (block.value ? '\n' : '') + content;
    if (newValue.length > block.limit) {
      throw new Error(`Content exceeds block limit (${block.limit} chars)`);
    }
    block.value = newValue;
    block.updatedAt = Date.now();
    block.version += 1;
    block.metadata = {
      ...block.metadata,
      lastEdited: Date.now(),
      lastEditedBy: block.metadata.lastEditedBy ?? 'agent',
    };
    this.save();
  }

  /** 精确替换 block 中的内容 */
  replaceBlock(label: string, oldContent: string, newContent: string): boolean {
    const block = this.blocks.get(label);
    if (!block) throw new Error(`Block '${label}' does not exist`);
    if (block.readOnly) throw new Error(`Block '${label}' is read-only`);
    if (!block.value.includes(oldContent)) return false;
    const newValue = block.value.replace(oldContent, newContent);
    if (newValue.length > block.limit) {
      throw new Error(`Content exceeds block limit (${block.limit} chars)`);
    }
    block.value = newValue;
    block.updatedAt = Date.now();
    block.version += 1;
    block.metadata = {
      ...block.metadata,
      lastEdited: Date.now(),
      lastEditedBy: block.metadata.lastEditedBy ?? 'agent',
    };
    this.save();
    return true;
  }

  /** 创建新 block */
  createBlock(def: BlockDefinition, value = ''): Block {
    if (this.blocks.has(def.label)) {
      throw new Error(`Block '${def.label}' already exists`);
    }
    const block = createBlock(def, value);
    const err = validateBlock(block);
    if (err) throw new Error(err);
    this.blocks.set(block.label, block);
    this.save();
    return block;
  }

  /** 删除 block */
  deleteBlock(label: string): void {
    const block = this.blocks.get(label);
    if (!block) throw new Error(`Block '${label}' does not exist`);
    if (block.readOnly) throw new Error(`Block '${label}' is read-only`);
    this.blocks.delete(label);
    this.save();
  }

  listBlocks(): Block[] {
    return Array.from(this.blocks.values());
  }

  // ==========================================================================
  // Compile / Render
  // ==========================================================================

  compile(options?: CompileOptions): string {
    const { format = 'markdown', includeHidden = false, labels } = options ?? {};
    if (format === 'markdown') {
      return this.compileToMarkdown(labels, includeHidden);
    }
    return this.compileToXml(labels, includeHidden);
  }

  private compileToMarkdown(
    includeLabels?: string[],
    includeHidden = false,
  ): string {
    const lines: string[] = ['# Memory\n'];
    for (const block of this.blocks.values()) {
      if (includeLabels && !includeLabels.includes(block.label)) continue;
      if ((block.metadata as any).hidden && !includeHidden) continue;

      lines.push(`## ${block.label}`);
      lines.push(`{description: ${block.description}}`);
      lines.push(`{limit: ${block.limit}}`);
      lines.push(`{readOnly: ${block.readOnly}}`);
      if (block.tags.length > 0) {
        lines.push(`{tags: ${block.tags.join(', ')}}`);
      }
      lines.push('');
      if (block.value) {
        lines.push(block.value);
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  private compileToXml(
    includeLabels?: string[],
    includeHidden = false,
  ): string {
    const s: string[] = [];
    s.push('<memory_blocks>');
    s.push('The following memory blocks are currently engaged in your core memory unit:\n');

    for (const block of this.blocks.values()) {
      if (includeLabels && !includeLabels.includes(block.label)) continue;
      if ((block.metadata as any).hidden && !includeHidden) continue;

      s.push(`<${block.label}>`);
      s.push(`<description>${block.description}</description>`);
      s.push('<metadata>');
      s.push(`- chars_current=${block.value.length}`);
      s.push(`- chars_limit=${block.limit}`);
      if (block.readOnly) s.push('- read_only=true');
      s.push('</metadata>');
      s.push(`<value>${block.value}</value>`);
      s.push(`</${block.label}>`);
      s.push('');
    }

    s.push('</memory_blocks>');
    return s.join('\n');
  }

  // ==========================================================================
  // Persistence
  // ==========================================================================

  save(): void {
    this.saveMemoryMd();
    this.saveBlocksSnapshot();
  }

  private saveMemoryMd(): void {
    const content = this.compileToMarkdown();
    const filePath = path.join(this.agentDir, 'Memory.md');
    fs.mkdirSync(this.agentDir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  private saveBlocksSnapshot(): void {
    const filePath = path.join(this.agentDir, 'blocks.json');
    fs.mkdirSync(this.agentDir, { recursive: true });
    const existing = this.loadBlocksSnapshot();
    const snapshots: BlocksVersionSnapshot[] = existing ?? [];

    const snapshot: BlocksVersionSnapshot = {
      version: this.getNextVersion(snapshots),
      timestamp: Date.now(),
      blocks: Array.from(this.blocks.values()).map(serializeBlock),
    };

    // Keep last 10 versions
    snapshots.push(snapshot);
    while (snapshots.length > 10) {
      snapshots.shift();
    }

    fs.writeFileSync(filePath, JSON.stringify(snapshots, null, 2), 'utf-8');
  }

  private loadBlocksSnapshot(): BlocksVersionSnapshot[] | null {
    const filePath = path.join(this.agentDir, 'blocks.json');
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private getNextVersion(snapshots: BlocksVersionSnapshot[]): number {
    if (snapshots.length === 0) return 1;
    return (snapshots[snapshots.length - 1]?.version ?? 0) + 1;
  }

  private loadFromDisk(): void {
    // 尝试从 Memory.md 解析 blocks
    const memoryMdPath = path.join(this.agentDir, 'Memory.md');
    if (fs.existsSync(memoryMdPath)) {
      const content = fs.readFileSync(memoryMdPath, 'utf-8');
      this.parseMemoryMd(content);
    }
  }

  /** 解析 Memory.md 格式的文本为 Block */
  private parseMemoryMd(content: string): void {
    const lines = content.split('\n');
    let currentLabel: string | null = null;
    let currentDesc = '';
    let currentLimit = 2000;
    let currentReadOnly = false;
    let currentTags: string[] = [];
    const valueLines: string[] = [];

    const flushBlock = () => {
      if (currentLabel) {
        const def: BlockDefinition = {
          label: currentLabel,
          description: currentDesc || currentLabel,
          limit: currentLimit,
          readOnly: currentReadOnly,
          tags: currentTags,
        };
        const block = createBlock(def, valueLines.join('\n').trim());
        // 从现有 blocks.json 恢复版本信息（如果有）
        this.blocks.set(block.label, block);
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();

      // ## label
      const headingMatch = line.match(/^## (.+)$/);
      if (headingMatch?.[1]) {
        flushBlock();
        currentLabel = headingMatch[1].trim();
        currentDesc = '';
        currentLimit = 2000;
        currentReadOnly = false;
        currentTags = [];
        valueLines.length = 0;
        continue;
      }

      // {key: value}
      if (line.startsWith('{') && line.endsWith('}')) {
        const inner = line.slice(1, -1);
        const colonIdx = inner.indexOf(':');
        if (colonIdx > 0) {
          const key = inner.substring(0, colonIdx).trim();
          const val = inner.substring(colonIdx + 1).trim();
          if (key === 'description') currentDesc = val;
          else if (key === 'limit') currentLimit = parseInt(val, 10) || 2000;
          else if (key === 'readOnly') currentReadOnly = val === 'true';
          else if (key === 'tags') currentTags = val.split(',').map((t) => t.trim()).filter(Boolean);
        }
        continue;
      }

      // Skip header line
      if (line === '# Memory' || line === '') {
        if (line === '' && currentLabel && valueLines.length === 0 && !currentDesc) continue;
        // Skip blank separator lines between header metadata and value
        if (line === '' && currentLabel && valueLines.length === 0 && !currentDesc) continue;
      }

      if (currentLabel) {
        valueLines.push(line);
      }
    }
    flushBlock();
  }

  private initializeDefaults(definitions?: BlockDefinition[]): void {
    const defs = definitions ?? DEFAULT_BLOCKS;
    for (const def of defs) {
      if (!this.blocks.has(def.label)) {
        const block = createBlock(def);
        this.blocks.set(block.label, block);
      }
    }
    this.save();
  }
}
