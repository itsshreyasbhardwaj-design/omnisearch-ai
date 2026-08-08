import { describe, expect, it } from 'vitest';
import { chunkFileContent } from '@/lib/indexing/chunking';

describe('chunkFileContent', () => {
  it('returns no chunks for empty content', () => {
    expect(chunkFileContent('')).toEqual([]);
  });

  it('produces a single chunk for content shorter than the window', () => {
    const chunks = chunkFileContent('line1\nline2\nline3', 60);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ startLine: 1, endLine: 3, content: 'line1\nline2\nline3' });
  });

  it('splits content into non-overlapping windows with correct line ranges', () => {
    const lines = Array.from({ length: 25 }, (_, i) => `line${i + 1}`);
    const chunks = chunkFileContent(lines.join('\n'), 10);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({ startLine: 1, endLine: 10 });
    expect(chunks[1]).toMatchObject({ startLine: 11, endLine: 20 });
    expect(chunks[2]).toMatchObject({ startLine: 21, endLine: 25 });
  });

  it('covers every line exactly once across chunks', () => {
    const lines = Array.from({ length: 137 }, (_, i) => `x${i}`);
    const chunks = chunkFileContent(lines.join('\n'), 40);
    const reassembled = chunks.map((c) => c.content).join('\n');
    expect(reassembled).toBe(lines.join('\n'));
  });
});
