#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function fail(message) {
  console.error(`[prepare-apple-api-key] ${message}`);
  process.exit(1);
}

function stripWrappingQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizePem(value) {
  const unquoted = stripWrappingQuotes(value);
  const unescaped = unquoted.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  if (unescaped.includes('-----BEGIN PRIVATE KEY-----')) {
    return unescaped;
  }

  try {
    const decoded = Buffer.from(unquoted.replace(/\s+/g, ''), 'base64').toString('utf8').trim();
    const decodedUnescaped = decoded.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
    if (decodedUnescaped.includes('-----BEGIN PRIVATE KEY-----')) {
      return decodedUnescaped;
    }
  } catch {
    // Fall through to validation error below.
  }

  return unescaped;
}

function validatePrivateKey(pem) {
  try {
    crypto.createPrivateKey(pem);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    fail(
      [
        'APPLE_API_KEY is not a valid App Store Connect .p8 private key.',
        'Store the secret as the full PEM text, escaped PEM text with \\n, or base64 of the PEM.',
        `Validation error: ${details}`,
      ].join(' '),
    );
  }
}

function main() {
  const rawKey = process.env.APPLE_API_KEY;
  const keyId = process.env.APPLE_API_KEY_ID;
  const outputDir = process.env.RUNNER_TEMP || process.env.TMPDIR || process.cwd();

  if (!rawKey) fail('APPLE_API_KEY is required');
  if (!keyId) fail('APPLE_API_KEY_ID is required');

  const pem = normalizePem(rawKey).replace(/\r\n/g, '\n').trimEnd() + '\n';
  validatePrivateKey(pem);

  const outputPath = path.join(outputDir, `AuthKey_${keyId}.p8`);
  fs.writeFileSync(outputPath, pem, { mode: 0o600 });
  fs.chmodSync(outputPath, 0o600);
  console.log(outputPath);
}

main();
