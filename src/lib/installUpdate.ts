import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { create } from 'zustand';

type Phase = 'idle' | 'downloading' | 'installing' | 'error';

interface InstallState {
  phase: Phase;
  progress: number; // 0..1
  error: string | null;
  start: (url: string, build: number) => Promise<void>;
  reset: () => void;
}

const FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;
const apkPath = (build: number) => `${FileSystem.cacheDirectory}swap-update-${build}.apk`;

/**
 * Downloads the new APK inside the app and hands it to Android's package installer,
 * which shows its usual "Update this app?" screen. Android always asks the person to
 * confirm an install from outside the Play Store; the first time it also asks them to
 * allow installs from Swap.
 */
export const useInstallUpdate = create<InstallState>((set, get) => ({
  phase: 'idle',
  progress: 0,
  error: null,
  reset: () => set({ phase: 'idle', progress: 0, error: null }),
  start: async (url, build) => {
    if (Platform.OS !== 'android' || get().phase === 'downloading') return;
    set({ phase: 'downloading', progress: 0, error: null });
    try {
      const target = apkPath(build);
      const existing = await FileSystem.getInfoAsync(target);
      if (!existing.exists || (existing.size ?? 0) < 1_000_000) {
        const task = FileSystem.createDownloadResumable(url, target, {}, (p) => {
          if (p.totalBytesExpectedToWrite > 0) set({ progress: p.totalBytesWritten / p.totalBytesExpectedToWrite });
        });
        const res = await task.downloadAsync();
        if (!res || res.status !== 200) throw new Error(`Download failed (${res?.status ?? 'no response'}).`);
      }
      set({ phase: 'installing', progress: 1 });
      const contentUri = await FileSystem.getContentUriAsync(target);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/vnd.android.package-archive',
        flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK,
      });
      // If the person backs out of the installer we land here; let them try again.
      set({ phase: 'idle' });
    } catch (e) {
      set({ phase: 'error', error: e instanceof Error ? e.message : 'Update failed.' });
    }
  },
}));

/** Removes downloaded update files once they're no longer needed. */
export async function cleanOldUpdates(currentBuild: number) {
  if (Platform.OS !== 'android' || !FileSystem.cacheDirectory) return;
  try {
    const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
    await Promise.all(
      files
        .filter((f) => /^swap-update-(\d+)\.apk$/.test(f) && Number(f.match(/(\d+)/)![1]) <= currentBuild)
        .map((f) => FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${f}`, { idempotent: true })),
    );
  } catch {
    // ignore
  }
}
