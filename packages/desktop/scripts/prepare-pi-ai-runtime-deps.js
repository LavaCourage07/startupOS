#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..', '..');
const outputNodeModules = path.join(desktopDir, '.packaging', 'pi-ai-runtime', 'node_modules');
const rootRequire = createRequire(path.join(repoRoot, 'package.json'));

const roots = [
  '@anthropic-ai/sdk',
  '@aws-sdk/client-bedrock-runtime',
  '@google/genai',
  '@mistralai/mistralai',
  '@opentelemetry/api',
  '@smithy/node-http-handler',
  'http-proxy-agent',
  'https-proxy-agent',
  'openai',
];

function packageNameParts(packageName) {
  return packageName.startsWith('@') ? packageName.split('/').slice(0, 2) : [packageName];
}

function packageOutputDir(packageName) {
  return path.join(outputNodeModules, ...packageNameParts(packageName));
}

function findPackageJson(packageName, fromRequire) {
  const lookupPaths = fromRequire.resolve.paths(packageName) || [];
  for (const lookupPath of lookupPaths) {
    const candidate = path.join(lookupPath, ...packageNameParts(packageName), 'package.json');
    if (fs.existsSync(candidate)) {
      return fs.realpathSync(candidate);
    }
  }

  const entry = fromRequire.resolve(packageName);
  let dir = fs.statSync(entry).isDirectory() ? entry : path.dirname(fs.realpathSync(entry));
  while (dir !== path.dirname(dir)) {
    const packageJson = path.join(dir, 'package.json');
    if (fs.existsSync(packageJson)) {
      const parsed = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
      if (parsed.name === packageName) {
        return packageJson;
      }
    }
    dir = path.dirname(dir);
  }
  throw new Error(`Unable to locate package.json for ${packageName}`);
}

function copyPackage(packageName, packageJson) {
  const sourceDir = path.dirname(packageJson);
  const targetDir = packageOutputDir(packageName);
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    dereference: true,
    force: true,
    filter(source) {
      const relativePath = path.relative(sourceDir, source).replace(/\\/g, '/');
      if (relativePath === 'node_modules' || relativePath.startsWith('node_modules/')) {
        return false;
      }
      return true;
    },
  });
}

function collect(packageName, fromRequire, seen, ordered) {
  if (seen.has(packageName)) {
    return;
  }
  seen.add(packageName);

  const packageJson = findPackageJson(packageName, fromRequire);
  const parsed = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
  ordered.push({ name: packageName, packageJson });

  const packageRequire = createRequire(packageJson);
  const dependencyNames = [
    ...Object.keys(parsed.dependencies || {}),
    ...Object.keys(parsed.optionalDependencies || {}),
  ].sort();

  for (const dependencyName of dependencyNames) {
    collect(dependencyName, packageRequire, seen, ordered);
  }
}

const adapterPackageJson = findPackageJson('@originos/pi-agent-adapter', rootRequire);
const adapterRequire = createRequire(adapterPackageJson);
const piAiPackageJson = findPackageJson('@earendil-works/pi-ai', adapterRequire);
const piAiRequire = createRequire(piAiPackageJson);

fs.rmSync(outputNodeModules, { recursive: true, force: true });
fs.mkdirSync(outputNodeModules, { recursive: true });

const seen = new Set();
const ordered = [];
for (const root of roots) {
  collect(root, piAiRequire, seen, ordered);
}

for (const item of ordered) {
  copyPackage(item.name, item.packageJson);
}

console.log(`[prepare-pi-ai-runtime-deps] copied ${ordered.length} packages -> ${path.relative(repoRoot, outputNodeModules)}`);
