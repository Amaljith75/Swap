import { deleteStoredPhotos, isLocalUri, uploadImage } from './media';

/**
 * Uploads any new local photos and returns storage paths in the same order.
 * One at a time: decoding several full-size camera photos at once can run
 * low-memory phones out of memory. If one upload fails, the ones already
 * uploaded in this call are deleted again.
 */
export async function resolvePhotos(photos: string[], userId: string): Promise<string[]> {
  const out: string[] = [];
  const uploaded: string[] = [];
  try {
    for (const p of photos) {
      if (isLocalUri(p)) {
        const path = await uploadImage(p, userId, 'listings');
        uploaded.push(path);
        out.push(path);
      } else {
        out.push(p);
      }
    }
  } catch (e) {
    void deleteStoredPhotos(uploaded);
    throw e;
  }
  return out;
}
