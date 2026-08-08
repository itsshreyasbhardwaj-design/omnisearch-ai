export function cosineSimilarity(
  a: Float32Array,
  aNorm: number,
  b: Float32Array,
  bNorm: number,
): number {
  if (aNorm === 0 || bNorm === 0) return 0;

  let dot = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }

  return dot / (aNorm * bNorm);
}
