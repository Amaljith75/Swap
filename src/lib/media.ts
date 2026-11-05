import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const BUCKET = 'media';

/** Storage path -> public URL. Accepts full URLs unchanged. */
export function publicUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^(https?:|file:|content:)/.test(path)) return path;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export const isLocalUri = (p: string) => /^(file:|content:)/.test(p);

// Item photos uploaded since V 1.2 are named "p2-<id>.jpg" and have a small
// "p2-<id>.t.jpg" copy for lists and cards. Older photos have no small copy.
const THUMB_NAME = /\/p2-[^/]+\.jpg$/;
export const hasThumb = (path: string) => THUMB_NAME.test(path);
export const thumbPath = (path: string) => path.replace(/\.jpg$/, '.t.jpg');

/** Smaller version of a stored photo when one exists (falls back to the full photo). */
export function thumbUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return publicUrl(hasThumb(path) ? thumbPath(path) : path);
}

/** Best-effort delete of photos this person no longer uses (and their small copies).
 *  A nightly server job also removes anything left behind. */
export async function deleteStoredPhotos(paths: (string | null | undefined)[]): Promise<void> {
  const stored = paths.filter((p): p is string => !!p && !isLocalUri(p) && !/^https?:/.test(p));
  if (stored.length === 0) return;
  const all = stored.flatMap((p) => (hasThumb(p) ? [p, thumbPath(p)] : [p]));
  try {
    await supabase.storage.from(BUCKET).remove(all);
  } catch {
    // ignore: the cleanup job will get it
  }
}

export async function pickImages(max: number): Promise<string[]> {
  if (max <= 0) return [];
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Allow photo access in Settings to add photos.');
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: max > 1,
    selectionLimit: max,
    quality: 1,
  });
  if (res.canceled) return [];
  return res.assets.slice(0, max).map((a) => a.uri);
}

export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Allow camera access in Settings to take photos.');
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  return res.canceled ? null : (res.assets[0]?.uri ?? null);
}

const randomId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

type Decoded = Awaited<ReturnType<ReturnType<typeof ImageManipulator.manipulate>['renderAsync']>>;

async function jpegBase64(source: Decoded, maxSide: number, compress: number): Promise<string> {
  // Fit the longest side, so tall photos aren't stored larger than wide ones.
  const ctx = ImageManipulator.manipulate(source);
  if (Math.max(source.width, source.height) > maxSide) {
    ctx.resize(source.width >= source.height ? { width: maxSide } : { height: maxSide });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) throw new Error('Could not process the photo.');
  return saved.base64;
}

async function put(path: string, base64: string) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
}

/** Resizes, compresses to JPEG and uploads into the user's folder. Item photos also get a small copy. */
export async function uploadImage(localUri: string, userId: string, folder: 'listings' | 'avatar'): Promise<string> {
  const decoded = await ImageManipulator.manipulate(localUri).renderAsync(); // decode once
  if (folder === 'avatar') {
    const path = `${userId}/avatar/${randomId()}.jpg`;
    await put(path, await jpegBase64(decoded, 512, 0.72));
    return path;
  }
  const path = `${userId}/listings/p2-${randomId()}.jpg`;
  const full = await jpegBase64(decoded, 1280, 0.72);
  const small = await jpegBase64(decoded, 400, 0.7);
  await put(thumbPath(path), small);
  await put(path, full);
  return path;
}
