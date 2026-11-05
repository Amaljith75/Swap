-- =====================================================================
-- 1. Moderation: admins get a push for every new report, and can review
--    reports, remove items and suspend people from the app.
-- 2. Rate limits on reports and nearby search.
-- 3. App error log (so crashes in the field can be fixed). Kept 90 days.
-- 4. Storage cleanup helpers for the nightly maintenance job.
-- 5. Faster row-level security: auth.uid() evaluated once per query.
-- =====================================================================

-- ---------- rate limiting helper ----------
create table if not exists rate_hits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (user_id, bucket, window_start)
);
alter table rate_hits enable row level security;  -- server only

-- Counts one hit for the caller in the current window; false once the limit is reached.
create or replace function hit_rate_limit(p_bucket text, p_max int, p_window interval) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_start timestamptz := date_bin(p_window, now(), timestamptz '2000-01-01');
  v_hits int;
begin
  if v_uid is null then
    return true;
  end if;
  insert into rate_hits (user_id, bucket, window_start, hits) values (v_uid, p_bucket, v_start, 1)
  on conflict (user_id, bucket, window_start) do update set hits = rate_hits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

insert into app_config (key, value) values
  ('reports_per_day', '10'),
  ('nearby_searches_per_10min', '120')
on conflict (key) do nothing;

-- ---------- 1 + 2. reports ----------
create or replace function check_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day')
       >= cfg_int('reports_per_day', 10) then
    raise exception 'You have sent a lot of reports today. Please try again tomorrow.' using errcode = '22023';
  end if;
  if exists (select 1 from reports
             where reporter_id = new.reporter_id and reported_user_id = new.reported_user_id
               and listing_id is not distinct from new.listing_id
               and offer_id is not distinct from new.offer_id
               and status in ('open', 'reviewing')) then
    raise exception 'You already reported this. We will look at it.' using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists trg_reports_check on reports;
create trigger trg_reports_check before insert on reports
  for each row execute function check_report();

create or replace function notify_admins_on_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a record;
begin
  for a in select user_id from admin_users loop
    perform enqueue_notification(a.user_id, 'New report: ' || replace(new.reason::text, '_', ' '),
      display_name_of(new.reporter_id) || ' reported ' || display_name_of(new.reported_user_id) || '. Tap to review.',
      jsonb_build_object('type', 'report', 'report_id', new.id));
  end loop;
  return new;
end $$;
drop trigger if exists trg_reports_notify on reports;
create trigger trg_reports_notify after insert on reports
  for each row execute function notify_admins_on_report();

