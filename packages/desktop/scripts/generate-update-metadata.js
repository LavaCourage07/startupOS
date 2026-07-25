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
const MIN_RELEASE_PACKAGE_BYTES = 1024 * 1024;

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing release artifact: ${filePath}`);
  }
}

function hasReleasePackage(fileName) {
  const filePath = path.join(releaseDir, fileName);
  if (!fs.existsSync(filePath)) {
    return false;
  }

  return fs.statSync(filePath).size >= MIN_RELEASE_PACKAGE_BYTES;
}

function sha512Base64(filePath) {
  const hash = crypto.createHash('sha512');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('base64');
}

function writeMetadata(platform, fileNames) {
  const releaseDate = new Date().toISOString();
  const entries = fileNames.map((fileName) => {
    const filePath = path.join(releaseDir, fileName);
    assertFile(filePath);
    return {
      fileName,
      size: fs.statSync(filePath).size,
      sha512: sha512Base64(filePath),
    };
  });

  const primary = entries[0];
  const lines = [
    `version: ${version}`,
    'files:',
    ...entries.flatMap((entry) => [
      `  - url: ${entry.fileName}`,
      `    sha512: ${entry.sha512}`,
      `    size: ${entry.size}`,
    ]),
    `path: ${primary.fileName}`,
    `sha512: ${primary.sha512}`,
    `releaseDate: '${releaseDate}'`,
    '',
  ];

  const latestName = `latest-${platform}.yml`;
  const stableName = `stable-${platform}.yml`;
  const latestPath = path.join(releaseDir, latestName);
  fs.writeFileSync(latestPath, lines.join('\n'), 'utf8');
  fs.copyFileSync(latestPath, path.join(releaseDir, stableName));

  if (platform === 'win') {
    fs.copyFileSync(latestPath, path.join(releaseDir, 'latest.yml'));
    fs.copyFileSync(latestPath, path.join(releaseDir, 'stable.yml'));
  }

  console.log(`[generate-update-metadata] wrote ${latestName} -> ${primary.fileName}`);
}

function main() {
  const hasWinExe = hasReleasePackage(`OriginOS CE-${version}-x64.exe`);
  const hasWinZip = hasReleasePackage(`OriginOS CE-${version}-x64.zip`);
  if (hasWinExe || hasWinZip) {
    writeMetadata('win', [
      hasWinExe ? `OriginOS CE-${version}-x64.exe` : `OriginOS CE-${version}-x64.zip`,
    ]);
  }

  const hasMacArm64Zip = hasReleasePackage(`OriginOS CE-${version}-arm64.zip`);
  const hasMacX64Zip = hasReleasePackage(`OriginOS CE-${version}-x64.zip`);
  const hasMacArm64Dmg = hasReleasePackage(`OriginOS CE-${version}-arm64.dmg`);
  const hasMacX64Dmg = hasReleasePackage(`OriginOS CE-${version}-x64.dmg`);
  if (hasMacArm64Zip && hasMacX64Zip) {
    writeMetadata('mac', [
      `OriginOS CE-${version}-x64.zip`,
      `OriginOS CE-${version}-arm64.zip`,
    ]);
  } else if (hasMacArm64Dmg && hasMacX64Dmg) {
    writeMetadata('mac', [
      `OriginOS CE-${version}-x64.dmg`,
      `OriginOS CE-${version}-arm64.dmg`,
    ]);
  }
}

main();
