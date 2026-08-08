import { tsSymbolExtractor, tsImportExtractor } from './tsExtractor';
import { heuristicSymbolExtractor, heuristicImportExtractor } from './heuristicExtractor';
import type { ExtractedImport, ExtractedSymbol } from './types';

const TS_LANGUAGES = new Set(['typescript', 'javascript']);

export function extractSymbols(
  content: string,
  filePath: string,
  language: string | null,
): ExtractedSymbol[] {
  if (!language) return [];
  try {
    if (TS_LANGUAGES.has(language)) {
      return tsSymbolExtractor.extract(content, filePath);
    }
    return heuristicSymbolExtractor(language).extract(content);
  } catch {
    // A malformed file shouldn't fail the whole indexing run — just skip symbols for it.
    return [];
  }
}

export function extractImports(content: string, language: string | null): ExtractedImport[] {
  if (!language) return [];
  try {
    if (TS_LANGUAGES.has(language)) {
      return tsImportExtractor.extract(content);
    }
    return heuristicImportExtractor(language).extract(content);
  } catch {
    return [];
  }
}
