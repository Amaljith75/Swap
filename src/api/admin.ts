import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/store/session';

export interface AdminReport {
  id: string;
  created_at: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  reason: string;
  details: string | null;
  reporter_id: string;
  reporter_name: string;
  reported_user_id: string;
  reported_name: string;
  reported_suspended: boolean;
  reported_open_reports: number;
  listing_id: string | null;
  listing_title: string | null;
  listing_status: string | null;
  listing_photo: string | null;
  offer_id: string | null;
}

/** True for accounts in admin_users (add yourself in Supabase: Table Editor → admin_users). */
export function useIsAdmin() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['is-admin', uid],
    enabled: !!uid,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) throw error;
      return !!data;
    },
  });
}

export function useAdminReports(status: 'open' | 'closed') {
  return useQuery({
    queryKey: ['admin-reports', status],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_reports', { p_status: status });
      if (error) throw error;
      return (data ?? []) as AdminReport[];
    },
  });
}

type Action =
  | { kind: 'resolve'; reportId: string; status: 'resolved' | 'dismissed'; note?: string }
  | { kind: 'remove-listing'; listingId: string }
  | { kind: 'suspend'; userId: string; suspended: boolean };

export function useAdminAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Action) => {
      const { error } =
        a.kind === 'resolve'
          ? await supabase.rpc('admin_resolve_report', { p_id: a.reportId, p_status: a.status, p_note: a.note ?? null })
          : a.kind === 'remove-listing'
            ? await supabase.rpc('admin_remove_listing', { p_id: a.listingId })
            : await supabase.rpc('admin_set_suspended', { p_user: a.userId, p_suspended: a.suspended });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-reports'] }),
  });
}
