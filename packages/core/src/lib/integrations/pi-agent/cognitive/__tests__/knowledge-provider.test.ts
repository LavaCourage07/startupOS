import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { KnowledgeProvider } from '../knowledge-provider';

function tmpDir(): string {
  return path.join(process.cwd(), '.test-tmp', `knowledge-provider-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
}

describe('KnowledgeProvider', () => {
  let agentDir: string;
  let provider: KnowledgeProvider;

  beforeEach(() => {
    agentDir = tmpDir();
    fs.mkdirSync(agentDir, { recursive: true });
    provider = new KnowledgeProvider(agentDir);
  });

  afterEach(() => {
    fs.rmSync(agentDir, { recursive: true, force: true });
  });

  it('ingests knowledge candidates into ontology and snapshot', async () => {
    await provider.ingestCandidates([
      {
        entities: [
          {
            name: 'Tesla Factory',
            type: 'Concept',
            attributes: { source: 'candidate', turn: 1 },
          },
        ],
        facts: ['Turn #1: read_file → Tesla Factory uses a three-shift schedule.'],
      },
    ]);

    const ontology = provider.getOntology();
    expect(ontology.entities.some((entity) => entity.name === 'Tesla Factory')).toBe(true);

    const snapshotPath = path.join(agentDir, 'Knowledge.md');
    expect(fs.existsSync(snapshotPath)).toBe(true);
    const snapshot = fs.readFileSync(snapshotPath, 'utf-8');
    expect(snapshot).toContain('Tesla Factory');
  });
});
