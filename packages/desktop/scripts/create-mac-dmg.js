const { execFileSync } = require('node:child_process');
const { existsSync, rmSync } = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const desktopPackage = require('../package.json');
const version = desktopPackage.version;
const releaseDir = path.join(repoRoot, 'release');

for (const arch of ['arm64', 'x64']) {
  const appDir = arch === 'x64' ? 'mac' : `mac-${arch}`;
  const appPath = path.join(releaseDir, appDir, 'OriginOS CE.app');
  const dmgPath = path.join(releaseDir, `OriginOS CE-${version}-${arch}.dmg`);

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
}
