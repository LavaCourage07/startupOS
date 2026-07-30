declare module "mammoth" {
  export interface ExtractionResult {
    value: string;
    messages: unknown[];
  }
  export function extractRawText(options: { buffer: Buffer } | { path: string }): Promise<ExtractionResult>;
}

declare module "xlsx" {
  export interface WorkSheet {
    [key: string]: unknown;
  }
  export interface WorkBook {
    Sheets: Record<string, WorkSheet>;
    SheetNames: string[];
  }
  export function read(data: Buffer, options?: { type?: string }): WorkBook;
  export function readFile(path: string, options?: { type?: string }): WorkBook;
  export namespace utils {
    function sheet_to_csv(sheet: WorkSheet): string;
  }
}

declare module "jszip" {
  export default class JSZip {
    static loadAsync(data: Buffer): Promise<JSZip>;
    files: Record<string, { async(type: string): Promise<string> }>;
    folder(name: string): JSZip | null;
    file(name: string): { async(type: string): Promise<Buffer> } | null;
  }
}
