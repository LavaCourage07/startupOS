/**
 * MemoryCore — 三层记忆统一门面。
 *
 * Story M.6: 一个类管理 Core + Archival + Recall 三层记忆。
 */

import { BlockDefinition } from '../core/block';
import { Memory } from '../core/memory';
import { ArchivalMemory as ArchivalMemoryImpl } from '../archival/archival-memory';
import { RecallMemory } from '../recall/recall-memory';
import { CoreMemoryTools } from '../tools/core-memory-tools';
import { ArchivalMemoryTools } from '../tools/archival-memory-tools';

export class MemoryCore {
  readonly agentDir: string;
  readonly memory: Memory;
  readonly archival: ArchivalMemoryImpl;
  readonly recall: RecallMemory;
  readonly coreTools: CoreMemoryTools;
  readonly archivalTools: ArchivalMemoryTools;

  constructor(agentDir: string, sessionId: string = 'default', definitions?: BlockDefinition[]) {
    this.agentDir = agentDir;
    this.memory = new Memory(agentDir, definitions);
    this.archival = new ArchivalMemoryImpl(agentDir);
    this.recall = new RecallMemory(agentDir, sessionId);
    this.coreTools = new CoreMemoryTools(this.memory);
    this.archivalTools = new ArchivalMemoryTools(this.archival);
  }

  async initialize(): Promise<void> {
    // Archival and Recall already load in constructor
  }

  async shutdown(): Promise<void> {
    await Promise.all([
      this.memory.save(),
      this.archival.persist(),
    ]);
  }
}
