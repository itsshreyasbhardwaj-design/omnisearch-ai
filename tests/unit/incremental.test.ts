import { describe, expect, it } from 'vitest';
import { diffFiles } from '@/lib/indexing/incremental';

describe('diffFiles', () => {
  it('treats every file as changed on first index (no existing rows)', () => {
    const result = diffFiles(
      [],
      [
        { path: 'a.ts', contentHash: 'h1' },
        { path: 'b.ts', contentHash: 'h2' },
      ],
    );
    expect(result.changed.sort()).toEqual(['a.ts', 'b.ts']);
    expect(result.unchanged).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it('skips files whose content hash is unchanged', () => {
    const result = diffFiles(
      [{ id: '1', path: 'a.ts', contentHash: 'h1' }],
      [{ path: 'a.ts', contentHash: 'h1' }],
    );
    expect(result.changed).toEqual([]);
    expect(result.unchanged).toEqual(['a.ts']);
  });

  it('re-indexes a file whose content hash changed', () => {
    const result = diffFiles(
      [{ id: '1', path: 'a.ts', contentHash: 'old' }],
      [{ path: 'a.ts', contentHash: 'new' }],
    );
    expect(result.changed).toEqual(['a.ts']);
    expect(result.unchanged).toEqual([]);
  });

  it('reports files removed from disk', () => {
    const result = diffFiles(
      [
        { id: '1', path: 'a.ts', contentHash: 'h1' },
        { id: '2', path: 'gone.ts', contentHash: 'h2' },
      ],
      [{ path: 'a.ts', contentHash: 'h1' }],
    );
    expect(result.unchanged).toEqual(['a.ts']);
    expect(result.removed).toEqual([{ id: '2', path: 'gone.ts', contentHash: 'h2' }]);
  });
});
