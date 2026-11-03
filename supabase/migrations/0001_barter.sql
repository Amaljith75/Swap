-- =====================================================================
-- Swap (barter) database: run this whole file once in the Supabase
-- SQL editor. If you ran the old cash/UPI schema before, run
-- supabase/reset_old_cash_schema.sql FIRST.
--
-- Security model:
--   * RLS on every table, default deny.
--   * Clients READ through RLS (and column grants).
--   * Every state change goes through a SECURITY DEFINER function below
--     that checks auth.uid(), ownership and the allowed transition.
--   * Exact locations are never stored: positions are snapped to a
--     ~500 m grid on the server, and the lat/lng columns are not
--     readable by clients. Distance comes back rounded.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type listing_status as enum ('available', 'reserved', 'traded', 'removed');
create type item_condition as enum ('new', 'like_new', 'good', 'fair');
create type offer_status as enum ('pending', 'countered', 'accepted', 'completed', 'declined', 'cancelled');
create type report_reason as enum ('no_show', 'not_as_described', 'unsafe_behavior', 'spam_or_scam', 'prohibited_item', 'other');
create type report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

-- ---------- helpers ----------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- config (tunable without an app update) ----------
create table app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into app_config (key, value) values
  ('chat_grace_seconds', '300'),        -- chat closes 5 min after a trade completes
  ('max_photos', '4'),
  ('max_active_listings', '30'),
  ('max_offer_items', '5'),
  ('offers_per_hour', '20'),
  ('messages_per_minute', '20'),
  ('max_radius_km', '50'),
  ('chat_block_contact_info', 'true');  -- block phone numbers / links in chat

create or replace function cfg_int(k text, fallback int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from app_config where key = k), fallback);
$$;

create or replace function cfg_bool(k text, fallback boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from app_config where key = k), fallback);
$$;

-- ---------- admins ----------
create table admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

-- ---------- profiles ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Swap user'
    check (char_length(btrim(display_name)) between 1 and 40),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  bio text check (bio is null or char_length(bio) <= 300),
  city text check (city is null or char_length(city) <= 60),
  rating_avg numeric(3, 2),
  rating_count int not null default 0,
  trades_completed int not null default 0,
  onboarded boolean not null default false,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- Profile text can't carry phone numbers/links, and the avatar must be the
-- user's own upload (no third-party tracking URLs).
create or replace function validate_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if has_contact_info(new.display_name) or has_contact_info(coalesce(new.bio, ''))
     or has_contact_info(coalesce(new.city, '')) then
    raise exception 'Phone numbers and links are not allowed in your profile.' using errcode = '22023';
  end if;
  if new.avatar_url is not null
     and (new.avatar_url not like new.id::text || '/%' or position('..' in new.avatar_url) > 0) then
    raise exception 'Invalid profile photo.' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger trg_profiles_validate before insert or update on profiles
  for each row execute function validate_profile();

-- A profile row is created server-side for every new account.
-- Email/phone stay in auth.users and are never exposed.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- blocks ----------
create table blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index idx_blocks_blocked on blocks (blocked_id);

