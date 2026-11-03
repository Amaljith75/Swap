import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/store/session';
import type { Profile, Rating } from '@/types/db';
import { qk } from './keys';
import { PROFILE_FULL } from './select';

export function useMe() {
  const uid = useUserId();
  return useQuery({
    queryKey: qk.me,
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select(PROFILE_FULL).eq('id', uid!).single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

export function useProfile(id: string | undefined) {
  return useQuery({
    queryKey: qk.profile(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select(PROFILE_FULL).eq('id', id!).single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

export interface ProfileUpdate {
  display_name?: string;
  city?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  onboarded?: boolean;
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const uid = useUserId();
  return useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', uid!);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.me });
      if (uid) void qc.invalidateQueries({ queryKey: qk.profile(uid) });
    },
  });
}

export function useRatings(userId: string | undefined) {
  return useQuery({
    queryKey: qk.ratings(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ratings')
        .select('id,offer_id,rater_id,ratee_id,stars,comment,created_at,rater:profiles!rater_id(id,display_name,avatar_url)')
        .eq('ratee_id', userId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as unknown as Rating[];
    },
  });
}
