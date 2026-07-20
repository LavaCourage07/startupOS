import { promises as fs } from 'fs';
import path from 'path';
import { OfficeZip } from './office-zip';
import type {
  DocumentAst,
  DocumentBlock,
  DocumentTable,
  ReadSliceOptions,
  TextSlice,
  WorkbookAst,
  WorkbookSheet,
} from './types';

const XML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeXmlText(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, entity: string) => XML_ENTITY_MAP[entity] ?? match);
}

function stripXmlTags(input: string): string {
  return decodeXmlText(input.replace(/<[^>]+>/g, '')).trim();
}

function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase().replace(/^\./, '');
}

async function getMetadata(filePath: string, parser: string) {
  const stat = await fs.stat(filePath);
  const extension = path.extname(filePath).toLowerCase();
  return {
    fileName: path.basename(filePath),
    extension,
    sizeBytes: stat.size,
    parser,
  };
}

function sliceText(text: string, options: ReadSliceOptions = {}): TextSlice {
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.max(1, options.limit ?? options.maxChars ?? 12000);
  const sliced = text.slice(offset, offset + limit);
  const nextOffset = offset + sliced.length;
  const truncated = nextOffset < text.length;
  return {
    text: sliced,
    totalChars: text.length,
    returnedChars: sliced.length,
    offset,
    limit,
    truncated,
    ...(truncated ? { nextCursor: String(nextOffset) } : {}),
  };
}

function parseDocxParagraphs(documentXml: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  const paragraphMatches = documentXml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [];

  for (const paragraphXml of paragraphMatches) {
    const textParts = [...paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((match) => decodeXmlText(match[1] ?? ''));
    const text = textParts.join('').trim();
    if (!text) continue;

    const styleMatch = paragraphXml.match(/<w:pStyle[^>]*w:val="([^"]+)"/);
    const style = styleMatch?.[1]?.toLowerCase() ?? '';
    const headingMatch = style.match(/heading(\d+)/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: Number(headingMatch[1]), text });
    } else {
      blocks.push({ type: 'paragraph', text });
    }
  }

  return blocks;
}

function parseDocxTables(documentXml: string): DocumentTable[] {
  const tables: DocumentTable[] = [];
  const tableMatches = documentXml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) ?? [];

  tableMatches.forEach((tableXml, tableIndex) => {
    const rows: string[][] = [];
    const rowMatches = tableXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) ?? [];
    for (const rowXml of rowMatches) {
      const cells: string[] = [];
      const cellMatches = rowXml.match(/<w:tc[\s\S]*?<\/w:tc>/g) ?? [];
      for (const cellXml of cellMatches) {
        const text = [...cellXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
          .map((match) => decodeXmlText(match[1] ?? ''))
          .join('')
          .trim();
        cells.push(text);
      }
      rows.push(cells);
    }
    tables.push({ index: tableIndex, rows });
  });

  return tables;
}

export async function parseDocument(filePath: string): Promise<DocumentAst> {
  const extension = getExtension(filePath);

  if (extension === 'docx') {
    const zip = await OfficeZip.fromFile(filePath);
    const documentXml = zip.readText('word/document.xml');
    if (!documentXml) {
      throw new Error('Invalid docx: word/document.xml not found');
    }
    const blocks = parseDocxParagraphs(documentXml);
    const tables = parseDocxTables(documentXml);
    return {
      type: 'docx',
      title: blocks.find((block) => block.type === 'heading')?.text,
      blocks,
      tables,
      metadata: await getMetadata(filePath, 'office-zip-docx'),
    };
  }

  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const blocks: DocumentBlock[] = lines
    .map((line): DocumentBlock | null => {
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      if (heading) {
        return { type: 'heading', level: (heading[1] ?? '#').length, text: (heading[2] ?? '').trim() };
      }
      const text = line.trim();
      return text ? { type: 'paragraph', text } : null;
    })
    .filter((block): block is DocumentBlock => Boolean(block));

  return {
    type: ['md', 'txt', 'json', 'xml', 'html'].includes(extension) ? extension as DocumentAst['type'] : 'txt',
    title: blocks.find((block) => block.type === 'heading')?.text,
    blocks,
    tables: [],
    metadata: await getMetadata(filePath, 'plain-text'),
  };
}

export function renderDocumentText(ast: DocumentAst): string {
  const parts: string[] = [];
  for (const block of ast.blocks) {
    if (block.type === 'heading') {
      parts.push(`${'#'.repeat(block.level ?? 1)} ${block.text}`);
    } else {
      parts.push(block.text);
    }
  }
  for (const table of ast.tables) {
    parts.push(`\n[Table ${table.index + 1}]`);
    parts.push(table.rows.map((row) => row.join('\t')).join('\n'));
  }
  return parts.join('\n\n').trim();
}

function columnNameToIndex(columnName: string): number {
  let index = 0;
  for (const char of columnName.toUpperCase()) {
    index = index * 26 + char.charCodeAt(0) - 64;
  }
  return index;
}

function cellAddressToPosition(address: string): { row: number; column: number } | null {
  const match = /^([A-Z]+)(\d+)$/i.exec(address);
  if (!match) return null;
  return { column: columnNameToIndex(match[1] ?? ''), row: Number(match[2] ?? '0') };
}

