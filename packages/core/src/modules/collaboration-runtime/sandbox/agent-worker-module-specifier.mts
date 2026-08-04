import process from "node:process";
import { pathToFileURL } from "node:url";

const SUPPORTED_ESM_SCHEME = /^(?:file|data|node|electron):/i;
const WINDOWS_ABSOLUTE_PATH = /^(?:[a-z]:[\\/]|\\\\)/i;

/** Convert a local module path into a specifier accepted by Node's ESM loader. */
export function toEsmModuleSpecifier(
  value: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (SUPPORTED_ESM_SCHEME.test(value)) {
    return value;
  }

  const useWindowsPathSemantics = platform === "win32" || WINDOWS_ABSOLUTE_PATH.test(value);
  return pathToFileURL(value, { windows: useWindowsPathSemantics }).href;
}
