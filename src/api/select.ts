// Explicit column lists: listings.lat/lng and profiles.is_suspended are not
// readable by clients, so `select('*')` on those tables would fail.
export const PROFILE_LITE = 'id,display_name,avatar_url,rating_avg,rating_count,trades_completed';
export const PROFILE_FULL = `${PROFILE_LITE},bio,city,onboarded,created_at`;
export const LISTING_COLS =
  'id,owner_id,title,description,category,condition,looking_for,photos,status,created_at,updated_at';
export const LISTING_LITE = 'id,owner_id,title,photos,status,condition';
export const OFFER_SELECT =
  `*,target:listings!target_listing_id(${LISTING_LITE}),` +
  `from_profile:profiles!from_user(${PROFILE_LITE}),` +
  `to_profile:profiles!to_user(${PROFILE_LITE}),` +
  `offer_items(listing:listings(${LISTING_LITE}))`;
