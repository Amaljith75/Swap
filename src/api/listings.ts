import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { limits } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/store/session';
import type { Condition, Listing, ListingWithOwner, NearbyListing } from '@/types/db';
import { qk } from './keys';
import { LISTING_COLS, PROFILE_LITE } from './select';

export interface NearbyParams {
  lat: number;
  lng: number;
  radiusKm: number;
  category: string | null;
  query: string;
}

export function useNearby(p: NearbyParams | null) {
  return useInfiniteQuery({
    queryKey: qk.nearby(p ?? {}),
    enabled: !!p,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('nearby_listings', {
        p_lat: p!.lat,
        p_lng: p!.lng,
        p_radius_km: p!.radiusKm,
        p_category: p!.category,
        p_query: p!.query || null,
        p_limit: limits.pageSize,
        p_offset: pageParam,
      });
      if (error) throw error;
      return (data ?? []) as NearbyListing[];
    },
    getNextPageParam: (last, all) =>
      last.length < limits.pageSize ? undefined : all.reduce((n, page) => n + page.length, 0),
  });
}

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: qk.listing(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(`${LISTING_COLS},owner:profiles!owner_id(${PROFILE_LITE})`)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ListingWithOwner | null;
    },
  });
}

export function useListingDistance(id: string | undefined, coords: { lat: number; lng: number } | null) {
  return useQuery({
    queryKey: [...qk.listingDistance(id ?? ''), coords?.lat, coords?.lng],
    enabled: !!id && !!coords,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listing_distance', {
        p_id: id!,
        p_lat: coords!.lat,
        p_lng: coords!.lng,
      });
      if (error) throw error;
      return data as number | null;
    },
  });
}

/** Your own items. `onlyAvailable` is used when picking items to offer. */
export function useMyListings(onlyAvailable = false) {
  const uid = useUserId();
  return useQuery({
    queryKey: [...qk.myListings, onlyAvailable],
    enabled: !!uid,
    queryFn: async () => {
      let q = supabase.from('listings').select(LISTING_COLS).eq('owner_id', uid!);
      q = onlyAvailable ? q.eq('status', 'available') : q.neq('status', 'removed');
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return data as Listing[];
    },
  });
}

/** Someone's available items (their public profile, or picking items for a counter-offer). */
export function useUserListings(userId: string | undefined) {
  return useQuery({
    queryKey: qk.userListings(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(LISTING_COLS)
        .eq('owner_id', userId!)
        .eq('status', 'available')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Listing[];
    },
  });
}

export interface ListingInput {
  title: string;
  description: string;
  category: string;
  condition: Condition;
  looking_for: string;
  photos: string[];
}

function invalidateListings(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: qk.myListings });
  void qc.invalidateQueries({ queryKey: ['nearby'] });
  void qc.invalidateQueries({ queryKey: ['listing'] });
  void qc.invalidateQueries({ queryKey: ['user-listings'] });
}

export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: ListingInput & { lat: number; lng: number }) => {
      const { data, error } = await supabase.rpc('create_listing', {
        p_title: v.title,
        p_description: v.description,
        p_category: v.category,
        p_condition: v.condition,
        p_looking_for: v.looking_for,
        p_photos: v.photos,
        p_lat: v.lat,
        p_lng: v.lng,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidateListings(qc),
  });
}

export function useUpdateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: ListingInput & { id: string }) => {
      const { error } = await supabase.rpc('update_listing', {
        p_id: v.id,
        p_title: v.title,
        p_description: v.description,
        p_category: v.category,
        p_condition: v.condition,
        p_looking_for: v.looking_for,
        p_photos: v.photos,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateListings(qc),
  });
}

export function useRemoveListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('remove_listing', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateListings(qc);
      void qc.invalidateQueries({ queryKey: qk.offers });
    },
  });
}

/** The item's rounded (~500 m) position, for the "approximate area" map. */
export function useListingArea(id: string | undefined) {
  return useQuery({
    queryKey: ['listing-area', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listing_area', { p_id: id! });
      if (error) throw error;
      const row = (data as { lat: number; lng: number }[] | null)?.[0];
      return row ?? null;
    },
  });
}

export function useMoveListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; lat: number; lng: number }) => {
      const { error } = await supabase.rpc('move_listing', { p_id: v.id, p_lat: v.lat, p_lng: v.lng });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateListings(qc);
      void qc.invalidateQueries({ queryKey: ['listing-area'] });
    },
  });
}
