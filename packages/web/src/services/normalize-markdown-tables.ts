interface TableRange {
  start: number;
  separator: number;
  end: number;
}

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/;
const SEPARATOR_CELL_PATTERN = /^:?-+:?$/;

function normalizeFullWidthPipes(line: string): string {
  const pipeCount = line.match(/｜/g)?.length ?? 0;
  return pipeCount >= 2 ? line.replace(/｜/g, '|') : line;
}

function normalizePipesOutsideFences(lines: string[]): string[] {
  let fenceMarker: string | null = null;

  return lines.map((line) => {
    const fenceMatch = line.match(FENCE_PATTERN);
    if (fenceMatch?.[1]) {
      const marker = fenceMatch[1][0] ?? '';
      fenceMarker = fenceMarker === marker ? null : marker;
      return line;
    }
    return fenceMarker ? line : normalizeFullWidthPipes(line);
  });
}

function splitTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) {
    return null;
  }

  const withoutEdges = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '');
  const cells = withoutEdges.split(/(?<!\\)\|/).map((cell) => cell.trim());
  return cells.length >= 2 ? cells : null;
}

function parseSeparatorRow(line: string): string[] | null {
  const cells = splitTableRow(line);
  if (!cells || !cells.every((cell) => SEPARATOR_CELL_PATTERN.test(cell))) {
    return null;
  }
  return cells;
}

function normalizeSeparatorCell(cell: string): string {
  const leftAligned = cell.startsWith(':');
  const rightAligned = cell.endsWith(':');
  return `${leftAligned ? ':' : ''}---${rightAligned ? ':' : ''}`;
}

function findTableRanges(lines: string[]): TableRange[] {
  const ranges: TableRange[] = [];
  let fenceMarker: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fenceMatch = line.match(FENCE_PATTERN);
    if (fenceMatch?.[1]) {
      const marker = fenceMatch[1][0] ?? '';
      fenceMarker = fenceMarker === marker ? null : marker;
      continue;
    }
    if (fenceMarker || index === 0) {
      continue;
    }

    const separatorCells = parseSeparatorRow(line);
    const headerCells = splitTableRow(lines[index - 1] ?? '');
    if (!separatorCells || !headerCells || separatorCells.length !== headerCells.length) {
      continue;
    }

    let end = index;
    while (end + 1 < lines.length) {
      const nextLine = lines[end + 1] ?? '';
      if (!nextLine.trim() || FENCE_PATTERN.test(nextLine)) {
        break;
      }
      const rowCells = splitTableRow(nextLine);
      if (!rowCells) {
        break;
      }
      end += 1;
    }

    ranges.push({ start: index - 1, separator: index, end });
    index = end;
  }

  return ranges;
}

/**
 * Repairs common model-generated GFM table mistakes without changing source
 * inside fenced code blocks or guessing tables that have no separator row.
 */
export function normalizeMarkdownTables(markdown: string): string {
  if (!markdown.includes('|') && !markdown.includes('｜')) {
    return markdown;
  }

  const lines = normalizePipesOutsideFences(
    markdown.replace(/\r\n?/g, '\n').split('\n'),
  );
  const ranges = findTableRanges(lines);
  if (ranges.length === 0) {
    return markdown;
  }

  for (const range of ranges) {
    const cells = parseSeparatorRow(lines[range.separator] ?? '');
    if (cells) {
      lines[range.separator] = `| ${cells.map(normalizeSeparatorCell).join(' | ')} |`;
    }
  }

  const output: string[] = [];
  let rangeIndex = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const range = ranges[rangeIndex];
    if (range && index === range.start) {
      if (output.length > 0 && output[output.length - 1]?.trim()) {
        output.push('');
      }
      output.push(...lines.slice(range.start, range.end + 1));
      if (range.end + 1 < lines.length && lines[range.end + 1]?.trim()) {
        output.push('');
      }
      index = range.end;
      rangeIndex += 1;
      continue;
    }
    output.push(lines[index] ?? '');
  }

  return output.join('\n');
}