create or replace function require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create or replace function admin_reports(p_status text default 'open')
returns table (
  id uuid, created_at timestamptz, status report_status, reason report_reason, details text,
  reporter_id uuid, reporter_name text, reported_user_id uuid, reported_name text,
  reported_suspended boolean, reported_open_reports int,
  listing_id uuid, listing_title text, listing_status listing_status, listing_photo text, offer_id uuid
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return query
  select r.id, r.created_at, r.status, r.reason, r.details,
         r.reporter_id, rp.display_name, r.reported_user_id, up.display_name, up.is_suspended,
         (select count(*)::int from reports x where x.reported_user_id = r.reported_user_id and x.status in ('open', 'reviewing')),
         r.listing_id, l.title, l.status, l.photos[1], r.offer_id
  from reports r
  join profiles rp on rp.id = r.reporter_id
  join profiles up on up.id = r.reported_user_id
  left join listings l on l.id = r.listing_id
  where (p_status = 'open' and r.status in ('open', 'reviewing'))
     or (p_status = 'closed' and r.status in ('resolved', 'dismissed'))
  order by r.created_at desc
  limit 100;
end $$;

create or replace function admin_resolve_report(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if p_status not in ('resolved', 'dismissed', 'reviewing', 'open') then
    raise exception 'Invalid status.' using errcode = '22023';
  end if;
  update reports set status = p_status::report_status, resolution_note = left(nullif(btrim(coalesce(p_note, '')), ''), 500)
  where id = p_id;
  if not found then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;
end $$;

create or replace function admin_remove_listing(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  l listings%rowtype;
  r record;
  v_all uuid[];
begin
  perform require_admin();
  select * into l from listings where id = p_id for update;
  if not found then
    raise exception 'Item not found.' using errcode = 'P0002';
  end if;
  if l.status in ('removed', 'traded') then
    return;
  end if;
  -- An accepted trade with this item is cancelled and the other items freed.
  for r in
    select * from offers o
    where o.status = 'accepted'
      and (o.target_listing_id = p_id or exists (select 1 from offer_items oi where oi.offer_id = o.id and oi.listing_id = p_id))
    for update
  loop
    select array_agg(listing_id) into v_all from offer_items where offer_id = r.id;
    v_all := coalesce(v_all, '{}') || r.target_listing_id;
    update listings set status = 'available' where id = any(v_all) and id <> p_id and status = 'reserved';
    update offers set status = 'cancelled', closed_at = now(), from_confirmed_at = null, to_confirmed_at = null where id = r.id;
    perform post_system_message(r.id, 'This swap was cancelled because an item was removed for breaking the Swap rules.');
  end loop;
  update listings set status = 'removed' where id = p_id;
  perform close_open_offers_for_listings(array[p_id], null, 'This offer closed because an item was removed.');
  perform enqueue_notification(l.owner_id, 'Item removed',
    '"' || l.title || '" was removed because it breaks the Swap rules.', jsonb_build_object('type', 'removed'));
end $$;

create or replace function admin_set_suspended(p_user uuid, p_suspended boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if require_admin() = p_user then
    raise exception 'You can''t suspend yourself.' using errcode = '22023';
  end if;
  update profiles set is_suspended = coalesce(p_suspended, false) where id = p_user and deleted_at is null;
  if not found then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
  if p_suspended then
    delete from push_tokens where user_id = p_user;
    perform close_user_offers(p_user, 'This swap closed because the other account was suspended.',
      'The other account was suspended, so this swap is closed.');
  end if;
end $$;

-- ---------- 2. rate-limited nearby search (otherwise unchanged) ----------
create or replace function nearby_listings(
  p_lat double precision, p_lng double precision, p_radius_km double precision,
  p_category text default null, p_query text default null,
  p_limit int default 30, p_offset int default 0
) returns table (
  id uuid, title text, category text, condition item_condition, looking_for text,
  photos text[], created_at timestamptz, owner_id uuid, owner_name text,
  owner_avatar text, owner_rating numeric, owner_trades int, distance_km numeric
)
language plpgsql volatile security definer set search_path = public as $$
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
  if not hit_rate_limit('nearby', cfg_int('nearby_searches_per_10min', 120), interval '10 minutes') then
    raise exception 'You are searching very fast. Wait a few minutes and try again.' using errcode = '22023';
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

-- ---------- 3. app error log ----------
create table if not exists client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  fatal boolean not null default false,
  message text not null,
  stack text,
  route text,
  build int,
  channel text,
  platform text,
  os_version text,
  device text
);
create index if not exists idx_client_errors_created on client_errors (created_at desc);
alter table client_errors enable row level security;  -- server only; read it in the dashboard

create or replace function log_client_error(
  p_message text, p_stack text default null, p_route text default null, p_fatal boolean default false,
  p_build int default null, p_channel text default null, p_platform text default null,
  p_os_version text default null, p_device text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if nullif(btrim(coalesce(p_message, '')), '') is null then
    return;
  end if;
  -- Caps so a crash loop (or abuse) can't flood the table.
  if v_uid is not null and not hit_rate_limit('client_error', 30, interval '1 hour') then
    return;
  end if;
  if (select count(*) from client_errors where created_at > now() - interval '1 hour') >= 2000 then
    return;
  end if;
  insert into client_errors (user_id, fatal, message, stack, route, build, channel, platform, os_version, device)
  values (v_uid, coalesce(p_fatal, false), left(p_message, 1000), left(p_stack, 4000), left(p_route, 200), p_build,
          left(p_channel, 20), left(p_platform, 20), left(p_os_version, 40), left(p_device, 80));
end $$;

-- ---------- 4. cleanup helpers (called by the maintenance Edge Function) ----------
-- Photos of items removed more than 7 days ago that were never part of an offer.
create or replace function release_removed_listing_photos() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  update listings l set photos = '{}'
  where l.status = 'removed' and cardinality(l.photos) > 0 and l.updated_at < now() - interval '7 days'
    and not exists (select 1 from offers o where o.target_listing_id = l.id)
    and not exists (select 1 from offer_items oi where oi.listing_id = l.id);
  get diagnostics n = row_count;
  return n;
end $$;

-- Stored files no item or profile points to any more, older than a day
-- (so an upload whose item is still being saved is never touched).
create or replace function orphan_media_paths(p_limit int default 500) returns setof text
language sql stable security definer set search_path = public, storage as $$
  with used as (
    select unnest(photos) as name from public.listings
    union all
    select regexp_replace(unnest(photos), '\.jpg$', '.t.jpg') from public.listings
    union all
    select avatar_url from public.profiles where avatar_url is not null
  )
  select o.name from storage.objects o
  where o.bucket_id = 'media'
    and o.created_at < now() - interval '1 day'
    and not exists (select 1 from used u where u.name = o.name)
  order by o.created_at
  limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;

create or replace function purge_old_rows() returns void
language sql security definer set search_path = public as $$
  delete from client_errors where created_at < now() - interval '90 days';
  delete from notification_queue where created_at < now() - interval '30 days';
  delete from rate_hits where window_start < now() - interval '2 days';
  delete from reports where status in ('resolved', 'dismissed') and updated_at < now() - interval '2 years';
$$;

-- ---------- 5. RLS: evaluate auth.uid() / is_admin() once per query ----------
drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles for update to authenticated
  using (id = (select auth.uid()) and deleted_at is null) with check (id = (select auth.uid()));

drop policy if exists blocks_own_read on blocks;
create policy blocks_own_read on blocks for select to authenticated using (blocker_id = (select auth.uid()));
drop policy if exists blocks_own_delete on blocks;
create policy blocks_own_delete on blocks for delete to authenticated using (blocker_id = (select auth.uid()));

drop policy if exists listings_read on listings;
create policy listings_read on listings for select to authenticated using (
  owner_id = (select auth.uid())
  or (status = 'available' and not is_blocked_with(owner_id))
  or exists (
    select 1 from offers o
    where (o.from_user = (select auth.uid()) or o.to_user = (select auth.uid()))
      and (o.target_listing_id = listings.id
           or exists (select 1 from offer_items oi where oi.offer_id = o.id and oi.listing_id = listings.id))
  )
);

drop policy if exists offers_read on offers;
create policy offers_read on offers for select to authenticated
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()) or (select is_admin()));

drop policy if exists offer_items_read on offer_items;
create policy offer_items_read on offer_items for select to authenticated using (
  exists (select 1 from offers o where o.id = offer_id
          and (o.from_user = (select auth.uid()) or o.to_user = (select auth.uid()) or (select is_admin())))
);

drop policy if exists messages_read on messages;
create policy messages_read on messages for select to authenticated using (
  exists (select 1 from offers o where o.id = offer_id
          and (o.from_user = (select auth.uid()) or o.to_user = (select auth.uid()) or (select is_admin())))
);

drop policy if exists reports_insert_own on reports;
create policy reports_insert_own on reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and reported_user_id <> (select auth.uid()));
drop policy if exists reports_read on reports;
create policy reports_read on reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select is_admin()));