function parseWorkbookRelationships(xml: string): Record<string, string> {
  const relationships: Record<string, string> = {};
  const matches = xml.matchAll(/<Relationship\b([^>]*)\/?>/g);
  for (const match of matches) {
    const attrs = match[1] ?? '';
    const id = attrs.match(/\bId="([^"]+)"/)?.[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) relationships[id] = target;
  }
  return relationships;
}

function parseWorkbookSheets(workbookXml: string, relationships: Record<string, string>): Array<{ name: string; path: string }> {
  const sheets: Array<{ name: string; path: string }> = [];
  const matches = workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g);
  for (const match of matches) {
    const attrs = match[1] ?? '';
    const name = decodeXmlText(attrs.match(/\bname="([^"]+)"/)?.[1] ?? '');
    const relId = attrs.match(/\br:id="([^"]+)"/)?.[1];
    const target = relId ? relationships[relId] : undefined;
    if (!name || !target) continue;
    sheets.push({
      name,
      path: target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\.\//, '')}`,
    });
  }
  return sheets;
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  const itemMatches = xml.match(/<si[\s\S]*?<\/si>/g) ?? [];
  for (const itemXml of itemMatches) {
    const parts = [...itemXml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((match) => decodeXmlText(match[1] ?? ''));
    strings.push(parts.join(''));
  }
  return strings;
}

function parseSheetXml(name: string, xml: string, sharedStrings: string[]): WorkbookSheet {
  const rows: string[][] = [];
  const cells: WorkbookSheet['cells'] = [];
  const merges = [...xml.matchAll(/<mergeCell[^>]*ref="([^"]+)"/g)].map((match) => match[1] ?? '');
  const rowMatches = xml.match(/<row\b[\s\S]*?<\/row>/g) ?? [];

  let maxRow = 0;
  let maxColumn = 0;
  for (const rowXml of rowMatches) {
    const rowNumber = Number(rowXml.match(/\br="(\d+)"/)?.[1] ?? rows.length + 1);
    maxRow = Math.max(maxRow, rowNumber);
    if (!rows[rowNumber - 1]) rows[rowNumber - 1] = [];

    const cellMatches = rowXml.match(/<c\b[\s\S]*?<\/c>/g) ?? [];
    for (const cellXml of cellMatches) {
      const address = cellXml.match(/\br="([^"]+)"/)?.[1] ?? '';
      const position = cellAddressToPosition(address);
      if (!position) continue;
      const type = cellXml.match(/\bt="([^"]+)"/)?.[1];
      const valueRaw = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
      const inlineText = cellXml.match(/<is>([\s\S]*?)<\/is>/)?.[1];
      let value = '';
      if (type === 's') {
        value = sharedStrings[Number(valueRaw)] ?? '';
      } else if (type === 'inlineStr' && inlineText) {
        value = stripXmlTags(inlineText);
      } else {
        value = decodeXmlText(valueRaw);
      }
      const rowIndex = position.row - 1;
      const row = rows[rowIndex] ?? [];
      row[position.column - 1] = value;
      rows[rowIndex] = row;
      maxColumn = Math.max(maxColumn, position.column);
      cells.push({ address, row: position.row, column: position.column, value });
    }
  }

  const normalizedRows = Array.from({ length: maxRow }, (_, rowIndex) => {
    const row = rows[rowIndex] ?? [];
    return Array.from({ length: maxColumn }, (_, columnIndex) => row[columnIndex] ?? '');
  });

  return { name, rowCount: maxRow, columnCount: maxColumn, merges, rows: normalizedRows, cells };
}

function parseCsvContent(content: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  row.push(current);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

export async function parseWorkbook(filePath: string): Promise<WorkbookAst> {
  const extension = getExtension(filePath);

  if (extension === 'csv') {
    const content = await fs.readFile(filePath, 'utf8');
    const rows = parseCsvContent(content);
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const sheet: WorkbookSheet = {
      name: path.basename(filePath, path.extname(filePath)),
      rowCount: rows.length,
      columnCount,
      merges: [],
      rows: rows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? '')),
      cells: [],
    };
    return {
      type: 'csv',
      sheets: [sheet],
      metadata: await getMetadata(filePath, 'csv-native'),
    };
  }

  if (extension !== 'xlsx') {
    throw new Error(`Unsupported workbook extension: .${extension}`);
  }

  const zip = await OfficeZip.fromFile(filePath);
  const workbookXml = zip.readText('xl/workbook.xml');
  const relationshipsXml = zip.readText('xl/_rels/workbook.xml.rels');
  if (!workbookXml || !relationshipsXml) {
    throw new Error('Invalid xlsx: workbook metadata not found');
  }
  const relationships = parseWorkbookRelationships(relationshipsXml);
  const sheetRefs = parseWorkbookSheets(workbookXml, relationships);
  const sharedStrings = parseSharedStrings(zip.readText('xl/sharedStrings.xml'));
  const sheets = sheetRefs.map((sheetRef) => {
    const sheetXml = zip.readText(sheetRef.path);
    if (!sheetXml) {
      return { name: sheetRef.name, rowCount: 0, columnCount: 0, merges: [], rows: [], cells: [] };
    }
    return parseSheetXml(sheetRef.name, sheetXml, sharedStrings);
  });

  return {
    type: 'xlsx',
    sheets,
    metadata: await getMetadata(filePath, 'office-zip-xlsx'),
  };
}

export function sliceDocumentText(ast: DocumentAst, options?: ReadSliceOptions): TextSlice {
  return sliceText(renderDocumentText(ast), options);
}
