import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface ReleaseInfo {
  build: number;
  url: string | null;
  name: string | null;
}

/** This install's build number (the Android versionCode set by CI). */
export const currentBuild = () => Number(Application.nativeBuildVersion ?? 0) || 0;

export function useLatestRelease() {
  return useQuery({
    queryKey: ['latest-release'],
    // Android APKs only; iOS updates will come through the App Store / TestFlight.
    enabled: Platform.OS === 'android',
    staleTime: 10 * 60_000,
    refetchInterval: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('app_config').select('value').eq('key', 'latest_release').maybeSingle();
      if (error) throw error;
      return (data?.value ?? null) as ReleaseInfo | null;
    },
  });
}

export function useUpdateAvailable() {
  const latest = useLatestRelease();
  const r = latest.data;
  const available = !!r && !!r.url && r.build > currentBuild() && currentBuild() > 0;
  return { available, release: r ?? null };
}
