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

/** Resizes to max 1280 px, compresses to JPEG and uploads into the user's folder. */
export async function uploadImage(localUri: string, userId: string, folder: 'listings' | 'avatar'): Promise<string> {
  const ctx = ImageManipulator.manipulate(localUri).resize({ width: folder === 'avatar' ? 512 : 1280 });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.72, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) throw new Error('Could not process the photo.');
  const path = `${userId}/${folder}/${randomId()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(saved.base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}
