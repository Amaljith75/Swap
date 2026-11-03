import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/store/session';
import type { ProfileLite, ReportReason } from '@/types/db';
import { qk } from './keys';
import { PROFILE_LITE } from './select';

export function useBlocks() {
  const uid = useUserId();
  return useQuery({
    queryKey: qk.blocks,
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocks')
        .select(`blocked_id,created_at,blocked:profiles!blocked_id(${PROFILE_LITE})`)
        .eq('blocker_id', uid!);
      if (error) throw error;
      return data as unknown as { blocked_id: string; created_at: string; blocked: ProfileLite }[];
    },
  });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { userId: string; block: boolean }) => {
      const { error } = await supabase.rpc(v.block ? 'block_user' : 'unblock_user', { p_user: v.userId });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries(),
  });
}

export const reportReasons: { value: ReportReason; label: string }[] = [
  { value: 'no_show', label: 'Did not show up' },
  { value: 'not_as_described', label: 'Item was not as described' },
  { value: 'unsafe_behavior', label: 'Unsafe or abusive behaviour' },
  { value: 'spam_or_scam', label: 'Spam or scam' },
  { value: 'prohibited_item', label: 'Prohibited or illegal item' },
  { value: 'other', label: 'Something else' },
];

export function useReport() {
  const uid = useUserId();
  return useMutation({
    mutationFn: async (v: {
      userId: string;
      reason: ReportReason;
      details: string;
      offerId?: string;
      listingId?: string;
    }) => {
      const { error } = await supabase.from('reports').insert({
        reporter_id: uid,
        reported_user_id: v.userId,
        reason: v.reason,
        details: v.details || null,
        offer_id: v.offerId ?? null,
        listing_id: v.listingId ?? null,
      });
      if (error) throw error;
    },
  });
}
