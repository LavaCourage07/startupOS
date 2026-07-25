#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const asar = require('@electron/asar');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const releaseDir = path.join(repoRoot, 'release');
const productName = 'OriginOS CE.app';
const bundledSkillEntries = fs
  .readdirSync(path.join(repoRoot, 'templates', 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `templates/skills/${entry.name}/SKILL.md`)
  .filter((entry) => fs.existsSync(path.join(repoRoot, entry)));
const candidateAppPaths = [
  path.join(releaseDir, 'mac-arm64', productName),
  path.join(releaseDir, 'mac', productName),
];

function fail(message) {
  console.error(`[verify-mac-package] ${message}`);
  process.exitCode = 1;
}

function normalizeAsarEntry(entry) {
  const normalized = entry
    .replace(/^(?:pack|unpack)\s*:\s*/, '')
    .replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized.slice(1) : normalized;
}

function verifyApp(appPath) {
  const resourcesDir = path.join(appPath, 'Contents', 'Resources');
  const asarPath = path.join(resourcesDir, 'app.asar');
  if (!fs.existsSync(asarPath)) {
    fail(`app.asar missing: ${path.relative(repoRoot, asarPath)}`);
    return;
  }

  const entries = asar.listPackage(asarPath, { isPack: true }).map(normalizeAsarEntry);
  const requiredEntries = [
    'dist-electron/core/src/lib/integrations/pi-agent/core/agent.js',
    'dist-electron/core/src/lib/features/skills/service.js',
    'dist-electron/core/src/lib/features/services/launcher/skill.js',
    'dist-electron/desktop/src/main/main.js',
    'node_modules/@mariozechner/agent/index.js',
    'node_modules/@mariozechner/pi-agent-core/dist/index.js',
    'node_modules/@mariozechner/pi-agent-core/package.json',
  ];

  for (const entry of requiredEntries) {
    if (!entries.includes(entry)) {
      fail(`${path.relative(repoRoot, asarPath)} missing ${entry}`);
    }
  }
  if (process.exitCode) return;

  const smokeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'originos-mac-asar-smoke-'));
  try {
    asar.extractAll(asarPath, smokeDir);
    const smokeRequire = createRequire(path.join(smokeDir, 'package.json'));
    smokeRequire.resolve('@mariozechner/agent');
    smokeRequire.resolve('@mariozechner/pi-agent-core');
    smokeRequire.resolve(path.join(
      smokeDir,
      'dist-electron/core/src/lib/integrations/pi-agent/core/agent.js',
    ));
    const skillServiceRuntime = fs.readFileSync(
      path.join(smokeDir, 'dist-electron/core/src/lib/features/skills/service.js'),
      'utf8',
    );
    if (!skillServiceRuntime.includes('materializeBundledSkill')) {
      fail('SkillService runtime does not materialize bundled skills before content load');
    }
    if (!skillServiceRuntime.includes('loadSkillFromDirectory')) {
      fail('SkillService runtime does not load existing data skills by directory name');
    }
    for (const entry of bundledSkillEntries) {
      const skillPath = path.join(resourcesDir, entry);
      if (!fs.existsSync(skillPath)) {
        fail(`bundled skill resource missing: ${path.relative(repoRoot, skillPath)}`);
      }
    }
    console.log('[verify-mac-package] app.asar runtime ok', {
      appPath: path.relative(repoRoot, appPath),
    });
  } finally {
    fs.rmSync(smokeDir, { recursive: true, force: true });
  }
}

function main() {
  const appPaths = candidateAppPaths.filter((appPath) => fs.existsSync(appPath));
  if (appPaths.length === 0) {
    throw new Error(`No macOS app bundle found under ${releaseDir}/mac*.`);
  }

  for (const appPath of appPaths) {
    verifyApp(appPath);
  }
}

try {
  main();
} catch (error) {
  console.error('[verify-mac-package] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
