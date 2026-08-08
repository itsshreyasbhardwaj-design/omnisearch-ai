import type { ExtractedImport, ExtractedSymbol } from './types';

/**
 * Regex-based extraction for the six languages the TypeScript compiler API
 * can't parse. This is deliberately NOT a full parser: each rule matches a
 * declaration on its own line and reports that line as both start and end
 * (a heuristic extractor can't reliably find a construct's closing
 * brace/dedent — that needs a real parser). It is still genuinely useful
 * for symbol search and dependency edges; it just isn't AST-accurate. See
 * ARCHITECTURE.md.
 */
interface Rule {
  pattern: RegExp;
  kind: ExtractedSymbol['kind'];
  nameGroup: number;
  exported?: (line: string) => boolean;
}

const RULES_BY_LANGUAGE: Record<string, Rule[]> = {
  python: [
    { pattern: /^\s*def\s+(\w+)\s*\(/, kind: 'function', nameGroup: 1 },
    { pattern: /^\s*class\s+(\w+)/, kind: 'class', nameGroup: 1 },
  ],
  go: [
    {
      pattern: /^\s*func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/,
      kind: 'function',
      nameGroup: 1,
      exported: (line) => /func\s+(?:\([^)]*\)\s+)?[A-Z]/.test(line),
    },
    {
      pattern: /^\s*type\s+(\w+)\s+struct\b/,
      kind: 'class',
      nameGroup: 1,
      exported: (line) => /type\s+[A-Z]/.test(line),
    },
    {
      pattern: /^\s*type\s+(\w+)\s+interface\b/,
      kind: 'interface',
      nameGroup: 1,
      exported: (line) => /type\s+[A-Z]/.test(line),
    },
  ],
  rust: [
    {
      pattern: /^\s*(?:pub\s+)?fn\s+(\w+)\s*[(<]/,
      kind: 'function',
      nameGroup: 1,
      exported: (l) => /^\s*pub\s+fn/.test(l),
    },
    {
      pattern: /^\s*(?:pub\s+)?struct\s+(\w+)/,
      kind: 'class',
      nameGroup: 1,
      exported: (l) => /^\s*pub\s+struct/.test(l),
    },
    {
      pattern: /^\s*(?:pub\s+)?trait\s+(\w+)/,
      kind: 'interface',
      nameGroup: 1,
      exported: (l) => /^\s*pub\s+trait/.test(l),
    },
    {
      pattern: /^\s*(?:pub\s+)?enum\s+(\w+)/,
      kind: 'type',
      nameGroup: 1,
      exported: (l) => /^\s*pub\s+enum/.test(l),
    },
  ],
  java: [
    {
      pattern: /^\s*(?:public|private|protected)?\s*(?:static\s+)?class\s+(\w+)/,
      kind: 'class',
      nameGroup: 1,
      exported: (l) => /public\s+class/.test(l),
    },
    {
      pattern: /^\s*(?:public|private|protected)?\s*interface\s+(\w+)/,
      kind: 'interface',
      nameGroup: 1,
      exported: (l) => /public\s+interface/.test(l),
    },
    {
      pattern:
        /^\s*(?:public|private|protected)\s+(?:static\s+)?[\w<>[\],\s]+?\s+(\w+)\s*\([^;{]*\)\s*\{?\s*$/,
      kind: 'method',
      nameGroup: 1,
      exported: (l) => /^\s*public/.test(l),
    },
  ],
  csharp: [
    {
      pattern: /^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?class\s+(\w+)/,
      kind: 'class',
      nameGroup: 1,
      exported: (l) => /public\s+class/.test(l),
    },
    {
      pattern: /^\s*(?:public|private|protected|internal)?\s*interface\s+(\w+)/,
      kind: 'interface',
      nameGroup: 1,
      exported: (l) => /public\s+interface/.test(l),
    },
    {
      pattern:
        /^\s*(?:public|private|protected|internal)\s+(?:static\s+)?[\w<>[\],\s]+?\s+(\w+)\s*\([^;{]*\)\s*\{?\s*$/,
      kind: 'method',
      nameGroup: 1,
      exported: (l) => /^\s*public/.test(l),
    },
  ],
  php: [
    {
      pattern: /^\s*(?:public\s+|private\s+|protected\s+|static\s+)*function\s+(\w+)\s*\(/,
      kind: 'function',
      nameGroup: 1,
    },
    { pattern: /^\s*(?:abstract\s+|final\s+)?class\s+(\w+)/, kind: 'class', nameGroup: 1 },
    { pattern: /^\s*interface\s+(\w+)/, kind: 'interface', nameGroup: 1 },
  ],
};

const IMPORT_RULES_BY_LANGUAGE: Record<string, RegExp> = {
  python: /^\s*(?:from\s+(\S+)\s+import|import\s+(\S+))/,
  go: /^\s*"([^"]+)"\s*$/,
  rust: /^\s*use\s+([\w:]+)/,
  java: /^\s*import\s+([\w.]+)\s*;/,
  csharp: /^\s*using\s+([\w.]+)\s*;/,
  php: /^\s*(?:use|require|require_once|include|include_once)\s*\(?\s*['"]?([^'";)]+)/,
};

export function heuristicSymbolExtractor(language: string) {
  const rules = RULES_BY_LANGUAGE[language] ?? [];
  return {
    extract(content: string): ExtractedSymbol[] {
      if (rules.length === 0) return [];
      const lines = content.split('\n');
      const symbols: ExtractedSymbol[] = [];

      lines.forEach((line, index) => {
        for (const rule of rules) {
          const match = rule.pattern.exec(line);
          if (!match) continue;
          const name = match[rule.nameGroup];
          if (!name) continue;
          const startLine = index + 1;
          symbols.push({
            name,
            kind: rule.kind,
            startLine,
            endLine: startLine,
            signature: line.trim().slice(0, 160),
            exported: rule.exported?.(line) ?? false,
          });
          break;
        }
      });

      return symbols;
    },
  };
}

export function heuristicImportExtractor(language: string) {
  const pattern = IMPORT_RULES_BY_LANGUAGE[language];
  return {
    extract(content: string): ExtractedImport[] {
      if (!pattern) return [];
      const imports: ExtractedImport[] = [];
      for (const line of content.split('\n')) {
        const match = pattern.exec(line);
        const specifier = match?.[1] ?? match?.[2];
        if (specifier) imports.push({ specifier, importedNames: [] });
      }
      return imports;
    },
  };
}

export const HEURISTIC_LANGUAGES = Object.keys(RULES_BY_LANGUAGE);
