import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/store/session';
import type { Message, Offer, OfferStatus } from '@/types/db';
import { qk } from './keys';
import { OFFER_SELECT } from './select';

export function useOffers() {
  const uid = useUserId();
  return useQuery({
    queryKey: qk.offers,
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offers')
        .select(OFFER_SELECT)
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as Offer[];
    },
  });
}

export function useOffer(id: string | undefined) {
  return useQuery({
    queryKey: qk.offer(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('offers').select(OFFER_SELECT).eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as unknown as Offer | null;
    },
  });
}

/** Your open offer on an item, if any (so the item screen can link to it). */
export function useMyOpenOfferOn(listingId: string | undefined) {
  const uid = useUserId();
  return useQuery({
    queryKey: qk.myOfferOn(listingId ?? ''),
    enabled: !!listingId && !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offers')
        .select('id,status')
        .eq('target_listing_id', listingId!)
        .eq('from_user', uid!)
        .in('status', ['pending', 'countered', 'accepted'])
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; status: OfferStatus } | null;
    },
  });
}

export function usePendingCount() {
  const uid = useUserId();
  return useQuery({
    queryKey: qk.pendingCount,
    enabled: !!uid,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_pending_count');
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
}

/**
 * Refreshes what a trade change can affect. Item lists (nearby, my items, item
 * pages) only change when items get reserved, swapped or freed, i.e. when a
 * trade is accepted, completed or cancelled; other steps leave them alone.
 */
function invalidateTrade(qc: ReturnType<typeof useQueryClient>, offerId?: string, itemsChanged = true) {
  void qc.invalidateQueries({ queryKey: qk.offers });
  void qc.invalidateQueries({ queryKey: qk.pendingCount });
  void qc.invalidateQueries({ queryKey: ['my-offer-on'] });
  if (itemsChanged) {
    void qc.invalidateQueries({ queryKey: qk.myListings });
    void qc.invalidateQueries({ queryKey: ['nearby'] });
    void qc.invalidateQueries({ queryKey: ['listing'] });
    void qc.invalidateQueries({ queryKey: ['user-listings'] });
  }
  if (offerId) {
    void qc.invalidateQueries({ queryKey: qk.offer(offerId) });
    void qc.invalidateQueries({ queryKey: qk.messages(offerId) });
  }
}

export function useMakeOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { targetId: string; itemIds: string[]; message: string }) => {
      const { data, error } = await supabase.rpc('make_offer', {
        p_target: v.targetId,
        p_items: v.itemIds,
        p_message: v.message || null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => invalidateTrade(qc, id, false),
  });
}

export type OfferAction = 'accept' | 'decline' | 'counter' | 'cancel';

export function useRespondOffer(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { action: OfferAction; itemIds?: string[] }) => {
      const { data, error } = await supabase.rpc('respond_offer', {
        p_offer: offerId,
        p_action: v.action,
        p_items: v.itemIds ?? null,
      });
      if (error) throw error;
      return data as OfferStatus;
    },
    onSettled: (_d, _e, v) => invalidateTrade(qc, offerId, v.action === 'accept' || v.action === 'cancel'),
  });
}

export function useConfirmTrade(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('confirm_trade', { p_offer: offerId });
      if (error) throw error;
      return data as OfferStatus;
    },
    onSettled: () => {
      invalidateTrade(qc, offerId);
      void qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useMessages(offerId: string | undefined) {
  return useQuery({
    queryKey: qk.messages(offerId ?? ''),
    enabled: !!offerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('offer_id', offerId!)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return data as Message[];
    },
  });
}

export function useSendMessage(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.rpc('send_message', { p_offer: offerId, p_body: body });
      if (error) throw error;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.messages(offerId) }),
  });
}

/** Live updates for one conversation: new messages and offer status changes. */
export function useOfferRealtime(offerId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!offerId) return;
    const channel = supabase
      .channel(`offer-${offerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `offer_id=eq.${offerId}` },
        (payload) => {
          qc.setQueryData<Message[]>(qk.messages(offerId), (old) => {
            const m = payload.new as Message;
            if (!old) return [m];
            return old.some((x) => x.id === m.id) ? old : [...old, m];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'offers', filter: `id=eq.${offerId}` },
        (payload) => {
          const status = (payload.new as { status?: OfferStatus }).status;
          invalidateTrade(qc, offerId, status === 'accepted' || status === 'completed' || status === 'cancelled');
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [offerId, qc]);
}

/** App-wide: refresh the inbox and badge when any of your offers change. */
export function useInboxRealtime() {
  const qc = useQueryClient();
  const uid = useUserId();
  useEffect(() => {
    if (!uid) return;
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: qk.offers });
      void qc.invalidateQueries({ queryKey: qk.pendingCount });
    };
    const channel = supabase
      .channel(`inbox-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `to_user=eq.${uid}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `from_user=eq.${uid}` }, refresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uid, qc]);
}

export function useMyRating(offerId: string | undefined) {
  const uid = useUserId();
  return useQuery({
    queryKey: qk.myRating(offerId ?? ''),
    enabled: !!offerId && !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ratings')
        .select('id,stars')
        .eq('offer_id', offerId!)
        .eq('rater_id', uid!)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; stars: number } | null;
    },
  });
}

export function useRateTrade(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { stars: number; comment: string }) => {
      const { error } = await supabase.rpc('rate_trade', {
        p_offer: offerId,
        p_stars: v.stars,
        p_comment: v.comment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.myRating(offerId) });
      void qc.invalidateQueries({ queryKey: ['ratings'] });
      void qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
