#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const rootPackagePath = path.join(repoRoot, 'package.json');
const desktopPackagePath = path.join(repoRoot, 'packages/desktop/package.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  if (!match) {
    throw new Error(`Unsupported semver: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function nextVersion(version, releaseType) {
  const parsed = parseSemver(version);
  if (releaseType === 'major') {
    return `${parsed.major + 1}.0.0`;
  }
  if (releaseType === 'minor') {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }
  if (releaseType === 'patch') {
    return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }
  if (/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(releaseType)) {
    return releaseType;
  }
  throw new Error(`Unsupported release type: ${releaseType}. Use patch, minor, major, or explicit x.y.z.`);
}

const releaseType = process.env.RELEASE_VERSION || process.argv[2] || 'patch';
const rootPackage = readJson(rootPackagePath);
const desktopPackage = readJson(desktopPackagePath);
const currentVersion = desktopPackage.version;
const bumpedVersion = nextVersion(currentVersion, releaseType);

desktopPackage.version = bumpedVersion;
rootPackage.version = bumpedVersion;

writeJson(desktopPackagePath, desktopPackage);
writeJson(rootPackagePath, rootPackage);

console.log(`[bump-release-version] ${currentVersion} -> ${bumpedVersion}`);
