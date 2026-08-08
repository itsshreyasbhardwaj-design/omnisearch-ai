import { describe, expect, it } from 'vitest';
import { tsSymbolExtractor, tsImportExtractor } from '@/lib/symbols/tsExtractor';

describe('tsSymbolExtractor', () => {
  it('extracts an exported function declaration', () => {
    const symbols = tsSymbolExtractor.extract(
      'export function authenticateUser(email: string): boolean {\n  return true;\n}\n',
      'auth.ts',
    );
    const fn = symbols.find((s) => s.name === 'authenticateUser');
    expect(fn).toMatchObject({ kind: 'function', exported: true, startLine: 1 });
  });

  it('extracts a class and its methods', () => {
    const symbols = tsSymbolExtractor.extract(
      'export class UserService {\n  find(id: string) {\n    return id;\n  }\n}\n',
      'service.ts',
    );
    expect(symbols.find((s) => s.name === 'UserService')).toMatchObject({
      kind: 'class',
      exported: true,
    });
    expect(symbols.find((s) => s.name === 'find')).toMatchObject({ kind: 'method' });
  });

  it('extracts interfaces and type aliases', () => {
    const symbols = tsSymbolExtractor.extract(
      'export interface User { id: string }\ntype Id = string;\n',
      'types.ts',
    );
    expect(symbols.find((s) => s.name === 'User')).toMatchObject({
      kind: 'interface',
      exported: true,
    });
    expect(symbols.find((s) => s.name === 'Id')).toMatchObject({ kind: 'type', exported: false });
  });

  it('classifies an uppercase arrow function in a .tsx file as a component', () => {
    const symbols = tsSymbolExtractor.extract(
      'export const Button = () => {\n  return null;\n};\n',
      'button.tsx',
    );
    expect(symbols.find((s) => s.name === 'Button')).toMatchObject({ kind: 'component' });
  });

  it('classifies a lowercase arrow function as a function, not a component', () => {
    const symbols = tsSymbolExtractor.extract('const helper = () => 1;\n', 'utils.ts');
    expect(symbols.find((s) => s.name === 'helper')).toMatchObject({ kind: 'function' });
  });

  it('does not throw on malformed source', () => {
    expect(() => tsSymbolExtractor.extract('function (((', 'broken.ts')).not.toThrow();
  });
});

describe('tsImportExtractor', () => {
  it('extracts named, default, and namespace imports with their specifiers', () => {
    const imports = tsImportExtractor.extract(
      `import React from 'react';\nimport { useState, useEffect } from 'react';\nimport * as path from 'node:path';\nimport './authService';\n`,
    );
    expect(
      imports.find((i) => i.specifier === 'react' && i.importedNames.includes('React')),
    ).toBeDefined();
    expect(
      imports.find((i) => i.specifier === 'react' && i.importedNames.includes('useState')),
    ).toBeDefined();
    expect(imports.find((i) => i.specifier === './authService')).toBeDefined();
  });
});
