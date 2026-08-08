import ts from 'typescript';
import type { ExtractedImport, ExtractedSymbol } from './types';

function lineOf(sourceFile: ts.SourceFile, pos: number): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
}

function isExported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function signaturePreview(content: string, startLine: number): string {
  const line = content.split('\n')[startLine - 1] ?? '';
  const trimmed = line.trim();
  return trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed;
}

function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

/**
 * Real AST extraction via the TypeScript compiler API — accurate for
 * TS/TSX/JS/JSX, the languages that API actually understands. The other six
 * spec languages use `heuristicExtractor.ts` instead; see ARCHITECTURE.md
 * for why that's an honest tradeoff rather than a silent quality gap.
 */
export const tsSymbolExtractor = {
  extract(content: string, filePath: string): ExtractedSymbol[] {
    const isJsx = /\.(tsx|jsx)$/i.test(filePath);
    const scriptKind = /\.(tsx)$/i.test(filePath)
      ? ts.ScriptKind.TSX
      : /\.(jsx)$/i.test(filePath)
        ? ts.ScriptKind.JSX
        : /\.(js|mjs|cjs)$/i.test(filePath)
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS;

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const symbols: ExtractedSymbol[] = [];

    function push(name: string, kind: ExtractedSymbol['kind'], node: ts.Node, exported: boolean) {
      const startLine = lineOf(sourceFile, node.getStart(sourceFile));
      const endLine = lineOf(sourceFile, node.getEnd());
      symbols.push({
        name,
        kind,
        startLine,
        endLine,
        signature: signaturePreview(content, startLine),
        exported,
      });
    }

    function visit(node: ts.Node) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const name = node.name.text;
        const kind = isJsx && isComponentName(name) ? 'component' : 'function';
        push(name, kind, node, isExported(node));
      } else if (ts.isClassDeclaration(node) && node.name) {
        push(node.name.text, 'class', node, isExported(node));
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
            push(member.name.text, 'method', member, false);
          }
        }
      } else if (ts.isInterfaceDeclaration(node)) {
        push(node.name.text, 'interface', node, isExported(node));
      } else if (ts.isTypeAliasDeclaration(node)) {
        push(node.name.text, 'type', node, isExported(node));
      } else if (ts.isVariableStatement(node)) {
        const exported = isExported(node);
        for (const decl of node.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name)) continue;
          const name = decl.name.text;
          const initializer = decl.initializer;
          const isFn =
            initializer &&
            (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer));
          const kind = isFn
            ? isJsx && isComponentName(name)
              ? 'component'
              : 'function'
            : 'variable';
          push(name, kind, decl, exported);
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return symbols;
  },
};

export const tsImportExtractor = {
  extract(content: string): ExtractedImport[] {
    const sourceFile = ts.createSourceFile(
      'file.tsx',
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const imports: ExtractedImport[] = [];

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;

      const names: string[] = [];
      const clause = statement.importClause;
      if (clause) {
        if (clause.name) names.push(clause.name.text);
        if (clause.namedBindings) {
          if (ts.isNamedImports(clause.namedBindings)) {
            for (const el of clause.namedBindings.elements) names.push(el.name.text);
          } else if (ts.isNamespaceImport(clause.namedBindings)) {
            names.push(`* as ${clause.namedBindings.name.text}`);
          }
        }
      }

      imports.push({ specifier, importedNames: names });
    }

    return imports;
  },
};
