/**
 * Migrate old single-file solutions to new versioned folder structure.
 *
 * Old format: data/projects/{projectId}/solutions/solution-{version}.json
 * New format: data/projects/{projectId}/solutions/{version}/{manifest,agents,skills}.json
 *
 * Usage: npx tsx scripts/migrate-solutions.ts [projectDir]
 *   projectDir defaults to data/projects
 */

import { promises as fs } from 'fs';
import path from 'path';

const PROJECTS_DIR = path.join(process.cwd(), 'data', 'projects');

interface RawSolution {
  status?: string;
  solutionVersion?: string;
  version?: string;
  changesFromPrevious?: string[];
  modeling?: Record<string, unknown>;
  executionMode?: string;
  agents?: Array<Record<string, unknown>>;
  skills?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

async function migrateProject(projectDir: string): Promise<number> {
  const solutionsDir = path.join(projectDir, 'solutions');

  if (!await exists(solutionsDir)) {
    return 0;
  }

  const files = await fs.readdir(solutionsDir);
  const solutionFiles = files.filter(
    (f) => f.startsWith('solution-v') && f.endsWith('.json') && !f.endsWith('-manifest.json') && !f.endsWith('-incomplete.md') && !f.endsWith('-dataflow-validation.md')
  );

  let migrated = 0;

  for (const file of solutionFiles) {
    const filePath = path.join(solutionsDir, file);
    const versionMatch = file.match(/solution-(v[\d.]+)\.json/);
    if (!versionMatch) continue;

    const version = versionMatch[1];
    console.log(`  Migrating ${file} → ${version}/`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const raw: RawSolution = JSON.parse(content);
      const data = raw.data || raw;

      const versionDir = path.join(solutionsDir, version);
      await fs.mkdir(versionDir, { recursive: true });

      // 1. manifest.json
      const manifest = {
        version: '1.0.0',
        status: data.status || 'confirmed',
        solutionVersion: version,
        modeling: data.modeling || {},
        executionMode: data.executionMode || 'Workflow',
        changesFromPrevious: data.changesFromPrevious || [],
        createdAt: data.createdAt ? new Date(data.createdAt as number).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await fs.writeFile(
        path.join(versionDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8'
      );

      // 2. agents.json
      const agents = (data.agents || []).map((a: Record<string, unknown>) => ({
        id: a.id,
        name: a.name,
        type: a.type || 'agent',
        responsibility: a.responsibility,
        businessDomain: a.businessDomain || a.domain,
        derivedFrom: a.derivedFrom || [],
        ontologyOperations: a.ontologyOperations || [],
        skills: extractSkillCodes(a.skills || []),
        collaborations: (a.collaborations || []).map((c: Record<string, unknown>) => ({
          targetAgentId: (c as any).targetAgentId || (c as any).target,
          targetAgentName: (c as any).targetAgentName || (c as any).target || '',
          type: c.type,
          description: c.description,
        })),
      }));
      await fs.writeFile(
        path.join(versionDir, 'agents.json'),
        JSON.stringify({ version: '1.0.0', solutionVersion: version, agents }, null, 2),
        'utf-8'
      );

      // 3. skills.json
      const skills = Array.isArray(data.skills) ? data.skills : [];
      await fs.writeFile(
        path.join(versionDir, 'skills.json'),
        JSON.stringify({ version: '1.0.0', solutionVersion: version, skills }, null, 2),
        'utf-8'
      );

      // 4. Remove old file
      await fs.unlink(filePath);

      migrated++;
      console.log(`    ✓ ${version}: ${agents.length} agents, ${skills.length} skills`);
    } catch (err) {
      console.error(`    ✗ Failed to migrate ${file}:`, err);
    }
  }

  return migrated;
}

/**
 * Extract skill codes from skills array.
 * If items are strings, return as-is. If items are objects, extract .code or .id.
 */
function extractSkillCodes(skills: Array<string | Record<string, unknown>>): string[] {
  return (skills || []).map((s) => {
    if (typeof s === 'string') return s;
    return (s as any).code || (s as any).id || (s as any).name || 'unknown';
  });
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const arg = process.argv[2];
  const baseDir = arg ? path.resolve(arg) : PROJECTS_DIR;

  console.log(`Scanning for solutions in: ${baseDir}`);

  let totalMigrated = 0;

  if (await exists(baseDir) && (await fs.stat(baseDir)).isDirectory()) {
    // Check if it's a project dir (has solutions/) or the projects root
    const stats = await fs.stat(baseDir);
    if (stats.isDirectory()) {
      const entries = await fs.readdir(baseDir);

      // If this dir contains solutions/ directly, it's a project dir
      if (entries.includes('solutions')) {
        totalMigrated = await migrateProject(baseDir);
      } else {
        // Otherwise, scan subdirectories for projects
        for (const entry of entries) {
          const projectPath = path.join(baseDir, entry);
          const st = await fs.stat(projectPath);
          if (st.isDirectory()) {
            const count = await migrateProject(projectPath);
            totalMigrated += count;
          }
        }
      }
    }
  }

  console.log(`\nDone. Migrated ${totalMigrated} solution(s).`);
}

main().catch(console.error);
