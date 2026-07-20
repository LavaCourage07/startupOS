#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { buildReleaseNotes } = require('./release-notes');

const repoRoot = path.resolve(__dirname, '../../..');
const desktopRoot = path.resolve(__dirname, '..');
const desktopPackage = require('../package.json');
const version = desktopPackage.version;

function loadEnvFiles() {
  const envFiles = [
    path.join(desktopRoot, '.env.local'),
    path.join(desktopRoot, '.env'),
    path.join(repoRoot, '.env.local'),
    path.join(repoRoot, '.env'),
  ];

  for (const filePath of envFiles) {
    if (!fs.existsSync(filePath)) continue;
    const parsed = dotenv.parse(fs.readFileSync(filePath));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

loadEnvFiles();

const baseUrl = process.env.ORIGINOS_UPDATE_BASE_URL || 'https://cdn.artseeu.cn/originos-ce/updates/stable/';
const cdnBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
const releaseNotes = buildReleaseNotes(version);

const releaseData = {
  version: version,
  win_x64_url: new URL(`OriginOS CE-${version}-x64.exe`, cdnBase).toString(),
  mac_arm64_url: new URL(`OriginOS CE-${version}-arm64.dmg`, cdnBase).toString(),
  mac_x64_url: new URL(`OriginOS CE-${version}-x64.dmg`, cdnBase).toString(),
  release_summary: releaseNotes.summary,
  release_notes: releaseNotes.markdown,
  changelog: releaseNotes,
};

console.log('Release data:', JSON.stringify(releaseData, null, 2));
console.log(`Changelog items: ${releaseNotes.items.length}`);

const releaseApiUrl = process.env.ORIGINOS_RELEASE_API_URL;
const releaseApiKey = process.env.ORIGINOS_RELEASE_API_KEY;

if (!releaseApiUrl) {
  console.error('Error: ORIGINOS_RELEASE_API_URL not set');
  process.exit(1);
}

if (!releaseApiKey) {
  console.error('Error: ORIGINOS_RELEASE_API_KEY not set');
  process.exit(1);
}

console.log(`\nNotifying release service: ${releaseApiUrl}`);

fetch(releaseApiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': releaseApiKey,
  },
  body: JSON.stringify(releaseData),
})
  .then(async (response) => {
    const text = await response.text();
    console.log(`Response status: ${response.status}`);

    if (response.ok) {
      console.log('✅ Release service notified successfully');
      try {
        console.log('Response:', JSON.parse(text));
      } catch {
        console.log('Response:', text);
      }
    } else {
      console.error('❌ Failed to notify release service');
      console.error('Response:', text.substring(0, 500));
    }
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
  });
