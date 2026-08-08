export interface ExistingFileRecord {
  id: string;
  path: string;
  contentHash: string;
}

export interface DiscoveredFileDigest {
  path: string;
  contentHash: string;
}

export interface DiffResult {
  /** New files, or existing files whose content hash changed — need re-chunking. */
  changed: string[];
  /** Existing files whose content hash is identical — skip re-chunking entirely. */
  unchanged: string[];
  /** Files that were indexed before but are no longer present on disk. */
  removed: ExistingFileRecord[];
}

/**
 * Pure content-hash diff — the core of "don't re-index unchanged files."
 * Kept free of fs/db so it's cheap to unit test against fabricated file
 * lists instead of a real repository checkout.
 */
export function diffFiles(
  existing: ExistingFileRecord[],
  discovered: DiscoveredFileDigest[],
): DiffResult {
  const existingByPath = new Map(existing.map((file) => [file.path, file]));
  const discoveredPaths = new Set(discovered.map((file) => file.path));

  const changed: string[] = [];
  const unchanged: string[] = [];

  for (const file of discovered) {
    const prior = existingByPath.get(file.path);
    if (prior && prior.contentHash === file.contentHash) {
      unchanged.push(file.path);
    } else {
      changed.push(file.path);
    }
  }

  const removed = existing.filter((file) => !discoveredPaths.has(file.path));

  return { changed, unchanged, removed };
}
