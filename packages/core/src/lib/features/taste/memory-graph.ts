/**
 * Memory Graph - Simplified Graph Database (MVP)
 *
 * Native TypeScript implementation for Phase 1 (Observer Mode).
 * Future migration path to Neo4j/Memgraph for Phase 2+ when complex queries needed.
 */

import { TasteMemory, TasteContext } from './taste-schema';

/**
 * Simplified Graph Database
 *
 * Uses native TypeScript data structures:
 * - Map for nodes (O(1) lookup)
 * - Adjacency list for edges (O(1) neighbor access)
 */
export class MemoryGraph {
  private nodes: Map<string, TasteMemory> = new Map();
  private edges: Map<string, Set<string>> = new Map(); // adjacency list
  private contextIndex: Map<string, Set<string>> = new Map();

  /**
   * Add a node (memory) to the graph
   */
  async addNode(memory: TasteMemory): Promise<void> {
    this.nodes.set(memory.id, memory);

    // Index by context
    const contextKey = this.getContextKey(memory.context);
    if (!this.contextIndex.has(contextKey)) {
      this.contextIndex.set(contextKey, new Set());
    }
    this.contextIndex.get(contextKey)!.add(memory.id);
  }

  /**
   * Add context-based relations
   */
  async addContextRelations(memory: TasteMemory): Promise<void> {
    const similarIds = await this.findSimilarContexts(memory.context, 0.6);

    if (!this.edges.has(memory.id)) {
      this.edges.set(memory.id, new Set());
    }

    for (const similarId of similarIds) {
      if (similarId !== memory.id) {
        this.edges.get(memory.id)!.add(similarId);

        if (!this.edges.has(similarId)) {
          this.edges.set(similarId, new Set());
        }
        this.edges.get(similarId)!.add(memory.id); // undirected
      }
    }
  }

  /**
   * Query memories with filters
   */
  async query(
    context: TasteContext,
    options: {
      minDecayWeight?: number;
      maxAge?: string;
      limit?: number;
    } = {}
  ): Promise<TasteMemory[]> {
    const contextKey = this.getContextKey(context);
    const candidateIds = this.contextIndex.get(contextKey) || new Set();

    let results: TasteMemory[] = [];

    for (const id of candidateIds) {
      const memory = this.nodes.get(id);
      if (!memory) continue;

      if (options.minDecayWeight && memory.decay_weight < options.minDecayWeight) {
        continue;
      }

      if (options.maxAge) {
        const days = this.parseAge(options.maxAge);
        if (this.daysSince(memory.updated_at) > days) {
          continue;
        }
      }

      results.push(memory);
    }

    results.sort((a, b) => b.decay_weight - a.decay_weight);
    return results.slice(0, options.limit);
  }

  /**
   * Query all memories
   */
  async queryAll(options: {
    minDecayWeight?: number;
    maxAge?: string;
  } = {}): Promise<TasteMemory[]> {
    let results = Array.from(this.nodes.values());

    if (options.minDecayWeight) {
      results = results.filter(m => m.decay_weight >= options.minDecayWeight);
    }

    if (options.maxAge) {
      const days = this.parseAge(options.maxAge);
      results = results.filter(m => this.daysSince(m.updated_at) <= days);
    }

    return results;
  }

  /**
   * Find similar memories
   */
  async findSimilar(
    context: TasteContext,
    options: { threshold?: number; limit?: number }
  ): Promise<TasteMemory[]> {
    const contextKey = this.getContextKey(context);
    const candidateIds = this.contextIndex.get(contextKey) || new Set();

    return Array.from(candidateIds)
      .map(id => this.nodes.get(id)!)
      .filter(Boolean)
      .slice(0, options.limit);
  }

  /**
   * Get a specific memory
   */
  async getMemory(id: string): Promise<TasteMemory> {
    const memory = this.nodes.get(id);
    if (!memory) {
      throw new Error(`Memory not found: ${id}`);
    }
    return memory;
  }

  /**
   * Update decay weight
   */
  async updateDecayWeight(id: string, weight: number): Promise<void> {
    const memory = this.nodes.get(id);
    if (!memory) return;

    memory.decay_weight = Math.max(0, Math.min(1, weight));
    memory.updated_at = new Date().toISOString();
  }

  /**
   * Increment reference count
   */
  async incrementReferenceCount(id: string): Promise<void> {
    const memory = this.nodes.get(id);
    if (!memory) return;

    memory.reference_count++;
    memory.updated_at = new Date().toISOString();
  }

  /**
   * Remove a node (for archiving)
   */
  async removeNode(id: string): Promise<void> {
    this.nodes.delete(id);

    const neighbors = this.edges.get(id) || new Set();
    for (const neighborId of neighbors) {
      this.edges.get(neighborId)?.delete(id);
    }
    this.edges.delete(id);

    for (const [key, ids] of this.contextIndex.entries()) {
      ids.delete(id);
      if (ids.size === 0) {
        this.contextIndex.delete(key);
      }
    }
  }

  /**
   * Get node count
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Get edge count
   */
  getEdgeCount(): number {
    let count = 0;
    for (const neighbors of this.edges.values()) {
      count += neighbors.size;
    }
    return count / 2; // undirected, so divide by 2
  }

  /**
   * Traverse the graph from a starting node
   */
  async traverse(fromId: string, depth: number): Promise<TasteMemory[]> {
    const visited = new Set<string>([fromId]);
    const queue: [string, number][] = [[fromId, 0]];
    const results: TasteMemory[] = [];

    while (queue.length > 0) {
      const [nodeId, currentDepth] = queue.shift()!;
      const memory = this.nodes.get(nodeId);

      if (memory) {
        results.push(memory);
      }

      if (currentDepth >= depth) continue;

      const neighbors = this.edges.get(nodeId) || new Set();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push([neighborId, currentDepth + 1]);
        }
      }
    }

    return results;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private getContextKey(context: TasteContext): string {
    const cf = context.context_features;
    return `${cf.domain}:${cf.task_type}:${cf.risk_level}`;
  }

  private async findSimilarContexts(context: TasteContext, threshold: number): Promise<string[]> {
    const targetKey = this.getContextKey(context);
    return Array.from(this.contextIndex.get(targetKey) || new Set());
  }

  private parseAge(age: string): number {
    const match = age.match(/^(\d+)d$/);
    return match ? parseInt(match[1], 10) : 90;
  }

  private daysSince(isoDate: string): number {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get cross-user reference count (for ownership promotion)
   */
  async getCrossUserReferenceCount(memoryId: string): Promise<number> {
    // MVP: Return 0, implement full tracking in Phase 2
    return 0;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.contextIndex.clear();
  }
}
