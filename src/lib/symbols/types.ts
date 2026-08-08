import type { SymbolKind } from '@/types/db';

export interface ExtractedSymbol {
  name: string;
  kind: SymbolKind;
  startLine: number;
  endLine: number;
  signature: string | null;
  exported: boolean;
}

export interface SymbolExtractor {
  extract(content: string, filePath: string): ExtractedSymbol[];
}

export interface ExtractedImport {
  specifier: string;
  importedNames: string[];
}

export interface ImportExtractor {
  extract(content: string): ExtractedImport[];
}
