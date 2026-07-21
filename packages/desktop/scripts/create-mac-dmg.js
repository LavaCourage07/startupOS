const { execFileSync } = require('node:child_process');
const { existsSync, rmSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const repoRoot = path.resolve(__dirname, '../../..');
const desktopPackage = require('../package.json');
const version = desktopPackage.version;
const releaseDir = path.join(repoRoot, 'release');

// Generate blockmap for a file
function generateBlockmap(filePath) {
  const fileBuffer = readFileSync(filePath);
  const blockMap = {
    version: '2',
    blocks: []
  };

  const BLOCK_SIZE = 1024 * 1024; // 1MB blocks
  const numBlocks = Math.ceil(fileBuffer.length / BLOCK_SIZE);

  for (let i = 0; i < numBlocks; i++) {
    const start = i * BLOCK_SIZE;
    const end = Math.min(start + BLOCK_SIZE, fileBuffer.length);
    const block = fileBuffer.slice(start, end);
    const hash = crypto.createHash('sha256').update(block).digest('base64');

    blockMap.blocks.push({
      offset: start,
      size: block.length,
      hash: hash
    });
  }

  return blockMap;
}

for (const arch of ['arm64', 'x64']) {
  const appDir = arch === 'x64' ? 'mac' : `mac-${arch}`;
  const appPath = path.join(releaseDir, appDir, 'OriginOS CE.app');
  const dmgPath = path.join(releaseDir, `OriginOS CE-${version}-${arch}.dmg`);
  const blockmapPath = `${dmgPath}.blockmap`;

  if (!existsSync(appPath)) {
    throw new Error(`Missing packaged app: ${appPath}`);
  }

  if (existsSync(dmgPath)) {
    rmSync(dmgPath, { force: true });
  }

  execFileSync(
    'hdiutil',
    [
      'create',
      '-volname',
      `OriginOS CE ${version}-${arch}`,
      '-srcfolder',
      appPath,
      '-ov',
      '-format',
      'UDZO',
      dmgPath,
    ],
    {
      stdio: 'inherit',
    }
  );

  // Generate blockmap file
  console.log(`Generating blockmap for ${dmgPath}...`);
  const blockmap = generateBlockmap(dmgPath);
  writeFileSync(blockmapPath, JSON.stringify(blockmap, null, 2));
  console.log(`Blockmap written to ${blockmapPath}`);
}
