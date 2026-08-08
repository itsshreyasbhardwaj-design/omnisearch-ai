import { describe, expect, it } from 'vitest';
import {
  heuristicSymbolExtractor,
  heuristicImportExtractor,
} from '@/lib/symbols/heuristicExtractor';

describe('heuristicSymbolExtractor', () => {
  it('finds Python def and class declarations', () => {
    const content = 'class DemoUser:\n    def __init__(self, email):\n        self.email = email\n';
    const symbols = heuristicSymbolExtractor('python').extract(content);
    expect(symbols.find((s) => s.name === 'DemoUser')).toMatchObject({
      kind: 'class',
      startLine: 1,
    });
    expect(symbols.find((s) => s.name === '__init__')).toMatchObject({
      kind: 'function',
      startLine: 2,
    });
  });

  it('finds Go func and struct declarations, marking capitalized ones exported', () => {
    const content =
      'func HandleHealthCheck(w http.ResponseWriter) {}\nfunc helper() {}\ntype Server struct {}\n';
    const symbols = heuristicSymbolExtractor('go').extract(content);
    expect(symbols.find((s) => s.name === 'HandleHealthCheck')).toMatchObject({ exported: true });
    expect(symbols.find((s) => s.name === 'helper')).toMatchObject({ exported: false });
    expect(symbols.find((s) => s.name === 'Server')).toMatchObject({
      kind: 'class',
      exported: true,
    });
  });

  it('returns an empty array for a language with no rules', () => {
    expect(heuristicSymbolExtractor('sql').extract('SELECT 1')).toEqual([]);
  });
});

describe('heuristicImportExtractor', () => {
  it('finds Python imports', () => {
    const imports = heuristicImportExtractor('python').extract(
      'import hashlib\nfrom auth import login\n',
    );
    expect(imports.map((i) => i.specifier)).toEqual(expect.arrayContaining(['hashlib', 'auth']));
  });

  it('finds Rust use statements', () => {
    const imports = heuristicImportExtractor('rust').extract('use std::collections::HashMap;\n');
    expect(imports[0]?.specifier).toBe('std::collections::HashMap');
  });
});
