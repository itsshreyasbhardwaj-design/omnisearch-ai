import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isBinaryContent, isBinaryPath, walkRepository } from '@/lib/ingestion/fileFilter';

describe('isBinaryPath', () => {
  it('flags known binary extensions', () => {
    expect(isBinaryPath('logo.png')).toBe(true);
    expect(isBinaryPath('archive.zip')).toBe(true);
    expect(isBinaryPath('a.out.wasm')).toBe(true);
  });

  it('allows source extensions', () => {
    expect(isBinaryPath('index.ts')).toBe(false);
    expect(isBinaryPath('README.md')).toBe(false);
  });
});

describe('isBinaryContent', () => {
  it('detects a null byte as binary', () => {
    expect(isBinaryContent(Buffer.from([0x68, 0x69, 0x00, 0x21]))).toBe(true);
  });

  it('treats plain text as non-binary', () => {
    expect(isBinaryContent(Buffer.from('hello world', 'utf8'))).toBe(false);
  });
});

describe('walkRepository', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'omnisearch-filter-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('discovers source files while skipping node_modules, .git, and binaries', async () => {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules', 'dep'), { recursive: true });
    fs.mkdirSync(path.join(root, '.git'), { recursive: true });

    fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'export const x = 1;');
    fs.writeFileSync(path.join(root, 'node_modules', 'dep', 'index.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/main');
    fs.writeFileSync(path.join(root, 'logo.png'), 'not-really-a-png');

    const files = await walkRepository(root);
    const relPaths = files.map((f) => f.relPath).sort();

    expect(relPaths).toEqual(['src/index.ts']);
  });

  it('respects a nested .gitignore (the .gitignore file itself is real content and stays indexed)', async () => {
    fs.mkdirSync(path.join(root, 'build'), { recursive: true });
    fs.writeFileSync(path.join(root, '.gitignore'), 'build/\n');
    fs.writeFileSync(path.join(root, 'build', 'out.js'), 'console.log(1);');
    fs.writeFileSync(path.join(root, 'keep.js'), 'console.log(2);');

    const files = await walkRepository(root);
    expect(files.map((f) => f.relPath).sort()).toEqual(['.gitignore', 'keep.js']);
  });

  it('excludes files larger than the configured max size', async () => {
    fs.writeFileSync(path.join(root, 'small.ts'), 'x');
    fs.writeFileSync(path.join(root, 'big.ts'), 'y'.repeat(1000));

    const files = await walkRepository(root, { maxFileSizeBytes: 100 });
    expect(files.map((f) => f.relPath)).toEqual(['small.ts']);
  });

  it('excludes empty files', async () => {
    fs.writeFileSync(path.join(root, 'empty.ts'), '');
    fs.writeFileSync(path.join(root, 'nonempty.ts'), 'x');

    const files = await walkRepository(root);
    expect(files.map((f) => f.relPath)).toEqual(['nonempty.ts']);
  });
});
