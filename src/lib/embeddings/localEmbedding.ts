/**
 * Zero-cost default embedding: a hashing-trick bag-of-words vector, not a
 * neural embedding. It has no external dependency and no per-call cost, and
 * it genuinely captures lexical/conceptual overlap (shared vocabulary
 * between a query and a chunk), which is what "semantic search" means here
 * until a real `EmbeddingProvider` is configured — see `embeddingProvider.ts`.
 */
export const EMBEDDING_DIMENSIONS = 256;

function fnv1aHash(token: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Lowercased alphanumeric runs of 2+ chars — good enough for identifiers, words, and numbers. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter((t) => t.length >= 2);
}

export interface EmbeddedVector {
  vector: Buffer;
  norm: number;
}

export function vectorToBuffer(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

export function bufferToVector(buffer: Buffer): Float32Array {
  return new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
}

function embedTokens(tokens: string[]): EmbeddedVector {
  const vector = new Float32Array(EMBEDDING_DIMENSIONS);

  for (const token of tokens) {
    const hash = fnv1aHash(token);
    const bucket = hash % EMBEDDING_DIMENSIONS;
    // A second bit of the same hash flips the sign — the standard
    // hashing-trick refinement that keeps unrelated collisions from all
    // pushing the vector in the same direction.
    const sign = (hash & 0x100) !== 0 ? 1 : -1;
    vector[bucket] = (vector[bucket] ?? 0) + sign;
  }

  let sumSquares = 0;
  for (let i = 0; i < vector.length; i += 1) {
    const value = vector[i] ?? 0;
    sumSquares += value * value;
  }

  return { vector: vectorToBuffer(vector), norm: Math.sqrt(sumSquares) };
}

export function embedChunk(content: string): EmbeddedVector {
  return embedTokens(tokenize(content));
}

export function embedQuery(query: string): EmbeddedVector {
  return embedTokens(tokenize(query));
}
