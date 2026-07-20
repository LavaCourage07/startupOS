#!/usr/bin/env npx tsx
/**
 * IPC Migration Coverage Scanner
 *
 * 扫描 packages/web 和 packages/core 中残留的 fetch('/api/...') 调用，
 * 对比已有的 IPC adapter，输出迁移覆盖率报告。
 *
 * 用法: npx tsx scripts/ipc-migration-scan.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// ── Config ──────────────────────────────────────────────────────

const ROOT = join(__dirname, '..');
const SCAN_DIRS = [
  'packages/web/src',
  'packages/core/src/lib/features',
  'packages/core/src/modules',
];
const ADAPTER_DIR = 'packages/core/src/lib/integrations/electron/services';
const SKIP_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist-electron/,
  /__tests__/,
  /\.test\./,
  /\.spec\./,
  /tsconfig\.tsbuildinfo/,
];

// ── Types ───────────────────────────────────────────────────────

interface FetchCall {
  file: string;
  line: number;
  method: string;
  endpoint: string;
}

interface AdapterFunc {
  name: string;
  file: string;
  ipcChannel?: string;
  hasWebFallback: boolean;
}

interface ScanResult {
  fetchCalls: FetchCall[];
  adapters: AdapterFunc[];
  ipcChannels: string[];
  migrated: FetchCall[];
  unmigrated: FetchCall[];
  adapterOnly: AdapterFunc[];
}

// ── Helpers ─────────────────────────────────────────────────────

function walkDir(dir: string, ext: string[]): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (SKIP_PATTERNS.some(p => p.test(full))) continue;
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(...walkDir(full, ext));
      } else if (ext.some(e => full.endsWith(e))) {
        results.push(full);
      }
    }
  } catch { /* dir not found */ }
  return results;
}

function extractFetchCalls(filePath: string): FetchCall[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const calls: FetchCall[] = [];
  const regex = /fetch\(\s*['"`](\/api\/[^'"`]+)['"`]\s*(?:,\s*\{[^}]*method:\s*['"`](\w+)['"`])?/g;

  for (let i = 0; i < lines.length; i++) {
    let match;
    while ((match = regex.exec(lines[i])) !== null) {
      calls.push({
        file: relative(ROOT, filePath),
        line: i + 1,
        method: (match[2] || 'GET').toUpperCase(),
        endpoint: match[1],
      });
    }
  }
  return calls;
}

function extractAdapters(dir: string): AdapterFunc[] {
  const files = walkDir(join(ROOT, dir), ['.ts']);
  const adapters: AdapterFunc[] = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8');
    // Match exported async functions
    const funcRegex = /export\s+async\s+function\s+(\w+)/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      const name = match[1];
      if (name === 'readJsonResponse') continue;

      // Check if it has isElectron() branch
      const hasElectronBranch = content.includes('isElectron()');
      // Check if it has fetch fallback
      const funcStart = content.indexOf(`export async function ${name}`);
      const nextFunc = content.indexOf('export async function', funcStart + 1);
      const funcBody = content.slice(funcStart, nextFunc > 0 ? nextFunc : undefined);
      const hasWebFallback = funcBody.includes("fetch(");

      // Try to extract IPC channel
      const channelMatch = funcBody.match(/IPC_CHANNELS\.(\w+)/);

      adapters.push({
        name,
        file: relative(ROOT, filePath),
        ipcChannel: channelMatch?.[1],
        hasWebFallback: hasElectronBranch && hasWebFallback,
      });
    }
  }
  return adapters;
}

