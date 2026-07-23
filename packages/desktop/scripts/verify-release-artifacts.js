#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const releaseDir = process.env.RELEASE_DIR
  ? path.resolve(process.env.RELEASE_DIR)
  : path.join(repoRoot, 'release');
const desktopPackage = require('../package.json');
const version = desktopPackage.version;
const minReleasePackageBytes = 1024 * 1024;

function fail(message) {
  console.error(`[verify-release-artifacts] ${message}`);
  process.exitCode = 1;
}

function requirePackage(fileName) {
  const filePath = path.join(releaseDir, fileName);
  if (!fs.existsSync(filePath)) {
    fail(`missing required release package: ${path.relative(repoRoot, filePath)}`);
    return;
  }

  const size = fs.statSync(filePath).size;
  if (size < minReleasePackageBytes) {
    fail(`release package is too small: ${path.relative(repoRoot, filePath)} size=${size}`);
    return;
  }

  console.log(`[verify-release-artifacts] ok ${fileName} size=${size}`);
}

function main() {
  requirePackage(`OriginOS CE-${version}-x64.exe`);
  requirePackage(`OriginOS CE-${version}-x64.zip`);
  requirePackage(`OriginOS CE-${version}-arm64.dmg`);
  requirePackage(`OriginOS CE-${version}-x64.dmg`);
}

main();

if (process.exitCode) {
  process.exit();
}

console.log('[verify-release-artifacts] verified complete desktop release artifacts');
