import 'server-only';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

/**
 * Local-disk slab-photo storage — a deliberate "for now" stopgap (doesn't
 * survive redeploys or multiple instances). Every disk operation is
 * centralized here so a future move to object storage (Blob/S3/Cloudinary)
 * only requires swapping this module's internals, not its callers.
 */

const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'slab-photos');

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB

function extensionFor(mimeType: string): string | null {
  const entry = Object.entries(CONTENT_TYPES).find(([, mt]) => mt === mimeType);
  return entry ? entry[0] : null;
}

/** Resolve a storageKey to an absolute path, refusing anything that would escape STORAGE_ROOT. */
function resolvePath(storageKey: string): string {
  const resolved = path.resolve(STORAGE_ROOT, storageKey);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error('Invalid storage key');
  }
  return resolved;
}

export async function saveSlabPhoto(
  inventoryItemId: string,
  file: File,
): Promise<{ storageKey: string }> {
  const ext = extensionFor(file.type) ?? 'jpg';
  const storageKey = `${inventoryItemId}/${randomUUID()}.${ext}`;
  const destPath = resolvePath(storageKey);

  await mkdir(path.dirname(destPath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(destPath, buffer);

  return { storageKey };
}

export async function readSlabPhoto(
  storageKey: string,
): Promise<{ data: Buffer; contentType: string }> {
  const ext = storageKey.split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
  const data = await readFile(resolvePath(storageKey));
  return { data, contentType };
}

export async function deleteSlabPhoto(storageKey: string): Promise<void> {
  try {
    await unlink(resolvePath(storageKey));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
