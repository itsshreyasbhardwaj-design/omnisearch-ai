import { embedChunk, embedQuery, type EmbeddedVector } from './localEmbedding';

/**
 * The seam a real neural embedding provider (OpenAI, Cohere, a local model
 * server) would implement. `localEmbeddingProvider` is the only
 * implementation shipped — it costs nothing and needs no network, at the
 * cost of not understanding meaning the way a trained model does.
 */
export interface EmbeddingProvider {
  readonly name: string;
  embedChunk(content: string): EmbeddedVector | Promise<EmbeddedVector>;
  embedQuery(query: string): EmbeddedVector | Promise<EmbeddedVector>;
}

export const localEmbeddingProvider: EmbeddingProvider = {
  name: 'local-hashing-trick',
  embedChunk,
  embedQuery,
};

export function getEmbeddingProvider(): EmbeddingProvider {
  return localEmbeddingProvider;
}
