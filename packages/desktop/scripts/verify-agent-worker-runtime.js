#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const workerSourcePath = path.join(repoRoot, 'packages/core/src/modules/collaboration-runtime/sandbox/agent-worker.mts');
const compiledWorkerPath = path.join(repoRoot, 'dist-electron/core/src/modules/collaboration-runtime/sandbox/agent-worker.mjs');
const coreOutDir = path.join(repoRoot, 'dist-electron/core/src');

function fail(message) {
  console.error(`[verify-agent-worker-runtime] ${message}`);
  process.exitCode = 1;
}

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function resolveCompiledModule(modulePath) {
  const candidates = [
    path.join(coreOutDir, `${modulePath}.js`),
    path.join(coreOutDir, modulePath, 'index.js'),
  ];
  return candidates.find(exists) ?? null;
}

if (!exists(workerSourcePath)) {
  fail(`agent worker source entry not found: ${workerSourcePath}`);
  process.exit();
}

if (!exists(coreOutDir)) {
  fail(`core build output not found: ${coreOutDir}. Run desktop build first.`);
  process.exit();
}

if (!exists(compiledWorkerPath)) {
  fail(`compiled agent worker entry not found: ${compiledWorkerPath}. Run desktop build first.`);
  process.exit();
}

const workerSource = fs.readFileSync(workerSourcePath, 'utf8');
const modules = Array.from(new Set(
  Array.from(workerSource.matchAll(/runtimeImport\("([^"]+)"\)/g), (match) => match[1])
)).sort();

if (modules.length === 0) {
  fail(`no runtimeImport() calls found in ${workerSourcePath}`);
}

for (const modulePath of modules) {
  const resolved = resolveCompiledModule(modulePath);
  if (!resolved) {
    fail(`missing compiled worker runtime module: ${modulePath}`);
    continue;
  }
  console.log(`[verify-agent-worker-runtime] OK ${modulePath} -> ${path.relative(repoRoot, resolved)}`);
}

if (/\brequire\(['"]electron['"]\)/.test(workerSource)) {
  fail('agent-worker.mts must not call require("electron") in ESM packaged worker bootstrap');
}

if (process.exitCode) {
  process.exit();
}

console.log(`[verify-agent-worker-runtime] verified ${modules.length} packaged worker runtime modules`);