drop policy if exists media_insert_own on storage.objects;
create policy media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists media_select_own on storage.objects;
create policy media_select_own on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists media_update_own on storage.objects;
create policy media_update_own on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists media_delete_own on storage.objects;
create policy media_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- ---------- privileges ----------
revoke all on rate_hits, client_errors from anon, authenticated;
revoke execute on function
  hit_rate_limit(text, int, interval), check_report(), notify_admins_on_report(),
  require_admin(),
  admin_reports(text), admin_resolve_report(uuid, text, text), admin_remove_listing(uuid),
  admin_set_suspended(uuid, boolean),
  nearby_listings(double precision, double precision, double precision, text, text, int, int),
  log_client_error(text, text, text, boolean, int, text, text, text, text),
  release_removed_listing_photos(), orphan_media_paths(int), purge_old_rows()
from public, anon, authenticated;
grant execute on function
  admin_reports(text), admin_resolve_report(uuid, text, text), admin_remove_listing(uuid),
  admin_set_suspended(uuid, boolean),
  nearby_listings(double precision, double precision, double precision, text, text, int, int),
  log_client_error(text, text, text, boolean, int, text, text, text, text)
to authenticated;
grant execute on function log_client_error(text, text, text, boolean, int, text, text, text, text) to anon;
grant execute on function release_removed_listing_photos(), orphan_media_paths(int), purge_old_rows() to service_role;
