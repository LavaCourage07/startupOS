export type SupportedDocumentType = 'docx' | 'txt' | 'md' | 'json' | 'xml' | 'html';

export type SupportedWorkbookType = 'xlsx' | 'csv';

export interface DocumentMetadata {
  fileName: string;
  extension: string;
  sizeBytes: number;
  parser: string;
}

export interface DocumentBlock {
  type: 'heading' | 'paragraph';
  text: string;
  level?: number;
}

export interface DocumentTable {
  index: number;
  rows: string[][];
}

export interface DocumentAst {
  type: SupportedDocumentType;
  title?: string;
  blocks: DocumentBlock[];
  tables: DocumentTable[];
  metadata: DocumentMetadata;
}

export interface WorkbookMetadata {
  fileName: string;
  extension: string;
  sizeBytes: number;
  parser: string;
}

export interface WorkbookCell {
  address: string;
  row: number;
  column: number;
  value: string;
}

export interface WorkbookSheet {
  name: string;
  rowCount: number;
  columnCount: number;
  merges: string[];
  rows: string[][];
  cells: WorkbookCell[];
}

export interface WorkbookAst {
  type: SupportedWorkbookType;
  sheets: WorkbookSheet[];
  metadata: WorkbookMetadata;
}

export interface ReadSliceOptions {
  offset?: number;
  limit?: number;
  maxChars?: number;
}

export interface TextSlice {
  text: string;
  totalChars: number;
  returnedChars: number;
  offset: number;
  limit: number;
  truncated: boolean;
  nextCursor?: string;
}

