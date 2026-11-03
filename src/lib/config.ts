// Product constants. Server-side limits live in the app_config table and are
// enforced there; these values only shape the UI.
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

export const isSupabaseConfigured = env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;

export const limits = {
  maxPhotos: 4,
  maxOfferItems: 5,
  radiusOptionsKm: [1, 5, 10, 25],
  defaultRadiusKm: 5,
  pageSize: 30,
} as const;

export const categories = [
  { slug: 'electronics', label: 'Electronics', icon: 'phone-portrait-outline' },
  { slug: 'books', label: 'Books', icon: 'book-outline' },
  { slug: 'clothing', label: 'Clothing', icon: 'shirt-outline' },
  { slug: 'home', label: 'Home', icon: 'home-outline' },
  { slug: 'sports', label: 'Sports', icon: 'bicycle-outline' },
  { slug: 'toys', label: 'Toys & games', icon: 'game-controller-outline' },
  { slug: 'music', label: 'Music', icon: 'musical-notes-outline' },
  { slug: 'hobbies', label: 'Hobbies', icon: 'color-palette-outline' },
  { slug: 'tools', label: 'Tools', icon: 'hammer-outline' },
  { slug: 'other', label: 'Other', icon: 'cube-outline' },
] as const;

export type CategorySlug = (typeof categories)[number]['slug'];
export const categoryLabel = (slug: string) => categories.find((c) => c.slug === slug)?.label ?? 'Other';

export const conditions = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
] as const;
export const conditionLabel = (v: string) => conditions.find((c) => c.value === v)?.label ?? v;

export const safetyTips = [
  'Meet in a busy public place, like a mall, metro station or college gate, during the day.',
  'Check the item works before you swap. Ask to see it switched on or tried out.',
  'Keep chats in Swap so there is a record if something goes wrong.',
  'Never pay money, share OTPs or give out bank details. Swap is item for item.',
  'If something feels off, leave, then report or block the person.',
];
