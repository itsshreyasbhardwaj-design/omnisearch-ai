import fs from 'node:fs/promises';
import path from 'node:path';
import unzipper from 'unzipper';

export class ZipExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipExtractionError';
  }
}

const MAX_ENTRIES = 20_000;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500MB — a sanity cap against zip bombs

/**
 * Extracts a ZIP buffer into `destDir`. Every entry's resolved path is
 * checked against `destDir` before writing ("zip-slip" — a `../../etc/passwd`
 * entry name must not escape the extraction root) and total extracted size
 * is capped so a crafted archive can't exhaust disk.
 */
export async function extractZipSafely(buffer: Buffer, destDir: string): Promise<void> {
  await fs.rm(destDir, { recursive: true, force: true });
  await fs.mkdir(destDir, { recursive: true });

  const directory = await unzipper.Open.buffer(buffer);

  if (directory.files.length > MAX_ENTRIES) {
    throw new ZipExtractionError(`Archive has too many entries (limit ${MAX_ENTRIES}).`);
  }

  let totalBytes = 0;
  const destRoot = path.resolve(destDir);

  for (const entry of directory.files) {
    if (entry.type !== 'File') continue;

    const resolved = path.resolve(destRoot, entry.path);
    const withinRoot = resolved === destRoot || resolved.startsWith(destRoot + path.sep);
    if (!withinRoot) {
      throw new ZipExtractionError(
        `Archive entry "${entry.path}" resolves outside the extraction directory.`,
      );
    }

    totalBytes += entry.uncompressedSize;
    if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new ZipExtractionError('Archive is too large once extracted.');
    }

    await fs.mkdir(path.dirname(resolved), { recursive: true });
    const content = await entry.buffer();
    await fs.writeFile(resolved, content);
  }
}