function extractIpcChannels(dir: string): string[] {
  const protocolFile = join(ROOT, dir, 'ipc-protocol.ts');
  try {
    const content = readFileSync(protocolFile, 'utf-8');
    const channelRegex = /(\w+):\s*['"`]([^'"`]+)['"`]/g;
    const channels: string[] = [];
    let match;
    while ((match = channelRegex.exec(content)) !== null) {
      channels.push(match[1]);
    }
    return channels;
  } catch { return []; }
}

// ── Normalize endpoint for matching ─────────────────────────────

function normalizeEndpoint(ep: string): string {
  return ep
    .replace(/\$\{[^}]+\}/g, ':id')
    .replace(/\/[^/]+\/(encodeURIComponent|encodeURIComponent\([^)]+\))/g, '/:id')
    .replace(/\?.*$/, '');
}

function endpointToAdapterHint(ep: string): string {
  const norm = normalizeEndpoint(ep);
  // Map common endpoint patterns to likely adapter names
  const patterns: [RegExp, string][] = [
    [/\/api\/agent\/sessions\/.*\/messages/, 'sendAgentMessage / sendAgentMessageStream'],
    [/\/api\/agent\/sessions\/destroy/, 'destroyAgentSession'],
    [/\/api\/agent\/sessions/, 'listAgentSessions / createAgentSession / getAgentSession / deleteAgentSession'],
    [/\/api\/agent\/abort/, 'abortAgentSession'],
    [/\/api\/agent\/memory/, 'consolidateMemory'],
    [/\/api\/agent\/content/, 'getAgentContent'],
    [/\/api\/notifications/, 'listNotifications'],
    [/\/api\/sandbox/, 'listSandboxApps'],
    [/\/api\/launch/, 'launchEntry'],
    [/\/api\/interviews/, 'listInterviews / createInterview / completeInterview'],
    [/\/api\/user-agents/, 'listUserAgents / getUserAgent'],
    [/\/api\/user-skills/, 'listUserSkills / getUserSkill'],
    [/\/api\/projects/, 'listProjects / createProject / getProject / updateProject / deleteProject'],
    [/\/api\/ontology\/generate/, 'generateOntology'],
    [/\/api\/ontology\/entities/, 'listOntologyEntities / createOntologyEntity / ...'],
    [/\/api\/ontology-data\/domains/, 'createOntologyDomain / deleteOntologyDomain'],
    [/\/api\/ontology-data\/concepts/, 'listOntologyConcepts / createOntologyConcept'],
    [/\/api\/ontology-data\/instances/, 'listOntologyInstances / createOntologyInstance'],
    [/\/api\/ontology-data\/relations/, 'NO ADAPTER'],
    [/\/api\/ontology-data\/sync/, 'NO ADAPTER'],
    [/\/api\/taste/, 'startTasteDetection / sendTasteDetectionMessage / analyzeTasteDetection / getTasteDraft'],
    [/\/api\/collaboration/, 'getCollaborationTopology / createCollaborationSession / ...'],
    [/\/api\/skills/, 'listSkills / getSkillContent / ...'],
    [/\/api\/debug/, 'NO ADAPTER'],
    [/\/api\/workspace/, 'resolveWorkspace / listWorkspaceFiles / ...'],
  ];

  for (const [pat, hint] of patterns) {
    if (pat.test(norm)) return hint;
  }
  return 'UNKNOWN';
}

// ── Main scan ───────────────────────────────────────────────────

function scan(): ScanResult {
  // 1. Collect all fetch('/api/...) calls
  const fetchCalls: FetchCall[] = [];
  for (const dir of SCAN_DIRS) {
    const files = walkDir(join(ROOT, dir), ['.ts', '.tsx']);
    for (const f of files) {
      fetchCalls.push(...extractFetchCalls(f));
    }
  }

  // 2. Collect all adapters
  const adapters = extractAdapters(ADAPTER_DIR);

  // 3. Collect IPC channels
  const coreChannels = extractIpcChannels('packages/core/src/lib/integrations/electron');
  const desktopChannels = extractIpcChannels('packages/desktop/src/main');

  // 4. Classify fetch calls
  // A call is considered "migrated" if it's inside an adapter file (web fallback)
  const adapterFiles = new Set(adapters.map(a => a.file));
  const migrated: FetchCall[] = [];
  const unmigrated: FetchCall[] = [];

  for (const call of fetchCalls) {
    if (adapterFiles.has(call.file)) {
      migrated.push(call);
    } else {
      unmigrated.push(call);
    }
  }

  // 5. Find adapters without IPC channels (incomplete)
  const adapterOnly = adapters.filter(a => !a.ipcChannel);

  return { fetchCalls, adapters, ipcChannels: coreChannels, migrated, unmigrated, adapterOnly };
}

// ── Report ──────────────────────────────────────────────────────

function printReport(result: ScanResult) {
  const { adapters, migrated, unmigrated, adapterOnly, ipcChannels } = result;

  console.log('\n' + '='.repeat(70));
  console.log('  IPC Migration Coverage Report');
  console.log('='.repeat(70));

  // Summary
  const totalFetch = migrated.length + unmigrated.length;
  const coverage = totalFetch > 0 ? ((migrated.length / totalFetch) * 100).toFixed(1) : '100';
  console.log(`\n📊 Summary`);
  console.log(`   Adapters defined:     ${adapters.length}`);
  console.log(`   IPC channels:         ${ipcChannels.length}`);
  console.log(`   Fetch calls (total):  ${totalFetch}`);
  console.log(`   ├── In adapters:      ${migrated.length} ✅ (web fallback, expected)`);
  console.log(`   └── In components:    ${unmigrated.length} ${unmigrated.length === 0 ? '✅' : '⚠️'} (should be migrated)`);
  console.log(`   Coverage:             ${coverage}%`);

  // Unmigrated calls
  if (unmigrated.length > 0) {
    console.log(`\n⚠️  Unmigrated fetch calls (${unmigrated.length}):`);
    console.log('-'.repeat(70));

    // Group by endpoint
    const byEndpoint = new Map<string, FetchCall[]>();
    for (const call of unmigrated) {
      const key = `${call.method} ${normalizeEndpoint(call.endpoint)}`;
      if (!byEndpoint.has(key)) byEndpoint.set(key, []);
      byEndpoint.get(key)!.push(call);
    }

    for (const [endpoint, calls] of byEndpoint) {
      const hint = endpointToAdapterHint(calls[0].endpoint);
      const status = hint === 'NO ADAPTER' ? '❌ 需新建' : hint === 'UNKNOWN' ? '❓ 待确认' : `→ ${hint}`;
      console.log(`\n  ${endpoint}`);
      console.log(`    ${status}`);
      for (const call of calls) {
        console.log(`    └─ ${call.file}:${call.line}`);
      }
    }
  }

  // Adapters missing IPC channel
  if (adapterOnly.length > 0) {
    console.log(`\n⚠️  Adapters without IPC channel (${adapterOnly.length}):`);
    console.log('-'.repeat(70));
    for (const a of adapterOnly) {
      console.log(`  ${a.name} (${a.file})`);
    }
  }

  // Channel coverage: desktop vs core
  const desktopChannels = extractIpcChannels('packages/desktop/src/main');
  const coreOnly = ipcChannels.filter(c => !desktopChannels.includes(c));
  const desktopOnly = desktopChannels.filter(c => !ipcChannels.includes(c));

  if (coreOnly.length > 0 || desktopOnly.length > 0) {
    console.log(`\n⚠️  Channel mismatch:`);
    if (coreOnly.length > 0) {
      console.log(`  In core but not desktop: ${coreOnly.join(', ')}`);
    }
    if (desktopOnly.length > 0) {
      console.log(`  In desktop but not core: ${desktopOnly.join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`  Done. ${unmigrated.length === 0 ? '✅ All migrated!' : `${unmigrated.length} calls need migration.`}`);
  console.log('='.repeat(70) + '\n');
}

// ── Run ─────────────────────────────────────────────────────────

const result = scan();
printReport(result);
process.exit(result.unmigrated.length > 0 ? 1 : 0);
