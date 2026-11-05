// Product constants. Server-side limits live in the app_config table and are
// enforced there; these values only shape the UI.
// The anon key is public by design: it ships inside every APK, and the database's
// row-level security is what protects data. Never put the service_role key here.
// EXPO_PUBLIC_* env vars (or GitHub secrets in the build) override these defaults.
const DEFAULT_SUPABASE_URL = 'https://vwkaohiukqmotwesdqvi.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3a2FvaGl1a3Ftb3R3ZXNkcXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMDU0NzUsImV4cCI6MjEwNjg4MTQ3NX0.ke2fcG5Mytp7rxmutoIAEQMBHmAo04DhnAqBvbumEu0';

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
};

export const isSupabaseConfigured = env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;

// Public web pages (GitHub Pages, from the docs/ folder of the repo).
// EXPO_PUBLIC_SITE_URL overrides this if the pages move to your own domain.
const SITE = (process.env.EXPO_PUBLIC_SITE_URL || 'https://amaljith75.github.io/swap').replace(/\/$/, '');
export const links = {
  /** Landing page; also where "confirm your email" links end up. */
  site: `${SITE}/`,
  privacy: `${SITE}/privacy.html`,
  terms: `${SITE}/terms.html`,
  deleteAccount: `${SITE}/delete-account.html`,
  /** Where password-reset emails send people (must be in Supabase Auth > URL Configuration > Redirect URLs). */
  resetPassword: `${SITE}/reset-password.html`,
};

/** Bump when the Terms or Privacy Policy change in a way people must agree to again. */
export const TERMS_VERSION = 1;
/** Minimum age to use Swap. */
export const MIN_AGE = 18;
/** Minimum password length for new passwords (also set this in Supabase Auth settings). */
export const MIN_PASSWORD = 8;

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
