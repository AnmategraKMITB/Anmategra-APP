import { UTApi } from 'uploadthing/server';

/**
 * Menghapus berkas dari UploadThing, upaya terbaik: gagal tidak boleh
 * menggagalkan penyimpanan form (berkas yatim hanya memakan kuota).
 */
export async function deleteUploadedFiles(keys: string[]) {
  const wanted = keys.filter(Boolean);
  if (wanted.length === 0) return;
  try {
    await new UTApi().deleteFiles(wanted);
  } catch (error) {
    console.error('gagal menghapus berkas UploadThing', error);
  }
}

/** Kunci berkas UploadThing dari URL-nya (`https://utfs.io/f/<kunci>`), atau null. */
export function keyFromUploadUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop();
    return last ?? null;
  } catch {
    return null;
  }
}
