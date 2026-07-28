import path from 'node:path';
import { constants, promises as fs } from 'node:fs';

type PathImplementation = Pick<typeof path, 'isAbsolute' | 'join' | 'normalize' | 'parse' | 'sep'>;

interface ResolveWorkspaceBasePathOptions {
  dataRoot: string;
  monorepoRoot: string;
  pathImplementation?: PathImplementation;
}

interface IsPathWithinOptions {
  pathImplementation?: PathImplementation;
  caseInsensitive?: boolean;
}

const WINDOWS_RESERVED_FILE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function splitPortablePath(value: string): string[] {
  return value.replace(/\\/g, '/').split('/').filter(Boolean);
}

function trimTrailingSeparators(value: string, pathImplementation: PathImplementation): string {
  const normalized = pathImplementation.normalize(value);
  const root = pathImplementation.normalize(pathImplementation.parse(value).root);
  let result = normalized;
  while (result.length > root.length && result.endsWith(pathImplementation.sep)) {
    result = result.slice(0, -pathImplementation.sep.length);
  }
  return result;
}

export function resolveWorkspaceBasePath(
  basePath: string,
  options: ResolveWorkspaceBasePathOptions,
): string {
  const pathImplementation = options.pathImplementation ?? path;
  if (pathImplementation.isAbsolute(basePath)) {
    return pathImplementation.normalize(basePath);
  }

  const portablePath = basePath.replace(/\\/g, '/');
  if (portablePath === 'data' || portablePath.startsWith('data/')) {
    const relativePart = portablePath === 'data' ? '' : portablePath.slice('data/'.length);
    return pathImplementation.normalize(
      pathImplementation.join(options.dataRoot, ...splitPortablePath(relativePart)),
    );
  }

  return pathImplementation.normalize(
    pathImplementation.join(options.monorepoRoot, ...splitPortablePath(portablePath)),
  );
}

export function isPathWithin(
  targetPath: string,
  basePath: string,
  options: IsPathWithinOptions = {},
): boolean {
  const pathImplementation = options.pathImplementation ?? path;
  const caseInsensitive = options.caseInsensitive ?? false;
  const normalizeForComparison = (value: string): string => {
    const normalized = trimTrailingSeparators(value, pathImplementation);
    return caseInsensitive ? normalized.toLowerCase() : normalized;
  };

  const target = normalizeForComparison(targetPath);
  const base = normalizeForComparison(basePath);
  return target === base || target.startsWith(base + pathImplementation.sep);
}

export function assertSafeWorkspaceFileName(fileName: string): void {
  const invalid =
    !fileName ||
    fileName === '.' ||
    fileName === '..' ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes(':') ||
    fileName.includes('\0') ||
    fileName.endsWith('.') ||
    fileName.endsWith(' ') ||
    WINDOWS_RESERVED_FILE_NAME.test(fileName);

  if (invalid) {
    throw Object.assign(new Error(`Unsafe file name: ${fileName || '(empty)'}`), {
      code: 'INVALID_FILE_NAME',
    });
  }
}

export async function assertRealPathWithin(
  targetPath: string,
  allowedBasePaths: string[],
): Promise<string> {
  const realTarget = await fs.realpath(targetPath);
  for (const allowedBasePath of allowedBasePaths) {
    try {
      const realBase = await fs.realpath(allowedBasePath);
      if (isPathWithin(realTarget, realBase)) {
        return realTarget;
      }
    } catch {
      // An unavailable allowed base cannot authorize a target.
    }
  }

  throw Object.assign(new Error('Forbidden real path'), { code: 'FORBIDDEN' });
}

export async function assertWorkspacePathCanBeCreated(
  targetPath: string,
  allowedBasePaths: string[],
): Promise<void> {
  let existingAncestor = path.resolve(targetPath);
  while (true) {
    try {
      await assertRealPathWithin(existingAncestor, allowedBasePaths);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw error;
      }
      const parent = path.dirname(existingAncestor);
      if (parent === existingAncestor) {
        throw Object.assign(new Error('No authorized workspace ancestor exists'), {
          code: 'FORBIDDEN',
        });
      }
      existingAncestor = parent;
    }
  }
}

export async function writeWorkspaceUploadFile(
  directory: string,
  requestedFileName: string,
  content: Uint8Array,
): Promise<{ fileName: string; fullPath: string }> {
  assertSafeWorkspaceFileName(requestedFileName);
  const parsed = path.parse(requestedFileName);

  for (let suffix = 0; suffix < 10_000; suffix += 1) {
    const fileName =
      suffix === 0
        ? requestedFileName
        : `${parsed.name} (${suffix})${parsed.ext}`;
    const fullPath = path.join(directory, fileName);
    let handle;
    try {
      handle = await fs.open(
        fullPath,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600,
      );
      await handle.writeFile(content);
      return { fileName, fullPath };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        continue;
      }
      throw error;
    } finally {
      await handle?.close();
    }
  }

  throw Object.assign(new Error(`Unable to allocate upload file name for ${requestedFileName}`), {
    code: 'FILE_EXISTS',
  });
}
