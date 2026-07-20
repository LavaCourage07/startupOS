#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const qiniu = require('qiniu');

const repoRoot = path.resolve(__dirname, '../../..');
const desktopRoot = path.resolve(__dirname, '..');
const desktopPackage = require('../package.json');
const version = desktopPackage.version;
const releaseDir = path.join(repoRoot, 'release');

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

function env(name, fallbackName) {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
}

function requiredEnv(name, fallbackName) {
  const value = env(name, fallbackName);
  if (!value) {
    const suffix = fallbackName ? ` or ${fallbackName}` : '';
    throw new Error(`Missing required env: ${name}${suffix}`);
  }
  return value;
}

function normalizePrefix(prefix) {
  return String(prefix || 'originos-ce/updates/stable')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function remoteKey(prefix, fileName) {
  return prefix ? `${prefix}/${fileName}` : fileName;
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing release artifact: ${filePath}`);
  }
}

function sha512Base64(filePath) {
  const hash = crypto.createHash('sha512');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('base64');
}

function statObject(bucketManager, bucket, key) {
  return new Promise((resolve, reject) => {
    bucketManager.stat(bucket, key, (error, body, info) => {
      if (error) {
        reject(error);
        return;
      }
      if (info.statusCode === 200) {
        resolve({ exists: true, body });
        return;
      }
      if (info.statusCode === 612) {
        resolve({ exists: false });
        return;
      }
      reject(new Error(`Qiniu stat failed: ${key} status=${info.statusCode} body=${JSON.stringify(body)}`));
    });
  });
}

function uploadFile({ mac, config, bucket, key, filePath, overwrite, cacheControl }) {
  return new Promise((resolve, reject) => {
    const putPolicy = new qiniu.rs.PutPolicy({
      scope: `${bucket}:${key}`,
      insertOnly: overwrite ? 0 : 1,
    });
    const uploadToken = putPolicy.uploadToken(mac);
    const formUploader = new qiniu.form_up.FormUploader(config);
    const putExtra = new qiniu.form_up.PutExtra();

    // 设置 cache-control
    if (cacheControl) {
      putExtra.customVars = { 'x-qn-meta-cache-control': cacheControl };
    }

    formUploader.putFile(uploadToken, key, filePath, putExtra, (error, body, info) => {
      if (error) {
        reject(error);
        return;
      }
      if (info.statusCode === 200) {
        resolve(body);
        return;
      }
      reject(new Error(`Qiniu upload failed: ${key} status=${info.statusCode} body=${JSON.stringify(body)}`));
    });
  });
}

function cdnUrl(baseUrl, key, prefix) {
  if (!baseUrl) return null;
  const base = ensureTrailingSlash(baseUrl);
  const relative = prefix && key.startsWith(`${prefix}/`) ? key.slice(prefix.length + 1) : key;
  return new URL(relative.split('/').map(encodeURIComponent).join('/'), base).toString();
}

async function verifyCdnUrl(url) {
  if (!url) return;
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) {
    throw new Error(`CDN verification failed: ${response.status} ${url}`);
  }
}

async function main() {
  const accessKey = requiredEnv('QINIU_ACCESS_KEY', 'QINIU_AK');
  const secretKey = requiredEnv('QINIU_SECRET_KEY', 'QINIU_AS');
  const bucket = requiredEnv('QINIU_BUCKET');
  const prefix = normalizePrefix(process.env.QINIU_PREFIX);
  const region = process.env.QINIU_REGION || 'z0';
  const baseUrl = process.env.ORIGINOS_UPDATE_BASE_URL;
  const skipCdnVerify = process.env.QINIU_SKIP_CDN_VERIFY === '1';

  const config = new qiniu.conf.Config();
  config.regionsProvider = qiniu.httpc.Region.fromRegionId(region);
  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
  const bucketManager = new qiniu.rs.BucketManager(mac, config);

  // Only upload Windows files
  const artifacts = [];

  // Windows exe
  const exe = `OriginOS CE-${version}-x64.exe`;
  const exePath = path.join(releaseDir, exe);
  assertFile(exePath);
  artifacts.push({
    fileName: exe,
    filePath: exePath,
    overwrite: false,
  });

  // Windows zip
  const zip = `OriginOS CE-${version}-x64.zip`;
  const zipPath = path.join(releaseDir, zip);
  assertFile(zipPath);
  artifacts.push({
    fileName: zip,
    filePath: zipPath,
    overwrite: false,
  });

  // Windows blockmaps
  artifacts.push({
    fileName: `${exe}.blockmap`,
    filePath: path.join(releaseDir, `${exe}.blockmap`),
    overwrite: false,
  });
  artifacts.push({
    fileName: `${zip}.blockmap`,
    filePath: path.join(releaseDir, `${zip}.blockmap`),
    overwrite: false,
  });

  console.log('[publish-windows-only] release', {
    version,
    bucket,
    prefix,
    region,
    baseUrl: baseUrl || null,
  });

  // Upload Windows artifacts
  for (const artifact of artifacts) {
    const key = remoteKey(prefix, artifact.fileName);
    if (!artifact.overwrite) {
      const stat = await statObject(bucketManager, bucket, key);
      if (stat.exists) {
        console.log(`[publish-windows-only] skipping existing ${artifact.fileName}`);
        continue;
      }
    }

    console.log(`[publish-windows-only] uploading ${artifact.fileName} -> ${key}`);
    await uploadFile({
      mac,
      config,
      bucket,
      key,
      filePath: artifact.filePath,
      overwrite: artifact.overwrite,
    });

    const url = cdnUrl(baseUrl, key, prefix);
    if (url && !skipCdnVerify) {
      console.log(`[publish-windows-only] verifying ${url}`);
      await verifyCdnUrl(url);
    }
  }

  console.log('[publish-windows-only] published successfully');
}

main().catch((error) => {
  console.error('[publish-windows-only] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