create or replace function is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- Caller-relative version for RLS policies and client calls, so nobody can
-- ask about blocks between two other people.
create or replace function is_blocked_with(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_blocked_between(auth.uid(), other);
$$;

-- Phone numbers and links are kept out of chat, offer messages and profiles.
create or replace function has_contact_info(t text) returns boolean
language sql immutable as $$
  select coalesce(t ~ '(\+?\d[\d\s().-]{8,}\d)' or t ~* '(https?://|www\.|wa\.me)', false);
$$;

-- ---------- listings (items people want to swap) ----------
create table listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  category text not null check (category in
    ('electronics', 'books', 'clothing', 'home', 'sports', 'toys', 'music', 'hobbies', 'tools', 'other')),
  condition item_condition not null default 'good',
  looking_for text not null default '' check (char_length(looking_for) <= 200),
  photos text[] not null default '{}' check (cardinality(photos) <= 6),
  lat double precision check (lat between -90 and 90),     -- snapped, never exact
  lng double precision check (lng between -180 and 180),
  status listing_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_listings_updated before update on listings
  for each row execute function set_updated_at();
create index idx_listings_owner on listings (owner_id, status);
create index idx_listings_geo on listings (lat, lng) where status = 'available';
create index idx_listings_created on listings (created_at desc) where status = 'available';

-- ~550 m grid snap. Deterministic, so averaging many listings cannot
-- recover a more precise position than the grid cell.
create or replace function snap_coord(v double precision) returns double precision
language sql immutable as $$
  select round(v / 0.005) * 0.005;
$$;

create or replace function distance_km(lat1 double precision, lng1 double precision,
                                       lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Distances are shown rounded to 0.5 km, never below 0.5.
create or replace function display_distance(d double precision) returns numeric
language sql immutable as $$
  select greatest(0.5, round((d * 2)::numeric) / 2);
$$;

-- ---------- offers ----------
-- from_user offers one or more of their items (offer_items) for to_user's target listing.
-- awaiting_user is whoever must act next (accept / decline / counter).
create table offers (
  id uuid primary key default gen_random_uuid(),
  target_listing_id uuid not null references listings(id) on delete cascade,
  from_user uuid not null references profiles(id) on delete cascade,
  to_user uuid not null references profiles(id) on delete cascade,
  status offer_status not null default 'pending',
  awaiting_user uuid references profiles(id) on delete set null,
  message text check (message is null or char_length(message) <= 300),
  from_confirmed_at timestamptz,
  to_confirmed_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  chat_closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create trigger trg_offers_updated before update on offers
  for each row execute function set_updated_at();
create index idx_offers_from on offers (from_user, status);
create index idx_offers_to on offers (to_user, status);
create index idx_offers_target on offers (target_listing_id);
create index idx_offers_awaiting on offers (awaiting_user) where status in ('pending', 'countered');
-- One open offer per person per item.
create unique index uq_open_offer on offers (target_listing_id, from_user)
  where status in ('pending', 'countered', 'accepted');

create table offer_items (
  offer_id uuid not null references offers(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  primary key (offer_id, listing_id)
);
create index idx_offer_items_listing on offer_items (listing_id);

-- ---------- chat ----------
create table messages (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,  -- null for system messages
  kind text not null default 'text' check (kind in ('text', 'system')),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index idx_messages_offer on messages (offer_id, created_at);
create index idx_messages_sender on messages (sender_id, created_at desc);

-- ---------- ratings ----------
create table ratings (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  rater_id uuid not null references profiles(id) on delete cascade,
  ratee_id uuid not null references profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  unique (offer_id, rater_id),
  check (rater_id <> ratee_id)
);
create index idx_ratings_ratee on ratings (ratee_id, created_at desc);

-- ---------- reports ----------
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  reported_user_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  offer_id uuid references offers(id) on delete set null,
  reason report_reason not null,
  details text check (details is null or char_length(details) <= 1000),
  status report_status not null default 'open',
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);
create trigger trg_reports_updated before update on reports
  for each row execute function set_updated_at();
create index idx_reports_status on reports (status, created_at);

-- =====================================================================
-- Internal helpers
-- =====================================================================

create or replace function require_user() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in to continue.' using errcode = '28000';
  end if;
  if exists (select 1 from profiles where id = v_uid and is_suspended) then
    raise exception 'Your account is suspended. Contact support.' using errcode = '42501';
  end if;
  return v_uid;
end $$;

create or replace function post_system_message(p_offer uuid, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into messages (offer_id, sender_id, kind, body) values (p_offer, null, 'system', p_body);
$$;

create or replace function display_name_of(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select display_name from profiles where id = p_user), 'Someone');
$$;

-- Close open (pending/countered) offers that involve any of the given listings,
-- except p_keep. Used when items are traded, removed, or users block each other.
create or replace function close_open_offers_for_listings(p_listings uuid[], p_keep uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in
    select o.id
    from offers o
    where o.status in ('pending', 'countered')
      and o.id is distinct from p_keep
      and (o.target_listing_id = any(p_listings)
           or exists (select 1 from offer_items oi where oi.offer_id = o.id and oi.listing_id = any(p_listings)))
    order by o.id
    for update of o
  loop
    -- Re-check under the lock: a concurrent accept may have changed it.
    update offers set status = 'declined', awaiting_user = null, closed_at = now()
    where id = r.id and status in ('pending', 'countered');
    if found then
      perform post_system_message(r.id, p_reason);
    end if;
  end loop;
end $$;

-- =====================================================================
-- Listings API
-- =====================================================================

create or replace function validate_photos(p_uid uuid, p_photos text[]) returns void
language plpgsql immutable as $$
declare
  p text;
begin
  if p_photos is null or cardinality(p_photos) < 1 then
    raise exception 'Add at least one photo.' using errcode = '22023';
  end if;
  foreach p in array p_photos loop
    if p not like p_uid::text || '/%' or position('..' in p) > 0 or char_length(p) > 300 then
      raise exception 'Invalid photo.' using errcode = '22023';
    end if;
  end loop;
end $$;

create or replace function create_listing(
  p_title text, p_description text, p_category text, p_condition item_condition,
  p_looking_for text, p_photos text[], p_lat double precision, p_lng double precision
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
  v_id uuid;
begin
  if (select count(*) from listings where owner_id = v_uid and status in ('available', 'reserved'))
       >= cfg_int('max_active_listings', 30) then
    raise exception 'You have too many active items. Remove one first.' using errcode = '22023';
  end if;
  if cardinality(p_photos) > cfg_int('max_photos', 4) then
    raise exception 'Too many photos.' using errcode = '22023';
  end if;
  perform validate_photos(v_uid, p_photos);
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Location is needed to list an item.' using errcode = '22023';
  end if;

  insert into listings (owner_id, title, description, category, condition, looking_for, photos, lat, lng)
  values (v_uid, btrim(p_title), btrim(coalesce(p_description, '')), p_category, p_condition,
          btrim(coalesce(p_looking_for, '')), p_photos, snap_coord(p_lat), snap_coord(p_lng))
  returning id into v_id;
  return v_id;
end $$;

create or replace function update_listing(
  p_id uuid, p_title text, p_description text, p_category text, p_condition item_condition,
  p_looking_for text, p_photos text[]
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
  v_status listing_status;
begin
  select status into v_status from listings where id = p_id and owner_id = v_uid for update;
  if not found then
    raise exception 'Item not found.' using errcode = 'P0002';
  end if;
  if v_status <> 'available' then
    raise exception 'Only available items can be edited.' using errcode = '22023';
  end if;
  if cardinality(p_photos) > cfg_int('max_photos', 4) then
    raise exception 'Too many photos.' using errcode = '22023';
  end if;
  perform validate_photos(v_uid, p_photos);
  update listings set
    title = btrim(p_title),
    description = btrim(coalesce(p_description, '')),
    category = p_category,
    condition = p_condition,
    looking_for = btrim(coalesce(p_looking_for, '')),
    photos = p_photos
  where id = p_id;
  -- Nobody should accept a version of an item they didn't see.
  perform close_open_offers_for_listings(array[p_id], null,
    'This offer closed because one of the items was edited. Make a new offer if you are still interested.');
end $$;

create or replace function remove_listing(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
  v_status listing_status;
begin
  select status into v_status from listings where id = p_id and owner_id = v_uid for update;
  if not found then
    raise exception 'Item not found.' using errcode = 'P0002';
  end if;
  if v_status = 'reserved' then
    raise exception 'This item is in an accepted trade. Cancel the trade first.' using errcode = '22023';
  end if;
  if v_status <> 'available' then
    return;
  end if;
  update listings set status = 'removed' where id = p_id;
  perform close_open_offers_for_listings(array[p_id], null, 'This offer closed because an item was removed.');
end $$;

-- Nearby available items, nearest first. The caller's position is used
-- only for this query and is not stored.
create or replace function nearby_listings(
  p_lat double precision, p_lng double precision, p_radius_km double precision,
  p_category text default null, p_query text default null,
  p_limit int default 30, p_offset int default 0
) returns table (
  id uuid, title text, category text, condition item_condition, looking_for text,
  photos text[], created_at timestamptz, owner_id uuid, owner_name text,
  owner_avatar text, owner_rating numeric, owner_trades int, distance_km numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
  -- Radius is limited to fixed steps and the search point is snapped to the same
  -- grid as listings, so repeated queries can't triangulate a listing's cell more
  -- finely than the ~550 m grid itself.
  v_r double precision := (select min(x) from unnest(array[1, 2, 5, 10, 25, 50]) x
                           where x >= least(coalesce(p_radius_km, 5), cfg_int('max_radius_km', 50)));
  v_dlat double precision;
  v_dlng double precision;
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if p_lat is null or p_lng is null then
    raise exception 'Location is needed to find nearby items.' using errcode = '22023';
  end if;
  v_r := coalesce(v_r, 50);
  v_dlat := v_r / 111.0;
  p_lat := snap_coord(p_lat);
  p_lng := snap_coord(p_lng);
  v_dlng := v_r / greatest(111.0 * cos(radians(p_lat)), 1.0);
  if v_q is not null then
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select l.id, l.title, l.category, l.condition, l.looking_for, l.photos, l.created_at,
         l.owner_id, p.display_name, p.avatar_url, p.rating_avg, p.trades_completed,
         display_distance(distance_km(p_lat, p_lng, l.lat, l.lng))
  from listings l
  join profiles p on p.id = l.owner_id
  where l.status = 'available'
    and l.owner_id <> v_uid
    and not p.is_suspended
    and l.lat between p_lat - v_dlat and p_lat + v_dlat
    and l.lng between p_lng - v_dlng and p_lng + v_dlng
    and display_distance(distance_km(p_lat, p_lng, l.lat, l.lng)) <= v_r
    and (p_category is null or l.category = p_category)
    and (v_q is null or l.title ilike v_q or l.looking_for ilike v_q or l.description ilike v_q)
    and not is_blocked_between(v_uid, l.owner_id)
  order by distance_km(p_lat, p_lng, l.lat, l.lng), l.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- Rounded distance to one item the caller is allowed to see.
create or replace function listing_distance(p_id uuid, p_lat double precision, p_lng double precision)
returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
  v_lat double precision;
  v_lng double precision;
begin
  if p_lat is null or p_lng is null then
    return null;
  end if;
  select l.lat, l.lng into v_lat, v_lng
  from listings l
  where l.id = p_id
    and (l.owner_id = v_uid or l.status = 'available')
    and not is_blocked_between(v_uid, l.owner_id);
  if v_lat is null then
    return null;
  end if;
  return display_distance(distance_km(snap_coord(p_lat), snap_coord(p_lng), v_lat, v_lng));
end $$;

-- =====================================================================
-- Offers API
-- =====================================================================

create or replace function validate_offer_items(p_owner uuid, p_target uuid, p_items uuid[]) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare
  v_items uuid[];
begin
  select array_agg(distinct x) into v_items from unnest(p_items) as x where x is not null;
  if v_items is null or cardinality(v_items) < 1 then
    raise exception 'Pick at least one item to offer.' using errcode = '22023';
  end if;
  if cardinality(v_items) > cfg_int('max_offer_items', 5) then
    raise exception 'Too many items in one offer.' using errcode = '22023';
  end if;
  if p_target = any(v_items) then
    raise exception 'An item cannot be offered for itself.' using errcode = '22023';
  end if;
  if (select count(*) from listings
      where id = any(v_items) and owner_id = p_owner and status = 'available') <> cardinality(v_items) then
    raise exception 'Some of those items are no longer available.' using errcode = '22023';
  end if;
  return v_items;
end $$;

create or replace function make_offer(p_target uuid, p_items uuid[], p_message text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
  v_owner uuid;
  v_items uuid[];
  v_id uuid;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
begin
  select l.owner_id into v_owner
  from listings l join profiles p on p.id = l.owner_id
  where l.id = p_target and l.status = 'available' and not p.is_suspended;
  if v_owner is null then
    raise exception 'This item is no longer available.' using errcode = 'P0002';
  end if;
  if v_owner = v_uid then
    raise exception 'You cannot make an offer on your own item.' using errcode = '22023';
  end if;
  if is_blocked_between(v_uid, v_owner) then
    raise exception 'You cannot make an offer to this person.' using errcode = '42501';
  end if;
  if exists (select 1 from offers where target_listing_id = p_target and from_user = v_uid
             and status in ('pending', 'countered', 'accepted')) then
    raise exception 'You already have an open offer on this item.' using errcode = '23505';
  end if;
  if (select count(*) from offers where from_user = v_uid and created_at > now() - interval '1 hour')
       >= cfg_int('offers_per_hour', 20) then
    raise exception 'Too many offers in a short time. Try again later.' using errcode = '22023';
  end if;
  if v_msg is not null and char_length(v_msg) > 300 then
    raise exception 'Message is too long.' using errcode = '22023';
  end if;
  if v_msg is not null and cfg_bool('chat_block_contact_info', true) and has_contact_info(v_msg) then
    raise exception 'For your safety, phone numbers and links can''t be shared. Arrange the meetup in the chat.'
      using errcode = '22023';
  end if;

  v_items := validate_offer_items(v_uid, p_target, p_items);

  insert into offers (target_listing_id, from_user, to_user, status, awaiting_user, message)
  values (p_target, v_uid, v_owner, 'pending', v_owner, v_msg)
  returning id into v_id;
  insert into offer_items (offer_id, listing_id) select v_id, unnest(v_items);

  perform post_system_message(v_id, display_name_of(v_uid) || ' made an offer.');
  if v_msg is not null then
    insert into messages (offer_id, sender_id, kind, body) values (v_id, v_uid, 'text', v_msg);
  end if;
  return v_id;
end $$;

-- p_action: 'accept' | 'decline' | 'counter' | 'cancel'
-- 'counter' replaces the offered items (always items owned by the offerer)
-- and hands the turn to the other person.
create or replace function respond_offer(p_offer uuid, p_action text, p_items uuid[] default null)
returns offer_status
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
  o offers%rowtype;
  v_all uuid[];
  v_items uuid[];
  v_other uuid;
begin
  select * into o from offers where id = p_offer for update;
  if not found or v_uid not in (o.from_user, o.to_user) then
    raise exception 'Offer not found.' using errcode = 'P0002';
  end if;
  v_other := case when v_uid = o.from_user then o.to_user else o.from_user end;

  if p_action = 'accept' then
    if o.status not in ('pending', 'countered') or o.awaiting_user is distinct from v_uid then
      raise exception 'This offer is not waiting for you.' using errcode = '22023';
    end if;
    if is_blocked_between(o.from_user, o.to_user) then
      raise exception 'This trade is no longer possible.' using errcode = '42501';
    end if;
    select array_agg(listing_id) into v_all from offer_items where offer_id = o.id;
    v_all := v_all || o.target_listing_id;
    perform 1 from listings where id = any(v_all) for update;
    if (select count(*) from listings where id = any(v_all) and status = 'available') <> cardinality(v_all)
       or not exists (select 1 from listings where id = o.target_listing_id and owner_id = o.to_user)
       or exists (select 1 from offer_items oi join listings l on l.id = oi.listing_id
                  where oi.offer_id = o.id and l.owner_id <> o.from_user) then
      raise exception 'Some items in this offer are no longer available.' using errcode = '22023';
    end if;
    update listings set status = 'reserved' where id = any(v_all);
    update offers set status = 'accepted', awaiting_user = null, accepted_at = now() where id = o.id;
    perform post_system_message(o.id,
      display_name_of(v_uid) || ' accepted. Agree on a busy public place and a time to meet. '
      || 'Check the items before you swap, then both tap "We swapped".');
    return 'accepted';

  elsif p_action = 'decline' then
    -- The item owner can decline at any point (even after countering);
    -- the offerer can decline a counter-offer when it's their turn.
    if o.status not in ('pending', 'countered')
       or (v_uid <> o.to_user and o.awaiting_user is distinct from v_uid) then
      raise exception 'This offer is not waiting for you.' using errcode = '22023';
    end if;
    update offers set status = 'declined', awaiting_user = null, closed_at = now() where id = o.id;
    perform post_system_message(o.id, display_name_of(v_uid) || ' declined.');
    return 'declined';

  elsif p_action = 'counter' then
    if o.status not in ('pending', 'countered') or o.awaiting_user is distinct from v_uid then
      raise exception 'This offer is not waiting for you.' using errcode = '22023';
    end if;
    v_items := validate_offer_items(o.from_user, o.target_listing_id, p_items);
    delete from offer_items where offer_id = o.id;
    insert into offer_items (offer_id, listing_id) select o.id, unnest(v_items);
    update offers set status = 'countered', awaiting_user = v_other where id = o.id;
    perform post_system_message(o.id,
      case when v_uid = o.to_user
        then display_name_of(v_uid) || ' asked for different items.'
        else display_name_of(v_uid) || ' changed the offer.' end);
    return 'countered';

  elsif p_action = 'cancel' then
    if o.status in ('pending', 'countered') then
      if v_uid <> o.from_user then
        raise exception 'Use decline instead.' using errcode = '22023';
      end if;
      update offers set status = 'cancelled', awaiting_user = null, closed_at = now() where id = o.id;
      perform post_system_message(o.id, display_name_of(v_uid) || ' withdrew the offer.');
      return 'cancelled';
    elsif o.status = 'accepted' then
      select array_agg(listing_id) into v_all from offer_items where offer_id = o.id;
      v_all := v_all || o.target_listing_id;
      update listings set status = 'available' where id = any(v_all) and status = 'reserved';
      update offers set status = 'cancelled', closed_at = now(),
        from_confirmed_at = null, to_confirmed_at = null where id = o.id;
      perform post_system_message(o.id, display_name_of(v_uid) || ' cancelled the trade. The items are available again.');
      return 'cancelled';
    else
      raise exception 'This offer is already closed.' using errcode = '22023';
    end if;

  else
    raise exception 'Unknown action.' using errcode = '22023';
  end if;
end $$;

-- Both people must confirm. Neither can complete the trade for the other.
create or replace function confirm_trade(p_offer uuid) returns offer_status
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
  o offers%rowtype;
  v_all uuid[];
begin
  select * into o from offers where id = p_offer for update;
  if not found or v_uid not in (o.from_user, o.to_user) then
    raise exception 'Offer not found.' using errcode = 'P0002';
  end if;
  if o.status = 'completed' then
    return 'completed';
  end if;
  if o.status <> 'accepted' then
    raise exception 'Only accepted trades can be confirmed.' using errcode = '22023';
  end if;

  if v_uid = o.from_user then
    update offers set from_confirmed_at = coalesce(from_confirmed_at, now()) where id = o.id
      returning * into o;
  else
    update offers set to_confirmed_at = coalesce(to_confirmed_at, now()) where id = o.id
      returning * into o;
  end if;

  if o.from_confirmed_at is null or o.to_confirmed_at is null then
    perform post_system_message(o.id, display_name_of(v_uid) || ' confirmed the swap. Waiting for the other person.');
    return 'accepted';
  end if;

  select array_agg(listing_id) into v_all from offer_items where offer_id = o.id;
  v_all := v_all || o.target_listing_id;
  update listings set status = 'traded' where id = any(v_all);
  update offers set status = 'completed', completed_at = now(),
    chat_closes_at = now() + make_interval(secs => cfg_int('chat_grace_seconds', 300))
  where id = o.id;
  update profiles set trades_completed = trades_completed + 1 where id in (o.from_user, o.to_user);
  perform post_system_message(o.id, 'Swap complete. This chat closes in 5 minutes. You can rate each other any time.');
  perform close_open_offers_for_listings(v_all, o.id, 'This offer closed because an item was swapped with someone else.');
  return 'completed';
end $$;

-- =====================================================================
-- Chat
-- =====================================================================

create or replace function send_message(p_offer uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
  o offers%rowtype;
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  select * into o from offers where id = p_offer;
  if not found or v_uid not in (o.from_user, o.to_user) then
    raise exception 'Chat not found.' using errcode = 'P0002';
  end if;
  if o.status in ('declined', 'cancelled')
     or (o.status = 'completed' and (o.chat_closes_at is null or now() >= o.chat_closes_at)) then
    raise exception 'This chat is closed.' using errcode = '22023';
  end if;
  if is_blocked_between(o.from_user, o.to_user) then
    raise exception 'This chat is closed.' using errcode = '42501';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 500 then
    raise exception 'Messages must be 1 to 500 characters.' using errcode = '22023';
  end if;
  if cfg_bool('chat_block_contact_info', true) and has_contact_info(v_body) then
    raise exception 'For your safety, phone numbers and links can''t be shared. Arrange the meetup here.'
      using errcode = '22023';
  end if;
  if (select count(*) from messages where sender_id = v_uid and created_at > now() - interval '1 minute')
       >= cfg_int('messages_per_minute', 20) then
    raise exception 'You are sending messages too fast.' using errcode = '22023';
  end if;
  insert into messages (offer_id, sender_id, kind, body) values (o.id, v_uid, 'text', v_body)
  returning id into v_id;
  return v_id;
end $$;

-- =====================================================================
-- Ratings, blocks
-- =====================================================================

create or replace function rate_trade(p_offer uuid, p_stars int, p_comment text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
  o offers%rowtype;
  v_ratee uuid;
begin
  select * into o from offers where id = p_offer;
  if not found or v_uid not in (o.from_user, o.to_user) then
    raise exception 'Trade not found.' using errcode = 'P0002';
  end if;
  if o.status <> 'completed' then
    raise exception 'You can rate only completed swaps.' using errcode = '22023';
  end if;
  if p_stars not between 1 and 5 then
    raise exception 'Pick 1 to 5 stars.' using errcode = '22023';
  end if;
  v_ratee := case when v_uid = o.from_user then o.to_user else o.from_user end;
  perform 1 from profiles where id = v_ratee for update;  -- serialize aggregate updates
  begin
    insert into ratings (offer_id, rater_id, ratee_id, stars, comment)
    values (o.id, v_uid, v_ratee, p_stars, nullif(btrim(coalesce(p_comment, '')), ''));
  exception when unique_violation then
    raise exception 'You already rated this swap.' using errcode = '23505';
  end;
  update profiles p set
    rating_count = s.cnt,
    rating_avg = s.avg
  -- Only each person's latest rating counts, so swapping repeatedly with the
  -- same (or a second) account can't pump someone's score.
  from (select count(*)::int as cnt, round(avg(stars)::numeric, 2) as avg
        from (select distinct on (rater_id) stars from ratings
              where ratee_id = v_ratee order by rater_id, created_at desc) latest) s
  where p.id = v_ratee;
end $$;

create or replace function block_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null then
    raise exception 'Sign in to continue.' using errcode = '28000';
  end if;
  if p_user is null or p_user = v_uid or not exists (select 1 from profiles where id = p_user) then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
  insert into blocks (blocker_id, blocked_id) values (v_uid, p_user) on conflict do nothing;

  -- Close everything open between the two people.
  for r in
    select id, status from offers
    where status in ('pending', 'countered', 'accepted')
      and ((from_user = v_uid and to_user = p_user) or (from_user = p_user and to_user = v_uid))
    for update
  loop
    if r.status = 'accepted' then
      update listings set status = 'available'
      where status = 'reserved'
        and (id = (select target_listing_id from offers where id = r.id)
             or id in (select listing_id from offer_items where offer_id = r.id));
      update offers set status = 'cancelled', closed_at = now() where id = r.id;
    else
      update offers set status = 'declined', awaiting_user = null, closed_at = now() where id = r.id;
    end if;
    perform post_system_message(r.id, 'This conversation was closed.');
  end loop;
end $$;

create or replace function unblock_user(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from blocks where blocker_id = auth.uid() and blocked_id = p_user;
$$;

-- Count of offers waiting for the caller (badge on the Offers tab).
create or replace function my_pending_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from offers
  where awaiting_user = auth.uid() and status in ('pending', 'countered');
$$;

-- =====================================================================
-- Row Level Security + grants
-- =====================================================================

alter table app_config enable row level security;
alter table admin_users enable row level security;
alter table profiles enable row level security;
alter table blocks enable row level security;
alter table listings enable row level security;
alter table offers enable row level security;
alter table offer_items enable row level security;
alter table messages enable row level security;
alter table ratings enable row level security;
alter table reports enable row level security;

-- Start from nothing, then grant exactly what clients need.
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon;

grant select on app_config to authenticated;
create policy config_read on app_config for select to authenticated using (true);

-- Profiles: public fields readable by signed-in users; only own row editable,
-- and only these columns. Ratings, counts and suspension are server-only.
grant select (id, display_name, avatar_url, bio, city, rating_avg, rating_count,
              trades_completed, onboarded, created_at, updated_at) on profiles to authenticated;
grant update (display_name, avatar_url, bio, city, onboarded) on profiles to authenticated;
create policy profiles_read on profiles for select to authenticated using (true);
create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Blocks: users see and remove their own (adding goes through block_user).
grant select, delete on blocks to authenticated;
create policy blocks_own_read on blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_own_delete on blocks for delete to authenticated using (blocker_id = auth.uid());

-- Listings: lat/lng are NOT granted. Readable when available (and no block),
-- when it's yours, or when it is part of an offer you are in.
grant select (id, owner_id, title, description, category, condition, looking_for, photos,
              status, created_at, updated_at) on listings to authenticated;
create policy listings_read on listings for select to authenticated using (
  owner_id = auth.uid()
  or (status = 'available' and not is_blocked_with(owner_id))
  or exists (
    select 1 from offers o
    where (o.from_user = auth.uid() or o.to_user = auth.uid())
      and (o.target_listing_id = listings.id
           or exists (select 1 from offer_items oi where oi.offer_id = o.id and oi.listing_id = listings.id))
  )
);

grant select on offers to authenticated;
create policy offers_read on offers for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid() or is_admin());

grant select on offer_items to authenticated;
create policy offer_items_read on offer_items for select to authenticated using (
  exists (select 1 from offers o where o.id = offer_id
          and (o.from_user = auth.uid() or o.to_user = auth.uid() or is_admin()))
);

grant select on messages to authenticated;
create policy messages_read on messages for select to authenticated using (
  exists (select 1 from offers o where o.id = offer_id
          and (o.from_user = auth.uid() or o.to_user = auth.uid() or is_admin()))
);

grant select on ratings to authenticated;
create policy ratings_read on ratings for select to authenticated using (true);

grant select, insert (reported_user_id, listing_id, offer_id, reason, details, reporter_id)
  on reports to authenticated;
create policy reports_insert_own on reports for insert to authenticated
  with check (reporter_id = auth.uid() and reported_user_id <> auth.uid());
create policy reports_read on reports for select to authenticated
  using (reporter_id = auth.uid() or is_admin());

grant execute on function
  create_listing(text, text, text, item_condition, text, text[], double precision, double precision),
  update_listing(uuid, text, text, text, item_condition, text, text[]),
  remove_listing(uuid),
  nearby_listings(double precision, double precision, double precision, text, text, int, int),
  listing_distance(uuid, double precision, double precision),
  make_offer(uuid, uuid[], text),
  respond_offer(uuid, text, uuid[]),
  confirm_trade(uuid),
  send_message(uuid, text),
  rate_trade(uuid, int, text),
  block_user(uuid),
  unblock_user(uuid),
  my_pending_count(),
  is_blocked_with(uuid),
  is_admin()
to authenticated;

-- Internal helpers stay private (only callable from the functions above).
revoke execute on function
  post_system_message(uuid, text),
  close_open_offers_for_listings(uuid[], uuid, text),
  require_user(),
  validate_offer_items(uuid, uuid, uuid[]),
  cfg_int(text, int),
  cfg_bool(text, boolean),
  display_name_of(uuid),
  is_blocked_between(uuid, uuid),
  validate_photos(uuid, text[]),
  snap_coord(double precision),
  distance_km(double precision, double precision, double precision, double precision),
  display_distance(double precision),
  has_contact_info(text),
  set_updated_at(),
  handle_new_user(),
  validate_profile()
from authenticated;

-- =====================================================================
-- Realtime (RLS still applies to what each user receives)
-- =====================================================================
alter publication supabase_realtime add table messages, offers;

-- =====================================================================
-- Photo storage: public bucket for item photos and avatars.
-- Users can upload only into their own folder: <user id>/...
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_select_own on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_update_own on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
