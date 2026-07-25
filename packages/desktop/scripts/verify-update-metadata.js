#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const repoRoot = path.resolve(__dirname, '../../..');
const releaseDir = process.env.RELEASE_DIR
  ? path.resolve(process.env.RELEASE_DIR)
  : path.join(repoRoot, 'release');
const desktopPackage = require('../package.json');
const version = desktopPackage.version;

function fail(message) {
  console.error(`[verify-update-metadata] ${message}`);
  process.exitCode = 1;
}

function sha512Base64(filePath) {
  const hash = crypto.createHash('sha512');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('base64');
}

function parseSimpleUpdateYml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = {
    files: [],
  };
  let currentFile = null;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'files:') {
      continue;
    }
    if (trimmed.startsWith('- url: ')) {
      currentFile = { url: trimmed.slice('- url: '.length) };
      data.files.push(currentFile);
      continue;
    }
    if (trimmed.startsWith('sha512: ')) {
      const value = trimmed.slice('sha512: '.length);
      if (currentFile && line.startsWith('    ')) {
        currentFile.sha512 = value;
      } else {
        data.sha512 = value;
      }
      continue;
    }
    if (trimmed.startsWith('size: ') && currentFile) {
      currentFile.size = Number.parseInt(trimmed.slice('size: '.length), 10);
      continue;
    }
    if (trimmed.startsWith('version: ')) {
      data.version = trimmed.slice('version: '.length);
      continue;
    }
    if (trimmed.startsWith('path: ')) {
      data.path = trimmed.slice('path: '.length);
      continue;
    }
  }

  return data;
}

function verifyMetadataFile(fileName, expectedPrimaryFileName) {
  const metadataPath = path.join(releaseDir, fileName);
  if (!fs.existsSync(metadataPath)) {
    fail(`missing metadata: ${path.relative(repoRoot, metadataPath)}`);
    return;
  }

  const metadata = parseSimpleUpdateYml(metadataPath);
  const primaryPath = path.join(releaseDir, expectedPrimaryFileName);
  if (!fs.existsSync(primaryPath)) {
    fail(`missing primary package for ${fileName}: ${path.relative(repoRoot, primaryPath)}`);
    return;
  }

  const expectedSize = fs.statSync(primaryPath).size;
  const expectedSha512 = sha512Base64(primaryPath);

  if (metadata.version !== version) {
    fail(`${fileName} version mismatch: expected=${version} actual=${metadata.version}`);
  }
  if (metadata.path !== expectedPrimaryFileName) {
    fail(`${fileName} path mismatch: expected=${expectedPrimaryFileName} actual=${metadata.path}`);
  }
  if (metadata.sha512 !== expectedSha512) {
    fail(`${fileName} top-level sha512 mismatch for ${expectedPrimaryFileName}`);
  }

  const fileEntry = metadata.files.find((entry) => entry.url === expectedPrimaryFileName);
  if (!fileEntry) {
    fail(`${fileName} missing files entry for ${expectedPrimaryFileName}`);
    return;
  }
  if (fileEntry.sha512 !== expectedSha512) {
    fail(`${fileName} files entry sha512 mismatch for ${expectedPrimaryFileName}`);
  }
  if (fileEntry.size !== expectedSize) {
    fail(`${fileName} files entry size mismatch for ${expectedPrimaryFileName}: expected=${expectedSize} actual=${fileEntry.size}`);
  }

  console.log(`[verify-update-metadata] ok ${fileName} -> ${expectedPrimaryFileName}`);
}

function main() {
  const windowsExe = `OriginOS CE-${version}-x64.exe`;
  if (fs.existsSync(path.join(releaseDir, windowsExe))) {
    verifyMetadataFile('latest-win.yml', windowsExe);
    verifyMetadataFile('stable-win.yml', windowsExe);
    verifyMetadataFile('latest.yml', windowsExe);
    verifyMetadataFile('stable.yml', windowsExe);
  }

  const macX64Zip = `OriginOS CE-${version}-x64.zip`;
  const macArm64Zip = `OriginOS CE-${version}-arm64.zip`;
  const macX64Dmg = `OriginOS CE-${version}-x64.dmg`;
  const macArm64Dmg = `OriginOS CE-${version}-arm64.dmg`;
  const hasMacZip =
    fs.existsSync(path.join(releaseDir, macX64Zip)) &&
    fs.existsSync(path.join(releaseDir, macArm64Zip));
  const hasMacDmg =
    fs.existsSync(path.join(releaseDir, macX64Dmg)) &&
    fs.existsSync(path.join(releaseDir, macArm64Dmg));
  if (hasMacZip || hasMacDmg) {
    const macPrimary = hasMacZip ? macX64Zip : macX64Dmg;
    verifyMetadataFile('latest-mac.yml', macPrimary);
    verifyMetadataFile('stable-mac.yml', macPrimary);
  }
}

main();

if (process.exitCode) {
  process.exit();
}

console.log('[verify-update-metadata] verified update metadata');
