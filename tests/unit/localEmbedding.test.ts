import { describe, expect, it } from 'vitest';
import { bufferToVector, embedChunk, embedQuery, tokenize } from '@/lib/embeddings/localEmbedding';
import { cosineSimilarity } from '@/lib/embeddings/similarity';

describe('tokenize', () => {
  it('lowercases and splits on non-alphanumerics, dropping 1-char tokens', () => {
    expect(tokenize('Hello, World! a b cd')).toEqual(['hello', 'world', 'cd']);
  });
});

describe('embedChunk', () => {
  it('is deterministic for the same input', () => {
    const a = embedChunk('function authenticateUser(email, password) {}');
    const b = embedChunk('function authenticateUser(email, password) {}');
    expect(a.vector.equals(b.vector)).toBe(true);
    expect(a.norm).toBe(b.norm);
  });

  it('produces a zero vector (and zero norm) for content with no tokens', () => {
    const embedded = embedChunk('!!! ,,, ...');
    expect(embedded.norm).toBe(0);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    const a = embedChunk('const authenticateUser = (email) => verify(email)');
    const vector = bufferToVector(a.vector);
    expect(cosineSimilarity(vector, a.norm, vector, a.norm)).toBeCloseTo(1, 5);
  });

  it('scores lexically-overlapping text higher than unrelated text', () => {
    const query = embedQuery('authenticate user with email and password');
    const related = embedChunk(
      'function authenticateUser(email, password) { return verify(email, password); }',
    );
    const unrelated = embedChunk('function slugify(text) { return text.toLowerCase(); }');

    const qv = bufferToVector(query.vector);
    const relatedScore = cosineSimilarity(
      qv,
      query.norm,
      bufferToVector(related.vector),
      related.norm,
    );
    const unrelatedScore = cosineSimilarity(
      qv,
      query.norm,
      bufferToVector(unrelated.vector),
      unrelated.norm,
    );

    expect(relatedScore).toBeGreaterThan(unrelatedScore);
  });

  it('returns 0 when either norm is 0', () => {
    const a = embedChunk('some real content here');
    const empty = embedChunk('');
    expect(
      cosineSimilarity(bufferToVector(a.vector), a.norm, bufferToVector(empty.vector), empty.norm),
    ).toBe(0);
  });
});
