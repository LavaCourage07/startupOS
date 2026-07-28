const path = require('node:path');

const RELEASE_ARTIFACT_PATTERN =
  /^OriginOS CE-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)-(?:arm64|x64)\.(?:dmg|zip|exe)(?:\.blockmap)?$/;

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function comparePrerelease(left, right) {
  if (left.length === 0 || right.length === 0) {
    return left.length === right.length ? 0 : left.length === 0 ? 1 : -1;
  }

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined || rightPart === undefined) {
      return leftPart === rightPart ? 0 : leftPart === undefined ? -1 : 1;
    }
    if (leftPart === rightPart) {
      continue;
    }

    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) {
      return Number(leftPart) - Number(rightPart);
    }
    if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    }
    return leftPart.localeCompare(rightPart);
  }
  return 0;
}

function compareSemver(leftVersion, rightVersion) {
  const left = parseSemver(leftVersion);
  const right = parseSemver(rightVersion);
  if (!left || !right) {
    throw new Error(`Cannot compare invalid versions: ${leftVersion}, ${rightVersion}`);
  }

  for (const field of ['major', 'minor', 'patch']) {
    const difference = left[field] - right[field];
    if (difference !== 0) {
      return difference;
    }
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

function artifactVersion(key, prefix) {
  const normalizedPrefix = String(prefix || '').replace(/\/+$/, '');
  const expectedPrefix = normalizedPrefix ? `${normalizedPrefix}/` : '';
  if (expectedPrefix && !key.startsWith(expectedPrefix)) {
    return null;
  }

  const relativeKey = expectedPrefix ? key.slice(expectedPrefix.length) : key;
  if (!relativeKey || relativeKey !== path.posix.basename(relativeKey)) {
    return null;
  }
  return RELEASE_ARTIFACT_PATTERN.exec(relativeKey)?.[1] ?? null;
}

function planQiniuRetention(items, options) {
  const retainCount = Number(options.retainCount);
  if (!Number.isInteger(retainCount) || retainCount < 1) {
    throw new Error(`QINIU_RETAIN_VERSIONS must be a positive integer, got: ${options.retainCount}`);
  }

  const artifactsByVersion = new Map();
  for (const item of items) {
    if (!item || typeof item.key !== 'string') {
      continue;
    }
    const releaseVersion = artifactVersion(item.key, options.prefix);
    if (!releaseVersion) {
      continue;
    }
    const artifacts = artifactsByVersion.get(releaseVersion) ?? [];
    artifacts.push(item.key);
    artifactsByVersion.set(releaseVersion, artifacts);
  }

  const versions = [...artifactsByVersion.keys()].sort((left, right) =>
    compareSemver(right, left)
  );
  const retainedVersions = versions.slice(0, retainCount);
  const deletedVersions = versions.slice(retainCount);
  const deletedKeys = deletedVersions.flatMap((releaseVersion) =>
    artifactsByVersion.get(releaseVersion) ?? []
  );

  return {
    retainedVersions,
    deletedVersions,
    deletedKeys,
    recognizedArtifactCount: [...artifactsByVersion.values()]
      .reduce((total, artifacts) => total + artifacts.length, 0),
  };
}

module.exports = {
  artifactVersion,
  compareSemver,
  planQiniuRetention,
};
