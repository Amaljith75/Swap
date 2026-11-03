import type { CategorySlug } from '@/lib/config';

export type ListingStatus = 'available' | 'reserved' | 'traded' | 'removed';
export type Condition = 'new' | 'like_new' | 'good' | 'fair';
export type OfferStatus = 'pending' | 'countered' | 'accepted' | 'completed' | 'declined' | 'cancelled';
export type ReportReason =
  | 'no_show'
  | 'not_as_described'
  | 'unsafe_behavior'
  | 'spam_or_scam'
  | 'prohibited_item'
  | 'other';

export interface ProfileLite {
  id: string;
  display_name: string;
  avatar_url: string | null;
  rating_avg: number | null;
  rating_count: number;
  trades_completed: number;
}

export interface Profile extends ProfileLite {
  bio: string | null;
  city: string | null;
  onboarded: boolean;
  created_at: string;
}

export interface Listing {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: CategorySlug;
  condition: Condition;
  looking_for: string;
  photos: string[];
  status: ListingStatus;
  created_at: string;
  updated_at: string;
}

export type ListingLite = Pick<Listing, 'id' | 'owner_id' | 'title' | 'photos' | 'status' | 'condition'>;

export interface ListingWithOwner extends Listing {
  owner: ProfileLite;
}

export interface NearbyListing {
  id: string;
  title: string;
  category: CategorySlug;
  condition: Condition;
  looking_for: string;
  photos: string[];
  created_at: string;
  owner_id: string;
  owner_name: string;
  owner_avatar: string | null;
  owner_rating: number | null;
  owner_trades: number;
  distance_km: number;
}

export interface Offer {
  id: string;
  target_listing_id: string;
  from_user: string;
  to_user: string;
  status: OfferStatus;
  awaiting_user: string | null;
  message: string | null;
  from_confirmed_at: string | null;
  to_confirmed_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  closed_at: string | null;
  chat_closes_at: string | null;
  created_at: string;
  updated_at: string;
  target: ListingLite;
  from_profile: ProfileLite;
  to_profile: ProfileLite;
  offer_items: { listing: ListingLite }[];
}

export interface Message {
  id: string;
  offer_id: string;
  sender_id: string | null;
  kind: 'text' | 'system';
  body: string;
  created_at: string;
}

export interface Rating {
  id: string;
  offer_id: string;
  rater_id: string;
  ratee_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  rater: Pick<ProfileLite, 'id' | 'display_name' | 'avatar_url'>;
}
