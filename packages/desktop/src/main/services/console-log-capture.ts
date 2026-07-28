import util from 'node:util';

const DEFAULT_MAX_LINE_LENGTH = 8 * 1024;

function truncateLine(line: string, maxLength: number): string {
  if (line.length <= maxLength) {
    return line;
  }
  return `${line.slice(0, maxLength)}...[console line truncated, originalLength=${line.length}]`;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+\S+/giu, 'Bearer [REDACTED]')
    .replace(/\b(?:sk|tp)-[A-Za-z0-9._-]{8,}\b/gu, '[REDACTED]')
    .replace(
      /\b(api[_-]?key|token|secret|password)(\s*[:=]\s*["']?)[^\s,"'}]+/giu,
      '$1$2[REDACTED]',
    );
}

export function serializeConsoleArgs(
  args: unknown[],
  maxLineLength = DEFAULT_MAX_LINE_LENGTH,
): string {
  const line = args.map((arg) => {
    if (typeof arg === 'string') {
      return arg;
    }
    return util.inspect(arg, {
      depth: 4,
      breakLength: 160,
      maxArrayLength: 30,
      maxStringLength: 1000,
      compact: true,
    });
  }).join(' ');
  return truncateLine(redactSensitiveText(line), maxLineLength);
}

export interface CaptureConsoleCallOptions {
  methodName: 'log' | 'info' | 'warn' | 'error';
  args: unknown[];
  llmEnabled: boolean;
  shouldWriteLlm: (line: string) => boolean;
  appendDesktop: (line: string) => void;
  appendLlm: (line: string) => void;
  writeTerminal: (line: string) => void;
  serialize?: (args: unknown[]) => string;
}

export function captureConsoleCall(options: CaptureConsoleCallOptions): void {
  const line = (options.serialize ?? serializeConsoleArgs)(options.args);
  const prefixed = `${options.methodName.toUpperCase()} ${line}`;
  options.appendDesktop(prefixed);
  if (options.llmEnabled && options.shouldWriteLlm(line)) {
    options.appendLlm(prefixed);
  }
  options.writeTerminal(line);
}
