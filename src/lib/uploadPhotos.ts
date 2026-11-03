import { isLocalUri, uploadImage } from './media';

/** Uploads any new local photos and returns storage paths in the same order. */
export async function resolvePhotos(photos: string[], userId: string): Promise<string[]> {
  return Promise.all(photos.map((p) => (isLocalUri(p) ? uploadImage(p, userId, 'listings') : Promise.resolve(p))));
}
