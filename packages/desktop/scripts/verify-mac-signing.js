#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const releaseDir = path.join(repoRoot, 'release');
const productName = 'OriginOS CE.app';
const candidateAppPaths = [
  path.join(releaseDir, 'mac-arm64', productName),
  path.join(releaseDir, 'mac', productName),
];

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const message = output || `${command} ${args.join(' ')} exited with ${result.status}`;
    throw new Error(message);
  }

  return output;
}

function codesignOutput(appPath) {
  try {
    run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`codesign verification failed for ${appPath}\n${details}`);
  }

  try {
    return run('codesign', ['-dv', '--verbose=4', appPath]);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`codesign detail read failed for ${appPath}\n${details}`);
  }
}

function verifyGatekeeper(appPath) {
  try {
    const output = run('spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath]);
    if (!/source=Notarized Developer ID|source=Developer ID/i.test(output)) {
      throw new Error(output || 'spctl did not report a Developer ID source');
    }
    return output;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`Gatekeeper assessment failed for ${appPath}\n${details}`);
  }
}

function extractField(output, field) {
  const line = output
    .split('\n')
    .find((entry) => entry.startsWith(`${field}=`));
  return line ? line.slice(field.length + 1).trim() : null;
}

function verifyApp(appPath) {
  const output = codesignOutput(appPath);
  const gatekeeperOutput = verifyGatekeeper(appPath);
  const signature = extractField(output, 'Signature');
  const teamIdentifier = extractField(output, 'TeamIdentifier');
  const authorityLines = output
    .split('\n')
    .filter((line) => line.startsWith('Authority='));

  if (signature === 'adhoc') {
    throw new Error(
      `${appPath} is ad-hoc signed. Install a Developer ID Application certificate and rebuild before publishing updates.`
    );
  }

  if (!teamIdentifier || teamIdentifier === 'not set') {
    throw new Error(
      `${appPath} has no TeamIdentifier. Squirrel.Mac will reject this update during code signature validation.`
    );
  }

  const hasDeveloperIdAuthority = authorityLines.some((line) => line.includes('Developer ID Application:'));
  const hasUnavailableAuthority = authorityLines.some((line) => line.includes('(unavailable)'));
  if (authorityLines.length > 0 && !hasDeveloperIdAuthority && !hasUnavailableAuthority) {
    throw new Error(
      `${appPath} is not signed with a Developer ID Application certificate. Found: ${authorityLines.join(', ') || 'none'}`
    );
  }

  console.log('[verify-mac-signing] valid', {
    appPath,
    signature: signature || 'present',
    teamIdentifier,
    authority: hasDeveloperIdAuthority ? 'Developer ID Application' : 'unavailable',
    gatekeeper: gatekeeperOutput.trim().split('\n').find((line) => line.includes('source=')) ?? 'accepted',
  });
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
  console.error('[verify-mac-signing] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
