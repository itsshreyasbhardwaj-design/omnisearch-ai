import fs from 'node:fs/promises';
import path from 'node:path';

export class LocalPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalPathError';
  }
}

/**
 * Local-path ingestion reads a directory the server process already has
 * filesystem access to — this is a local developer tool, and the user
 * supplying the path is the same person running the server. It is not
 * copied into `.omnisearch/repos`; the stored `source_ref` *is* the root
 * the indexer and file-serving reads from.
 */
export async function validateLocalRepoPath(inputPath: string): Promise<string> {
  const resolved = path.resolve(inputPath.trim());

  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    throw new LocalPathError(`No such directory: ${resolved}`);
  }

  if (!stat.isDirectory()) {
    throw new LocalPathError(`Not a directory: ${resolved}`);
  }

  return resolved;
}

export function suggestedNameFromPath(resolvedPath: string): string {
  return path.basename(resolvedPath) || resolvedPath;
}
