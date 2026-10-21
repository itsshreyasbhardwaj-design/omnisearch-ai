import { describe, expect, it } from 'vitest';
import { buildTree, flattenVisible } from '@/components/repo/file-tree';

const FILES = [
  { path: 'src/auth/authService.ts', language: 'typescript' },
  { path: 'src/auth/password.ts', language: 'typescript' },
  { path: 'src/utils/stringHelpers.js', language: 'javascript' },
  { path: 'README.md', language: 'markdown' },
];

describe('buildTree', () => {
  it('nests files under their directory chain, deduping shared ancestors', () => {
    const root = buildTree(FILES);
    expect(root.children.has('src')).toBe(true);
    expect(root.children.has('README.md')).toBe(true);

    const src = root.children.get('src')!;
    expect(src.isFile).toBe(false);
    expect(src.children.has('auth')).toBe(true);
    expect(src.children.has('utils')).toBe(true);

    const auth = src.children.get('auth')!;
    expect(auth.children.size).toBe(2);
    expect(auth.children.get('authService.ts')?.isFile).toBe(true);
    expect(auth.children.get('authService.ts')?.path).toBe('src/auth/authService.ts');
  });
});

describe('flattenVisible', () => {
  it('shows only top-level rows when nothing is expanded', () => {
    const root = buildTree(FILES);
    const rows = flattenVisible(root, new Set());
    expect(rows.map((r) => r.node.name).sort()).toEqual(['README.md', 'src']);
  });

  it('descends into an expanded folder but not its unexpanded children', () => {
    const root = buildTree(FILES);
    const rows = flattenVisible(root, new Set(['src']));
    const names = rows.map((r) => r.node.name);
    expect(names).toContain('auth');
    expect(names).toContain('utils');
    expect(names).not.toContain('authService.ts');
  });

  it('descends recursively through every expanded ancestor', () => {
    const root = buildTree(FILES);
    const rows = flattenVisible(root, new Set(['src', 'src/auth']));
    const names = rows.map((r) => r.node.name);
    expect(names).toContain('authService.ts');
    expect(names).toContain('password.ts');
    // utils is a sibling of auth, expanded independently — its file isn't shown.
    expect(names).not.toContain('stringHelpers.js');
  });

  it('assigns increasing depth to nested rows', () => {
    const root = buildTree(FILES);
    const rows = flattenVisible(root, new Set(['src', 'src/auth']));
    const authServiceRow = rows.find((r) => r.node.name === 'authService.ts');
    expect(authServiceRow?.depth).toBe(2);
  });
});
